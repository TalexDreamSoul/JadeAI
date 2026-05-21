import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type ToolResult = {
  structuredContent?: unknown;
  isError?: boolean;
  content?: Array<{ type: string; text: string }>;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlitePath = `/private/tmp/jadeai-resume-mcp-smoke-${process.pid}-${Date.now()}.db`;

process.chdir(projectRoot);
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_PATH = sqlitePath;
process.env.AUTH_ENABLED = 'false';
process.env.JADEAI_MCP_FINGERPRINT = 'demo-fingerprint';
process.env.ADMIN_EMAIL = 'mcp-smoke-admin@touchresume.local';
process.env.ADMIN_PASSWORD = 'mcp-smoke-admin-password';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function textOf(result: ToolResult) {
  return result.content?.map((item) => item.text).join('\n') || '';
}

function expectOk<T>(name: string, result: ToolResult): T {
  if (result.isError) {
    throw new Error(`${name} failed: ${textOf(result)}`);
  }
  return result.structuredContent as T;
}

function expectToolError(name: string, result: ToolResult, expectedText: string) {
  assert(result.isError, `${name} should fail`);
  assert(textOf(result).includes(expectedText), `${name} should include "${expectedText}"`);
}

async function withMutedConsoleLog<T>(task: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    return await task();
  } finally {
    console.log = originalLog;
  }
}

