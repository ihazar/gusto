# Gusto 🔥

Home-chefs food delivery platform. One monorepo, three apps, one shared contracts library.

| Path             | What                                       | Stack                      | Local port |
| ---------------- | ------------------------------------------ | -------------------------- | ---------- |
| `apps/api`       | Backend API (auth, chefs, orders)          | NestJS + Prisma + Postgres | **5000**   |
| `apps/web`       | Chef & ops portal                          | Angular 18 (standalone)    | **5001**   |
| `apps/mobile`    | Customer app                               | React Native (Expo)        | **5002**   |
| `libs/contracts` | Shared DTOs, enums, zod schemas, API types | TypeScript + zod           | –          |

Infra (Docker): Postgres **5003**, Redis **5004**, MinIO API **5005** / console **5006**.
All ports live in the 5000–5006 block to avoid clashing with other local projects.

See [PLAN.md](./PLAN.md) for the full architecture and roadmap. This repo currently
implements **Phase 0**: monorepo scaffold + **phone-OTP 2FA auth end-to-end**.

## Prerequisites

-   Node 20+
-   Docker (for Postgres / Redis / MinIO)

## One-time setup (run once, from the repo root)

```bash
# 1. Install all workspaces (api, web, mobile, contracts)
npm install

# 2. Start Postgres + Redis + MinIO in Docker
npm run infra:up

# 3. Create the API env file (mock OTP works with zero credentials)
cp .env.example apps/api/.env

# 4. Build the shared contracts lib — the other packages import its dist
npm run contracts:build

# 5. Generate the Prisma client and create the database schema
npm run -w apps/api prisma:generate
npm run -w apps/api prisma:migrate -- --name init
```

## Run the apps (each in its own terminal)

### API — http://localhost:5000/api

```bash
npm run api:dev
```

Health check: `curl localhost:5000/api/health` → `{"status":"ok"}`.

### Web (Angular chef/ops portal) — http://localhost:5001

```bash
npm run web:dev
```

Open http://localhost:5001 — it redirects to `/login`. The web app calls the API at
`http://localhost:5000/api` (configured in `apps/web/src/environments/environment.ts`),
so **start the API first** for login to work.

### Mobile (Expo customer app) — dev server on port 5002

```bash
npm run mobile:dev          # then press i (iOS sim), a (Android emulator), or scan the QR
```

## Logging in (mock OTP mode)

No real SMS is sent in development:

-   The 6-digit code is **printed in the API logs** (the `npm run api:dev` terminal).
-   The code **`000000` is always accepted** in development.

So on any login screen, enter an E.164 number like `+14155552671`, then `000000`.

Hit it directly with curl:

```bash
curl -X POST localhost:5000/api/auth/otp/request \
  -H 'content-type: application/json' -d '{"phone":"+14155552671"}'

curl -X POST localhost:5000/api/auth/otp/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155552671","code":"000000"}'
# -> { user, tokens: { accessToken, refreshToken, expiresIn } }

curl localhost:5000/api/me -H "authorization: Bearer <accessToken>"
```

## Notes

-   **Expo on a physical phone:** `localhost` points at the phone, not your Mac. Set
    `apps/mobile/app.json` → `expo.extra.apiUrl` to your Mac's LAN IP, e.g.
    `http://192.168.1.50:5000/api`. The iOS simulator and Android emulator work with
    `localhost` as-is.
-   **Stop / reset infra:** `npm run infra:down` (add `docker compose down -v` to wipe DB volumes).
-   **Changing a port:** API → `API_PORT` in `apps/api/.env`; web → `angular.json`
    (`serve.options.port`); mobile → the `--port` flag in `apps/mobile/package.json`;
    infra → the host side of the mappings in `docker-compose.yml` (keep the URLs in
    `.env` in sync).

## Switching to real SMS

In `apps/api/.env`:

```
OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
```

Set `NODE_ENV=production` to switch the OTP rate limiter from in-memory to Redis.

## Tests

```bash
npm run -w apps/api test     # phone-OTP auth flow: rotation + reuse detection (no infra needed)
```
