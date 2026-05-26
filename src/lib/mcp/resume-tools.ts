import { DEFAULT_TEMPLATE } from '../constants';
import { buildSuggestionUpdate } from '../career/suggestion-application';
import { JOB_TEMPLATES, type JobTemplate } from '../career/job-templates';
import { applicableSuggestionSchema, type ApplicableSuggestion } from '../ai/jd-analysis-schema';
import { dbReady } from '../db';
import { shareRepository } from '../db/repositories/share.repository';
import { generateShareToken } from '../utils/share';
import { diffResumes, resumeSectionPlainText } from '../resume-version-utils';
import { analysisRepository } from '../db/repositories/analysis.repository';
import { chatRepository } from '../db/repositories/chat.repository';
import { jobTemplateRepository, toJobTemplate } from '../db/repositories/job-template.repository';
import { knowledgeRepository } from '../db/repositories/knowledge.repository';
import { resumeRepository } from '../db/repositories/resume.repository';
import { userProfileMemoryRepository } from '../db/repositories/user-profile-memory.repository';
import { userRepository } from '../db/repositories/user.repository';
import { generateJsonWithRetry } from '../ai/generate-json';
import { getModel, getProviderOptions, type AIConfig } from '../ai/provider';
import { textAnnotationSchema, type TextAnnotationResult } from '../ai/text-annotation-schema';
import type { ResumeSection } from '../../types/resume';

export type McpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

type McpUser = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type ResumeMcpToolContext = {
  user?: McpUser;
};

type OwnedResume = NonNullable<Awaited<ReturnType<typeof resumeRepository.findById>>>;
type ResumeListItem = Awaited<ReturnType<typeof resumeRepository.findAllByUserId>>[number];
type ResumeVersion = Awaited<ReturnType<typeof resumeRepository.findVersions>>[number];
type ResumeShare = Awaited<ReturnType<typeof shareRepository.findByResumeId>>[number];
type KnowledgeNode = Awaited<ReturnType<typeof knowledgeRepository.listNodes>>[number];
type KnowledgeEdge = Awaited<ReturnType<typeof knowledgeRepository.listEdges>>[number];
type UserProfileMemory = Awaited<ReturnType<typeof userProfileMemoryRepository.listByUserId>>[number];
type ResumeChatSession = Awaited<ReturnType<typeof chatRepository.findSessionsByResumeId>>[number];
type ResumeChatWithMessages = NonNullable<Awaited<ReturnType<typeof chatRepository.findSessionWithMessages>>>;
type ResumeChatMessage = ResumeChatWithMessages['messages'][number];

type ToolHandlerContext = Required<ResumeMcpToolContext>;

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, context: ToolHandlerContext) => Promise<unknown>;
};

type SectionReadiness = {
  sectionType: string;
  score: number;
  strengths: string[];
  gaps: string[];
};

const JSON_OBJECT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
};

function stringArg(args: Record<string, unknown>, key: string, required = true): string {
  const value = args[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!required) return '';
  throw new Error(`${key} is required`);
}

function boolArg(args: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = args[key];
  return typeof value === 'boolean' ? value : fallback;
}

function numberArg(args: Record<string, unknown>, key: string, fallback: number, max: number): number {
  const value = args[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.trunc(value), max));
}