async function main() {
  const { callResumeMcpTool } = await withMutedConsoleLog(() => import('../src/lib/mcp/resume-tools'));

  const call = (name: string, args: Record<string, unknown> = {}) => callResumeMcpTool(name, args);
  const list = expectOk<{ user: { id: string }; resumes: any[] }>(
    'list_resumes',
    await withMutedConsoleLog(() => call('list_resumes')),
  );
  assert(list.resumes.length > 0, 'list_resumes should return the demo resume');

  const userId = list.user.id;
  const resumeId = list.resumes[0].id;
  const resume = expectOk<{ resume: { sections: any[] } }>('get_resume', await call('get_resume', { resumeId })).resume;
  const summarySection = resume.sections.find((section) => section.type === 'summary');
  assert(summarySection, 'get_resume should include a summary section');

  const { analysisRepository } = await import('../src/lib/db/repositories/analysis.repository');
  const { chatRepository } = await import('../src/lib/db/repositories/chat.repository');
  const { knowledgeRepository } = await import('../src/lib/db/repositories/knowledge.repository');
  const { userProfileMemoryRepository } = await import('../src/lib/db/repositories/user-profile-memory.repository');

  const jdAnalysis = await analysisRepository.createJdAnalysis({
    resumeId,
    jobDescription: 'Next.js TypeScript performance optimization role',
    result: {
      overallScore: 82,
      atsScore: 86,
      keywordMatches: ['Next.js', 'TypeScript'],
      missingKeywords: ['observability'],
      suggestions: [],
      applicableSuggestions: [],
      summary: 'Smoke seeded JD analysis',
    },
    overallScore: 82,
    atsScore: 86,
  });
  assert(jdAnalysis?.id, 'seed JD analysis should be created');

  const skillNode = await knowledgeRepository.createNode({
    userId,
    resumeId,
    type: 'skill',
    label: 'Next.js',
    content: 'Next.js and TypeScript delivery evidence',
  });
  const projectNode = await knowledgeRepository.createNode({
    userId,
    resumeId,
    type: 'project',
    label: 'Performance Optimization',
    content: 'Reduced LCP from 3.2s to 1.1s',
  });
  assert(skillNode?.id && projectNode?.id, 'knowledge nodes should be created');
  await knowledgeRepository.createEdge({
    userId,
    fromNodeId: skillNode.id,
    toNodeId: projectNode.id,
    relation: 'evidenced_by',
  });
  await userProfileMemoryRepository.create({
    userId,
    type: 'skill_evidence',
    title: 'Next.js performance memory',
    content: 'Candidate has measurable Next.js performance optimization evidence.',
    source: 'mcp-smoke',
    confidence: 95,
  });
  const chatSession = await chatRepository.createSession({ resumeId, title: 'MCP resume planning' });
  assert(chatSession?.id, 'chat session should be created');
  await chatRepository.addMessage({
    sessionId: chatSession.id,
    role: 'user',
    content: '我主导实现 JadeAI Resume MCP，需要把项目加入简历，并补充 Next.js 和 TypeScript 的量化成果。',
  });
  await chatRepository.addMessage({
    sessionId: chatSession.id,
    role: 'assistant',
    content: '建议下一步补充指标、创建项目草稿，并用 create_resume_version 后再写入 section。',
  });

  const analyses = expectOk<{ analyses: any[] }>('list_jd_analyses', await call('list_jd_analyses', { resumeId }));
  assert(analyses.analyses.some((analysis) => analysis.id === jdAnalysis.id), 'list_jd_analyses should include seeded analysis');
  const analysis = expectOk<{ analysis: { id: string } }>('get_jd_analysis', await call('get_jd_analysis', { analysisId: jdAnalysis.id }));
  assert(analysis.analysis.id === jdAnalysis.id, 'get_jd_analysis should return the seeded analysis');

  const knowledge = expectOk<{ nodes: any[]; memories: any[]; mindmap: any[] }>(
    'search_knowledge',
    await call('search_knowledge', { resumeId, query: 'Next.js' }),
  );
  assert(knowledge.nodes.length > 0, 'search_knowledge should return matching nodes');
  assert(knowledge.memories.length > 0, 'search_knowledge should return matching personal memories');
  assert(Array.isArray(knowledge.mindmap), 'search_knowledge should include mindmap data');
  const readiness = expectOk<{ overallScore: number; sections: any[]; knowledge: { mindmap: any[] }; recommendedQuestions: string[] }>(
    'analyze_resume_readiness',
    await call('analyze_resume_readiness', {
      resumeId,
      analysisId: jdAnalysis.id,
      targetRole: 'Frontend Platform Engineer',
      jobDescription: 'Next.js TypeScript observability performance optimization',
    }),
  );
  assert(readiness.overallScore >= 0 && readiness.overallScore <= 100, 'analyze_resume_readiness should return a bounded score');
  assert(readiness.sections.length > 0, 'analyze_resume_readiness should return section readiness');
  assert(Array.isArray(readiness.knowledge.mindmap), 'analyze_resume_readiness should return mindmap data');
  assert(readiness.recommendedQuestions.length > 0, 'analyze_resume_readiness should return follow-up questions');
  const contextPack = expectOk<{ resume: { id: string; sections: any[] }; analyses: any[]; readiness: { overallScore: number }; knowledge: { mindmap: any[]; memories: any[] }; suggestedAgentActions: any[] }>(
    'get_resume_context_pack',
    await call('get_resume_context_pack', {
      resumeId,
      analysisId: jdAnalysis.id,
      targetRole: 'Frontend Platform Engineer',
      includeChats: true,
    }),
  );
  assert(contextPack.resume.id === resumeId, 'get_resume_context_pack should include resume identity');
  assert(contextPack.resume.sections.length > 0, 'get_resume_context_pack should include section summaries');
  assert(contextPack.analyses.some((item) => item.id === jdAnalysis.id), 'get_resume_context_pack should include JD analyses');
  assert(contextPack.readiness.overallScore >= 0, 'get_resume_context_pack should include readiness');
  assert(Array.isArray(contextPack.knowledge.mindmap), 'get_resume_context_pack should include mindmap');
  assert(contextPack.knowledge.memories.length > 0, 'get_resume_context_pack should include personal memories');
  assert(contextPack.suggestedAgentActions.length > 0, 'get_resume_context_pack should include safe next actions');
  const projectDraft = expectOk<{ mode: string; project: { name: string; technologies: string[] }; preview: { diff: { changed: boolean; after: any } }; nextMcpSteps: string[] }>(
    'draft_project_for_resume',
    await call('draft_project_for_resume', {
      resumeId,
      projectName: 'JadeAI Resume MCP',
      description: 'Local MCP workflow for reading resumes, JD analysis, knowledge graph, and safe versioned resume edits.',
      role: 'Designed and implemented MCP tools',
      impact: 'Enabled local agents to participate in resume workflows with preview-first safety gates',
      technologies: ['Next.js', 'TypeScript', 'MCP', 'SQLite'],
      highlights: ['Built read-only context tools and version-protected write previews', 'Added repeatable smoke checks for MCP workflows'],
    }),
  );
  assert(projectDraft.mode === 'preview', 'draft_project_for_resume should return preview mode');
  assert(projectDraft.project.name === 'JadeAI Resume MCP', 'draft_project_for_resume should include project draft');
  assert(projectDraft.preview.diff.changed === true, 'draft_project_for_resume should include changed diff');
  assert(projectDraft.nextMcpSteps.some((step) => step.includes('create_resume_version')), 'draft_project_for_resume should point to safe write steps');
  const chatList = expectOk<{ sessions: any[] }>('list_resume_chats', await call('list_resume_chats', { resumeId }));
  assert(chatList.sessions.some((session) => session.id === chatSession.id), 'list_resume_chats should include seeded session');
  const chat = expectOk<{ session: { id: string; messages: any[] } }>('get_resume_chat', await call('get_resume_chat', { resumeId, sessionId: chatSession.id }));
  assert(chat.session.messages.length >= 2, 'get_resume_chat should include messages');
  const chatSummary = expectOk<{ sessionCount: number; actionItems: any[]; memoryDrafts: any[]; followUpQuestions: string[] }>(
    'summarize_resume_chats',
    await call('summarize_resume_chats', { resumeId, limit: 5 }),
  );
  assert(chatSummary.sessionCount > 0, 'summarize_resume_chats should count sessions');
  assert(chatSummary.actionItems.length > 0, 'summarize_resume_chats should extract action items');
  assert(chatSummary.memoryDrafts.length > 0, 'summarize_resume_chats should propose memory drafts');
  assert(chatSummary.followUpQuestions.length > 0, 'summarize_resume_chats should include follow-up questions');

  const originalText = String(summarySection.content.text || '');
  const updatedText = `${originalText}\nMCP smoke update.`;
  const updateContent = { ...summarySection.content, text: updatedText };
  const updateArgs = { resumeId, sectionId: summarySection.id, content: updateContent };
  const updatePreview = expectOk<any>('update_resume_section preview', await call('update_resume_section', updateArgs));
  assert(updatePreview.mode === 'preview', 'update_resume_section should default to preview');
  assert(updatePreview.preview.diff.changed === true, 'update_resume_section preview should include changed diff');
  expectToolError(
    'update_resume_section without version',
    await call('update_resume_section', { ...updateArgs, apply: true }),
    'valid versionId',
  );

  const updateVersion = expectOk<{ version: { id: string } }>(
    'create_resume_version for update',
    await call('create_resume_version', { resumeId, label: 'mcp-smoke-before-update' }),
  );
  const updateApplied = expectOk<any>(
    'update_resume_section apply',
    await call('update_resume_section', { ...updateArgs, apply: true, versionId: updateVersion.version.id }),
  );
  assert(updateApplied.mode === 'applied', 'update_resume_section should apply with versionId');
  assert(updateApplied.afterVersion?.id, 'update_resume_section should create an after version');

  const suggestion = {
    sectionType: 'summary',
    targetField: 'text',
    current: updatedText,
    suggested: `${updatedText}\nMCP smoke suggestion.`,
    reason: 'Smoke verifies suggestion application with version protection.',
    evidenceRequired: false,
  };
  const suggestionPreview = expectOk<any>(
    'apply_suggestion preview',
    await call('apply_suggestion', { resumeId, suggestion }),
  );
  assert(suggestionPreview.mode === 'preview', 'apply_suggestion should default to preview');
  expectToolError(
    'apply_suggestion without version',
    await call('apply_suggestion', { resumeId, suggestion, apply: true }),
    'valid versionId',
  );
  const suggestionVersion = expectOk<{ version: { id: string } }>(
    'create_resume_version for suggestion',
    await call('create_resume_version', { resumeId, label: 'mcp-smoke-before-suggestion' }),
  );
  const suggestionApplied = expectOk<any>(
    'apply_suggestion apply',
    await call('apply_suggestion', { resumeId, suggestion, apply: true, versionId: suggestionVersion.version.id }),
  );
  assert(suggestionApplied.mode === 'applied', 'apply_suggestion should apply with versionId');
  assert(suggestionApplied.afterVersion?.id, 'apply_suggestion should create an after version');

  const rolePreview = expectOk<any>(
    'create_role_resume preview',
    await call('create_role_resume', { resumeId, targetJobTitle: 'Frontend Platform Engineer' }),
  );
  assert(rolePreview.mode === 'preview', 'create_role_resume should default to preview');
  expectToolError(
    'create_role_resume without version',
    await call('create_role_resume', { resumeId, targetJobTitle: 'Frontend Platform Engineer', apply: true }),
    'valid versionId',
  );
  const roleVersion = expectOk<{ version: { id: string } }>(
    'create_resume_version for role resume',
    await call('create_resume_version', { resumeId, label: 'mcp-smoke-before-role-resume' }),
  );
  const roleApplied = expectOk<any>(
    'create_role_resume apply',
    await call('create_role_resume', {
      resumeId,
      targetJobTitle: 'Frontend Platform Engineer',
      apply: true,
      versionId: roleVersion.version.id,
    }),
  );
  assert(roleApplied.mode === 'applied', 'create_role_resume should apply with versionId');
  assert(roleApplied.resume?.id && roleApplied.resume.id !== resumeId, 'create_role_resume should create a new resume');
  assert(roleApplied.version?.id, 'create_role_resume should create a version for the new resume');

  console.log(JSON.stringify({
    ok: true,
    sqlitePath,
    resumeId,
    jdAnalysisId: jdAnalysis.id,
    verifiedTools: [
      'list_resumes',
      'get_resume',
      'list_jd_analyses',
      'get_jd_analysis',
      'search_knowledge',
      'analyze_resume_readiness',
      'get_resume_context_pack',
      'draft_project_for_resume',
      'list_resume_chats',
      'get_resume_chat',
      'summarize_resume_chats',
      'create_resume_version',
      'update_resume_section',
      'apply_suggestion',
      'create_role_resume',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
