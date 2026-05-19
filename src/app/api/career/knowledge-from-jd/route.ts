import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { knowledgeRepository } from '@/lib/db/repositories/knowledge.repository';
import { userProfileMemoryRepository } from '@/lib/db/repositories/user-profile-memory.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

const inputSchema = z.object({
  resumeId: z.string().min(1),
  jobTitle: z.string().optional(),
  jobDescription: z.string().min(1),
  missingKeywords: z.array(z.string()).optional().default([]),
  keywordMatches: z.array(z.string()).optional().default([]),
  interviewQuestions: z.array(z.string()).optional().default([]),
});

function takeUnique(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { resumeId, jobTitle, jobDescription, missingKeywords, keywordMatches, interviewQuestions } = parsed.data;
    const resume = await resumeRepository.findById(resumeId);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const root = await knowledgeRepository.createNode({
      userId: user.id,
      resumeId,
      type: 'jd_keyword',
      label: jobTitle || resume.targetJobTitle || '目标 JD',
      content: jobDescription.slice(0, 1600),
      metadata: { source: 'career-workbench' },
    });

    const createdNodes = root ? [root] : [];
    const gapKeywords = takeUnique(missingKeywords, 10);
    const matchedKeywords = takeUnique(keywordMatches, 8);
    const questions = takeUnique(interviewQuestions, 6);

    for (const keyword of gapKeywords) {
      const node = await knowledgeRepository.createNode({
        userId: user.id,
        resumeId,
        type: 'learning_task',
        label: keyword,
        content: `补齐 ${keyword}：整理概念、项目证据、常见追问，并补充到目标职位版本。`,
        metadata: { source: 'jd-analysis', status: 'missing' },
      });
      if (node && root) {
        createdNodes.push(node);
        await knowledgeRepository.createEdge({
          userId: user.id,
          fromNodeId: node.id,
          toNodeId: root.id,
          relation: 'missing_for',
        });
      }
    }

    for (const keyword of matchedKeywords) {
      const node = await knowledgeRepository.createNode({
        userId: user.id,
        resumeId,
        type: 'skill',
        label: keyword,
        content: `已在简历中体现：${keyword}`,
        metadata: { source: 'jd-analysis', status: 'matched' },
      });
      if (node && root) {
        createdNodes.push(node);
        await knowledgeRepository.createEdge({
          userId: user.id,
          fromNodeId: node.id,
          toNodeId: root.id,
          relation: 'evidenced_by',
        });
      }
    }

    for (const question of questions) {
      const node = await knowledgeRepository.createNode({
        userId: user.id,
        resumeId,
        type: 'question',
        label: question.slice(0, 80),
        content: question,
        metadata: { source: 'job-template' },
      });
      if (node && root) {
        createdNodes.push(node);
        await knowledgeRepository.createEdge({
          userId: user.id,
          fromNodeId: node.id,
          toNodeId: root.id,
          relation: 'prepares_for',
        });
      }
    }

    if (gapKeywords.length > 0) {
      await userProfileMemoryRepository.create({
        userId: user.id,
        type: 'interview_gap',
        title: `${jobTitle || resume.targetJobTitle || '目标职位'} 缺口`,
        content: gapKeywords.join('、'),
        source: 'jd-analysis',
        confidence: 85,
        metadata: { resumeId },
      }).catch(() => null);
    }

    return NextResponse.json({ nodes: createdNodes }, { status: 201 });
  } catch (error) {
    console.error('POST /api/career/knowledge-from-jd error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