function objectArg(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = args[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${key} must be an object`);
}

function toJsonResult(value: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function toErrorResult(error: unknown): McpToolResult {
  const message = error instanceof Error ? error.message : 'Unknown MCP tool error';
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: { error: message },
    isError: true,
  };
}

function lowerText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLowerCase();
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return String(value).toLowerCase();
  }
}

function summarizeDiff(before: unknown, after: unknown) {
  return {
    changed: JSON.stringify(before) !== JSON.stringify(after),
    before,
    after,
  };
}

function sectionPreview(section: ResumeSection, content: unknown) {
  return {
    resumeId: section.resumeId,
    sectionId: section.id,
    sectionType: section.type,
    sectionTitle: section.title,
    diff: summarizeDiff(section.content, content),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recordsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim())
    : [];
}

function textOfValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function arrayArg(args: Record<string, unknown>, key: string): unknown[] {
  const value = args[key];
  return Array.isArray(value) ? value : [];
}

function optionalObjectArg(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = args[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compactText(value: unknown, maxLength = 6000) {
  return truncateText(textOfValue(value).replace(/\s+/g, ' ').trim(), maxLength);
}

function resumeSectionText(section: ResumeSection) {
  return resumeSectionPlainText(section);
}

function findTextInSections(sections: ResumeSection[], text: string, sectionId?: string, sectionType?: string) {
  const needle = text.trim();
  if (!needle) return null;
  const candidates = sections.filter((section) => {
    if (sectionId && section.id !== sectionId) return false;
    if (sectionType && section.type !== sectionType) return false;
    return true;
  });
  const normalizedNeedle = needle.replace(/\s+/g, ' ').toLowerCase();
  return candidates.find((section) => resumeSectionText(section).replace(/\s+/g, ' ').toLowerCase().includes(normalizedNeedle)) || null;
}

function inferSectionFromAnalysis(section: unknown, sections: ResumeSection[]) {
  const value = textOfValue(section).toLowerCase();
  if (!value) return null;
  return sections.find((item) => (
    item.id.toLowerCase() === value
    || item.type.toLowerCase() === value
    || item.title.toLowerCase() === value
    || item.title.toLowerCase().includes(value)
    || value.includes(item.type.toLowerCase())
    || value.includes(item.title.toLowerCase())
  )) || null;
}

function normalizeTextAnnotations(result: TextAnnotationResult, sections: ResumeSection[], selectedText: string, fallbackSection?: ResumeSection | null) {
  const fallbackId = fallbackSection?.id || null;
  return recordsOf(result.annotations).map((item, index) => {
    const inferred = inferSectionFromAnalysis(item.section, sections);
    const quote = compactText(item.quote || selectedText, 800);
    const quoteSection = quote ? findTextInSections(sections, quote) : null;
    return {
      id: textOfValue(item.id) || `ann-${index + 1}`,
      section: textOfValue(item.section || inferred?.title || quoteSection?.title || fallbackSection?.title || ''),
      sectionId: textOfValue(item.sectionId || inferred?.id || quoteSection?.id || fallbackId || ''),
      quote,
      severity: textOfValue(item.severity || 'medium'),
      category: textOfValue(item.category || 'analysis'),
      comment: compactText(item.comment, 1600),
      suggestion: compactText(item.suggestion, 1600),
      evidence: compactText(item.evidence, 1200),
    };
  }).filter((item) => item.comment || item.suggestion || item.quote);
}

function buildAnnotationMarkdown(annotation: Record<string, unknown>) {
  const parts = [
    textOfValue(annotation.category) ? `类别：${textOfValue(annotation.category)}` : '',
    textOfValue(annotation.severity) ? `优先级：${textOfValue(annotation.severity)}` : '',
    textOfValue(annotation.comment) ? `分析：${textOfValue(annotation.comment)}` : '',
    textOfValue(annotation.suggestion) ? `建议：${textOfValue(annotation.suggestion)}` : '',
    textOfValue(annotation.evidence) ? `依据：${textOfValue(annotation.evidence)}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

function hasMetric(value: unknown) {
  return /(\d+(\.\d+)?\s*(%|倍|x|X|ms|s|秒|人|万|k|K|个|次|年|月)|from\s+\d+[\s\S]*to\s+\d+)/.test(textOfValue(value));
}

function pushTermTokens(value: unknown, terms: Set<string>, stopWords: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) pushTermTokens(item, terms, stopWords);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) pushTermTokens(item, terms, stopWords);
    return;
  }
  if (typeof value !== 'string') return;

  for (const token of value.split(/[\s,，、;；。.\n\r/|()[\]{}:：]+/)) {
    const normalized = token.trim().replace(/^["'`]+|["'`]+$/g, '');
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (key.length < 2 || stopWords.has(key)) continue;
    terms.add(normalized);
    if (terms.size >= 24) return;
  }
}

function targetTerms(...sources: unknown[]): string[] {
  const stopWords = new Set(['and', 'or', 'the', 'with', 'for', 'to', 'of', 'in', 'on', 'a', 'an', 'role', 'job']);
  const terms = new Set<string>();
  for (const source of sources) {
    pushTermTokens(source, terms, stopWords);
    if (terms.size >= 24) return Array.from(terms);
  }
  return Array.from(terms);
}

function truncateText(value: unknown, maxLength = 1000) {
  const text = textOfValue(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function splitListText(value: string): string[] {
  return value
    .split(/[,，、;；\n]/)
    .map((item) => item.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean);
}

function summarizeAnalysisResult(result: unknown) {
  const data = asRecord(result);
  return {
    overallScore: data.overallScore,
    atsScore: data.atsScore,
    keywordMatches: stringsOf(data.keywordMatches).slice(0, 30),
    missingKeywords: stringsOf(data.missingKeywords).slice(0, 30),
    summary: truncateText(data.summary, 1200),
    suggestions: recordsOf(data.suggestions).slice(0, 10),
    applicableSuggestions: recordsOf(data.applicableSuggestions).slice(0, 10),
  };
}

function summarizeKnowledgeNode(node: KnowledgeNode) {
  return {
    id: node.id,
    resumeId: node.resumeId,
    type: node.type,
    label: node.label,
    content: truncateText(node.content, 800),
    metadata: node.metadata,
  };
}

function summarizeMemory(memory: UserProfileMemory) {
  return {
    id: memory.id,
    type: memory.type,
    title: memory.title,
    content: truncateText(memory.content, 800),
    source: memory.source,
    confidence: memory.confidence,
    metadata: memory.metadata,
    updatedAt: memory.updatedAt,
  };
}

function buildProjectDraft(args: Record<string, unknown>, language?: string | null) {
  const projectName = stringArg(args, 'projectName');
  const description = stringArg(args, 'description');
  const url = stringArg(args, 'url', false);
  const startDate = stringArg(args, 'startDate', false);
  const endDate = stringArg(args, 'endDate', false);
  const role = stringArg(args, 'role', false);
  const impact = stringArg(args, 'impact', false);
  const rawTechnologies = args.technologies;
  const rawHighlights = args.highlights;
  const technologies = Array.isArray(rawTechnologies)
    ? stringsOf(rawTechnologies)
    : splitListText(textOfValue(rawTechnologies));
  const highlights = Array.isArray(rawHighlights)
    ? stringsOf(rawHighlights)
    : splitListText(textOfValue(rawHighlights));
  const defaultHighlight = [
    role ? `${language === 'en' ? 'Owned' : '负责'} ${role}` : '',
    impact,
  ].filter(Boolean).join(language === 'en' ? '; ' : '；');

  return {
    id: crypto.randomUUID(),
    name: projectName,
    ...(url ? { url } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    description: truncateText(description, 500),
    technologies: technologies.slice(0, 16),
    highlights: (highlights.length > 0 ? highlights : defaultHighlight ? [defaultHighlight] : []).slice(0, 8),
    source: 'mcp-preview',
  };
}

function extractKeywordsFromText(value: string, limit = 10) {
  const stopWords = new Set(['and', 'the', 'for', 'with', 'that', 'this', 'have', 'from', 'resume', 'project', '简历', '项目', '这个', '那个', '我们', '一个']);
  const counts = new Map<string, number>();
  for (const token of value.split(/[\s,，、;；。.!！？?\n\r/|()[\]{}:：]+/)) {
    const normalized = token.trim();
    if (normalized.length < 2) continue;
    const key = normalized.toLowerCase();
    if (stopWords.has(key)) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

function actionItemsFromMessages(messages: ResumeChatMessage[]) {
  const patterns = /(todo|next|action|需要|补充|修改|优化|添加|学习|确认|follow)/i;
  return messages
    .filter((message) => patterns.test(message.content))
    .slice(-12)
    .map((message) => ({
      role: message.role,
      text: truncateText(message.content, 360),
      createdAt: message.createdAt,
    }));
}

function memoryDraftsFromMessages(messages: ResumeChatMessage[]) {
  const factPatterns = /(负责|主导|实现|优化|提升|降低|完成|built|led|owned|improved|reduced|increased)/i;
  return messages
    .filter((message) => message.role === 'user' && factPatterns.test(message.content))
    .slice(-10)
    .map((message) => ({
      type: 'project_fact',
      title: truncateText(message.content.split(/[。.!?\n]/)[0], 80),
      content: truncateText(message.content, 600),
      source: 'resume_chat',
      confidence: 70,
    }));
}

function scoreFromChecks(sectionType: string, checks: Array<[boolean, string, string]>): SectionReadiness {
  const strengths = checks.filter(([passed]) => passed).map(([, strength]) => strength);
  const gaps = checks.filter(([passed]) => !passed).map(([, , gap]) => gap);
  return {
    sectionType,
    score: Math.round((strengths.length / Math.max(1, checks.length)) * 100),
    strengths,
    gaps,
  };
}

function sectionByType(sections: ResumeSection[], type: string) {
  return sections.find((section) => section.type === type);
}

function scorePersonalInfo(section?: ResumeSection): SectionReadiness {
  const content = asRecord(section?.content);
  return scoreFromChecks('personal_info', [
    [!!textOfValue(content.fullName).trim(), '姓名已填写', '补充姓名'],
    [!!textOfValue(content.jobTitle).trim(), '目标职位已填写', '补充目标职位'],
    [!!textOfValue(content.email).trim() || !!textOfValue(content.phone).trim(), '联系方式可用', '补充邮箱或电话'],
    [!!textOfValue(content.location).trim(), '地点信息已填写', '补充城市或远程偏好'],
  ]);
}

function scoreSummary(section: ResumeSection | undefined, targetRole: string): SectionReadiness {
  const text = textOfValue(asRecord(section?.content).text);
  return scoreFromChecks('summary', [
    [text.trim().length >= 60, '简介有足够信息密度', '简介过短，需要补充核心经验、领域和成果'],
    [hasMetric(text), '简介包含量化结果', '简介缺少量化指标'],
    [!targetRole || text.toLowerCase().includes(targetRole.toLowerCase()), '简介贴合目标角色', '简介未直接呼应目标角色'],
  ]);
}

function scoreSkills(section: ResumeSection | undefined, keywords: string[]): SectionReadiness {
  const categories = recordsOf(asRecord(section?.content).categories);
  const skills = categories.flatMap((category) => stringsOf(category.skills));
  const skillText = skills.join(' ').toLowerCase();
  const matchedKeywords = keywords.filter((keyword) => skillText.includes(keyword.toLowerCase()));
  return scoreFromChecks('skills', [
    [categories.length >= 2, '技能按类别组织', '技能分类不足'],
    [skills.length >= 8, '技能关键词数量充足', '技能关键词偏少'],
    [keywords.length === 0 || matchedKeywords.length >= Math.min(3, keywords.length), '技能覆盖目标关键词', '技能与目标 JD 关键词覆盖不足'],
  ]);
}

function scoreExperience(section: ResumeSection | undefined, sectionType: string): SectionReadiness {
  const items = recordsOf(asRecord(section?.content).items);
  const highlights = items.flatMap((item) => stringsOf(item.highlights));
  return scoreFromChecks(sectionType, [
    [items.length > 0, '已有经历条目', '缺少经历条目'],
    [items.some((item) => !!textOfValue(item.description).trim()), '经历有职责描述', '经历缺少职责描述'],
    [highlights.length >= Math.max(1, items.length), '经历有亮点 bullet', '经历亮点 bullet 不足'],
    [items.some((item) => hasMetric(item)) || highlights.some((item) => hasMetric(item)), '经历包含量化成果', '经历缺少量化成果'],
  ]);
}

function scoreProjects(section: ResumeSection | undefined): SectionReadiness {
  const items = recordsOf(asRecord(section?.content).items);
  const technologies = items.flatMap((item) => stringsOf(item.technologies));
  const highlights = items.flatMap((item) => stringsOf(item.highlights));
  return scoreFromChecks('projects', [
    [items.length > 0, '已有项目条目', '缺少项目经历'],
    [technologies.length > 0, '项目包含技术栈', '项目缺少技术栈'],
    [highlights.length > 0, '项目包含成果亮点', '项目缺少成果亮点'],
    [items.some((item) => hasMetric(item)) || highlights.some((item) => hasMetric(item)), '项目包含量化成果', '项目缺少量化成果'],
  ]);
}

function scoreEducation(section: ResumeSection | undefined): SectionReadiness {
  const items = recordsOf(asRecord(section?.content).items);
  return scoreFromChecks('education', [
    [items.length > 0, '教育背景已填写', '补充教育背景'],
  ]);
}

function summarizeSection(section: ResumeSection) {
  const content = asRecord(section.content);
  if (section.type === 'summary') {
    return { id: section.id, type: section.type, title: section.title, text: textOfValue(content.text).slice(0, 500) };
  }
  if (section.type === 'skills') {
    return {
      id: section.id,
      type: section.type,
      title: section.title,
      categories: recordsOf(content.categories).map((category) => ({
        name: textOfValue(category.name),
        skills: stringsOf(category.skills).slice(0, 20),
      })),
    };
  }
  if (section.type === 'projects' || section.type === 'work_experience' || section.type === 'education') {
    return {
      id: section.id,
      type: section.type,
      title: section.title,
      items: recordsOf(content.items).slice(0, 8).map((item) => ({
        title: textOfValue(item.name || item.company || item.institution || item.position || item.degree),
        subtitle: textOfValue(item.position || item.field || item.location),
        description: textOfValue(item.description).slice(0, 360),
        highlights: stringsOf(item.highlights).slice(0, 6),
        technologies: stringsOf(item.technologies).slice(0, 12),
      })),
    };
  }
  return { id: section.id, type: section.type, title: section.title, content };
}


function summarizeResumeSnapshot(snapshot: unknown) {
  const resume = asRecord(snapshot);
  const sections = recordsOf(resume.sections);
  return {
    id: resume.id,
    title: resume.title,
    template: resume.template,
    language: resume.language,
    versionLabel: resume.versionLabel,
    updatedAt: resume.updatedAt,
    sections: sections.map((section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      visible: section.visible,
      textLength: resumeSectionText(section as unknown as ResumeSection).length,
    })),
  };
}

function summarizeResumeDiff(before: unknown, after: unknown) {
  return diffResumes(before as import('../../types/resume').Resume, after as import('../../types/resume').Resume);
}

function getMcpAIConfig(args: Record<string, unknown>): AIConfig | null {
  const raw = optionalObjectArg(args, 'aiConfig');
  const provider = textOfValue(raw.provider || process.env.JADEAI_MCP_AI_PROVIDER || process.env.AI_PROVIDER || 'openai');
  const apiKey = textOfValue(raw.apiKey || process.env.JADEAI_MCP_AI_API_KEY || process.env.AI_API_KEY || '');
  const baseURL = textOfValue(raw.baseURL || raw.baseUrl || process.env.JADEAI_MCP_AI_BASE_URL || process.env.AI_BASE_URL || (provider === 'openai' ? 'https://api.openai.com/v1' : ''));
  const model = textOfValue(raw.model || process.env.JADEAI_MCP_AI_MODEL || process.env.AI_MODEL || '');
  const openAIEndpoint: AIConfig['openAIEndpoint'] = textOfValue(raw.openAIEndpoint || raw.openaiEndpoint || process.env.JADEAI_MCP_AI_OPENAI_ENDPOINT || process.env.AI_OPENAI_ENDPOINT || 'chat') === 'responses' ? 'responses' : 'chat';
  if (!apiKey || !model) return null;
  return { provider, apiKey, baseURL, model, mode: 'custom', openAIEndpoint };
}

function actionSuggestionsFromReadiness(readiness: Awaited<ReturnType<typeof analyzeResumeReadiness>>) {
  return [
    ...readiness.recommendedQuestions.map((question) => ({
      type: 'question',
      text: question,
    })),
    ...readiness.learningPlanHints.map((hint) => ({
      type: 'learning_plan',
      text: hint.action,
      topic: hint.topic,
    })),
  ].slice(0, 12);
}

async function resolveMcpUser(context: ResumeMcpToolContext = {}): Promise<McpUser> {
  await dbReady;

  if (context.user?.id) {
    return context.user;
  }

  const userId = process.env.JADEAI_MCP_USER_ID?.trim();
  if (userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error(`JADEAI_MCP_USER_ID not found: ${userId}`);
    return user;
  }

  const email = process.env.JADEAI_MCP_USER_EMAIL?.trim();
  if (email) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error(`JADEAI_MCP_USER_EMAIL not found: ${email}`);
    return user;
  }

  const fingerprint = process.env.JADEAI_MCP_FINGERPRINT?.trim()
    || (process.env.AUTH_ENABLED === 'false' ? 'demo-fingerprint' : '');
  if (fingerprint) {
    const user = await userRepository.findByFingerprint(fingerprint);
    if (!user) throw new Error(`JADEAI_MCP_FINGERPRINT not found: ${fingerprint}`);
    return user;
  }

  throw new Error('Set JADEAI_MCP_USER_ID, JADEAI_MCP_USER_EMAIL, or JADEAI_MCP_FINGERPRINT before using JadeAI MCP');
}

async function requireOwnedResume(resumeId: string, user: McpUser): Promise<OwnedResume> {
  const resume = await resumeRepository.findById(resumeId);
  if (!resume) throw new Error('Resume not found');
  if (resume.userId !== user.id) throw new Error('Forbidden');
  return resume;
}

async function requireOwnedAnalysis(analysisId: string, user: McpUser) {
  const analysis = await analysisRepository.findJdAnalysisById(analysisId);
  if (!analysis) throw new Error('Analysis not found');
  await requireOwnedResume(analysis.resumeId, user);
  return analysis;
}

async function requireVersion(resumeId: string, versionId: string) {
  const versions = await resumeRepository.findVersions(resumeId);
  const version = versions.find((item: ResumeVersion) => item.id === versionId);
  if (!version) {
    throw new Error('A valid versionId from create_resume_version is required before applying this write');
  }
  if (version.source !== 'mcp') {
    throw new Error('versionId must come from the MCP create_resume_version tool');
  }
  return version;
}

async function listResumes(_args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumes = await resumeRepository.findAllByUserId(user.id);
  return { user: { id: user.id, email: user.email, name: user.name }, resumes };
}

async function getResume(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const resume = await requireOwnedResume(resumeId, user);
  return { resume };
}

async function listJdAnalyses(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId', false);
  const limit = numberArg(args, 'limit', 50, 100);

  if (resumeId) {
    await requireOwnedResume(resumeId, user);
    const familyIds = await resumeRepository.findFamilyIdsByResumeId(resumeId, user.id);
    const ids = familyIds.length > 0 ? familyIds : [resumeId];
    return { analyses: await analysisRepository.findJdAnalysesByResumeIds(ids, limit), resumeIds: ids };
  }

  const resumes = await resumeRepository.findAllByUserId(user.id);
  const resumeIds = resumes.map((resume: ResumeListItem) => resume.id);
  return { analyses: await analysisRepository.findJdAnalysesByResumeIds(resumeIds, limit), resumeIds };
}

async function getJdAnalysis(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const analysisId = stringArg(args, 'analysisId');
  const analysis = await requireOwnedAnalysis(analysisId, user);
  return { analysis };
}

async function searchKnowledge(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const query = stringArg(args, 'query', false).toLowerCase();
  const resumeId = stringArg(args, 'resumeId', false);
  const limit = numberArg(args, 'limit', 20, 100);

  if (resumeId) await requireOwnedResume(resumeId, user);

  const [nodes, edges, memories] = await Promise.all([
    knowledgeRepository.listNodes(user.id),
    knowledgeRepository.listEdges(user.id),
    userProfileMemoryRepository.listByUserId(user.id, 100),
  ]);

  const filteredNodes = nodes
    .filter((node: KnowledgeNode) => (!resumeId || node.resumeId === resumeId) && (!query || lowerText([node.label, node.content, node.metadata]).includes(query)))
    .slice(0, limit);
  const nodeIds = new Set(filteredNodes.map((node: KnowledgeNode) => node.id));
  const graphEdges = edges.filter((edge: KnowledgeEdge) => nodeIds.has(edge.fromNodeId) || nodeIds.has(edge.toNodeId));
  const filteredMemories = memories
    .filter((memory: UserProfileMemory) => !query || lowerText([memory.title, memory.content, memory.type, memory.metadata]).includes(query))
    .slice(0, limit);

  return {
    query,
    nodes: filteredNodes,
    edges: graphEdges,
    memories: filteredMemories,
    mindmap: filteredNodes.map((node: KnowledgeNode) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      children: graphEdges
        .filter((edge: KnowledgeEdge) => edge.fromNodeId === node.id)
        .map((edge: KnowledgeEdge) => ({ id: edge.toNodeId, relation: edge.relation })),
    })),
  };
}

async function analyzeResumeReadiness(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const targetRole = stringArg(args, 'targetRole', false);
  const jobDescription = stringArg(args, 'jobDescription', false);
  const analysisId = stringArg(args, 'analysisId', false);
  const resume = await requireOwnedResume(resumeId, user);
  const sections = resume.sections as ResumeSection[];

  const analysis = analysisId
    ? await requireOwnedAnalysis(analysisId, user)
    : null;
  if (analysis && analysis.resumeId !== resumeId) {
    throw new Error('Analysis does not belong to the requested resume');
  }

  const latestAnalyses = analysis
    ? [analysis]
    : await analysisRepository.findJdAnalysesByResumeIds([resumeId], 3);
  const analysisResult = asRecord(latestAnalyses[0]?.result);
  const keywords = targetTerms(
    jobDescription,
    targetRole,
    analysisResult.keywordMatches,
    analysisResult.missingKeywords,
  );

  const [nodes, edges, memories] = await Promise.all([
    knowledgeRepository.listNodes(user.id),
    knowledgeRepository.listEdges(user.id),
    userProfileMemoryRepository.listByUserId(user.id, 100),
  ]);
  const resumeNodes = nodes.filter((node: KnowledgeNode) => !node.resumeId || node.resumeId === resumeId);
  const nodeIds = new Set(resumeNodes.map((node: KnowledgeNode) => node.id));
  const graphEdges = edges.filter((edge: KnowledgeEdge) => nodeIds.has(edge.fromNodeId) || nodeIds.has(edge.toNodeId));

  const sectionsReadiness = [
    scorePersonalInfo(sectionByType(sections, 'personal_info')),
    scoreSummary(sectionByType(sections, 'summary'), targetRole),
    scoreSkills(sectionByType(sections, 'skills'), keywords),
    scoreExperience(sectionByType(sections, 'work_experience'), 'work_experience'),
    scoreProjects(sectionByType(sections, 'projects')),
    scoreEducation(sectionByType(sections, 'education')),
  ];
  const overallScore = Math.round(sectionsReadiness.reduce((sum, item) => sum + item.score, 0) / sectionsReadiness.length);
  const topGaps = sectionsReadiness.flatMap((item) => item.gaps.map((gap) => ({ sectionType: item.sectionType, gap }))).slice(0, 12);
  const missingKeywords = keywords.filter((keyword) => !lowerText(resume).includes(keyword.toLowerCase())).slice(0, 12);
  const memoryCoverage = {
    total: memories.length,
    projectFacts: memories.filter((memory: UserProfileMemory) => memory.type === 'project_fact').length,
    skillEvidence: memories.filter((memory: UserProfileMemory) => memory.type === 'skill_evidence').length,
    interviewGaps: memories.filter((memory: UserProfileMemory) => memory.type === 'interview_gap').length,
  };

  return {
    resume: { id: resume.id, title: resume.title, targetRole: targetRole || resume.targetJobTitle || null },
    overallScore,
    sections: sectionsReadiness,
    jdContext: {
      analysisId: latestAnalyses[0]?.id || null,
      overallScore: latestAnalyses[0]?.overallScore ?? null,
      atsScore: latestAnalyses[0]?.atsScore ?? null,
      missingKeywords,
    },
    knowledge: {
      nodeCount: resumeNodes.length,
      edgeCount: graphEdges.length,
      memoryCoverage,
      mindmap: resumeNodes.slice(0, 50).map((node: KnowledgeNode) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        children: graphEdges
          .filter((edge: KnowledgeEdge) => edge.fromNodeId === node.id)
          .map((edge: KnowledgeEdge) => ({ id: edge.toNodeId, relation: edge.relation })),
      })),
    },
    recommendedQuestions: [
      ...topGaps.slice(0, 5).map((item) => `请补充 ${item.sectionType}：${item.gap}`),
      ...missingKeywords.slice(0, 5).map((keyword) => `你是否有 ${keyword} 的项目证据、指标或学习计划？`),
      ...(memoryCoverage.skillEvidence === 0 ? ['请补充可证明技能的项目事实或成果指标'] : []),
      ...(memoryCoverage.projectFacts === 0 ? ['请把代表项目沉淀为个人记忆，方便后续生成简历内容'] : []),
    ].slice(0, 10),
    learningPlanHints: missingKeywords.slice(0, 8).map((keyword) => ({
      topic: keyword,
      action: `围绕 ${keyword} 补一个可验证项目、课程记录或量化成果，再写入个人记忆。`,
    })),
  };
}

