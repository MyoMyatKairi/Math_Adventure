-- Math Adventure: core schema, constraints, indexes and row level security.
-- Trusted learning operations live in 20261019000002_learning_functions.sql.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  role text not null default 'parent' check (role in ('parent', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.role is 'Allowlisted. Clients cannot change it: only display_name is granted for update.';

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Role is never taken from client-supplied metadata.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, left(coalesce(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 60), 'parent');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------------

create table public.learning_levels (
  id uuid primary key,
  key text not null unique,
  name text not null,
  minimum_age int not null check (minimum_age between 3 and 18),
  maximum_age int not null,
  display_order int not null,
  is_active boolean not null default true,
  check (maximum_age >= minimum_age)
);

-- Reference data: ids are fixed and mirrored in packages/shared (LEARNING_LEVELS).
insert into public.learning_levels (id, key, name, minimum_age, maximum_age, display_order) values
  ('00000000-0000-4000-8000-000000000001', 'level_1', 'Level 1', 5, 7, 1),
  ('00000000-0000-4000-8000-000000000002', 'level_2', 'Level 2', 8, 10, 2),
  ('00000000-0000-4000-8000-000000000003', 'level_3', 'Level 3', 11, 12, 3);

create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  learning_level_id uuid not null references public.learning_levels (id),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '',
  theme_key text not null check (theme_key ~ '^[a-z][a-z0-9_-]{0,30}$'),
  display_order int not null,
  is_published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index worlds_level_idx on public.worlds (learning_level_id, display_order);
create trigger worlds_touch before update on public.worlds for each row execute function private.touch_updated_at();

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  learning_level_id uuid not null references public.learning_levels (id),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '',
  display_order int not null,
  is_published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index topics_level_idx on public.topics (learning_level_id, display_order);
create trigger topics_touch before update on public.topics for each row execute function private.touch_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id),
  topic_id uuid not null references public.topics (id),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '',
  learning_objective text not null check (char_length(learning_objective) between 1 and 200),
  difficulty smallint not null check (difficulty between 1 and 3),
  estimated_minutes smallint not null check (estimated_minutes between 1 and 60),
  display_order int not null,
  is_published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_world_idx on public.lessons (world_id, display_order);
create index lessons_topic_idx on public.lessons (topic_id);
create trigger lessons_touch before update on public.lessons for each row execute function private.touch_updated_at();

-- A lesson's world and topic must belong to the same learning level.
create or replace function private.check_lesson_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select learning_level_id from public.worlds where id = new.world_id)
     is distinct from (select learning_level_id from public.topics where id = new.topic_id) then
    raise exception 'lesson world and topic must share a learning level';
  end if;
  return new;
end;
$$;
create trigger lessons_level_check before insert or update of world_id, topic_id on public.lessons
  for each row execute function private.check_lesson_level();

create table public.lesson_sections (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  section_type text not null check (section_type in ('introduction', 'worked_example', 'practice', 'summary')),
  title text not null default '',
  content_json jsonb not null check (jsonb_typeof(content_json) = 'object'),
  display_order int not null,
  unique (lesson_id, display_order),
  check (content_json ->> 'kind' = section_type)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  question_type text not null check (
    question_type in ('multiple_choice', 'numeric', 'missing_number', 'compare', 'pattern', 'visual_quantity')
  ),
  prompt text not null check (char_length(prompt) between 3 and 240),
  visual_data jsonb check (visual_data is null or jsonb_typeof(visual_data) = 'object'),
  -- PRIVATE: never granted to learners. Only security-definer functions read it.
  answer_data jsonb not null check (
    jsonb_typeof(answer_data) = 'object'
    and jsonb_typeof(answer_data -> 'value') = 'string'
    and (not answer_data ? 'format' or answer_data ->> 'format' in ('any', 'decimal', 'fraction', 'simplest_fraction'))
  ),
  options jsonb check (options is null or jsonb_typeof(options) = 'array'),
  explanation text not null,
  hint text,
  difficulty smallint not null check (difficulty between 1 and 3),
  points int not null default 10 check (points between 1 and 50),
  display_order int not null,
  is_published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (question_type <> 'multiple_choice' or options is not null),
  check (question_type <> 'compare' or answer_data ->> 'value' in ('<', '>', '='))
);
create index questions_lesson_idx on public.questions (lesson_id, display_order);
create trigger questions_touch before update on public.questions for each row execute function private.touch_updated_at();

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]{1,40}$'),
  title text not null,
  description text not null,
  icon_key text not null,
  unlock_rule jsonb not null check (
    jsonb_typeof(unlock_rule) = 'object'
    and unlock_rule ->> 'type' in ('lessons_completed', 'total_stars', 'perfect_lessons', 'worlds_completed', 'daily_challenges')
    and jsonb_typeof(unlock_rule -> 'count') = 'number'
  ),
  display_order int not null default 0,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Learners (no email, birth date or legal name: a nickname, avatar and level)
