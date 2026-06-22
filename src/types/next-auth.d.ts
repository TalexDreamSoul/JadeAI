import type { DefaultSession } from 'next-auth';

type AuthSessionRole = 'user' | 'admin';

declare module 'next-auth' {
  interface Session {
    user?: {
      id: string;
      role: AuthSessionRole;
    } & DefaultSession['user'];
  }

  interface User {
    role?: AuthSessionRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: AuthSessionRole;
  }
}
