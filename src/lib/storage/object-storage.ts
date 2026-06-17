import { getGlobalStorageSettings } from './qiniu-config';
import { downloadQiniuObject, uploadQiniuObject, type QiniuStoredObject } from './qiniu-client';

export type DatabaseStoredObject = {
  provider: 'database';
  storedAt: string;
};

export type StoredObject = QiniuStoredObject | DatabaseStoredObject;

export async function storeObject(input: {
  key: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<QiniuStoredObject | null> {
  const storageSettings = await getGlobalStorageSettings();
  if (!storageSettings.qiniu.enabled) return null;

  return uploadQiniuObject({
    config: storageSettings.qiniu,
    key: input.key,
    buffer: input.buffer,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });
}

export function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'png';
}

export async function storeDataUrlObject(input: {
  key: string;
  dataUrl: string;
  fileNameBase: string;
}): Promise<QiniuStoredObject | null> {
  const parsed = parseDataUrl(input.dataUrl);
  if (!parsed) return null;
  const extension = extensionForMimeType(parsed.mimeType);
  return storeObject({
    key: `${input.key}.${extension}`,
    buffer: parsed.buffer,
    fileName: `${input.fileNameBase}.${extension}`,
    mimeType: parsed.mimeType,
  });
}

export async function readStoredObject(storage: unknown): Promise<Buffer | null> {
  if (!storage || typeof storage !== 'object' || Array.isArray(storage)) return null;
  const object = storage as Record<string, unknown>;
  if (object.provider !== 'qiniu' || typeof object.key !== 'string') return null;

  const storageSettings = await getGlobalStorageSettings();
  return downloadQiniuObject({
    config: storageSettings.qiniu,
    key: object.key,
    publicRead: object.publicRead !== false,
  });
}

export function databaseStoredObject(): DatabaseStoredObject {
  return { provider: 'database', storedAt: new Date().toISOString() };
}
