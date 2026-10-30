import { eq } from 'drizzle-orm';
import { db, dbReady } from '@/lib/db';
import { aiChannels, users } from '@/lib/db/schema';
import { aiChannelRepository } from '@/lib/db/repositories/ai-channel.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { getGlobalStorageSettings } from '@/lib/storage/qiniu-config';
import { isEncryptedSecret } from '@/lib/security/secret-crypto';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

async function main() {
  await dbReady;
  const adminId = `smoke-secret-admin-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: adminId,
    email: `${adminId}@example.test`,
    authType: 'password',
    name: 'Smoke Secret Admin',
    role: 'admin',
  });

  const channel = await aiChannelRepository.create({
    name: 'Smoke encrypted channel',
    provider: 'openai',
    apiKey: 'smoke-ai-private-key',
    baseUrl: 'https://example.test/v1',
    model: 'smoke-model',
  });
  assert(channel?.apiKey === 'smoke-ai-private-key', 'repository should return decrypted AI key');
  const rawChannels = await db.select().from(aiChannels).where(eq(aiChannels.id, channel.id)).limit(1);
  assert(isEncryptedSecret(rawChannels[0]?.apiKey || ''), 'database should contain encrypted AI key');
  assert(!rawChannels[0]?.apiKey.includes('smoke-ai-private-key'), 'AI key ciphertext must not contain plaintext');

  await userRepository.updateGlobalSettings({
    storage: {
      provider: 'qiniu',
      qiniu: {
        enabled: true,
        accessKey: 'smoke-access-key',
        secretKey: 'smoke-storage-private-key',
        bucket: 'smoke-bucket',
        region: 'z0',
        domain: 'storage.example.test',
        protocol: 'https',
        keyPrefix: 'uploads',
        publicRead: true,
      },
    },
  });
  const storage = await getGlobalStorageSettings();
  assert(storage.qiniu.secretKey === 'smoke-storage-private-key', 'storage config should decrypt the stored key');
  const admin = await userRepository.findById(adminId);
  const settings = record(admin?.settings);
  const storedStorage = record(settings.storage);
  const storedQiniu = record(storedStorage.qiniu);
  assert(isEncryptedSecret(String(storedQiniu.secretKey || '')), 'legacy storage key should migrate to ciphertext');

  console.log('[smoke] secret encryption at rest passed');
}

main().catch((error) => {
  console.error('[smoke] secret encryption at rest failed');
  console.error(error);
  process.exit(1);
});
