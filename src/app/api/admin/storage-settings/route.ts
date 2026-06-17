import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { userRepository } from '@/lib/db/repositories/user.repository';
import {
  getGlobalStorageSettings,
  normalizeQiniuStorageConfig,
  readStoredQiniuStorageConfig,
  sanitizeQiniuStorageConfig,
  type QiniuProtocol,
} from '@/lib/storage/qiniu-config';

function stringInput(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function protocolInput(value: unknown): QiniuProtocol {
  return stringInput(value).toLowerCase() === 'http' ? 'http' : 'https';
}

function sanitizeSettings(settings: Awaited<ReturnType<typeof getGlobalStorageSettings>>) {
  return {
    provider: settings.provider,
    qiniu: sanitizeQiniuStorageConfig(settings.qiniu),
  };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const settings = await getGlobalStorageSettings();
    return NextResponse.json(sanitizeSettings(settings));
  } catch (error) {
    console.error('GET /api/admin/storage-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const rawSettings = await userRepository.getGlobalSettings();
    const currentStored = readStoredQiniuStorageConfig(rawSettings);
    const currentResolved = await getGlobalStorageSettings();
    const currentSecretKey = currentResolved.qiniu.source === 'db'
      ? currentStored.secretKey
      : '';
    const body = await request.json().catch(() => ({}));
    const rawQiniu = body && typeof body === 'object' && !Array.isArray(body) && 'qiniu' in body
      ? (body as Record<string, unknown>).qiniu
      : body;
    const qiniu = rawQiniu && typeof rawQiniu === 'object' && !Array.isArray(rawQiniu)
      ? rawQiniu as Record<string, unknown>
      : {};
    const incomingSecretKey = stringInput(qiniu.secretKey);
    const nextQiniu = normalizeQiniuStorageConfig({
      enabled: Boolean(qiniu.enabled),
      accessKey: stringInput(qiniu.accessKey),
      secretKey: incomingSecretKey || currentSecretKey,
      bucket: stringInput(qiniu.bucket),
      region: stringInput(qiniu.region) || 'z0',
      domain: stringInput(qiniu.domain),
      protocol: protocolInput(qiniu.protocol),
      keyPrefix: stringInput(qiniu.keyPrefix),
      publicRead: qiniu.publicRead !== false,
    }, 'db');

    const storedQiniu: Record<string, unknown> = {
      enabled: nextQiniu.enabled,
      accessKey: nextQiniu.accessKey,
      bucket: nextQiniu.bucket,
      region: nextQiniu.region,
      domain: nextQiniu.domain,
      protocol: nextQiniu.protocol,
      keyPrefix: nextQiniu.keyPrefix,
      publicRead: nextQiniu.publicRead,
    };
    if (nextQiniu.secretKey) {
      storedQiniu.secretKey = nextQiniu.secretKey;
    }

    await userRepository.updateGlobalSettings({
      storage: {
        provider: 'qiniu',
        qiniu: storedQiniu,
      },
    });

    const updatedSettings = await getGlobalStorageSettings();
    return NextResponse.json(sanitizeSettings(updatedSettings));
  } catch (error) {
    console.error('PUT /api/admin/storage-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
