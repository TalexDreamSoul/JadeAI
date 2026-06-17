import { generateText } from 'ai';
import type { ModelMessage } from 'ai';
import { getModel, getProviderOptions, type AIConfig } from '@/lib/ai/provider';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import type { ParsedResume } from '@/lib/ai/parse-schema';
import { withMeteredAIUsage } from '@/lib/commercial/ai-route-metering';

export const ACCEPTED_RESUME_ANALYSIS_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const MAX_RESUME_ANALYSIS_FILE_SIZE = 10 * 1024 * 1024;

const SYSTEM_PROMPT = `You are a resume parser. Extract ALL information from the resume into the EXACT JSON schema below.

REQUIRED JSON SCHEMA:
{"personalInfo":{"fullName":"","jobTitle":"","age":"","gender":"","politicalStatus":"","ethnicity":"","hometown":"","maritalStatus":"","yearsOfExperience":"","educationLevel":"","email":"","phone":"","wechat":"","location":"","website":"","linkedin":"","github":""},"summary":"","workExperience":[{"company":"Company A","position":"","location":"","startDate":"YYYY-MM","endDate":"YYYY-MM or null","current":false,"description":"","highlights":["bullet 1","bullet 2"]},{"company":"Company B","position":"","location":"","startDate":"YYYY-MM","endDate":"YYYY-MM","current":false,"description":"","highlights":[]}],"education":[{"institution":"University A","degree":"","field":"","location":"","startDate":"YYYY-MM","endDate":"YYYY-MM","gpa":"","highlights":[]},{"institution":"University B","degree":"","field":"","location":"","startDate":"YYYY-MM","endDate":"YYYY-MM","gpa":"","highlights":[]}],"skills":[{"name":"category name","skills":["skill1","skill2"]}],"projects":[{"name":"Project A","description":"","technologies":[],"highlights":[]},{"name":"Project B","description":"","technologies":[],"highlights":[]}],"certifications":[{"name":"","issuer":"","date":""}],"languages":[{"language":"","proficiency":""}]}

RULES:
- You MUST use the EXACT field names shown above (fullName, jobTitle, workExperience, etc.)
- Output compact single-line JSON. No indentation, no newlines.
- You are a JSON API. Your entire response must be a single valid JSON object starting with { and ending with }. Do NOT use markdown syntax. Do NOT wrap in code fences. Do NOT add any text before or after the JSON.
- Use YYYY-MM for dates. Empty string "" for missing fields.
- For current jobs: current=true, endDate=null.
- Omit empty arrays (e.g. if no projects, omit "projects" entirely).
- Extract ALL items for EVERY section — every work experience, every project, every education entry, every certification, every language. Do NOT merge or omit any entries. If the resume has 3 projects, return 3 objects in the projects array. If the resume has 5 work experiences, return 5 objects in the workExperience array.
- Read ALL pages of the document thoroughly. Information may span multiple pages.`;

export type ResumeAnalysisInput = {
  userId: string;
  aiConfig: AIConfig;
  file: {
    name: string;
    type: string;
    size: number;
    buffer: Buffer;
  };
  template: string;
  language: string;
  resumeId?: string | null;
  onProgress?: (message: string, metadata?: Record<string, unknown>) => Promise<void> | void;
};

type AIAPICallErrorLike = {
  name?: string;
  message?: string;
  statusCode?: number;
  responseBody?: string;
  isRetryable?: boolean;
};

function isAIAPICallErrorLike(error: unknown): error is AIAPICallErrorLike {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as AIAPICallErrorLike;
  return candidate.name === 'AI_APICallError' || 'statusCode' in candidate || 'responseBody' in candidate;
}

