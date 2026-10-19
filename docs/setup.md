# Setup, deployment and troubleshooting

## Prerequisites

- Node 20 or newer (tested on 25), pnpm 9 (`npm i -g pnpm@9`)
- Docker Desktop, running
- Supabase CLI 2.x
- For mobile: Expo Go on a phone, or Xcode / Android Studio simulators

## Local development

```bash
pnpm install
pnpm content:build                 # validates curriculum, writes supabase/seed.sql
supabase start -x studio,postgres-meta,logflare,vector,imgproxy,edge-runtime,realtime
#   (plain `supabase start` also works; the exclusions just start faster)
supabase status                    # copy the API URL and the publishable/anon key
cp .env.example apps/web/.env.local   # fill in the web values
openssl rand -hex 32               # use as PARENT_GATE_SECRET
pnpm dev:web                       # http://localhost:3000
```

Local auth auto-confirms emails. Password reset emails appear in Mailpit at http://127.0.0.1:54324.

To reset the database (migrations + seed): `pnpm db:reset`.

### Mobile

```bash
cp .env.example apps/mobile/.env   # keep only the EXPO_PUBLIC_* lines
# A phone can't reach 127.0.0.1 on your computer: use your LAN IP, e.g.
# EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.20:54321
pnpm dev:mobile                    # scan the QR code with Expo Go
```

Optional `EXPO_PUBLIC_SITE_URL` points password-reset links at the deployed web app (reset is completed on the web).

## Tests

| Command | What it runs | Needs |
| --- | --- | --- |
| `pnpm typecheck` | `tsc` in every package | – |
| `pnpm lint` | ESLint (web), no-eval scan (all) | – |
| `pnpm test` | Vitest (shared, web), Jest + RNTL (mobile) | – |
| `pnpm test:integration` | RLS, RPCs, rewards, parity, API | `supabase start` |
| `pnpm test:e2e` | Playwright journey, builds and starts the web app on :3100 | `supabase start`, `apps/web/.env.local`, `npx playwright install chromium` |
| `pnpm db:lint` | `supabase db lint` | `supabase start` |
| `pnpm check:secrets` | Secret scan of tracked files | – |
| `pnpm --filter @math-adventure/mobile bundle:check` | Metro/Hermes iOS bundle | – |

Integration tests use `DATABASE_URL` (default local) and, for API tests, `SUPABASE_URL`/`SUPABASE_ANON_KEY` (default local CLI values). API tests skip themselves if the API isn't reachable.

## Deploying

Deploy only after the database steps succeed.

### 1. Supabase project

```bash
supabase link --project-ref <ref>
supabase db push                                   # applies migrations
pnpm content:build
psql "$PRODUCTION_DATABASE_URL" -f supabase/seed.sql   # curriculum + badges
```

In the Supabase dashboard (Authentication):

- Site URL: your web URL. Redirect URLs: `https://<web>/auth/callback` and `mathadventure://**`.
- Enable email confirmations; set up custom SMTP.
- Minimum password length 8; enable leaked-password protection and CAPTCHA if available.
- Review rate limits.

Run `supabase db lint` against the linked project and spot-check RLS with the queries in `tests/integration/security.test.ts`.

### 2. Web on Vercel

- Import the repo; set **Root Directory** to `apps/web`. Vercel detects pnpm workspaces.
- Install command: `pnpm install --frozen-lockfile` (default). Build command: `pnpm build` (default for Next.js).
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `NEXT_PUBLIC_SITE_URL`, `PARENT_GATE_SECRET` (server only, 32+ chars). Never add a service-role key.

### 3. Mobile with EAS

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build:configure       # creates eas.json
# set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / EXPO_PUBLIC_SITE_URL as EAS environment variables
npx eas-cli build --platform ios      # or android
npx eas-cli submit --platform ios
```

Bundle ids are `com.mathadventure.app` in `app.json`; change them to identifiers you own. App store listings for children's apps have extra requirements (Apple Kids Category, Google Families Policy); review them before submitting.

## Troubleshooting

- **`supabase start` can't pull images ("network is unreachable")**: Docker Desktop has no route to the registry (often a proxy setting). Fix Docker's proxy settings, or pull on the host and load them, e.g. with [crane](https://github.com/google/go-containerregistry): `crane pull --platform linux/arm64 docker.io/postgrest/postgrest:v14.10 pg.tar && docker load -i pg.tar && docker tag postgrest/postgrest:v14.10 public.ecr.aws/supabase/postgrest:v14.10`. Cached image versions can be pinned in `supabase/.temp/<service>-version` (local only, git-ignored).
- **Web says "Missing NEXT_PUBLIC_SUPABASE_URL…"**: create `apps/web/.env.local`.
- **Expo app can't connect**: use your computer's LAN IP in `EXPO_PUBLIC_SUPABASE_URL`, not `127.0.0.1`.
- **"Invalid hook call" or duplicate React**: the workspace must have exactly one React (19.3.0, pinned for Expo SDK 58). Run `pnpm why react`.
- **Metro can't resolve a workspace package**: `.npmrc` uses `node-linker=hoisted`; delete `node_modules` and reinstall after changing it.
- **Lesson won't start (`world_locked`)**: complete half the previous world, or change the learner's level in the parent area.
- **Seed changes not visible**: run `pnpm content:build` before `supabase db reset`.
