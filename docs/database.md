# Database

All schema changes are migrations in `supabase/migrations`. Curriculum content is loaded by `supabase/seed.sql`, which is generated (`pnpm content:build`) and idempotent.

## Tables

| Table | Purpose | Client access |
| --- | --- | --- |
| `profiles` | One row per auth user; `role` is `parent` or `admin` | Own row: select; update `display_name` only |
| `learning_levels` | Level 1–3 with age ranges (fixed ids, seeded in a migration) | Public read of active levels |
| `worlds`, `topics`, `lessons`, `lesson_sections` | Curriculum | Public read of published, non-archived rows; admin write |
| `questions` | Prompts, visuals, options, **answer keys**, explanations | No learner access at all; admin only |
| `badges` | Badge definitions and `unlock_rule` | Public read of active badges; admin write |
| `child_profiles` | Learner nickname, avatar, age group, level | Parent: select/insert/update/delete own |
| `lesson_progress` | One row per child × lesson | Parent: read own children |
| `quiz_attempts` | One row per lesson attempt; completed rows are immutable summaries | Parent: read own children |
| `question_responses` | Every submitted answer (≤ 2 per question per attempt) | Parent: read own children |
| `reward_events` | XP/star ledger with unique idempotency key per child | Parent: read own children |
| `child_badges` | Earned badges, unique per child × badge | Parent: read own children |

Learning records have **no** insert/update grants for clients. Only the `SECURITY DEFINER` functions write them.

## Changes from the original spec, and why

- `questions.answer_data` stays in `questions` as specified, but the whole table is closed to learners; questions reach clients only through `start_lesson`, which omits `answer_data` and `explanation`.
- `quiz_attempts` gains `status` (`in_progress`/`completed`/`abandoned`), `is_daily_challenge`, `question_ids` (the fixed question set), `points_possible`, `points_earned` and `stars`. Score fields are null until completion. A trigger blocks updates to completed attempts.
- `question_responses` gains `attempt_number` (1 or 2) and `points_awarded`.
- `reward_events` gains `idempotency_key` with `unique (child_profile_id, idempotency_key)`; `source_id` is the attempt that earned it.
- `lesson_progress.best_stars` is a cached value, updated in the same transaction as the reward events it mirrors.
- Content tables have `archived_at` (and timestamps) so admins can archive without deleting history. `learning_levels.key` and `badges.display_order` support stable references and ordering.

## Constraints and indexes

Check constraints cover every enum-like column (roles, avatars, age groups, question types, section types, statuses, answer formats, compare answers, difficulty, points, score and star ranges). A trigger ensures a lesson's world and topic share a level; another caps parents at 8 active learner profiles. Foreign keys used in filters are indexed; `quiz_attempts_one_open_idx` allows one in-progress attempt per child and lesson.

## Derived values

Totals (XP, stars, lessons completed, perfect lessons, daily challenges, worlds completed) are computed from the ledger by `private.learner_stats()`; nothing is stored twice except `best_stars`/`best_score` on `lesson_progress`.

## Content pipeline

```
packages/shared/src/content/level{1,2,3}.ts   (authoring)
        │  generators + seeds + validateQuestion()
        ▼
pnpm content:build  →  supabase/seed.sql  →  supabase db reset (local) / psql (remote)
```

Seeding upserts by id. Removing a lesson from the TypeScript does **not** delete it from the database; archive it (`archived_at`) or unpublish it with a migration.

## Admin

Admins are set by SQL only (`update profiles set role = 'admin' where id = …`) by someone with database access. Admins can read and write all curriculum tables through RLS. There's no admin UI in the MVP.
