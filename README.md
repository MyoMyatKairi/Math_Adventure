# Math Adventure

Game-based maths practice for children aged 5–12, on the web and on mobile. Parents hold the account and add children as learner profiles. Children work through short lessons along a winding adventure path, get two tries and a hint on every question, and collect stars, XP and badges. A daily streak (with streak freezes), a daily goal and a practice mode for earlier mistakes bring them back each day. Parents see accuracy by topic, recent lessons and a weekly summary.

Free MVP. English, Burmese (မြန်မာ) and Thai (ไทย). No ads, chat, leaderboards, paid features or AI services.

## What's included

- **Curriculum**: 3 levels (ages 5–7, 8–10, 11–12), 9 worlds, 15 topics, 45 lessons, 225 validated questions across 6 question types (multiple choice, numeric, missing number, compare, number pattern, visual quantity), with 18 kinds of visual model (number lines, base-ten blocks, clocks, fraction bars, arrays, coins and more).
- **Web** (Next.js): landing page, sign-up/in, password reset, parent dashboard, learner profiles, child progress reports with charts, profile and level editing, learner home, adventure map, worlds, lessons, rewards, progress.
- **Mobile** (Expo): sign-up/in, password reset request, profile picker, parent gate, parent dashboard, add/edit/delete learners, child reports, learner home, map, lessons, rewards.
- **Backend** (Supabase): RLS on every table, private answer keys, server-side scoring and idempotent rewards in transactional Postgres functions.

## Quick start

```bash
pnpm install
pnpm content:build
supabase start
cp .env.example apps/web/.env.local     # fill in values from `supabase status`
pnpm dev:web                            # http://localhost:3003
```

Full instructions, mobile setup, deployment (Supabase, Vercel, EAS) and troubleshooting: **[docs/setup.md](docs/setup.md)**.

## Repository

```
apps/web          Next.js 16 App Router, Tailwind 4, Radix, Playwright
apps/mobile       Expo SDK 58, Expo Router, react-native-svg, Reanimated, RNTL
packages/shared   Types, Zod schemas, maths engine, rewards, progression, curriculum
supabase          Migrations (schema, RLS, trusted functions), generated seed
tests             Integration tests against a local Supabase
docs              Architecture, database, security, setup, release checklist
scripts           Secret scan, no-eval lint
```

## Commands

| | |
| --- | --- |
| `pnpm dev:web` / `pnpm dev:mobile` | Run the apps |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Static checks and unit tests |
| `pnpm test:integration` | Database and API tests (needs `supabase start`) |
| `pnpm test:e2e` | Playwright journey (needs `supabase start`) |
| `pnpm content:build` | Validate curriculum and regenerate `supabase/seed.sql` |
| `pnpm db:reset` | Rebuild content and reset the local database |
| `pnpm check:secrets` | Scan for committed credentials |

## Documentation

- [Architecture](docs/architecture.md): structure, decisions, lesson flow, reward rules
- [Database](docs/database.md): tables, access, deviations from the spec, content pipeline
- [Security and privacy](docs/security.md): RLS, trusted functions, child privacy, pre-launch legal work
- [Setup](docs/setup.md): local development, tests, deployment, troubleshooting
- [Release checklist](docs/release-checklist.md): what's verified and what isn't

## Known limitations

- Mobile has been verified with unit/component tests and a Hermes bundle build, not on a device or simulator.
- Mobile uses simpler avatars (initials in the avatar's colours) and plain world banners; the illustrated world emblems and avatars are web-only.
- Password resets are completed on the web app, including when requested from mobile.
- The mobile parent unlock is in memory and resets on app restart (by design, but it means re-entering the password more often).
- Daily challenges, streaks, the daily goal and the weekly chart use UTC days.
- Lesson sounds are web-only (synthesised, off until turned on); mobile has no sound yet.
- The parent report's weekly "lessons completed" also counts practice rounds.
- No admin UI: content is managed in TypeScript and loaded by the seed; admins can edit through SQL/RLS.
- No offline mode.
- Not legally reviewed for COPPA or other child-privacy laws; see [security](docs/security.md#before-public-launch-not-done-needs-legal-review).
