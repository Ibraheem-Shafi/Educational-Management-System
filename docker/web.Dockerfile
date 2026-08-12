# syntax=docker/dockerfile:1
# Next.js web — standalone output for npm workspaces monorepo

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/
COPY apps/mobile/package.json ./apps/mobile/
# Install only web workspaces (skip Expo mobile tree)
RUN npm ci \
  --workspace=@eims/web \
  --workspace=@eims/types \
  --workspace=@eims/shared \
  --include-workspace-root

FROM deps AS builder
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG INSTITUTION_NAME=Nexium Academy
ARG NEXT_PUBLIC_SKIP_ADMIN_MFA=0

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV INSTITUTION_NAME=$INSTITUTION_NAME
ENV NEXT_PUBLIC_SKIP_ADMIN_MFA=$NEXT_PUBLIC_SKIP_ADMIN_MFA
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY packages/types ./packages/types
COPY packages/shared ./packages/shared
COPY packages/config ./packages/config
COPY apps/web ./apps/web
RUN npm run build -w @eims/types \
  && npm run build -w @eims/shared \
  && npm run build -w @eims/web

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Monorepo standalone layout: server.js lives under apps/web
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
