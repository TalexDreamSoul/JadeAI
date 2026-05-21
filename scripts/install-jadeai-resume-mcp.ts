import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type InstallOptions = {
  apply: boolean;
  configPath: string;
  commandPath: string;
  env: Record<string, string>;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultConfigPath = path.join(os.homedir(), '.codex', 'config.toml');
const defaultCommandPath = path.join(projectRoot, 'scripts', 'jadeai-resume-mcp.sh');
const managedSections = new Set([
  'mcp_servers.jadeai-resume',
  'mcp_servers.jadeai-resume.env',
]);

function usage() {
  return [
    'Usage: pnpm run mcp:resume:install -- [--apply] [--config <path>] [--user-id <id> | --user-email <email> | --fingerprint <fingerprint>]',
    '',
    'Default mode is dry-run. Pass --apply to write the Codex config file.',
  ].join('\n');
}

function takeValue(args: string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseArgs(argv: string[]): InstallOptions {
  let apply = false;
  let configPath = defaultConfigPath;
  let userId = '';
  let userEmail = '';
  let fingerprint = 'demo-fingerprint';

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--config') {
      configPath = path.resolve(takeValue(argv, index, arg));
      index++;
    } else if (arg === '--user-id') {
      userId = takeValue(argv, index, arg);
      index++;
    } else if (arg === '--user-email') {
      userEmail = takeValue(argv, index, arg);
      index++;
    } else if (arg === '--fingerprint') {
      fingerprint = takeValue(argv, index, arg);
      index++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const env: Record<string, string> = {};
  if (userId) {
    env.JADEAI_MCP_USER_ID = userId;
  } else if (userEmail) {
    env.JADEAI_MCP_USER_EMAIL = userEmail;
  } else {
    env.JADEAI_MCP_FINGERPRINT = fingerprint;
  }

  return {
    apply,
    configPath,
    commandPath: defaultCommandPath,
    env,
  };
}

function tomlString(value: string) {
  return JSON.stringify(value);
}

function renderBlock(options: InstallOptions) {
  const envLines = Object.entries(options.env)
    .map(([key, value]) => `${key} = ${tomlString(value)}`)
    .join('\n');

  return [
    '[mcp_servers.jadeai-resume]',
    'type = "stdio"',
    `command = ${tomlString(options.commandPath)}`,
    '',
    '[mcp_servers.jadeai-resume.env]',
    envLines,
  ].join('\n');
}

function sectionName(line: string) {
  const match = line.match(/^\s*\[([^\]]+)]\s*$/);
  return match?.[1]?.trim() || null;
}

function removeManagedSections(content: string) {
  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let skipped = false;

  for (const line of lines) {
    const currentSection = sectionName(line);
    if (currentSection) {
      skipped = managedSections.has(currentSection);
    }
    if (!skipped) kept.push(line);
  }

  return kept.join('\n').replace(/\s+$/, '');
}

function installConfig(existing: string, block: string) {
  const base = removeManagedSections(existing);
  return base ? `${base}\n\n${block}\n` : `${block}\n`;
}

function backupConfig(configPath: string) {
  if (!fs.existsSync(configPath)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${configPath}.jadeai-resume-mcp.${timestamp}.bak`;
  fs.copyFileSync(configPath, backupPath);
  return backupPath;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.commandPath)) {
    throw new Error(`MCP wrapper not found: ${options.commandPath}`);
  }

  const existing = fs.existsSync(options.configPath)
    ? fs.readFileSync(options.configPath, 'utf8')
    : '';
  const block = renderBlock(options);
  const next = installConfig(existing, block);
  const changed = existing !== next;

  if (!options.apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      changed,
      configPath: options.configPath,
      commandPath: options.commandPath,
      env: options.env,
      block,
      nextStep: 'Run with --apply after explicit confirmation to write the Codex config.',
    }, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(options.configPath), { recursive: true });
  const backupPath = backupConfig(options.configPath);
  fs.writeFileSync(options.configPath, next, 'utf8');
  console.log(JSON.stringify({
    mode: 'applied',
    changed,
    configPath: options.configPath,
    backupPath,
    commandPath: options.commandPath,
    env: options.env,
  }, null, 2));
}

main();
