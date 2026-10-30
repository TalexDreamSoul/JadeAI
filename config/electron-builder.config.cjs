/* eslint-disable @typescript-eslint/no-require-imports */
const { cpSync, existsSync, readFileSync, statSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const includeLocalRuntime = process.env.JADE_DESKTOP_INCLUDE_LOCAL === 'true';
const appleApiNotarization = Boolean(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);
const appleIdNotarization = Boolean(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID);
const extraResources = [
  { from: 'config/desktop-runtime.json', to: 'desktop-runtime.json' },
  { from: 'resources/splash.html', to: 'splash.html' },
  { from: 'resources/startup-error.html', to: 'startup-error.html' },
];
const MAX_CLOUD_ASAR_BYTES = 16 * 1024 * 1024;

function enforceMacTransportSecurity(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const infoPlist = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents',
    'Info.plist',
  );
  execFileSync('plutil', [
    '-replace',
    'NSAppTransportSecurity.NSAllowsArbitraryLoads',
    '-bool',
    'NO',
    infoPlist,
  ]);
  const arbitraryLoads = execFileSync('plutil', [
    '-extract',
    'NSAppTransportSecurity.NSAllowsArbitraryLoads',
    'raw',
    infoPlist,
  ], { encoding: 'utf8' }).trim();
  if (arbitraryLoads !== 'false') {
    throw new Error('macOS package must disable NSAllowsArbitraryLoads');
  }
}

function verifyCloudPackage(resources) {
  const runtimeConfigPath = join(resources, 'desktop-runtime.json');
  const runtimeConfig = JSON.parse(readFileSync(runtimeConfigPath, 'utf8'));
  if (runtimeConfig.mode !== 'remote') {
    throw new Error('Cloud desktop package must use remote runtime mode');
  }
  const remoteUrl = new URL(runtimeConfig.remoteUrl);
  if (remoteUrl.protocol !== 'https:') {
    throw new Error('Cloud desktop package requires an HTTPS remoteUrl');
  }

  for (const required of ['splash.html', 'startup-error.html']) {
    if (!existsSync(join(resources, required))) {
      throw new Error(`Cloud desktop package is missing ${required}`);
    }
  }
  for (const forbidden of ['standalone', 'drizzle', join('app.asar.unpacked', 'node_modules')]) {
    if (existsSync(join(resources, forbidden))) {
      throw new Error(`Cloud desktop package unexpectedly contains ${forbidden}`);
    }
  }

  const appAsarBytes = statSync(join(resources, 'app.asar')).size;
  if (appAsarBytes > MAX_CLOUD_ASAR_BYTES) {
    throw new Error(`Cloud desktop app.asar is unexpectedly large: ${appAsarBytes} bytes`);
  }
}

if (includeLocalRuntime) {
  extraResources.push(
    { from: '.next/standalone', to: 'standalone' },
    { from: '.next/static', to: 'standalone/.next/static' },
    { from: 'public', to: 'standalone/public' },
    { from: 'drizzle/migrations', to: 'drizzle/migrations' },
  );
}

module.exports = {
  appId: 'com.jadeai.desktop',
  productName: 'JadeAI',
  directories: { output: 'release' },
  artifactName: 'JadeAI-${version}-${os}-${arch}.${ext}',
  asar: true,
  npmRebuild: includeLocalRuntime,
  icon: 'public/logo.png',
  files: ['out/main/**', 'out/preload/**', 'package.json', '!node_modules{,/**/*}'],
  extraResources,
  publish: [{ provider: 'github', owner: 'TalexDreamSoul', repo: 'jadeai' }],
  afterPack(context) {
    enforceMacTransportSecurity(context);
    const resources = context.electronPlatformName === 'darwin'
      ? join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : join(context.appOutDir, 'resources');
    if (!includeLocalRuntime) {
      verifyCloudPackage(resources);
      return;
    }
    const runtimeConfigPath = join(resources, 'desktop-runtime.json');
    const runtimeConfig = JSON.parse(readFileSync(runtimeConfigPath, 'utf8'));
    writeFileSync(runtimeConfigPath, `${JSON.stringify({ ...runtimeConfig, mode: 'local' }, null, 2)}\n`);
    const source = join(context.packager.projectDir, '.next', 'standalone', 'node_modules');
    const destination = join(resources, 'standalone', 'node_modules');
    if (!existsSync(source)) throw new Error('Missing standalone node_modules; run pnpm build first');
    cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
  },
  afterSign(context) {
    if (includeLocalRuntime) return;
    const createsUpdateArtifact = [...context.targets]
      .some((target) => target.name === 'dmg' || target.name === 'zip');
    if (!createsUpdateArtifact) return;
    const resources = context.electronPlatformName === 'darwin'
      ? join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : join(context.appOutDir, 'resources');
    if (!existsSync(join(resources, 'app-update.yml'))) {
      throw new Error('Cloud desktop package is missing app-update.yml');
    }
  },
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'config/entitlements.mac.plist',
    entitlementsInherit: 'config/entitlements.mac.plist',
    notarize: appleApiNotarization || appleIdNotarization,
    extendInfo: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          '127.0.0.1': {
            NSIncludesSubdomains: false,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
          },
          localhost: {
            NSIncludesSubdomains: false,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
    },
  },
  win: { target: ['nsis'] },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true },
};
