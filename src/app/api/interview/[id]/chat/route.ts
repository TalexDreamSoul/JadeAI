import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages } from 'ai';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { buildInterviewSystemPrompt } from '@/lib/ai/interview-prompts';
import { dbReady } from '@/lib/db';
import type { InterviewerConfig } from '@/types/interview';
import { completeAIUsage, refundAIUsage } from '@/lib/commercial/ai-metering-service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbReady;
    const { id: sessionId } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const session = await interviewRepository.findSession(sessionId);
    if (!session || session.userId !== user.id) {
      return new Response('Not found', { status: 404 });
    }

    const { messages, roundId, model: modelId, locale = 'zh' } = await request.json();

    const round = await interviewRepository.findRound(roundId);
    if (!round || round.sessionId !== sessionId) {
      return new Response('Round not found', { status: 404 });
    }

    let resumeContent: string | undefined;
    let resumeStyle: string | undefined;
    if (session.resumeId) {
      const resume = await resumeRepository.findById(session.resumeId as string);
      if (resume) {
        resumeContent = JSON.stringify(resume.sections);
        resumeStyle = JSON.stringify({
          template: resume.template,
          themeConfig: resume.themeConfig,
          targetCompany: resume.targetCompany,
          targetJobTitle: resume.targetJobTitle,
          jobDescription: resume.jobDescription,
        });
      }
    }

    const interviewerConfig = round.interviewerConfig as InterviewerConfig;

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const textPart = lastMessage.parts?.find((p: { type: string }) => p.type === 'text');
        const content = textPart?.text || lastMessage.content || '';
        if (content) {
          await interviewRepository.addMessage({
            roundId,
            role: 'candidate',
            content,
          });
        }
      }
    }

    const aiConfig = await extractAIConfig(request);
    const model = getModel(aiConfig, modelId);
    const modelMessages = await convertToModelMessages(messages);

    if (round.status === 'pending') {
      await interviewRepository.updateRoundStatus(roundId, 'in_progress');
      await interviewRepository.updateSessionStatus(sessionId, 'in_progress');
    }

    const systemPrompt = buildInterviewSystemPrompt({
      interviewer: interviewerConfig,
      jobDescription: session.jobDescription,
      resumeContent,
      resumeStyle,
      maxQuestions: round.maxQuestions,
      locale,
    });

    const aiUsage = aiConfig.mode === 'server'
      ? await userRepository.reserveAICredit(user.id, {
        feature: 'interview.chat',
        aiConfig: { ...aiConfig, model: modelId || aiConfig.model },
        metadata: { sessionId, roundId, interviewerType: round.interviewerType },
      })
      : { ok: true as const, reservation: null };

    if (!aiUsage.ok) {
      return new Response(JSON.stringify({ error: aiUsage.error }), { status: 402 });
    }

    let settledUsage = false;
    const refundOnce = async (error: unknown) => {
      if (settledUsage) return;
      settledUsage = true;
      await refundAIUsage(aiUsage.reservation, error, { sessionId, roundId, interviewerType: round.interviewerType })
        .catch((refundError) => console.error('[ai-metering] interview chat refund failed:', refundError));
    };

    const result = await (async () => {
      try {
        return streamText({
        model,
        system: systemPrompt,
        messages: modelMessages,
        providerOptions: getProviderOptions(aiConfig),
        onFinish: async ({ text, usage }) => {
          if (!settledUsage) {
            settledUsage = true;
            await completeAIUsage(aiUsage.reservation, usage, { sessionId, roundId, interviewerType: round.interviewerType });
          }
          if (!text) return;

          await interviewRepository.addMessage({
            roundId,
            role: 'interviewer',
            content: text,
          });

          await interviewRepository.incrementQuestionCount(roundId);

          if (text.includes('[ROUND_COMPLETE]')) {
            await interviewRepository.setRoundSummary(roundId, {
              score: 0,
              feedback: text.replace('[ROUND_COMPLETE]', '').trim(),
            });

            const rounds = await interviewRepository.findRoundsBySessionId(sessionId);
            const currentIndex = rounds.findIndex((r: { id: string }) => r.id === roundId);
            const nextRound = rounds[currentIndex + 1];

            if (nextRound) {
              await interviewRepository.updateSessionRound(sessionId, currentIndex + 1);
            } else {
              await interviewRepository.updateSessionStatus(sessionId, 'completed');
            }
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
    console.error('POST /api/interview/[id]/chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
