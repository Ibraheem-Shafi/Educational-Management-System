# Docker / VPS (nexium-eims.online)

Runs **web** (Next.js), **api** (NestJS), and **Caddy** (HTTPS reverse proxy) on one VPS. Database/Auth/Storage stay on **Supabase**.

| Host | Service |
|------|---------|
| `https://nexium-eims.online` | Web UI |
| `https://www.nexium-eims.online` | Web UI |
| `https://api.nexium-eims.online` | Nest API (`/api/v1/...`) |

## VPS prerequisites

- Ubuntu 22.04+ (or similar), Docker Engine + Docker Compose plugin
- Ports **80** and **443** open
- DNS **A** records for `nexium-eims.online`, `www`, and `api` → VPS public IP

```bash
# Install Docker (Ubuntu example)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# re-login, then:
docker compose version
```

## Deploy

```bash
git clone <your-repo-url> eims
cd eims

cp .env.docker.example .env
# Edit .env — Supabase keys, DATABASE_URL, ACME_EMAIL, etc.

# After DNS points at this server:
docker compose up -d --build

docker compose ps
curl -sS https://api.nexium-eims.online/api/v1/health
```

### Before DNS / TLS is ready

HTTP-only proxy:

```bash
docker compose -f docker-compose.yml -f docker-compose.http.yml up -d --build
```

Or expose app ports directly:

```bash
docker compose -f docker-compose.yml -f docker-compose.ports.yml up -d --build
# http://VPS_IP:3000  ·  http://VPS_IP:3001/api/v1/health
```

For direct-IP testing, set build URLs in `.env` to `http://VPS_IP:3000` / `http://VPS_IP:3001` and rebuild web.

## Supabase Auth URLs

In Supabase Dashboard → Authentication → URL configuration:

- Site URL: `https://nexium-eims.online`
- Redirect URLs: `https://nexium-eims.online/**`

## Database schema

This repo currently uses Prisma `db push` (no migration history in git). From a machine with `.env` filled:

```bash
npm ci
npm run db:push
# optional demo seed
npm run db:seed:demo
```

Or one-off on the VPS (with Docker):

```bash
docker compose run --rm --entrypoint sh api -c \
  "cd /app/packages/database && npx prisma db push"
```

## Useful commands

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f caddy
docker compose up -d --build      # rebuild after git pull
docker compose down
```

## Notes

- Rebuild **web** after changing any `NEXT_PUBLIC_*` value (baked at image build time).
- API CORS allows `NEXT_PUBLIC_APP_URL` only — keep it `https://nexium-eims.online`.
- Never commit the real `.env` file.