export function describeResumeAnalysisError(error: unknown): {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
} {
  if (isAIAPICallErrorLike(error)) {
    const status = error.statusCode;
    const raw = (error.responseBody || error.message || '').slice(0, 1000);
    const lower = raw.toLowerCase();
    let message = 'AI 服务调用失败，请稍后重试或检查后台 AI 渠道配置。';
    if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('unauthorized')) {
      message = 'AI 渠道认证失败，请检查后台 API Key、Base URL 和模型配置。';
    } else if (status === 429 || lower.includes('rate limit') || lower.includes('quota')) {
      message = 'AI 渠道限流或额度不足，请稍后重试或检查服务商额度。';
    } else if (status === 400 && (lower.includes('image') || lower.includes('vision') || lower.includes('content'))) {
      message = '当前 AI 模型或网关不支持图片/多模态解析，请切换到支持视觉输入的模型后重试。';
    } else if (status === 400 && (lower.includes('json') || lower.includes('response_format') || lower.includes('schema'))) {
      message = '当前 AI 网关不兼容结构化 JSON 输出，请更新模型/网关配置后重试。';
    } else if (status && status >= 500) {
      message = 'AI 服务商暂时异常，请稍后自动重试。';
    }
    return {
      code: 'ai_provider_error',
      message,
      retryable: error.isRetryable,
      details: {
        statusCode: status,
        isRetryable: error.isRetryable,
        raw,
      },
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error || '未知错误');
  if (/No image|unsupported|multi.?modal|vision/i.test(rawMessage)) {
    return {
      code: 'ai_model_vision_unsupported',
      message: '当前 AI 模型不支持图片解析，请切换到支持视觉输入的模型后重试。',
      details: { raw: rawMessage.slice(0, 1000) },
    };
  }
  return {
    code: 'analysis_error',
    message: `${rawMessage}。请确认文件清晰可读，稍后可重新上传。`,
    details: { raw: rawMessage.slice(0, 1000) },
  };
}

export async function analyzeResumeFile(input: ResumeAnalysisInput) {
  const log = async (message: string, metadata?: Record<string, unknown>) => {
    await input.onProgress?.(message, metadata);
  };

  await log('开始读取简历文件', { fileName: input.file.name, fileType: input.file.type, fileSize: input.file.size });
  const model = getModel(input.aiConfig);
  const messages = await buildMessages(input.file.buffer, input.file.type, log);

  await log('开始调用 AI 解析简历');
  return withMeteredAIUsage({
    userId: input.userId,
    aiConfig: input.aiConfig,
    feature: 'resume.parse',
    metadata: {
      fileName: input.file.name,
      fileType: input.file.type,
      fileSize: input.file.size,
      template: input.template,
      language: input.language,
    },
    run: async () => {
      const result = await generateText({
        model,
        maxOutputTokens: 16384,
        system: SYSTEM_PROMPT,
        messages,
        providerOptions: getProviderOptions(input.aiConfig),
      });

      await log('AI 解析完成，开始保存简历', { finishReason: result.finishReason, outputLength: result.text.length });
      const raw = parseJsonFromText(result.text);
      if (!raw || typeof raw !== 'object') {
        throw new Error('AI 返回内容无法解析为有效简历 JSON');
      }

      const resumeData = mapToResumeSchema(raw as Record<string, unknown>);
      const title = resumeData.personalInfo?.fullName || '未命名简历';
      let resume = input.resumeId ? await resumeRepository.findById(input.resumeId) : null;

      if (resume) {
        await resumeRepository.update(resume.id, {
          title,
          template: input.template,
          language: input.language,
          themeConfig: clearAnalysisThemeConfig(resume.themeConfig),
        });
      } else {
        resume = await resumeRepository.create({
          userId: input.userId,
          title,
          template: input.template,
          language: input.language,
        });
      }

      if (!resume) {
        throw new Error('保存简历失败');
      }

      const sections = buildSections(resumeData, input.language);
      const parsedResume = await resumeRepository.replaceSections(
        resume.id,
        sections.map((section, index) => ({
          type: section.type,
          title: section.title,
          sortOrder: index,
          content: section.content,
        })),
      );
      await log('简历保存完成', { resumeId: resume.id, sectionCount: sections.length });
      return {
        value: parsedResume,
        usage: result.usage,
        metadata: { resumeId: resume.id, fileType: input.file.type, fileSize: input.file.size, template: input.template, language: input.language },
      };
    },
  });
}

