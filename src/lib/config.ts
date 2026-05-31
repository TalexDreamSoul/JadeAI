export const config = {
  auth: {
    enabled: process.env.AUTH_ENABLED !== 'false',
    providers: ['google', 'github', 'microsoft-entra-id'] as const,
  },
  db: {
    type: (process.env.DB_TYPE || 'sqlite') as 'postgresql' | 'sqlite',
  },
  i18n: {
    defaultLocale: 'zh' as const,
    locales: ['zh', 'en'] as const,
  },
};
