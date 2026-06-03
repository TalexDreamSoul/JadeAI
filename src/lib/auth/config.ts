import NextAuth from 'next-auth';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { createSampleResume } from '@/lib/db/sample-resume';
import { createRuntimeProviders } from './runtime-config';

type OAuthProfile = {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

/** Provider IDs that are OAuth-based (not credentials/password/fingerprint). */
const OAUTH_PROVIDER_IDS = new Set(['oidc']);

export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  trustHost: true,
  providers: await createRuntimeProviders(),
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // OIDC sign-in: create DB user on first login
      if (user && account?.provider && OAUTH_PROVIDER_IDS.has(account.provider)) {
        const email = (profile?.email || user.email) as string;
        const name = (profile?.name || user.name) as string | undefined;
        const avatar = ((profile as OAuthProfile | undefined)?.picture || user.image) as string | undefined;

        let dbUser = email ? await userRepository.findByEmail(email) : null;
        if (!dbUser) {
          const hasAdmin = await userRepository.findFirstAdmin();
          dbUser = await userRepository.create({
            email: email || undefined,
            name,
            avatarUrl: avatar,
            authType: 'oauth',
            role: hasAdmin ? 'user' : 'admin',
          });
          if (dbUser) {
            await createSampleResume(dbUser.id);
          }
        }
        if (dbUser) {
          token.userId = dbUser.id;
        }
        token.name = name;
        token.email = email;
        token.picture = avatar;
      }

      if (user && account?.provider === 'password') {
        token.userId = user.id;
        token.name = user.name;
        token.email = user.email;
      }

      // Credentials (fingerprint) mode
      if (user && account?.provider === 'credentials') {
        token.userId = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId || token.sub) as string;
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.AUTH_SECRET,
}));