async function buildMessages(
  buffer: Buffer,
  fileType: string,
  log: (message: string, metadata?: Record<string, unknown>) => Promise<void>,
): Promise<ModelMessage[]> {
  const messages: ModelMessage[] = [];

  if (fileType === 'application/pdf') {
    const pdfText = await extractPdfText(buffer);

    if (pdfText.length > 200) {
      await log('PDF 文本提取成功', { textLength: pdfText.length });
      messages.push({
        role: 'user',
        content: `Below is the full text extracted from a resume PDF. Extract all resume information using the EXACT JSON schema from the system prompt.\n\n---\n${pdfText}\n---`,
      });
    } else {
      await log('PDF 文本较少，转换页面为图片识别', { textLength: pdfText.length });
      const pageImages = await pdfPagesToImages(buffer);
      await log('PDF 页面图片转换完成', { pageCount: pageImages.length });
      const contentParts: Array<{ type: 'image'; image: string } | { type: 'text'; text: string }> = [];
      for (const png of pageImages) {
        contentParts.push({ type: 'image', image: `data:image/png;base64,${Buffer.from(png).toString('base64')}` });
      }
      contentParts.push({ type: 'text', text: 'Extract all resume information from these resume page images. Use the EXACT JSON schema from the system prompt.' });
      messages.push({ role: 'user', content: contentParts });
    }
  } else {
    const base64 = buffer.toString('base64');
    messages.push({
      role: 'user',
      content: [
        { type: 'image', image: `data:${fileType};base64,${base64}` },
        { type: 'text', text: 'Extract all resume information from this image. Use the EXACT JSON schema from the system prompt.' },
      ],
    });
  }

  return messages;
}

async function loadMupdfDoc(buffer: Uint8Array) {
  const mupdf = await import('mupdf');
  return { mupdf, doc: mupdf.Document.openDocument(buffer, 'application/pdf') };
}

function extractPdfText(buffer: Buffer): Promise<string> {
  return loadMupdfDoc(new Uint8Array(buffer)).then(({ doc }) => {
    const pageCount = doc.countPages();
    const parts: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      parts.push(page.toStructuredText('preserve-whitespace').asText());
    }
    return parts.join('\n').trim();
  }).catch((e) => {
    console.warn('[resume-analysis] mupdf text extraction failed:', (e as Error).message);
    return '';
  });
}

async function pdfPagesToImages(buffer: Uint8Array): Promise<Uint8Array[]> {
  const { mupdf, doc } = await loadMupdfDoc(buffer);
  const pageCount = doc.countPages();
  const images: Uint8Array[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(2, 2),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    images.push(pixmap.asPNG());
  }

  return images;
}

function parseJsonFromText(text: string): unknown | null {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/, '');
  cleaned = cleaned.trim();

  const candidates: string[] = [cleaned];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(cleaned.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      if (candidate === candidates[0]) console.warn('[resume-analysis] JSON.parse error:', (e as Error).message?.slice(0, 100));
      const repaired = repairTruncatedJson(candidate);
      if (repaired) {
        try { return JSON.parse(repaired); } catch { /* continue */ }
      }
    }
  }

  return null;
}

function repairTruncatedJson(text: string): string | null {
  let s = text.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return null;

  s = s.replace(/,\s*$/, '');
  s = s.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '');
  if (s.match(/:\s*"[^"]*$/)) s += '"';
  s = s.replace(/,\s*"[^"]*"?\s*:?\s*$/, '');
  s = s.replace(/,\s*$/, '');

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if ((ch === '}' || ch === ']') && stack.length > 0) stack.pop();
  }

  if (inString) s += '"';
  while (stack.length > 0) s += stack.pop();
  return s;
}