async function getResumeContextPack(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const targetRole = stringArg(args, 'targetRole', false);
  const jobDescription = stringArg(args, 'jobDescription', false);
  const analysisId = stringArg(args, 'analysisId', false);
  const includeChats = boolArg(args, 'includeChats', true);
  const chatLimit = numberArg(args, 'chatLimit', 3, 10);
  const resume = await requireOwnedResume(resumeId, user);
  const sections = resume.sections as ResumeSection[];
  const readiness = await analyzeResumeReadiness({ resumeId, targetRole, jobDescription, analysisId }, context);
  const analysis = analysisId
    ? await requireOwnedAnalysis(analysisId, user)
    : null;
  if (analysis && analysis.resumeId !== resumeId) {
    throw new Error('Analysis does not belong to the requested resume');
  }

  const [analyses, nodes, edges, memories, sessions] = await Promise.all([
    analysis ? Promise.resolve([analysis]) : analysisRepository.findJdAnalysesByResumeIds([resumeId], 5),
    knowledgeRepository.listNodes(user.id),
    knowledgeRepository.listEdges(user.id),
    userProfileMemoryRepository.listByUserId(user.id, 30),
    includeChats ? chatRepository.findSessionsByResumeId(resumeId) : Promise.resolve([]),
  ]);

  const resumeNodes = nodes.filter((node: KnowledgeNode) => !node.resumeId || node.resumeId === resumeId);
  const nodeIds = new Set(resumeNodes.map((node: KnowledgeNode) => node.id));
  const graphEdges = edges.filter((edge: KnowledgeEdge) => nodeIds.has(edge.fromNodeId) || nodeIds.has(edge.toNodeId));
  const chatDetails = includeChats
    ? await Promise.all(sessions.slice(0, chatLimit).map((session: ResumeChatSession) => chatRepository.findSessionWithMessages(session.id)))
    : [];

  return {
    user: { id: user.id, email: user.email, name: user.name },
    resume: {
      id: resume.id,
      title: resume.title,
      language: resume.language,
      targetCompany: resume.targetCompany,
      targetJobTitle: targetRole || resume.targetJobTitle,
      versionLabel: resume.versionLabel,
      sections: sections.map(summarizeSection),
    },
    analyses: analyses.map((item: Awaited<ReturnType<typeof analysisRepository.findJdAnalysesByResumeIds>>[number]) => ({
      id: item.id,
      overallScore: item.overallScore,
      atsScore: item.atsScore,
      status: item.status,
      createdAt: item.createdAt,
      jobDescription: item.jobDescription.slice(0, 1200),
      result: summarizeAnalysisResult(item.result),
    })),
    readiness,
    knowledge: {
      nodes: resumeNodes.slice(0, 80).map((node: KnowledgeNode) => summarizeKnowledgeNode(node)),
      edges: graphEdges.slice(0, 120),
      mindmap: readiness.knowledge.mindmap,
      memories: memories.slice(0, 30).map((memory: UserProfileMemory) => summarizeMemory(memory)),
    },
    chats: chatDetails.filter(Boolean).map((session) => ({
      id: session!.id,
      title: session!.title,
      updatedAt: session!.updatedAt,
      messages: session!.messages.slice(-8).map((message: ResumeChatMessage) => ({
        role: message.role,
        content: message.content.slice(0, 1000),
        createdAt: message.createdAt,
      })),
    })),
    suggestedAgentActions: actionSuggestionsFromReadiness(readiness),
    safety: {
      writePolicy: 'Call create_resume_version first, then pass versionId with apply=true. Write tools default to preview.',
      preferredWriteTools: ['create_resume_version', 'update_resume_section', 'apply_suggestion', 'create_role_resume'],
    },
  };
}

