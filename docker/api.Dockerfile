# syntax=docker/dockerfile:1
# NestJS API — multi-stage build for npm workspaces monorepo

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/
# Workspace stub so npm ci does not fail on missing mobile package
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
# Install only server-side workspaces (skip Expo mobile tree)
RUN npm ci \
  --workspace=@eims/api \
  --workspace=@eims/types \
  --workspace=@eims/shared \
  --workspace=@eims/database \
  --include-workspace-root

FROM deps AS builder
COPY packages/types ./packages/types
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY packages/config ./packages/config
COPY apps/api ./apps/api
# Dummy DATABASE_URL so prisma generate does not fail if schema validates env
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
ENV DIRECT_URL="postgresql://postgres:postgres@localhost:5432/postgres"
RUN npm run build -w @eims/api

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