function mapToResumeSchema(raw: Record<string, unknown>): ParsedResume {
  const pi = (raw.personalInfo || raw.personal_info || raw.basicInfo || raw.basic_info || {}) as Record<string, unknown>;
  const ji = (raw.jobIntention || raw.job_intention || {}) as Record<string, unknown>;

  const personalInfo = {
    fullName: str(pi.fullName || pi.name || pi.姓名 || ''),
    jobTitle: str(pi.jobTitle || pi.title || pi.position || ji.position || ji.jobTitle || pi.职位 || ''),
    age: str(pi.age || pi.年龄 || ''),
    gender: str(pi.gender || pi.sex || pi.性别 || ''),
    politicalStatus: str(pi.politicalStatus || pi.political_status || pi.政治面貌 || ''),
    ethnicity: str(pi.ethnicity || pi.nationality || pi.民族 || ''),
    hometown: str(pi.hometown || pi.nativePlace || pi.native_place || pi.籍贯 || ''),
    maritalStatus: str(pi.maritalStatus || pi.marital_status || pi.婚姻状况 || pi.婚姻 || ''),
    yearsOfExperience: str(pi.yearsOfExperience || pi.years_of_experience || pi.experience || pi.工作年限 || pi.工作经验 || ''),
    educationLevel: str(pi.educationLevel || pi.education_level || pi.education || pi.最高学历 || pi.学历 || ''),
    email: str(pi.email || pi.邮箱 || ''),
    phone: str(pi.phone || pi.tel || pi.mobile || pi.电话 || pi.手机 || ''),
    wechat: str(pi.wechat || pi.weixin || pi.微信 || ''),
    location: str(pi.location || pi.city || pi.address || ji.city || pi.地址 || pi.城市 || ''),
    website: str(pi.website || pi.url || pi.homepage || ''),
    linkedin: str(pi.linkedin || ''),
    github: str(pi.github || ''),
  };

  const summary = str(raw.summary || raw.objective || raw.selfIntroduction || raw.selfEvaluation || raw.profile || raw.about || '');
  const workExperience = mapArray(raw.workExperience || raw.work_experience || raw.experience || raw.work || [], (w) => ({
    company: str(w.company || w.companyName || w.employer || ''),
    position: str(w.position || w.title || w.jobTitle || w.role || ''),
    location: str(w.location || w.city || ''),
    startDate: str(w.startDate || w.start_date || w.startTime || ''),
    endDate: w.endDate === null || w.end_date === null || str(w.endDate || w.end_date || w.endTime || '') === '至今' ? null : str(w.endDate || w.end_date || w.endTime || ''),
    current: Boolean(w.current || w.isCurrent || str(w.endDate || w.end_date || '') === '至今'),
    description: str(w.description || w.desc || w.content || ''),
    highlights: toStringArray(w.highlights || w.achievements || w.bullets || w.duties || []),
  }));
  const education = mapArray(raw.education || raw.edu || [], (e) => ({
    institution: str(e.institution || e.school || e.university || e.college || e.schoolName || ''),
    degree: str(e.degree || e.学历 || ''),
    field: str(e.field || e.major || e.专业 || ''),
    location: str(e.location || ''),
    startDate: str(e.startDate || e.start_date || e.startTime || ''),
    endDate: str(e.endDate || e.end_date || e.endTime || ''),
    gpa: str(e.gpa || e.GPA || ''),
    highlights: toStringArray(e.highlights || e.achievements || e.courses || []),
  }));
  const skills = mapSkills(raw.skills || raw.skill || []);
  const projects = mapArray(raw.projects || raw.project || [], (p) => ({
    name: str(p.name || p.projectName || p.title || ''),
    url: str(p.url || p.link || ''),
    startDate: str(p.startDate || p.start_date || ''),
    endDate: str(p.endDate || p.end_date || ''),
    description: str(p.description || p.desc || p.content || ''),
    technologies: toStringArray(p.technologies || p.tech || p.techStack || p.skills || []),
    highlights: toStringArray(p.highlights || p.achievements || []),
  }));
  const certifications = mapArray(raw.certifications || raw.certificates || raw.certs || [], (c) => ({
    name: str(c.name || c.title || ''),
    issuer: str(c.issuer || c.organization || c.org || ''),
    date: str(c.date || c.issueDate || ''),
    url: str(c.url || ''),
  }));
  const languages = mapArray(raw.languages || raw.language || [], (l) => ({
    language: str(l.language || l.name || ''),
    proficiency: str(l.proficiency || l.level || ''),
  }));

  return {
    personalInfo,
    ...(summary ? { summary } : {}),
    ...(workExperience.length ? { workExperience } : {}),
    ...(education.length ? { education } : {}),
    ...(skills.length ? { skills } : {}),
    ...(projects.length ? { projects } : {}),
    ...(certifications.length ? { certifications } : {}),
    ...(languages.length ? { languages } : {}),
  };
}

function clearAnalysisThemeConfig(themeConfig: unknown) {
  if (!themeConfig || typeof themeConfig !== 'object' || Array.isArray(themeConfig)) return {};
  const next = { ...(themeConfig as Record<string, unknown>) };
  delete next.analysisJob;
  return next;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function mapArray<T>(raw: unknown, mapper: (item: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => mapper(item as Record<string, unknown>));
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value)).filter(Boolean);
}