async function draftProjectForResume(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const resume = await requireOwnedResume(resumeId, user);
  const sections = resume.sections as ResumeSection[];
  const projectsSection = sectionByType(sections, 'projects');
  const project = buildProjectDraft(args, resume.language);
  const existingContent = asRecord(projectsSection?.content);
  const existingItems = recordsOf(existingContent.items);
  const nextContent = {
    ...existingContent,
    items: [...existingItems, project],
  };

  return {
    mode: 'preview',
    writeRequired: false,
    resumeId,
    project,
    targetSection: projectsSection
      ? {
        sectionId: projectsSection.id,
        sectionType: projectsSection.type,
        sectionTitle: projectsSection.title,
      }
      : {
        sectionId: null,
        sectionType: 'projects',
        sectionTitle: resume.language === 'en' ? 'Projects' : '项目经历',
      },
    preview: projectsSection
      ? sectionPreview(projectsSection, nextContent)
      : {
        resumeId,
        sectionId: null,
        sectionType: 'projects',
        sectionTitle: resume.language === 'en' ? 'Projects' : '项目经历',
        diff: summarizeDiff(null, nextContent),
      },
    nextMcpSteps: projectsSection
      ? [
        'Call create_resume_version(resumeId, label).',
        'Call update_resume_section(resumeId, sectionId, content, apply=true, versionId) with the preview.after content.',
      ]
      : [
        'Create a projects section in the app first, then call create_resume_version and update_resume_section.',
        'This MCP tool does not create new sections automatically.',
      ],
  };
}

async function listResumeChats(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  await requireOwnedResume(resumeId, user);
  const sessions = await chatRepository.findSessionsByResumeId(resumeId);
  return { resumeId, sessions };
}

async function getResumeChat(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const sessionId = stringArg(args, 'sessionId');
  await requireOwnedResume(resumeId, user);
  const session = await chatRepository.findSessionWithMessages(sessionId);
  if (!session || session.resumeId !== resumeId) throw new Error('Chat session not found');
  return { session };
}

