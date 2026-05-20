FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS base
RUN corepack enable

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache python3 make g++ pkgconf
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_DB_INIT=1
RUN pnpm build

# --- Production ---
FROM base AS runner
WORKDIR /app
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ENV NODE_ENV=production
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_TELEMETRY_DISABLED=1

# Install Chromium, dependencies, and CJK fonts for PDF export
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont \
    font-noto-cjk

# Tell puppeteer / generate-pdf to use the system Chromium
ENV CHROME_PATH=/usr/bin/chromium-browser

# Copy build output and necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Runtime package metadata for image labels / diagnostics
COPY --from=builder /app/package.json ./package.json

# Drizzle migration files (for auto-migration on startup)
COPY --from=builder /app/drizzle ./drizzle

# Data directory for SQLite
RUN mkdir -p /app/data
VOLUME /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/ready >/dev/null 2>&1 || wget -qO- http://127.0.0.1:${PORT:-3000}/api/health >/dev/null 2>&1 || exit 1

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