function mapSkills(raw: unknown): { name: string; skills: string[] }[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (typeof raw[0] === 'object' && raw[0] !== null) {
      return raw.map((s: Record<string, unknown>) => ({
        name: str(s.name || s.category || s.type || s.group || 'Skills'),
        skills: toStringArray(s.skills || s.items || s.list || s.keywords || []),
      })).filter((s) => s.skills.length > 0);
    }
    if (typeof raw[0] === 'string') return [{ name: 'Skills', skills: raw.map(String) }];
  }

  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value))
      .map(([name, value]) => ({ name, skills: (value as unknown[]).map(String) }));
  }

  return [];
}

function buildSections(parsed: ParsedResume, language: string) {
  const isEn = language === 'en';
  const sections: { type: string; title: string; content: unknown }[] = [];

  sections.push({
    type: 'personal_info',
    title: isEn ? 'Personal Info' : '个人信息',
    content: {
      fullName: parsed.personalInfo?.fullName || '',
      jobTitle: parsed.personalInfo?.jobTitle || '',
      age: parsed.personalInfo?.age || '',
      gender: parsed.personalInfo?.gender || '',
      politicalStatus: parsed.personalInfo?.politicalStatus || '',
      ethnicity: parsed.personalInfo?.ethnicity || '',
      hometown: parsed.personalInfo?.hometown || '',
      maritalStatus: parsed.personalInfo?.maritalStatus || '',
      yearsOfExperience: parsed.personalInfo?.yearsOfExperience || '',
      educationLevel: parsed.personalInfo?.educationLevel || '',
      email: parsed.personalInfo?.email || '',
      phone: parsed.personalInfo?.phone || '',
      wechat: parsed.personalInfo?.wechat || '',
      location: parsed.personalInfo?.location || '',
      website: parsed.personalInfo?.website || '',
      linkedin: parsed.personalInfo?.linkedin || '',
      github: parsed.personalInfo?.github || '',
    },
  });

  if (parsed.summary) sections.push({ type: 'summary', title: isEn ? 'Summary' : '个人简介', content: { text: parsed.summary } });
  if (parsed.workExperience?.length) sections.push({
    type: 'work_experience',
    title: isEn ? 'Work Experience' : '工作经历',
    content: { items: parsed.workExperience.map((w) => ({ id: crypto.randomUUID(), company: w.company, position: w.position, location: w.location || '', startDate: w.startDate, endDate: w.endDate, current: w.current, description: w.description, highlights: w.highlights })) },
  });
  if (parsed.education?.length) sections.push({
    type: 'education',
    title: isEn ? 'Education' : '教育背景',
    content: { items: parsed.education.map((e) => ({ id: crypto.randomUUID(), institution: e.institution, degree: e.degree, field: e.field, location: e.location || '', startDate: e.startDate, endDate: e.endDate, gpa: e.gpa || '', highlights: e.highlights })) },
  });
  if (parsed.skills?.length) sections.push({
    type: 'skills',
    title: isEn ? 'Skills' : '技能特长',
    content: { categories: parsed.skills.map((s) => ({ id: crypto.randomUUID(), name: s.name, skills: s.skills })) },
  });
  if (parsed.projects?.length) sections.push({
    type: 'projects',
    title: isEn ? 'Projects' : '项目经历',
    content: { items: parsed.projects.map((p) => ({ id: crypto.randomUUID(), name: p.name, url: p.url || '', startDate: p.startDate || '', endDate: p.endDate || '', description: p.description, technologies: p.technologies, highlights: p.highlights })) },
  });
  if (parsed.certifications?.length) sections.push({
    type: 'certifications',
    title: isEn ? 'Certifications' : '资格证书',
    content: { items: parsed.certifications.map((c) => ({ id: crypto.randomUUID(), name: c.name, issuer: c.issuer, date: c.date, url: c.url || '' })) },
  });
  if (parsed.languages?.length) sections.push({
    type: 'languages',
    title: isEn ? 'Languages' : '语言能力',
    content: { items: parsed.languages.map((l) => ({ id: crypto.randomUUID(), language: l.language, proficiency: l.proficiency })) },
  });

  return sections;
}