async function summarizeResumeChats(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const limit = numberArg(args, 'limit', 5, 20);
  await requireOwnedResume(resumeId, user);
  const sessions = await chatRepository.findSessionsByResumeId(resumeId);
  const selected = sessions.slice(0, limit);
  const details = (await Promise.all(
    selected.map((session: ResumeChatSession) => chatRepository.findSessionWithMessages(session.id)),
  )).filter((session): session is ResumeChatWithMessages => !!session);
  const messages = details.flatMap((session) => session.messages);
  const userMessages = messages.filter((message) => message.role === 'user');
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const corpus = messages.map((message) => message.content).join('\n');

  return {
    resumeId,
    sessionCount: sessions.length,
    summarizedSessionCount: details.length,
    messageCount: messages.length,
    sessions: details.map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
      latestMessages: session.messages.slice(-6).map((message: ResumeChatMessage) => ({
        role: message.role,
        content: truncateText(message.content, 420),
        createdAt: message.createdAt,
      })),
    })),
    signals: {
      keywords: extractKeywordsFromText(corpus, 16),
      userQuestionCount: userMessages.filter((message) => /[?？]|怎么|如何|是否|能不能/.test(message.content)).length,
      assistantSuggestionCount: assistantMessages.filter((message) => /建议|可以|should|recommend/i.test(message.content)).length,
    },
    actionItems: actionItemsFromMessages(messages),
    memoryDrafts: memoryDraftsFromMessages(messages),
    followUpQuestions: [
      '这些历史对话里哪些事实可以确认写入个人记忆？',
      '哪些项目经历已经有指标，哪些还需要补证据？',
      '是否要把某个项目草稿转成 draft_project_for_resume 输入？',
    ],
  };
}


async function listResumeVersions(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const includeSnapshots = boolArg(args, 'includeSnapshots', false);
  const limit = numberArg(args, 'limit', 20, 100);
  await requireOwnedResume(resumeId, user);
  const versions = (await resumeRepository.findVersions(resumeId)).slice(0, limit);
  return {
    resumeId,
    versions: versions.map((version: ResumeVersion) => ({
      id: version.id,
      resumeId: version.resumeId,
      label: version.label,
      source: version.source,
      createdAt: version.createdAt,
      snapshotSummary: summarizeResumeSnapshot(version.snapshot),
      api: { get: 'get_resume_version', compare: 'compare_resume_version', restore: 'restore_resume_version' },
      ...(includeSnapshots ? { snapshot: version.snapshot } : {}),
    })),
  };
}

async function getResumeVersion(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const versionId = stringArg(args, 'versionId');
  await requireOwnedResume(resumeId, user);
  const versions = await resumeRepository.findVersions(resumeId);
  const version = versions.find((item: ResumeVersion) => item.id === versionId);
  if (!version) throw new Error('Version not found');
  return { version };
}

async function compareResumeVersion(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const versionId = stringArg(args, 'versionId');
  const compareTo = stringArg(args, 'compareTo', false) || 'current';
  const resume = await requireOwnedResume(resumeId, user);
  const versions = await resumeRepository.findVersions(resumeId);
  const version = versions.find((item: ResumeVersion) => item.id === versionId);
  if (!version) throw new Error('Version not found');
  const before = version.snapshot;
  const after = compareTo === 'current'
    ? resume
    : versions.find((item: ResumeVersion) => item.id === compareTo)?.snapshot;
  if (!after) throw new Error('compareTo version not found');
  return {
    resumeId,
    base: { id: version.id, label: version.label, source: version.source, createdAt: version.createdAt },
    compareTo,
    diff: summarizeResumeDiff(before, after),
  };
}

async function restoreResumeVersion(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const versionId = stringArg(args, 'versionId');
  const apply = boolArg(args, 'apply', false);
  const restoreMetadata = boolArg(args, 'restoreMetadata', true);
  const restoreSections = boolArg(args, 'restoreSections', true);
  const resume = await requireOwnedResume(resumeId, user);
  const versions = await resumeRepository.findVersions(resumeId);
  const version = versions.find((item: ResumeVersion) => item.id === versionId);
  if (!version) throw new Error('Version not found');
  const snapshot = version.snapshot as import('../../types/resume').Resume;
  const preview = {
    version: { id: version.id, label: version.label, source: version.source, createdAt: version.createdAt },
    restoreMetadata,
    restoreSections,
    diff: summarizeResumeDiff(snapshot, resume),
  };
  if (!apply) {
    return { mode: 'preview', preview, safety: 'Call with apply=true only after user approval. Current resume will be saved before restore.' };
  }
  await resumeRepository.createVersion(resumeId, `mcp-restore-before-${new Date().toISOString()}`, resume, 'mcp');
  const restored = await resumeRepository.restoreFromSnapshot(resumeId, snapshot, { restoreMetadata, restoreSections });
  if (!restored) throw new Error('Restore failed');
  const afterVersion = await resumeRepository.createVersion(resumeId, `mcp-restore-after-${version.label}`, restored, 'mcp').catch(() => null);
  await resumeRepository.createEvent({
    resumeId,
    userId: user.id,
    type: 'mcp.version.restored',
    title: 'MCP resume version restored',
    metadata: { versionId, label: version.label, afterVersionId: afterVersion?.id || null },
  }).catch(() => null);
  return { mode: 'applied', preview, resume: restored, afterVersion };
}

async function analyzeTextSelection(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId', false);
  const text = stringArg(args, 'text');
  const focus = stringArg(args, 'focus', false) || 'resume critique';
  const jobDescription = stringArg(args, 'jobDescription', false);
  const targetRole = stringArg(args, 'targetRole', false);
  const sectionId = stringArg(args, 'sectionId', false);
  const sectionType = stringArg(args, 'sectionType', false);
  const language = stringArg(args, 'language', false) || 'zh';
  const criteria = uniqueStrings(stringsOf(args.criteria));
  const maxAnnotations = numberArg(args, 'maxAnnotations', 6, 20);

  const resume = resumeId ? await requireOwnedResume(resumeId, user) : null;
  const sections = (resume?.sections || []) as ResumeSection[];
  const matchedSection = resume ? findTextInSections(sections, text, sectionId, sectionType) : null;
  const contextPack = resume ? {
    resume: {
      id: resume.id,
      title: resume.title,
      language: resume.language,
      targetCompany: resume.targetCompany,
      targetJobTitle: targetRole || resume.targetJobTitle,
      sections: sections.map(summarizeSection),
    },
    matchedSection: matchedSection ? summarizeSection(matchedSection) : null,
  } : null;

  const aiConfig = getMcpAIConfig(args);
  if (aiConfig) {
    const { data } = await generateJsonWithRetry({
      label: 'mcp-text-annotation',
      model: getModel(aiConfig),
      schema: textAnnotationSchema,
      system: `You are a senior resume reviewer and writing coach. Analyze the selected text precisely. Return JSON only. Use ${language === 'en' ? 'English' : 'Chinese'} unless the selected text strongly requires another language.`,
      prompt: JSON.stringify({
        selectedText: text,
        focus,
        criteria,
        maxAnnotations,
        targetRole,
        jobDescription: truncateText(jobDescription, 6000),
        context: contextPack,
        outputRules: [
          'Each annotation should point to a concrete quote when possible.',
          'Explain the issue, why it matters, and a specific rewrite or action.',
          'Do not invent facts or metrics; mark evidence gaps explicitly.',
        ],
      }),
      maxOutputTokens: 4096,
      providerOptions: getProviderOptions(aiConfig),
    });
    const annotations = normalizeTextAnnotations(data, sections, text, matchedSection).slice(0, maxAnnotations);
    return {
      mode: 'ai',
      resumeId: resume?.id || null,
      matchedSection: matchedSection ? summarizeSection(matchedSection) : null,
      summary: data.summary,
      overallScore: data.overallScore,
      annotations,
      rewrite: data.rewrite,
      keywords: data.keywords,
      questions: data.questions,
      nextMcpSteps: resumeId ? [
        'Call list_review_shares to choose an existing review share, or pass shareId/shareToken to create_review_annotations.',
        'Call create_review_annotations with apply=false to preview comments, then apply=true if you want them visible in review preview.',
      ] : [],
    };
  }

  const keywords = extractKeywordsFromText(text, 12).map((item) => item.keyword);
  const annotations = [
    {
      id: 'heuristic-density',
      section: matchedSection?.title || sectionType || '',
      sectionId: matchedSection?.id || sectionId || '',
      quote: truncateText(text, 240),
      severity: hasMetric(text) ? 'medium' : 'high',
      category: 'impact',
      comment: hasMetric(text) ? '这段文本已有一定量化信息，但仍可检查动作、范围、结果是否完整。' : '这段文本缺少量化结果或可验证影响，容易显得泛泛而谈。',
      suggestion: '按“动作 + 技术/方法 + 场景规模 + 量化结果/业务影响”重写，并只补充真实可证明的数据。',
      evidence: keywords.length ? `关键词：${keywords.join('、')}` : '',
    },
  ];
  return {
    mode: 'heuristic',
    resumeId: resume?.id || null,
    matchedSection: matchedSection ? summarizeSection(matchedSection) : null,
    summary: '未提供 MCP AI 配置，已返回基于规则的文本批注。若要详细分析，请在工具参数传入 aiConfig。',
    overallScore: hasMetric(text) ? 72 : 55,
    annotations,
    rewrite: '',
    keywords,
    questions: ['这段经历是否有真实指标、用户规模、性能数据或业务结果可以补充？'],
  };
}

