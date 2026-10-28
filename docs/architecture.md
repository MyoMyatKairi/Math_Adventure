# Architecture

Math Adventure is a TypeScript monorepo with two clients (Next.js web, Expo mobile) on one Supabase backend. Business rules live in one shared package; anything that affects scores, rewards or progress is enforced in Postgres.

```
apps/web (Next.js 16, App Router)        apps/mobile (Expo 58, Expo Router)
  server components + server actions        screens + supabase-js
  browser supabase-js for lesson play       AsyncStorage session, SecureStore child id
            \                                   /
             \        packages/shared          /
              \  types, Zod schemas, number   /
               \ parsing, answer checks,     /
                \ rewards, progression,     /
                 \ content + generators    /
                  v                       v
             Supabase: Auth (GoTrue) + PostgREST
                         |
                Postgres (RLS on every table)
        public RPCs (SECURITY DEFINER, transactional):
        start_lesson, submit_answer, complete_lesson,
        get_learner_overview, get_child_report, get_parent_overview
```

## Packages

| Path | Role |
| --- | --- |
| `packages/shared/src/schemas` | Zod schemas: visual models, questions, sections, forms, answers |
| `packages/shared/src/math` | Exact rational parsing of learner input, answer checking, seeded RNG, 50 question generators |
| `packages/shared/src/scoring` | Reward rules (points, stars, XP, idempotency keys, XP levels) |
| `packages/shared/src/progression` | World unlocks, badge rules and definitions, topic summaries, lesson recommendation |
| `packages/shared/src/content` | Curriculum (3 levels × 3 worlds × 5 topics × 3 lessons × 5 questions), validator, builder |
| `packages/shared/src/types` | Shared TS types including RPC response shapes |
| `supabase/migrations` | Schema, RLS, grants, trusted functions |
| `supabase/seed.sql` | Generated from the curriculum by `pnpm content:build` |
| `tests/integration` | Database and API tests (RLS, RPCs, parity, concurrency) |

Web and mobile UI components are separate. They share logic and types only.

## Key decisions

**Trusted operations are Postgres functions, not Edge Functions.** Answer checking, progress, rewards and badges for one completion happen in one transaction, behind row locks. Both clients call the same RPCs. Edge Functions would add a second runtime and a network hop without a concrete benefit for the MVP.

**Rules exist twice, and tests keep them identical.** The TypeScript copy gives instant feedback (format errors before a try is used) and powers content validation. The SQL copy is the authority. `tests/integration/parity.test.ts` runs the same 360 tricky inputs through both checkers and checks every seeded answer key server-side; `learning.test.ts` checks server rewards against `calculateLessonRewards()` and world unlocks against `unlockedWorldIds()`; `parity.test.ts` checks badge definitions match.

**Answers are exact rationals.** Learner input (`7`, `-2.5`, `3/4`, `1 1/2`, `1,000`) is parsed by regex into numerator/denominator and compared by cross-multiplication (BigInt in TS, `numeric` in SQL). No floating point, no `eval`. Questions can require a format (`decimal`, `fraction`, `simplest_fraction`) so "write 3/4 as a decimal" can't be answered with `3/4`. Wrong-format input is rejected without using a try.

**Content is code, generated deterministically.** Lessons are authored in TypeScript. Most questions come from generators that compute the answer and the explanation from the same numbers, seeded by lesson key, so the build is reproducible. Every question passes `validateQuestion()` (schema, options, equation truth, visual/answer agreement, explanation mentions the answer) before `seed.sql` is written. Content ids are derived from stable keys so reseeding updates rows in place.

**Learners are profiles, not accounts.** Children have no email or login. On the web the active child is an httpOnly cookie; on mobile it's in SecureStore. The parent area is behind a password re-check (signed, 30-minute cookie on web; in-memory on mobile).

**Extensible question types.** Each client has an `ANSWER_INPUTS` registry keyed by question type. Adding a type means: a schema entry, a checker branch in `answers.ts` and `private.check_answer`, and one registry entry per client. The lesson players don't change.