-- ---------------------------------------------------------------------------

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  avatar_key text not null check (avatar_key in ('fox', 'owl', 'panda', 'turtle', 'rocket', 'robot', 'whale', 'lion')),
  age_group text not null check (age_group in ('5-7', '8-10', '11-12')),
  learning_level_id uuid not null references public.learning_levels (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index child_profiles_parent_idx on public.child_profiles (parent_id) where archived_at is null;
create trigger child_profiles_touch before update on public.child_profiles
  for each row execute function private.touch_updated_at();

create or replace function private.limit_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.child_profiles where parent_id = new.parent_id and archived_at is null) >= 8 then
    raise exception 'child_limit_reached' using errcode = 'P0001', hint = 'A parent account can have up to 8 learner profiles.';
  end if;
  return new;
end;
$$;
create trigger child_profiles_limit before insert on public.child_profiles
  for each row execute function private.limit_children();

-- ---------------------------------------------------------------------------
-- Learning records (written only by security-definer functions)
-- ---------------------------------------------------------------------------

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  current_question_index int not null default 0 check (current_question_index >= 0),
  best_score int not null default 0 check (best_score between 0 and 100),
  -- Cached from reward_events in the same transaction as each completion.
  best_stars smallint not null default 0 check (best_stars between 0 and 3),
  attempts_count int not null default 0 check (attempts_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (child_profile_id, lesson_id),
  check (status <> 'completed' or completed_at is not null)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  is_daily_challenge boolean not null default false,
  question_ids uuid[] not null,
  total_questions int not null check (total_questions > 0),
  points_possible int not null check (points_possible > 0),
  points_earned int check (points_earned >= 0),
  score int check (score between 0 and 100),
  correct_answers int check (correct_answers >= 0),
  stars smallint check (stars between 1 and 3),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or (completed_at is not null and score is not null and correct_answers is not null))
);
create index quiz_attempts_child_idx on public.quiz_attempts (child_profile_id, created_at desc);
create index quiz_attempts_lesson_idx on public.quiz_attempts (lesson_id);
create unique index quiz_attempts_one_open_idx on public.quiz_attempts (child_profile_id, lesson_id)
  where status = 'in_progress';

-- Completed attempts are immutable summaries.
create or replace function private.protect_completed_attempt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' then
    raise exception 'completed attempts are immutable';
  end if;
  return new;
end;
$$;
create trigger quiz_attempts_immutable before update on public.quiz_attempts
  for each row execute function private.protect_completed_attempt();

create table public.question_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  submitted_answer jsonb not null,
  is_correct boolean not null,
  attempt_number smallint not null check (attempt_number between 1 and 2),
  points_awarded int not null default 0 check (points_awarded >= 0),
  answered_at timestamptz not null default now(),
  unique (quiz_attempt_id, question_id, attempt_number)
);
create index question_responses_question_idx on public.question_responses (question_id);