async function listReviewShares(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  await requireOwnedResume(resumeId, user);
  const shares = await shareRepository.findSummariesByResumeId(resumeId);
  return {
    resumeId,
    shares: shares.map((share: ResumeShare & { commentCount?: number; lastCommentAt?: Date | string | null }) => ({
      id: share.id,
      token: share.token,
      label: share.label,
      reviewEnabled: !!share.reviewEnabled,
      isActive: !!share.isActive,
      commentCount: Number(share.commentCount || 0),
      lastCommentAt: share.lastCommentAt || null,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
    })),
  };
}

async function createReviewAnnotations(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const shareId = stringArg(args, 'shareId', false);
  const shareToken = stringArg(args, 'shareToken', false);
  const authorName = stringArg(args, 'authorName', false) || 'MCP 批注';
  const apply = boolArg(args, 'apply', false);
  const rawAnnotations = arrayArg(args, 'annotations');
  const resume = await requireOwnedResume(resumeId, user);
  const sections = resume.sections as ResumeSection[];
  if (rawAnnotations.length === 0) throw new Error('annotations is required');

  const shares = await shareRepository.findByResumeId(resumeId);
  const share = shares.find((item: ResumeShare) => (shareId && item.id === shareId) || (shareToken && item.token === shareToken))
    || shares.find((item: ResumeShare) => item.reviewEnabled && item.isActive)
    || shares[0];
  if (!share) throw new Error('No share link exists for this resume. Create a review-enabled share link in the app first.');
  if (!share.reviewEnabled) throw new Error('Selected share link has review disabled. Enable review before creating annotations.');
  if (!share.isActive) throw new Error('Selected share link is inactive. Activate it before creating annotations.');

  const normalized = rawAnnotations.map((raw, index) => {
    const item = asRecord(raw);
    const section = textOfValue(item.sectionId)
      ? sections.find((candidate) => candidate.id === textOfValue(item.sectionId))
      : inferSectionFromAnalysis(item.section || item.sectionType, sections);
    const quote = compactText(item.quote || item.selectedText || '', 800);
    const quoteSection = quote ? findTextInSections(sections, quote) : null;
    const targetSection = section || quoteSection;
    return {
      index,
      shareId: share.id,
      resumeId,
      sectionId: targetSection?.id || null,
      sectionType: targetSection?.type || textOfValue(item.sectionType || item.section || 'summary'),
      targetField: textOfValue(item.targetField || 'text'),
      selectedText: quote || (targetSection ? `${targetSection.title} 批注` : 'MCP 批注'),
      suggestedText: textOfValue(item.suggestedText || item.suggested || item.replacement || ''),
      anchor: optionalObjectArg(item, 'anchor'),
      content: buildAnnotationMarkdown(item),
      authorName,
    };
  }).filter((item) => item.content.trim());

  if (!apply) {
    return {
      mode: 'preview',
      share: { id: share.id, token: share.token, label: share.label },
      commentCount: normalized.length,
      comments: normalized,
      nextMcpSteps: ['Call create_review_annotations with apply=true after the user approves.'],
    };
  }

  const comments = await Promise.all(normalized.map(async (item) => {
    const comment = await shareRepository.createComment({
      shareId: item.shareId,
      resumeId: item.resumeId,
      parentCommentId: null,
      authorUserId: user.id,
      authorName: item.authorName,
      authorEmail: user.email || null,
      sectionId: item.sectionId,
      selectedText: item.selectedText,
      anchor: Object.keys(item.anchor).length > 0 ? item.anchor : null,
      content: item.content,
    });
    if (comment && item.suggestedText) {
      await analysisRepository.createChangeProposal({
        resumeId: item.resumeId,
        userId: user.id,
        source: 'mcp',
        sourceId: comment.id,
        shareId: item.shareId,
        commentId: comment.id,
        sectionId: item.sectionId,
        sectionType: item.sectionType,
        targetField: item.targetField,
        current: item.selectedText,
        suggested: item.suggestedText,
        reason: item.content,
        evidenceRequired: false,
        metadata: { source: 'create_review_annotations' },
      }).catch(() => null);
    }
    return comment;
  }));
  await resumeRepository.createEvent({
    resumeId,
    userId: user.id,
    type: 'mcp.review_annotations.created',
    title: 'MCP review annotations created',
    metadata: { shareId: share.id, commentIds: comments.map((comment) => comment?.id).filter(Boolean) },
  }).catch(() => null);

  return { mode: 'applied', share: { id: share.id, token: share.token, label: share.label }, comments };
}

async function ensureReviewShare(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const label = stringArg(args, 'label', false) || 'MCP 批注';
  const apply = boolArg(args, 'apply', false);
  await requireOwnedResume(resumeId, user);
  const existing = (await shareRepository.findByResumeId(resumeId)).find((share: ResumeShare) => share.reviewEnabled && share.isActive);
  if (existing) {
    return { mode: 'existing', share: { id: existing.id, token: existing.token, label: existing.label, reviewEnabled: !!existing.reviewEnabled, isActive: !!existing.isActive } };
  }
  const preview = { resumeId, label, reviewEnabled: true, downloadEnabled: true, viewRequiresLogin: false };
  if (!apply) {
    return { mode: 'preview', preview, note: 'Creating a share link exposes a review URL. Call with apply=true only after user approval.' };
  }
  const token = generateShareToken();
  const share = await shareRepository.create({ resumeId, token, label, reviewEnabled: true, downloadEnabled: true });
  await resumeRepository.createEvent({
    resumeId,
    userId: user.id,
    type: 'mcp.review_share.created',
    title: 'MCP review share created',
    metadata: { shareId: share.id, token: share.token, label },
  }).catch(() => null);
  return { mode: 'applied', share: { id: share.id, token: share.token, label: share.label, reviewEnabled: !!share.reviewEnabled, isActive: !!share.isActive } };
}

