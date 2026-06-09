import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError, resolveAllowedAIModelId } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { isLocalResumeId } from '@/lib/local-resumes';
import { getResumeSectionsContext, normalizeResumeSnapshot } from '@/lib/ai/resume-snapshot';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { createExecutableTools } from '@/lib/ai/tools';
import { userProfileMemoryRepository } from '@/lib/db/repositories/user-profile-memory.repository';
import { completeAIUsage, refundAIUsage } from '@/lib/commercial/ai-metering-service';

const MAX_ROUNDS = 10;
const MAX_MESSAGES = MAX_ROUNDS * 2; // 10 rounds = 20 messages (user + assistant)

type ToolCallLike = {
  toolName?: string;
  input?: unknown;
};

type ToolResultLike = {
  output?: unknown;
};

type ProfileMemoryLike = {
  type: string;
  title: string;
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);

    const { messages, resumeId, model: modelId, sessionId, resume: resumeSnapshot } = await request.json();
    const localResume = resumeId && isLocalResumeId(resumeId)
      ? normalizeResumeSnapshot(resumeSnapshot, resumeId)
      : null;

    if (!user && !localResume) {
      return new Response('Unauthorized', { status: 401 });
    }

    let resumeContext = '';
    if (localResume) {
      resumeContext = getResumeSectionsContext(localResume);
    } else if (resumeId) {
      const resume = await resumeRepository.findById(resumeId);
      if (resume) {
        if (user && resume.userId !== user.id) {
          return new Response('Forbidden', { status: 403 });
        }
        resumeContext = JSON.stringify(resume.sections);
      }
    }

    // Save user message to DB before streaming
    if (!localResume && sessionId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const textPart = lastMessage.parts?.find((p: { type: string }) => p.type === 'text');
        const content = textPart?.text || lastMessage.content || '';
        if (content) {
          // First user message in this session → set as session title
          const userMessages = messages.filter((m: { role: string }) => m.role === 'user');
          if (userMessages.length === 1) {
            const title = content.slice(0, 50);
            await chatRepository.updateSessionTitle(sessionId, title);
          }

          await chatRepository.addMessage({
            sessionId,
            role: 'user',
            content,
          });
        }
      }
    }

    const aiConfig = await extractAIConfig(request);
    const effectiveModelId = await resolveAllowedAIModelId(request, aiConfig, modelId);
    const model = getModel(aiConfig, effectiveModelId);
    const modelMessages = await convertToModelMessages(messages);

    // Truncate to last N rounds for LLM context
    const truncatedMessages = modelMessages.slice(-MAX_MESSAGES);

    const tools = resumeId && !localResume
      ? createExecutableTools(resumeId, aiConfig, user?.id)
      : undefined;

    let memoryContext = '';
    if (user && !localResume) {
      const memories = await userProfileMemoryRepository.listByUserId(user.id, 12).catch(() => []);
      memoryContext = memories
        .map((memory: ProfileMemoryLike) => `- [${memory.type}] ${memory.title}: ${memory.content}`)
        .join('\n');
    }

    const aiUsage = user && aiConfig.mode === 'server'
      ? await userRepository.reserveAICredit(user.id, {
        feature: 'resume.chat',
        aiConfig: { ...aiConfig, model: effectiveModelId },
        metadata: { resumeId: resumeId || null, sessionId: sessionId || null },
      })
      : { ok: true as const, reservation: null };

    if (!aiUsage.ok) {
      return new Response(JSON.stringify({ error: aiUsage.error }), { status: 402 });
    }

    let settledUsage = false;
    const refundOnce = async (error: unknown) => {
      if (settledUsage) return;
      settledUsage = true;
      await refundAIUsage(aiUsage.reservation, error, { resumeId: resumeId || null, sessionId: sessionId || null })
        .catch((refundError) => console.error('[ai-metering] chat refund failed:', refundError));
    };

    const result = await (async () => {
      try {
        return streamText({
        model,
        system: getSystemPrompt(resumeContext, memoryContext),
        messages: truncatedMessages,
        tools,
        stopWhen: tools ? stepCountIs(25) : undefined,
        providerOptions: getProviderOptions(aiConfig),
        onFinish: async ({ text, steps, usage }) => {
          if (!settledUsage) {
            settledUsage = true;
            await completeAIUsage(aiUsage.reservation, usage, {
              resumeId: resumeId || null,
              sessionId: sessionId || null,
              stepCount: steps.length,
            });
          }
          if (localResume || !sessionId) return;

          // Build ordered parts array preserving the interleaving of text and tool calls
          const orderedParts: ({ type: 'text'; text: string } | { type: 'tool'; toolName: string; args: unknown; result: unknown })[] = [];

          for (const step of steps) {
            if (step.text) {
              orderedParts.push({ type: 'text', text: step.text });
            }
            const tcs = step.toolCalls ?? [];
            const trs = step.toolResults ?? [];
            for (let i = 0; i < tcs.length; i++) {
              const toolCall = tcs[i] as ToolCallLike;
              const toolResult = trs[i] as ToolResultLike | undefined;
              orderedParts.push({
                type: 'tool',
                toolName: toolCall.toolName || 'tool',
                args: toolCall.input,
                result: toolResult?.output,
              });
            }
          }

          const fullText = text || '';
          if (fullText || orderedParts.some((p) => p.type === 'tool')) {
            await chatRepository.addMessage({
              sessionId,
              role: 'assistant',
              content: fullText,
              metadata: orderedParts.length > 0 ? { orderedParts } : {},
            });
          }
        },
        onError: async ({ error }) => {
          await refundOnce(error);
        },
        onAbort: async () => {
          await refundOnce(new Error('AI stream aborted'));
        },
        });
      } catch (error) {
        await refundOnce(error);
        throw error;
      }
    })();

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof AIConfigError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401 });
    }
    console.error('POST /api/ai/chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
