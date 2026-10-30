import NextAuth from 'next-auth';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { createSampleResume } from '@/lib/db/sample-resume';
import { createRuntimeProviders, getAdminEmails, getAuthMode } from './runtime-config';
import {
  canUseExistingAccountForOidc,
  resolveVerifiedOidcEmail,
  type OidcIdentityProfile,
} from './oidc-policy';

type OAuthProfile = {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  email_verified?: boolean;
};

type AuthSessionRole = 'user' | 'admin';

/** Provider IDs that are OAuth-based (not credentials/password/fingerprint). */
const OAUTH_PROVIDER_IDS = new Set(['oidc']);

export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  trustHost: true,
  providers: await createRuntimeProviders(),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account?.provider || !OAUTH_PROVIDER_IDS.has(account.provider)) return true;

      const email = resolveVerifiedOidcEmail(profile as OidcIdentityProfile | undefined, user.email);
      if (!email) return false;

      const existing = await userRepository.findByEmail(email);
      return canUseExistingAccountForOidc(existing);
    },
    async jwt({ token, user, account, profile }) {
      const setTokenUser = async (input: { id?: string | null; email?: string | null; name?: string | null; avatar?: string | null }) => {
        if (input.id) {
          token.userId = input.id;
        }
        token.name = input.name || undefined;
        token.email = input.email || undefined;
        token.picture = input.avatar || undefined;

        const dbUser = input.id ? await userRepository.findById(input.id) : null;
        token.role = dbUser?.role === 'admin' ? 'admin' : 'user';
      };

      // OIDC sign-in: create DB user on first login
      if (user && account?.provider && OAUTH_PROVIDER_IDS.has(account.provider)) {
        const email = resolveVerifiedOidcEmail(profile as OAuthProfile | undefined, user.email);
        if (!email) return token;
        const name = (profile?.name || user.name) as string | undefined;
        const avatar = ((profile as OAuthProfile | undefined)?.picture || user.image) as string | undefined;

        let dbUser = await userRepository.findByEmail(email);
        if (!canUseExistingAccountForOidc(dbUser)) return token;
        if (!dbUser) {
          const normalizedEmail = email;
          const authMode = getAuthMode();
          const adminEmails = getAdminEmails();
          const hasAdmin = await userRepository.findFirstAdmin();
          const shouldPromote =
            normalizedEmail && adminEmails.includes(normalizedEmail)
              ? true
              : authMode === 'local'
                ? !hasAdmin
                : authMode === 'oidc-only' && process.env.AUTH_FIRST_OIDC_USER_ADMIN === 'true' && !hasAdmin;

          dbUser = await userRepository.create({
            email,
            name,
            avatarUrl: avatar,
            authType: 'oauth',
            role: shouldPromote ? 'admin' : 'user',
          });
          if (dbUser) {
            await createSampleResume(dbUser.id);
          }
        }
        await setTokenUser({ id: dbUser?.id, email, name, avatar });
      }

      if (user && account?.provider === 'password') {
        await setTokenUser({ id: user.id, email: user.email, name: user.name, avatar: user.image });
      }

      // Credentials (fingerprint) mode
      if (user && account?.provider === 'credentials') {
        token.userId = user.id;
        token.role = 'user';
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId || token.sub) as string;
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
        const dbUser = session.user.id
          ? await userRepository.findById(session.user.id)
          : null;
        session.user.role = (dbUser?.role === 'admin' || token.role === 'admin' ? 'admin' : 'user') as AuthSessionRole;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.AUTH_SECRET,
}));