async function createChangeProposal(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const rawSuggestion = objectArg(args, 'suggestion');
  const parsed = applicableSuggestionSchema.safeParse(rawSuggestion);
  if (!parsed.success) {
    throw new Error(`Invalid suggestion: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  }
  const resume = await requireOwnedResume(resumeId, user);
  const section = (resume.sections as ResumeSection[]).find((item) => item.type === parsed.data.sectionType);
  const proposal = await analysisRepository.createChangeProposal({
    resumeId,
    userId: user.id,
    source: stringArg(args, 'source', false) || 'mcp',
    sourceId: stringArg(args, 'sourceId', false) || null,
    sectionId: section?.id || stringArg(args, 'sectionId', false) || null,
    sectionType: parsed.data.sectionType,
    targetField: parsed.data.targetField,
    current: parsed.data.current,
    suggested: parsed.data.suggested,
    reason: parsed.data.reason,
    evidenceRequired: parsed.data.evidenceRequired,
    metadata: optionalObjectArg(args, 'metadata'),
  });
  await resumeRepository.createEvent({
    resumeId,
    userId: user.id,
    type: 'mcp.change_proposal.created',
    title: 'MCP change proposal created',
    description: parsed.data.reason,
    metadata: { proposalId: proposal?.id || null, sourceId: stringArg(args, 'sourceId', false) || null },
  }).catch(() => null);
  return { proposal, nextSteps: ['Review in JadeAI change proposals, or call apply_change_proposal with apply=true after user approval.'] };
}

async function listChangeProposals(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const limit = numberArg(args, 'limit', 50, 100);
  await requireOwnedResume(resumeId, user);
  return { proposals: await analysisRepository.findChangeProposalsByResumeId(resumeId, limit) };
}

async function applyChangeProposalTool(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const proposalId = stringArg(args, 'proposalId');
  const apply = boolArg(args, 'apply', false);
  const proposal = await analysisRepository.findChangeProposalById(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  await requireOwnedResume(proposal.resumeId, user);
  if (!apply) {
    return { mode: 'preview', proposal, safety: 'Call with apply=true only after user approval. Applying creates before/after versions.' };
  }
  const { applyChangeProposal } = await import('../change-proposals');
  return applyChangeProposal(proposalId, user.id);
}

async function createResumeVersion(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const label = stringArg(args, 'label', false) || `mcp-${new Date().toISOString()}`;
  const resume = await requireOwnedResume(resumeId, user);
  const version = await resumeRepository.createVersion(resumeId, label, resume, 'mcp');
  await resumeRepository.createEvent({
    resumeId,
    userId: user.id,
    type: 'mcp.version.created',
    title: 'MCP resume version created',
    metadata: { label, versionId: version?.id || null },
  }).catch(() => null);
  return { version, safety: 'Use this version.id as versionId before applying MCP write tools.' };
}

async function updateResumeSection(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const sectionId = stringArg(args, 'sectionId');
  const content = objectArg(args, 'content');
  const apply = boolArg(args, 'apply', false);
  const versionId = stringArg(args, 'versionId', false);
  const resume = await requireOwnedResume(resumeId, user);
  const section = (resume.sections as ResumeSection[]).find((item) => item.id === sectionId);
  if (!section) throw new Error('Section not found');

  const preview = sectionPreview(section, content);
  if (!apply) {
    return { mode: 'preview', requiresVersion: true, preview };
  }

  await requireVersion(resumeId, versionId);
  await resumeRepository.updateSection(sectionId, { content });
  const updated = await resumeRepository.findById(resumeId);
  const afterVersion = updated
    ? await resumeRepository.createVersion(resumeId, `mcp-after-${Date.now()}`, updated, 'mcp').catch(() => null)
    : null;
  await resumeRepository.createEvent({
    resumeId,
    userId: user.id,
    type: 'mcp.section.updated',
    title: 'MCP resume section updated',
    metadata: { sectionId, beforeVersionId: versionId, afterVersionId: afterVersion?.id || null },
  }).catch(() => null);
  return { mode: 'applied', preview, resume: updated, afterVersion };
}

async function applySuggestion(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const apply = boolArg(args, 'apply', false);
  const versionId = stringArg(args, 'versionId', false);
  const rawSuggestion = objectArg(args, 'suggestion');
  const parsed = applicableSuggestionSchema.safeParse(rawSuggestion);
  if (!parsed.success) {
    throw new Error(`Invalid suggestion: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  }

  const resume = await requireOwnedResume(resumeId, user);
  const update = buildSuggestionUpdate(resume, parsed.data as ApplicableSuggestion);
  const preview = sectionPreview(update.section, update.nextContent);

  if (!apply) {
    return { mode: 'preview', requiresVersion: true, preview, reason: parsed.data.reason };
  }

  await requireVersion(resumeId, versionId);
  await resumeRepository.updateSection(update.section.id, { content: update.nextContent });
  const updated = await resumeRepository.findById(resumeId);
  const afterVersion = updated
    ? await resumeRepository.createVersion(resumeId, `mcp-suggestion-after-${Date.now()}`, updated, 'mcp').catch(() => null)
    : null;
  await resumeRepository.createEvent({
    resumeId,
    userId: user.id,
    type: 'mcp.suggestion_applied',
    title: 'MCP JD suggestion applied',
    description: parsed.data.reason,
    metadata: { suggestion: parsed.data, beforeVersionId: versionId, afterVersionId: afterVersion?.id || null },
  }).catch(() => null);
  return { mode: 'applied', preview, resume: updated, afterVersion };
}

async function resolveRoleTemplate(userId: string, args: Record<string, unknown>): Promise<JobTemplate | null> {
  const roleKey = stringArg(args, 'roleKey', false);
  if (!roleKey) return null;

  const dbTemplates = await jobTemplateRepository.listVisible(userId).catch(() => []);
  const dbTemplate = dbTemplates.map(toJobTemplate).find((template: JobTemplate) => template.roleKey === roleKey);
  if (dbTemplate) return dbTemplate;
  return JOB_TEMPLATES.find((template) => template.roleKey === roleKey) || null;
}

async function createRoleResume(args: Record<string, unknown>, context: ToolHandlerContext) {
  const user = context.user;
  const resumeId = stringArg(args, 'resumeId');
  const versionId = stringArg(args, 'versionId', false);
  const apply = boolArg(args, 'apply', false);
  const source = await requireOwnedResume(resumeId, user);
  const template = await resolveRoleTemplate(user.id, args);
  const targetJobTitle = stringArg(args, 'targetJobTitle', false) || template?.title || stringArg(args, 'roleKey', false);
  const targetCompany = stringArg(args, 'targetCompany', false);
  const jobDescription = stringArg(args, 'jobDescription', false) || template?.jd || '';
  const title = stringArg(args, 'title', false) || `${source.title} - ${targetCompany || targetJobTitle || '角色版本'}`;

  const preview = {
    sourceResumeId: resumeId,
    title,
    targetCompany: targetCompany || null,
    targetJobTitle: targetJobTitle || null,
    jobDescription: jobDescription || null,
    baseResumeId: source.isBase ? source.id : source.baseResumeId || source.id,
    template: source.template || DEFAULT_TEMPLATE,
  };

  if (!apply) {
    return { mode: 'preview', requiresVersion: true, preview };
  }

  await requireVersion(resumeId, versionId);
  const roleResume = await resumeRepository.duplicate(resumeId, user.id, title, {
    baseResumeId: preview.baseResumeId,
    targetCompany: preview.targetCompany,
    targetJobTitle: preview.targetJobTitle,
    jobDescription: preview.jobDescription,
    versionLabel: 'mcp-role-v1',
  });
  if (!roleResume) throw new Error('Failed to create role resume');

  const version = await resumeRepository.createVersion(roleResume.id, 'mcp-role-v1', roleResume, 'mcp');
  await resumeRepository.createEvent({
    resumeId: roleResume.id,
    userId: user.id,
    type: 'mcp.role_resume.created',
    title: 'MCP role resume created',
    description: targetJobTitle || targetCompany || '',
    metadata: { sourceResumeId: resumeId, beforeVersionId: versionId, roleKey: stringArg(args, 'roleKey', false) || null },
  }).catch(() => null);

  return { mode: 'applied', resume: roleResume, version };
}

const listAnalyses = listJdAnalyses;
const getAnalysis = async (args: Record<string, unknown>, context: ToolHandlerContext) => getJdAnalysis({
  analysisId: stringArg(args, 'analysisId', false) || stringArg(args, 'id'),
}, context);

const inputSchemas = {
  empty: { type: 'object', properties: {}, additionalProperties: false },
  getResume: {
    type: 'object',
    properties: { resumeId: { type: 'string' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  listAnalyses: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, limit: { type: 'number' } },
    additionalProperties: false,
  },
  getAnalysis: {
    type: 'object',
    properties: { analysisId: { type: 'string' }, id: { type: 'string' } },
    additionalProperties: false,
  },
  searchKnowledge: {
    type: 'object',
    properties: { query: { type: 'string' }, resumeId: { type: 'string' }, limit: { type: 'number' } },
    additionalProperties: false,
  },
  analyzeReadiness: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      targetRole: { type: 'string' },
      jobDescription: { type: 'string' },
      analysisId: { type: 'string' },
    },
    required: ['resumeId'],
    additionalProperties: false,
  },
  contextPack: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      targetRole: { type: 'string' },
      jobDescription: { type: 'string' },
      analysisId: { type: 'string' },
      includeChats: { type: 'boolean', default: true },
      chatLimit: { type: 'number' },
    },
    required: ['resumeId'],
    additionalProperties: false,
  },
  draftProject: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      projectName: { type: 'string' },
      description: { type: 'string' },
      url: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      role: { type: 'string' },
      impact: { type: 'string' },
      technologies: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
      highlights: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] },
    },
    required: ['resumeId', 'projectName', 'description'],
    additionalProperties: false,
  },
  listResumeChats: {
    type: 'object',
    properties: { resumeId: { type: 'string' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  getResumeChat: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, sessionId: { type: 'string' } },
    required: ['resumeId', 'sessionId'],
    additionalProperties: false,
  },
  summarizeChats: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, limit: { type: 'number' } },
    required: ['resumeId'],
    additionalProperties: false,
  },

  listVersions: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, limit: { type: 'number' }, includeSnapshots: { type: 'boolean', default: false } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  getVersion: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, versionId: { type: 'string' } },
    required: ['resumeId', 'versionId'],
    additionalProperties: false,
  },
  compareVersion: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, versionId: { type: 'string' }, compareTo: { type: 'string' } },
    required: ['resumeId', 'versionId'],
    additionalProperties: false,
  },
  restoreVersion: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      versionId: { type: 'string' },
      apply: { type: 'boolean', default: false },
      restoreMetadata: { type: 'boolean', default: true },
      restoreSections: { type: 'boolean', default: true },
    },
    required: ['resumeId', 'versionId'],
    additionalProperties: false,
  },
  analyzeTextSelection: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      text: { type: 'string' },
      focus: { type: 'string' },
      sectionId: { type: 'string' },
      sectionType: { type: 'string' },
      targetRole: { type: 'string' },
      jobDescription: { type: 'string' },
      criteria: { type: 'array', items: { type: 'string' } },
      maxAnnotations: { type: 'number' },
      language: { type: 'string' },
      aiConfig: JSON_OBJECT_SCHEMA,
    },
    required: ['text'],
    additionalProperties: false,
  },
  listReviewShares: {
    type: 'object',
    properties: { resumeId: { type: 'string' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  createReviewAnnotations: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      shareId: { type: 'string' },
      shareToken: { type: 'string' },
      annotations: { type: 'array', items: JSON_OBJECT_SCHEMA, description: 'Each annotation may include quote, comment, suggestion, suggestedText/replacement, sectionId/sectionType, targetField.' },
      authorName: { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
    required: ['resumeId', 'annotations'],
    additionalProperties: false,
  },
  ensureReviewShare: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, label: { type: 'string' }, apply: { type: 'boolean', default: false } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  createChangeProposal: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      suggestion: JSON_OBJECT_SCHEMA,
      source: { type: 'string' },
      sourceId: { type: 'string' },
      sectionId: { type: 'string' },
      metadata: JSON_OBJECT_SCHEMA,
    },
    required: ['resumeId', 'suggestion'],
    additionalProperties: false,
  },
  listChangeProposals: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, limit: { type: 'number' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  applyChangeProposal: {
    type: 'object',
    properties: { proposalId: { type: 'string' }, apply: { type: 'boolean', default: false } },
    required: ['proposalId'],
    additionalProperties: false,
  },
  createVersion: {
    type: 'object',
    properties: { resumeId: { type: 'string' }, label: { type: 'string' } },
    required: ['resumeId'],
    additionalProperties: false,
  },
  updateSection: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      sectionId: { type: 'string' },
      content: JSON_OBJECT_SCHEMA,
      apply: { type: 'boolean', default: false },
      versionId: { type: 'string' },
    },
    required: ['resumeId', 'sectionId', 'content'],
    additionalProperties: false,
  },
  applySuggestion: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      suggestion: JSON_OBJECT_SCHEMA,
      apply: { type: 'boolean', default: false },
      versionId: { type: 'string' },
    },
    required: ['resumeId', 'suggestion'],
    additionalProperties: false,
  },
  createRoleResume: {
    type: 'object',
    properties: {
      resumeId: { type: 'string' },
      versionId: { type: 'string' },
      apply: { type: 'boolean', default: false },
      roleKey: { type: 'string' },
      title: { type: 'string' },
      targetCompany: { type: 'string' },
      targetJobTitle: { type: 'string' },
      jobDescription: { type: 'string' },
    },
    required: ['resumeId'],
    additionalProperties: false,
  },
} as const;