## Languages

English, Burmese (`my`) and Thai (`th`). The choice is app-wide: a cookie (`ma_locale`) on web, falling back to the browser's Accept-Language; AsyncStorage on mobile, falling back to the device language. A switcher sits in every header.

- **Interface text** lives in `packages/shared/src/i18n/messages/{en,my,th}.ts`. `my` and `th` are typed against the English keys, so a missing key fails `tsc`; `test/i18n.test.ts` checks placeholders match. Zod form schemas return message keys, translated by `fieldErrors(error, locale)`.
- **Curriculum text** for lessons, worlds and topics is in `packages/shared/src/content/translations/{my,th}.ts`, keyed by content key. Generators write all three languages from the same numbers. `pnpm content:build` fails if a translation is missing, has the wrong number of steps, or its explanation no longer states the answer (the same `validateQuestion` rules run on every language).
- **Database**: content tables have a `translations` jsonb column (`{ "my": {...}, "th": {...} }`). The learner RPCs take `p_locale` and fall back to English. Answer keys and option ids are shared, so scoring does not depend on language.
- **Answers** may be typed with Myanmar (၀–၉) or Thai (๐–๙) digits; both `normalizeInput` and `private.normalize_input` map them to 0–9.

The Burmese and Thai text is a draft and needs review by native speakers before release.

## Lesson flow

1. Client reads public lesson sections (introduction, worked example) via RLS-protected selects.
2. `start_lesson(child, lesson, daily)` checks ownership, publication, level and world unlock, resumes an open attempt (< 24 h) or creates one, and returns questions **without** answers or explanations.
3. `submit_answer(attempt, question, text)` validates input, checks it server-side, records the response (max 2 tries), and returns a hint after a wrong first try or the explanation and correct answer once the question is resolved.
4. `complete_lesson(attempt)` requires every question resolved, computes score and stars, inserts idempotent reward events, updates `lesson_progress`, awards badges and reports newly opened worlds. Calling it again returns the stored summary.

## Rewards

| Event | XP | Stars | Idempotency key |
| --- | --- | --- | --- |
| First completion of a lesson | 10 + 10 × difficulty | 0 | `lesson:<id>:complete` |
| Each star reached (1–3) | 5 | 1 | `lesson:<id>:star:<n>` |
| Daily challenge (once per UTC day) | 15 | 0 | `daily:<yyyy-mm-dd>` |

Score: first-try correct = full points, second-try = half, else 0. Stars: ≥ 90% → 3, ≥ 70% → 2, otherwise 1. Replays can only earn stars not yet earned. XP and stars are never taken away.

## Streaks, daily goal and practice

Rules live in `packages/shared/src/progression/streak.ts` and `supabase/migrations/20261028000002_streaks_goals_practice.sql`.

- **Streak**: consecutive UTC days with at least one finished session (lesson or practice round). Every 7th day in a row earns a streak freeze (max 2); each freeze covers one missed day automatically. If there aren't enough freezes the streak shows 0 and restarts at 1 with the next session. The longest streak is kept.
- **Daily goal**: finish 2 sessions (lessons or practice rounds) in a UTC day. Counted in sessions, not XP, so the goal is reachable without farming XP.
- **Practice** (`start_review`): up to 5 questions in the learner's open worlds whose most recent first try was wrong, newest first, topped up with random questions from finished lessons. Getting a question right first time in any later session takes it off the list. Practice rounds count for the streak and daily goal but award no XP, stars or badges, and don't touch `lesson_progress`.

World *n* opens when every earlier world in the level has at least half its lessons completed.

## Recommendations

Rule-based, no AI: continue an in-progress lesson, else the first unfinished lesson in map order, else the lowest-star lesson for review. Parent "what to try next" uses first-try accuracy per topic (needs ≥ 5 answers): < 60% "Practise X again", < 85% "Getting more confident with X", else "Confident with X".
