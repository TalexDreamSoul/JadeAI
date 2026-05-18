import { eq } from 'drizzle-orm';
import { hashPasswordForAuth, normalizeEmail } from '@/lib/auth/password';
import { users } from './schema';

const DEFAULT_ADMIN_EMAIL = 'admin@touchresume.local';

type AdminSeedDb = {
  select: () => {
    from: (table: typeof users) => {
      where: (condition: unknown) => {
        limit: (count: number) => Promise<Array<{ id: string }>>;
      };
    };
  };
  insert: (table: typeof users) => {
    values: (value: Record<string, unknown>) => Promise<unknown>;
  };
  update: (table: typeof users) => {
    set: (value: Record<string, unknown>) => {
      where: (condition: unknown) => Promise<unknown>;
    };
  };
};

function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(bytes)
    .toString('base64url')
    .replace(/[-_]/g, '')
    .slice(0, 22);
}

export async function ensureAdminUser(db: unknown) {
  const client = db as AdminSeedDb;
  const existingAdmins = await client.select().from(users).where(eq(users.role, 'admin')).limit(1);
  if (existingAdmins[0]) return;

  const email = normalizeEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  const existingUser = await client.select().from(users).where(eq(users.email, email)).limit(1);
  const password = process.env.ADMIN_PASSWORD || generatePassword();
  const passwordHash = await hashPasswordForAuth(password);

  if (existingUser[0]) {
    await client
      .update(users)
      .set({
        passwordHash,
        authType: 'password',
        role: 'admin',
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser[0].id));
  } else {
    await client.insert(users).values({
      id: crypto.randomUUID(),
      email,
      name: 'Administrator',
      passwordHash,
      authType: 'password',
      role: 'admin',
    });
  }

  console.log('='.repeat(72));
  console.log('[Admin] Initial administrator account created');
  console.log(`[Admin] Email: ${email}`);
  console.log(`[Admin] Password: ${password}`);
  console.log('[Admin] Save this password now. It will not be shown again.');
  console.log('='.repeat(72));
}
