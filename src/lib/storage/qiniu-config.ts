export type StorageProvider = 'qiniu';
export type QiniuStorageSource = 'db' | 'env' | 'none';
export type QiniuProtocol = 'https' | 'http';

export interface QiniuStorageConfig {
  provider: 'qiniu';
  enabled: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  domain: string;
  protocol: QiniuProtocol;
  keyPrefix: string;
  publicRead: boolean;
  source: QiniuStorageSource;
}

export interface GlobalStorageSettings {
  provider: StorageProvider;
  qiniu: QiniuStorageConfig;
}

export type SanitizedQiniuStorageConfig = Omit<QiniuStorageConfig, 'secretKey'> & {
  configured: boolean;
  secretKeySet: boolean;
  uploadBaseUrl: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringSetting(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function optionalStringSetting(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function boolSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function optionalBoolSetting(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function envString(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function cleanDomain(value: unknown): string {
  return stringSetting(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function normalizeProtocol(value: unknown): QiniuProtocol {
  return stringSetting(value, 'https').toLowerCase() === 'http' ? 'http' : 'https';
}

function normalizeKeyPrefix(value: unknown): string {
  const prefix = stringSetting(value).replace(/^\/+/, '').replace(/\/+$/, '');
  return prefix ? `${prefix}/` : '';
}

function hasConfigValue(config: Partial<QiniuStorageConfig>): boolean {
  return !!(config.accessKey || config.secretKey || config.bucket || config.domain);
}

function getEnvQiniuStorageConfig(): Partial<QiniuStorageConfig> {
  const provider = envString('STORAGE_PROVIDER').toLowerCase();
  const rawEnabled = process.env.QINIU_STORAGE_ENABLED;
  const rawPublicRead = process.env.QINIU_PUBLIC_READ;
  const protocol = envString('QINIU_PROTOCOL') || envString('STORAGE_QINIU_PROTOCOL');
  const config: Partial<QiniuStorageConfig> = {
    accessKey: envString('QINIU_ACCESS_KEY') || envString('STORAGE_QINIU_ACCESS_KEY'),
    secretKey: envString('QINIU_SECRET_KEY') || envString('STORAGE_QINIU_SECRET_KEY'),
    bucket: envString('QINIU_BUCKET') || envString('STORAGE_QINIU_BUCKET'),
    region: envString('QINIU_REGION') || envString('QINIU_ZONE') || envString('STORAGE_QINIU_REGION'),
    domain: envString('QINIU_DOMAIN') || envString('QINIU_BUCKET_DOMAIN') || envString('STORAGE_QINIU_DOMAIN'),
    keyPrefix: envString('QINIU_KEY_PREFIX') || envString('STORAGE_QINIU_KEY_PREFIX'),
  };
  if (provider === 'qiniu' || rawEnabled !== undefined) {
    config.enabled = envBool('QINIU_STORAGE_ENABLED', provider === 'qiniu');
  }
  if (protocol) {
    config.protocol = normalizeProtocol(protocol);
  }
  if (rawPublicRead !== undefined) {
    config.publicRead = envBool('QINIU_PUBLIC_READ', true);
  }
  return config;
}

export function readStoredQiniuStorageConfig(rawSettings: Record<string, unknown>): Partial<QiniuStorageConfig> {
  const storage = asRecord(rawSettings.storage);
  const nestedQiniu = asRecord(storage.qiniu);
  const raw = Object.keys(nestedQiniu).length > 0 ? nestedQiniu : storage.provider === 'qiniu' ? storage : {};
  const result: Partial<QiniuStorageConfig> = {};

  const enabled = optionalBoolSetting(raw.enabled);
  const publicRead = optionalBoolSetting(raw.publicRead);
  const accessKey = optionalStringSetting(raw.accessKey);
  const secretKey = optionalStringSetting(raw.secretKey);
  const bucket = optionalStringSetting(raw.bucket);
  const region = optionalStringSetting(raw.region);
  const domain = optionalStringSetting(raw.domain);
  const protocol = optionalStringSetting(raw.protocol);
  const keyPrefix = optionalStringSetting(raw.keyPrefix);

  if (enabled !== undefined) result.enabled = enabled;
  if (publicRead !== undefined) result.publicRead = publicRead;
  if (accessKey !== undefined) result.accessKey = accessKey;
  if (secretKey !== undefined) result.secretKey = secretKey;
  if (bucket !== undefined) result.bucket = bucket;
  if (region !== undefined) result.region = region;
  if (domain !== undefined) result.domain = domain;
  if (protocol !== undefined) result.protocol = normalizeProtocol(protocol);
  if (keyPrefix !== undefined) result.keyPrefix = keyPrefix;

  return result;
}

export function normalizeQiniuStorageConfig(
  input: Partial<QiniuStorageConfig>,
  source: QiniuStorageSource
): QiniuStorageConfig {
  return {
    provider: 'qiniu',
    enabled: boolSetting(input.enabled, false),
    accessKey: stringSetting(input.accessKey),
    secretKey: stringSetting(input.secretKey),
    bucket: stringSetting(input.bucket),
    region: stringSetting(input.region, 'z0'),
    domain: cleanDomain(input.domain),
    protocol: normalizeProtocol(input.protocol),
    keyPrefix: normalizeKeyPrefix(input.keyPrefix),
    publicRead: boolSetting(input.publicRead, true),
    source,
  };
}

export function isQiniuStorageConfigured(config: QiniuStorageConfig): boolean {
  return !!(config.enabled && config.accessKey && config.secretKey && config.bucket && config.region && config.domain);
}

export function getQiniuPublicBaseUrl(config: Pick<QiniuStorageConfig, 'domain' | 'protocol'>): string {
  const domain = cleanDomain(config.domain);
  if (!domain) return '';
  return `${normalizeProtocol(config.protocol)}://${domain}`;
}

export function getQiniuObjectKey(key: string, keyPrefix = ''): string {
  const cleanKey = stringSetting(key).replace(/^\/+/, '');
  const prefix = normalizeKeyPrefix(keyPrefix);
  return `${prefix}${cleanKey}`;
}

export function buildQiniuObjectUrl(key: string, config: QiniuStorageConfig): string {
  const baseUrl = getQiniuPublicBaseUrl(config);
  if (!baseUrl) return '';
  const objectKey = getQiniuObjectKey(key, config.keyPrefix);
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/${encodedKey}`;
}

export function sanitizeQiniuStorageConfig(config: QiniuStorageConfig): SanitizedQiniuStorageConfig {
  return {
    provider: config.provider,
    enabled: config.enabled,
    accessKey: config.accessKey,
    bucket: config.bucket,
    region: config.region,
    domain: config.domain,
    protocol: config.protocol,
    keyPrefix: config.keyPrefix,
    publicRead: config.publicRead,
    source: config.source,
    configured: isQiniuStorageConfigured(config),
    secretKeySet: !!config.secretKey,
    uploadBaseUrl: getQiniuPublicBaseUrl(config),
  };
}

export async function getGlobalStorageSettings(): Promise<GlobalStorageSettings> {
  const [{ dbReady }, { userRepository }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/db/repositories/user.repository'),
  ]);
  await dbReady;
  const rawSettings = await userRepository.getGlobalSettings();
  const envConfig = getEnvQiniuStorageConfig();
  const storedConfig = readStoredQiniuStorageConfig(rawSettings);
  const source: QiniuStorageSource = hasConfigValue(storedConfig)
    ? 'db'
    : hasConfigValue(envConfig)
      ? 'env'
      : 'none';

  return {
    provider: 'qiniu',
    qiniu: normalizeQiniuStorageConfig({ ...envConfig, ...storedConfig }, source),
  };
}
