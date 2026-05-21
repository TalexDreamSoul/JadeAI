import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type Check = {
  name: string;
  ok: boolean;
  detail?: unknown;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codexConfigPath = path.join(os.homedir(), '.codex', 'config.toml');
const requireCodexConfig = process.argv.includes('--require-codex-config');

const requiredReadTools = [
  'list_resumes',
  'get_resume',
  'list_jd_analyses',
  'get_jd_analysis',
  'list_analyses',
  'get_analysis',
  'search_knowledge',
  'analyze_resume_readiness',
  'get_resume_context_pack',
  'draft_project_for_resume',
  'list_resume_chats',
  'get_resume_chat',
  'summarize_resume_chats',
];

const requiredWriteTools = [
  'create_resume_version',
  'update_resume_section',
  'apply_suggestion',
  'create_role_resume',
];

function assertFile(relativePath: string) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function readText(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function isExecutable(relativePath: string) {
  try {
    fs.accessSync(path.join(projectRoot, relativePath), fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasText(relativePath: string, expected: string) {
  return assertFile(relativePath) && readText(relativePath).includes(expected);
}

function check(name: string, ok: boolean, detail?: unknown): Check {
  return { name, ok, detail };
}

async function main() {
  process.env.SKIP_DB_INIT = '1';
  const { resumeMcpTools } = await import('../src/lib/mcp/resume-tools');
  const toolNames = resumeMcpTools.map((tool: { name: string }) => tool.name);
  const missingReadTools = requiredReadTools.filter((name) => !toolNames.includes(name));
  const missingWriteTools = requiredWriteTools.filter((name) => !toolNames.includes(name));
  const toolSource = readText('src/lib/mcp/resume-tools.ts');
  const codexConfig = fs.existsSync(codexConfigPath) ? fs.readFileSync(codexConfigPath, 'utf8') : '';
  const codexInstalled = codexConfig.includes('[mcp_servers.jadeai-resume]')
    && codexConfig.includes('scripts/jadeai-resume-mcp.sh');

  const checks = [
    check('Phase 2 read tools registered', missingReadTools.length === 0, { missingReadTools }),
    check('Phase 3 write tools registered', missingWriteTools.length === 0, { missingWriteTools }),
    check('Write tools default to preview/apply gate', toolSource.includes("const apply = boolArg(args, 'apply', false)") && toolSource.includes("if (!apply)")),
    check('Write tools require MCP version source', toolSource.includes("version.source !== 'mcp'")),
    check('Readiness analysis includes mindmap/memory/learning hints', toolSource.includes('analyzeResumeReadiness') && toolSource.includes('learningPlanHints') && toolSource.includes('memoryCoverage')),
    check('Context pack includes analyses, memory, chats, and safe actions', toolSource.includes('getResumeContextPack') && toolSource.includes('suggestedAgentActions') && toolSource.includes('findSessionWithMessages')),
    check('Project drafting is preview-only and points to versioned write flow', toolSource.includes('draftProjectForResume') && toolSource.includes("mode: 'preview'") && toolSource.includes('create_resume_version')),
    check('Chat summary extracts action items and memory drafts', toolSource.includes('summarizeResumeChats') && toolSource.includes('memoryDraftsFromMessages') && toolSource.includes('actionItemsFromMessages')),
    check('MCP stdio entry exists', assertFile('scripts/jadeai-resume-mcp.ts')),
    check('MCP wrapper exists and is executable', assertFile('scripts/jadeai-resume-mcp.sh') && isExecutable('scripts/jadeai-resume-mcp.sh')),
    check('Codex install dry-run script exists', assertFile('scripts/install-jadeai-resume-mcp.ts')),
    check('Behavior smoke script exists', assertFile('scripts/smoke-jadeai-resume-mcp.ts')),
    check('Package scripts expose MCP commands', hasText('package.json', '"mcp:resume"') && hasText('package.json', '"smoke:mcp:resume"') && hasText('package.json', '"mcp:resume:install"')),
    check('MCP docs cover local clients and safety gates', hasText('docs/mcp/jadeai-resume-mcp.md', 'Codex 配置示例') && hasText('docs/mcp/jadeai-resume-mcp.md', '写入安全约束')),
    check('Codex config installed', codexInstalled, { codexConfigPath, required: requireCodexConfig }),
  ];

  const failed = checks.filter((item) => !item.ok && (item.name !== 'Codex config installed' || requireCodexConfig));
  console.log(JSON.stringify({
    ok: failed.length === 0,
    requireCodexConfig,
    toolCount: toolNames.length,
    tools: toolNames,
    checks,
  }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
