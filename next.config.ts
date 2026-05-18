import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ['better-sqlite3', 'puppeteer-core', '@sparticuz/chromium-min'],
};

export default withNextIntl(nextConfig);