export const resumeMcpTools: ToolDefinition[] = [
  { name: 'list_resumes', description: 'List resumes owned by the configured local JadeAI user.', inputSchema: inputSchemas.empty, handler: listResumes },
  { name: 'get_resume', description: 'Get one owned resume with sections.', inputSchema: inputSchemas.getResume, handler: getResume },
  { name: 'list_jd_analyses', description: 'List JD analyses for one resume family or all owned resumes.', inputSchema: inputSchemas.listAnalyses, handler: listJdAnalyses },
  { name: 'get_jd_analysis', description: 'Get one owned JD analysis.', inputSchema: inputSchemas.getAnalysis, handler: getJdAnalysis },
  { name: 'list_analyses', description: 'Alias of list_jd_analyses for Phase 2 read-only MCP clients.', inputSchema: inputSchemas.listAnalyses, handler: listAnalyses },
  { name: 'get_analysis', description: 'Alias of get_jd_analysis for Phase 2 read-only MCP clients.', inputSchema: inputSchemas.getAnalysis, handler: getAnalysis },
  { name: 'search_knowledge', description: 'Search resume knowledge graph nodes, edges, and personal memories.', inputSchema: inputSchemas.searchKnowledge, handler: searchKnowledge },
  { name: 'analyze_resume_readiness', description: 'Read-only analysis of resume completeness, JD fit, knowledge graph coverage, memory gaps, and learning prompts.', inputSchema: inputSchemas.analyzeReadiness, handler: analyzeResumeReadiness },
  { name: 'get_resume_context_pack', description: 'Read-only compact context pack for agents: resume sections, JD analyses, readiness, knowledge graph, memories, chats, and safe next actions.', inputSchema: inputSchemas.contextPack, handler: getResumeContextPack },
  { name: 'draft_project_for_resume', description: 'Preview a project item and projects-section update payload without writing. Apply through create_resume_version and update_resume_section.', inputSchema: inputSchemas.draftProject, handler: draftProjectForResume },
  { name: 'list_resume_chats', description: 'List chat sessions for one owned resume.', inputSchema: inputSchemas.listResumeChats, handler: listResumeChats },
  { name: 'get_resume_chat', description: 'Read one chat session with messages for an owned resume.', inputSchema: inputSchemas.getResumeChat, handler: getResumeChat },
  { name: 'summarize_resume_chats', description: 'Read-only summary of recent resume chats: themes, action items, memory drafts, and follow-up questions.', inputSchema: inputSchemas.summarizeChats, handler: summarizeResumeChats },
  { name: 'list_resume_versions', description: 'List saved versions for a resume, with compact snapshot summaries by default.', inputSchema: inputSchemas.listVersions, handler: listResumeVersions },
  { name: 'get_resume_version', description: 'Get one saved resume version including its snapshot.', inputSchema: inputSchemas.getVersion, handler: getResumeVersion },
  { name: 'compare_resume_version', description: 'Compare a saved version to the current resume or another saved version.', inputSchema: inputSchemas.compareVersion, handler: compareResumeVersion },
  { name: 'restore_resume_version', description: 'Preview or restore a saved version into the current resume. Applying creates MCP before/after restore snapshots.', inputSchema: inputSchemas.restoreVersion, handler: restoreResumeVersion },
  { name: 'analyze_text_selection', description: 'Analyze a selected text passage and return detailed annotations, rewrite suggestions, evidence gaps, and follow-up questions. Can use aiConfig for full AI analysis or heuristic fallback.', inputSchema: inputSchemas.analyzeTextSelection, handler: analyzeTextSelection },
  { name: 'list_review_shares', description: 'List share links and review status so MCP annotations can target the correct review preview.', inputSchema: inputSchemas.listReviewShares, handler: listReviewShares },
  { name: 'create_review_annotations', description: 'Preview or create review comments from annotations. Applying makes them visible in review preview. Requires a review-enabled active share link.', inputSchema: inputSchemas.createReviewAnnotations, handler: createReviewAnnotations },
  { name: 'ensure_review_share', description: 'Preview or create a review-enabled share link for MCP annotations. Creating a share link requires apply=true.', inputSchema: inputSchemas.ensureReviewShare, handler: ensureReviewShare },
  { name: 'create_change_proposal', description: 'Create an apply-ready change proposal instead of writing immediately. The user can accept/reject it in JadeAI.', inputSchema: inputSchemas.createChangeProposal, handler: createChangeProposal },
  { name: 'list_change_proposals', description: 'List apply-ready change proposals for a resume.', inputSchema: inputSchemas.listChangeProposals, handler: listChangeProposals },
  { name: 'apply_change_proposal', description: 'Preview or apply a change proposal. Applying creates before/after versions.', inputSchema: inputSchemas.applyChangeProposal, handler: applyChangeProposalTool },
  { name: 'create_resume_version', description: 'Create a resume snapshot version before any MCP write.', inputSchema: inputSchemas.createVersion, handler: createResumeVersion },
  { name: 'update_resume_section', description: 'Preview or apply a section content update. Applying requires versionId from create_resume_version.', inputSchema: inputSchemas.updateSection, handler: updateResumeSection },
  { name: 'apply_suggestion', description: 'Preview or apply a JD suggestion. Applying requires versionId from create_resume_version.', inputSchema: inputSchemas.applySuggestion, handler: applySuggestion },
  { name: 'create_role_resume', description: 'Preview or create a role-targeted resume copy. Applying requires versionId from create_resume_version.', inputSchema: inputSchemas.createRoleResume, handler: createRoleResume },
];

export async function callResumeMcpTool(name: string, args: Record<string, unknown> = {}, context: ResumeMcpToolContext = {}): Promise<McpToolResult> {
  const tool = resumeMcpTools.find((item) => item.name === name);
  if (!tool) return toErrorResult(new Error(`Unknown tool: ${name}`));
  try {
    const user = await resolveMcpUser(context);
    return toJsonResult(await tool.handler(args, { user }));
  } catch (error) {
    return toErrorResult(error);
  }
}
