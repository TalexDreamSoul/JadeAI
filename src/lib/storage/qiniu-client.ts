import crypto from 'crypto';
import {
  buildQiniuObjectUrl,
  getQiniuObjectKey,
  getQiniuPublicBaseUrl,
  isQiniuStorageConfigured,
  type QiniuStorageConfig,
} from './qiniu-config';

export type QiniuStoredObject = {
  provider: 'qiniu';
  bucket: string;
  key: string;
  hash?: string;
  url: string;
  publicRead: boolean;
  region: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

const UPLOAD_ENDPOINT_BY_REGION: Record<string, string> = {
  z0: 'https://up.qiniup.com',
  z1: 'https://up-z1.qiniup.com',
  z2: 'https://up-z2.qiniup.com',
  na0: 'https://up-na0.qiniup.com',
  as0: 'https://up-as0.qiniup.com',
  'cn-east-2': 'https://up-cn-east-2.qiniup.com',
};

function urlSafeBase64(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function hmacSha1UrlSafe(secretKey: string, data: string): string {
  return crypto.createHmac('sha1', secretKey).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function getUploadEndpoint(region: string): string {
  return UPLOAD_ENDPOINT_BY_REGION[region] || UPLOAD_ENDPOINT_BY_REGION.z0;
}

function createUploadToken(config: QiniuStorageConfig, objectKey: string) {
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const putPolicy = {
    scope: `${config.bucket}:${objectKey}`,
    deadline,
    insertOnly: 1,
  };
  const encodedPolicy = urlSafeBase64(JSON.stringify(putPolicy));
  const encodedSign = hmacSha1UrlSafe(config.secretKey, encodedPolicy);
  return `${config.accessKey}:${encodedSign}:${encodedPolicy}`;
}

function createPrivateDownloadUrl(config: QiniuStorageConfig, objectKey: string) {
  const baseUrl = buildQiniuObjectUrl(objectKey, { ...config, keyPrefix: '' });
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const urlWithDeadline = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}e=${deadline}`;
  const token = `${config.accessKey}:${hmacSha1UrlSafe(config.secretKey, urlWithDeadline)}`;
  return `${urlWithDeadline}&token=${token}`;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function assertReadyForUpload(config: QiniuStorageConfig) {
  if (!isQiniuStorageConfigured(config)) {
    throw new Error('Qiniu storage is enabled but not fully configured');
  }
}

function assertReadyForDownload(config: QiniuStorageConfig) {
  if (!config.accessKey || !config.secretKey || !config.bucket || !config.domain) {
    throw new Error('Qiniu storage file exists, but Qiniu credentials/domain are not configured');
  }
}

export async function uploadQiniuObject(input: {
  config: QiniuStorageConfig;
  key: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<QiniuStoredObject> {
  assertReadyForUpload(input.config);

  const objectKey = getQiniuObjectKey(input.key, input.config.keyPrefix);
  const token = createUploadToken(input.config, objectKey);
  const formData = new FormData();
  formData.append('token', token);
  formData.append('key', objectKey);
  formData.append('file', new Blob([toArrayBuffer(input.buffer)], { type: input.mimeType || 'application/octet-stream' }), input.fileName);

  const response = await fetch(getUploadEndpoint(input.config.region), {
    method: 'POST',
    body: formData,
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : text;
    throw new Error(`Qiniu upload failed: ${message || response.statusText}`);
  }

  return {
    provider: 'qiniu',
    bucket: input.config.bucket,
    key: String(payload.key || objectKey),
    hash: typeof payload.hash === 'string' ? payload.hash : undefined,
    url: buildQiniuObjectUrl(String(payload.key || objectKey), { ...input.config, keyPrefix: '' }),
    publicRead: input.config.publicRead,
    region: input.config.region,
    size: input.buffer.length,
    mimeType: input.mimeType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function downloadQiniuObject(input: {
  config: QiniuStorageConfig;
  key: string;
  publicRead?: boolean;
}): Promise<Buffer> {
  assertReadyForDownload(input.config);

  const url = input.publicRead === false
    ? createPrivateDownloadUrl(input.config, input.key)
    : `${getQiniuPublicBaseUrl(input.config)}/${input.key.split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Qiniu download failed: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