create table public.reward_events (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  source_type text not null check (source_type in ('lesson_completion', 'lesson_star', 'daily_challenge')),
  source_id uuid not null,
  -- e.g. lesson:<id>:complete, lesson:<id>:star:2, daily:2026-10-19. One reward per key per child.
  idempotency_key text not null,
  xp_awarded int not null default 0 check (xp_awarded >= 0),
  stars_awarded int not null default 0 check (stars_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (child_profile_id, idempotency_key)
);
create index reward_events_source_idx on public.reward_events (source_id);

create table public.child_badges (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id),
  awarded_at timestamptz not null default now(),
  unique (child_profile_id, badge_id)
);
create index child_badges_badge_idx on public.child_badges (badge_id);

-- ---------------------------------------------------------------------------
-- Privileges. Supabase grants everything to anon/authenticated by default,
-- so start from nothing and grant explicitly.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.learning_levels, public.worlds, public.topics, public.lessons, public.lesson_sections, public.badges
  to anon, authenticated;
grant insert, update, delete on public.worlds, public.topics, public.lessons, public.lesson_sections, public.badges
  to authenticated; -- restricted to admins by RLS
grant select, insert, update, delete on public.questions to authenticated; -- admins only, by RLS

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, delete on public.child_profiles to authenticated;
grant insert (display_name, avatar_key, age_group, learning_level_id) on public.child_profiles to authenticated;
grant update (display_name, avatar_key, age_group, learning_level_id, archived_at) on public.child_profiles to authenticated;

grant select on public.lesson_progress, public.quiz_attempts, public.question_responses, public.reward_events, public.child_badges
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.learning_levels enable row level security;
alter table public.worlds enable row level security;
alter table public.topics enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_sections enable row level security;
alter table public.questions enable row level security;
alter table public.badges enable row level security;
alter table public.child_profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.question_responses enable row level security;
alter table public.reward_events enable row level security;
alter table public.child_badges enable row level security;

create policy "own profile: read" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "levels: read active" on public.learning_levels for select to anon, authenticated
  using (is_active or (select private.is_admin()));

create policy "worlds: read published" on public.worlds for select to anon, authenticated
  using ((is_published and archived_at is null) or (select private.is_admin()));
create policy "worlds: admin write" on public.worlds for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "topics: read published" on public.topics for select to anon, authenticated
  using ((is_published and archived_at is null) or (select private.is_admin()));
create policy "topics: admin write" on public.topics for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "lessons: read published" on public.lessons for select to anon, authenticated
  using ((is_published and archived_at is null) or (select private.is_admin()));
create policy "lessons: admin write" on public.lessons for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "sections: read published" on public.lesson_sections for select to anon, authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.is_published and l.archived_at is null)
    or (select private.is_admin())
  );
create policy "sections: admin write" on public.lesson_sections for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Questions contain answer keys: no learner-facing policy at all.
create policy "questions: admin only" on public.questions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "badges: read active" on public.badges for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy "badges: admin write" on public.badges for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "children: parent read" on public.child_profiles for select to authenticated
  using (parent_id = (select auth.uid()));
create policy "children: parent insert" on public.child_profiles for insert to authenticated
  with check (parent_id = (select auth.uid()));
create policy "children: parent update" on public.child_profiles for update to authenticated
  using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
create policy "children: parent delete" on public.child_profiles for delete to authenticated
  using (parent_id = (select auth.uid()));

create or replace function private.owns_child(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.child_profiles where id = p_child and parent_id = (select auth.uid()));
$$;

create policy "progress: parent read" on public.lesson_progress for select to authenticated
  using ((select private.owns_child(child_profile_id)));
create policy "attempts: parent read" on public.quiz_attempts for select to authenticated
  using ((select private.owns_child(child_profile_id)));
create policy "responses: parent read" on public.question_responses for select to authenticated
  using (exists (
    select 1 from public.quiz_attempts a where a.id = quiz_attempt_id and private.owns_child(a.child_profile_id)
  ));
create policy "rewards: parent read" on public.reward_events for select to authenticated
  using ((select private.owns_child(child_profile_id)));
create policy "child badges: parent read" on public.child_badges for select to authenticated
  using ((select private.owns_child(child_profile_id)));

grant usage on schema private to authenticated, anon;
revoke all on all functions in schema private from public;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.owns_child(uuid) to authenticated;
