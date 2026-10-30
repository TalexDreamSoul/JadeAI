import { eq } from 'drizzle-orm';
import { hashPasswordForAuth, normalizeEmail } from '@/lib/auth/password';
import { users } from './schema';

const DEFAULT_ADMIN_EMAIL = 'admin@jadeai.local';
const MIN_ADMIN_PASSWORD_LENGTH = 12;

type AdminSeedEnvironment = Record<string, string | undefined>;

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

export function resolveAdminSeedCredentials(env: AdminSeedEnvironment = process.env) {
  const password = env.ADMIN_PASSWORD;
  if (!password) return null;
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }

  return {
    email: normalizeEmail(env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL),
    password,
  };
}

export async function ensureAdminUser(db: unknown) {
  const client = db as AdminSeedDb;
  const existingAdmins = await client.select().from(users).where(eq(users.role, 'admin')).limit(1);
  if (existingAdmins[0]) return;

  const credentials = resolveAdminSeedCredentials();
  if (!credentials) {
    console.warn('[Admin] No administrator exists and ADMIN_PASSWORD is not set; automatic creation skipped.');
    return;
  }

  const { email, password } = credentials;
  const existingUser = await client.select().from(users).where(eq(users.email, email)).limit(1);
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

  console.log(`[Admin] Initial administrator account created for ${email}.`);
  console.log('[Admin] Remove ADMIN_PASSWORD from the runtime environment after verifying access.');
}
