import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { isLocalResumeId } from '@/lib/local-resumes';
import { getResumeSectionsContext, normalizeResumeSnapshot } from '@/lib/ai/resume-snapshot';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { createExecutableTools } from '@/lib/ai/tools';
import { userProfileMemoryRepository } from '@/lib/db/repositories/user-profile-memory.repository';

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
    const model = getModel(aiConfig, modelId);
    const modelMessages = await convertToModelMessages(messages);

    // Truncate to last N rounds for LLM context
    const truncatedMessages = modelMessages.slice(-MAX_MESSAGES);

    const tools = resumeId && !localResume ? createExecutableTools(resumeId, aiConfig) : undefined;

    let memoryContext = '';
    if (user && !localResume) {
      const memories = await userProfileMemoryRepository.listByUserId(user.id, 12).catch(() => []);
      memoryContext = memories
        .map((memory: ProfileMemoryLike) => `- [${memory.type}] ${memory.title}: ${memory.content}`)
        .join('\n');
    }

    const result = streamText({
      model,
      system: getSystemPrompt(resumeContext, memoryContext),
      messages: truncatedMessages,
      tools,
      stopWhen: tools ? stepCountIs(25) : undefined,
      providerOptions: getProviderOptions(aiConfig),
      onFinish: async ({ text, steps }) => {
        if (user && aiConfig.mode === 'server') {
          await userRepository.consumeAICredit(user.id);
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
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof AIConfigError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401 });
    }
    console.error('POST /api/ai/chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
