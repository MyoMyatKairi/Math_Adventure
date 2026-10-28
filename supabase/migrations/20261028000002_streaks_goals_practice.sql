-- Math Adventure: streaks, a daily goal and mistake practice.
--
-- Streak: consecutive UTC days with at least one finished session (a lesson or
-- a practice round). Every 7th day in a row earns a streak freeze (up to 2);
-- each freeze covers one missed day automatically, so a short break does not
-- reset the streak. Daily goal: finish DAILY_GOAL_SESSIONS sessions in a day.
-- Practice: a review attempt (kind = 'review', no lesson) of up to 5 questions
-- the learner last got wrong on the first try, topped up from finished lessons.
-- Practice never awards XP or stars, so replays still cannot farm rewards.
-- Rules mirror packages/shared/src/progression/streak.ts.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.quiz_attempts
  add column kind text not null default 'lesson' check (kind in ('lesson', 'review'));
alter table public.quiz_attempts alter column lesson_id drop not null;
alter table public.quiz_attempts
  add constraint quiz_attempts_kind_lesson check ((kind = 'review') = (lesson_id is null));
create unique index quiz_attempts_one_open_review_idx on public.quiz_attempts (child_profile_id)
  where status = 'in_progress' and kind = 'review';

-- Written only by private.advance_streak(), inside complete_lesson.
create table public.child_streaks (
  child_profile_id uuid primary key references public.child_profiles (id) on delete cascade,
  current_streak int not null default 0 check (current_streak >= 0),
  longest_streak int not null default 0 check (longest_streak >= 0),
  last_active_day date,
  freezes smallint not null default 0 check (freezes between 0 and 2),
  updated_at timestamptz not null default now()
);

grant select on public.child_streaks to authenticated;
alter table public.child_streaks enable row level security;
create policy "streaks: parent read" on public.child_streaks for select to authenticated
  using ((select private.owns_child(child_profile_id)));

-- ---------------------------------------------------------------------------
-- Streak and daily goal helpers
-- ---------------------------------------------------------------------------

-- What the learner sees. A streak stays alive while the missed days since the
-- last active day can all be covered by freezes. Mirrors visibleStreak().
create or replace function private.streak_state(p_child uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select private.utc_today() as d)
  select jsonb_build_object(
    'current', coalesce((
      select case when s.last_active_day >= today.d - 1 - s.freezes::int then s.current_streak else 0 end
      from public.child_streaks s where s.child_profile_id = p_child), 0),
    'longest', coalesce((select longest_streak from public.child_streaks where child_profile_id = p_child), 0),
    'freezes', coalesce((select freezes from public.child_streaks where child_profile_id = p_child), 0),
    'practicedToday', coalesce((select last_active_day = today.d from public.child_streaks where child_profile_id = p_child), false),
    'week', (
      select jsonb_agg(jsonb_build_object(
          'date', d::date,
          'active', exists (
            select 1 from public.quiz_attempts a
            where a.child_profile_id = p_child and a.status = 'completed'
              and (a.completed_at at time zone 'utc')::date = d::date
          )
        ) order by d)
      from generate_series(today.d - 6, today.d, interval '1 day') d
    )
  )
  from today;
$$;

-- Records today's activity. Call once per newly finished session, with the
-- child row locked. Mirrors advanceStreak().
create or replace function private.advance_streak(p_child uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.utc_today();
  s public.child_streaks;
  v_gap int;
  v_used int := 0;
  v_earned boolean := false;
  v_extended boolean := false;
begin
  insert into public.child_streaks (child_profile_id) values (p_child) on conflict do nothing;
  select * into s from public.child_streaks where child_profile_id = p_child for update;

  if s.last_active_day is null then
    s.current_streak := 1;
    v_extended := true;
  else
    v_gap := v_today - s.last_active_day;
    if v_gap <= 0 then
      null; -- today already counted
    elsif v_gap - 1 <= s.freezes then
      v_used := v_gap - 1;
      s.freezes := s.freezes - v_used;
      s.current_streak := s.current_streak + 1;
      v_extended := true;
    else
      s.current_streak := 1;
      v_extended := true;
    end if;
  end if;

  if v_extended then
    if s.current_streak % 7 = 0 and s.freezes < 2 then
      s.freezes := s.freezes + 1;
      v_earned := true;
    end if;
    update public.child_streaks
      set current_streak = s.current_streak,
          longest_streak = greatest(s.longest_streak, s.current_streak),
          last_active_day = v_today,
          freezes = s.freezes,
          updated_at = now()
      where child_profile_id = p_child;
  end if;

  return jsonb_build_object('extended', v_extended, 'freezesUsed', v_used, 'freezeEarned', v_earned);
end;
$$;

-- Sessions (lessons or practice) finished today. Target mirrors DAILY_GOAL_SESSIONS.
create or replace function private.daily_goal(p_child uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'target', 2,
    'done', (
      select count(*) from public.quiz_attempts a
      where a.child_profile_id = p_child and a.status = 'completed'
        and a.completed_at >= (private.utc_today()::timestamp at time zone 'utc')
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Practice helpers
-- ---------------------------------------------------------------------------

-- Questions in the learner's open worlds whose most recent first try was wrong,
-- newest first. Getting one right first time in any later session clears it.
create or replace function private.mistake_questions(p_child uuid)
returns table (question_id uuid, answered_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with open_questions as (
    select q.id
    from private.world_states(p_child) ws
    join public.lessons l on l.world_id = ws.world_id and l.is_published and l.archived_at is null
    join public.questions q on q.lesson_id = l.id and q.is_published and q.archived_at is null
    where ws.unlocked
  ),
  latest as (
    select distinct on (qr.question_id) qr.question_id, qr.is_correct, qr.answered_at
    from public.question_responses qr
    join public.quiz_attempts a on a.id = qr.quiz_attempt_id and a.child_profile_id = p_child
    where qr.attempt_number = 1 and qr.question_id in (select id from open_questions)
    order by qr.question_id, qr.answered_at desc, qr.id
  )
  select question_id, answered_at from latest where not is_correct;
$$;

-- Up to p_limit questions for a practice round: mistakes first, then random
-- questions from finished lessons.
create or replace function private.review_questions(p_child uuid, p_limit int)
returns table (question_id uuid, ord bigint)
language sql
volatile
security definer
set search_path = ''
as $$
  with mistakes as (
    select m.question_id, row_number() over (order by m.answered_at desc, m.question_id) as ord
    from private.mistake_questions(p_child) m
    order by m.answered_at desc, m.question_id
    limit p_limit
  ),
  fill as (
    select q.id as question_id
    from private.world_states(p_child) ws
    join public.lessons l on l.world_id = ws.world_id and l.is_published and l.archived_at is null
    join public.lesson_progress lp on lp.lesson_id = l.id and lp.child_profile_id = p_child and lp.status = 'completed'
    join public.questions q on q.lesson_id = l.id and q.is_published and q.archived_at is null
    where ws.unlocked and q.id not in (select question_id from mistakes)
    order by random()
    limit greatest(p_limit - (select count(*) from mistakes), 0)
  )
  select question_id, ord from mistakes
  union all
  select question_id, 1000 + row_number() over () from fill;
$$;

-- ---------------------------------------------------------------------------
-- RPC: start_review
-- ---------------------------------------------------------------------------

create function public.start_review(p_child_id uuid, p_locale text default 'en')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.child_profiles;
  v_attempt public.quiz_attempts;
  v_question_ids uuid[];
  v_points int;
  v_resumed boolean := false;
  v_loc text := private.locale(p_locale);
begin
  v_child := private.require_child(p_child_id, true);

  select * into v_attempt from public.quiz_attempts
    where child_profile_id = v_child.id and kind = 'review' and status = 'in_progress'
    for update;
  if found then
    if v_attempt.started_at > now() - interval '1 day' then
      v_resumed := true;
    else
      update public.quiz_attempts set status = 'abandoned' where id = v_attempt.id;
    end if;
  end if;

  if not v_resumed then
    if (select count(*) from public.quiz_attempts
        where child_profile_id = v_child.id and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    select array_agg(r.question_id order by r.ord) into v_question_ids
      from private.review_questions(v_child.id, 5) r;
    if v_question_ids is null then
      raise exception 'nothing_to_review' using errcode = 'P0001';
    end if;
    select sum(points) into v_points from public.questions where id = any (v_question_ids);
    insert into public.quiz_attempts (child_profile_id, lesson_id, kind, question_ids, total_questions, points_possible)
      values (v_child.id, null, 'review', v_question_ids, cardinality(v_question_ids), v_points)
      returning * into v_attempt;
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'resumed', v_resumed,
    'kind', 'review',
    -- Public question fields only, as in start_lesson.
    'questions', (
      select jsonb_agg(jsonb_build_object(
          'id', q.id,
          'type', q.question_type,
          'prompt', private.tr(q.translations, v_loc, 'prompt', q.prompt),
          'visual', q.visual_data,
          'options', private.tr_options(q.options, q.translations, v_loc),
          'hint', private.tr(q.translations, v_loc, 'hint', q.hint),
          'answerFormat', coalesce(q.answer_data ->> 'format', 'any'),
          'difficulty', q.difficulty,
          'points', q.points
        ) order by array_position(v_attempt.question_ids, q.id))
      from public.questions q where q.id = any (v_attempt.question_ids)
    ),
    'progress', private.question_progress(v_attempt.id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_lesson: now also finishes practice rounds and records the streak.
-- Lesson rewards are unchanged from 20261028000001.
-- ---------------------------------------------------------------------------

create or replace function private.attempt_summary(p_attempt uuid, p_already boolean, p_new_badges jsonb, p_unlocked jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attemptId', a.id,
    'kind', a.kind,
    'lessonId', a.lesson_id,
    'score', a.score,
    'totalQuestions', a.total_questions,
    'correctAnswers', a.correct_answers,
    'stars', a.stars,
    'bestStars', coalesce(lp.best_stars, a.stars),
    'xpAwarded', coalesce((select sum(xp_awarded) from public.reward_events where source_id = a.id), 0),
    'starsAwarded', coalesce((select sum(stars_awarded) from public.reward_events where source_id = a.id), 0),
    'isDailyChallenge', a.is_daily_challenge,
    'dailyBonusXp', coalesce((select sum(xp_awarded) from public.reward_events where source_id = a.id and source_type = 'daily_challenge'), 0),
    'newBadges', p_new_badges,
    'unlockedWorlds', p_unlocked,
    'alreadyCompleted', p_already
  )
  from public.quiz_attempts a
  left join public.lesson_progress lp on lp.child_profile_id = a.child_profile_id and lp.lesson_id = a.lesson_id
  where a.id = p_attempt;
$$;

create or replace function public.complete_lesson(p_attempt_id uuid, p_locale text default 'en')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_child_id uuid;
  v_difficulty int;
  v_unresolved int;
  v_points int;
  v_first_correct int;
  v_score int;
  v_stars int;
  v_before uuid[];
  v_new_badges jsonb;
  v_unlocked jsonb;
  v_streak jsonb;
  v_loc text := private.locale(p_locale);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select a.child_profile_id into v_child_id
    from public.quiz_attempts a
    join public.child_profiles c on c.id = a.child_profile_id
    where a.id = p_attempt_id and c.parent_id = (select auth.uid()) and c.archived_at is null;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  -- Serialize all reward work for this child, then lock the attempt.
  perform private.require_child(v_child_id, true);
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;

  if v_attempt.status = 'completed' then
    return private.attempt_summary(v_attempt.id, true, '[]'::jsonb, '[]'::jsonb)
      || jsonb_build_object(
           'streak', private.streak_state(v_child_id) || jsonb_build_object('extended', false, 'freezesUsed', 0, 'freezeEarned', false),
           'dailyGoal', private.daily_goal(v_child_id));
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_closed' using errcode = 'P0001';
  end if;

  select count(*) into v_unresolved
    from jsonb_array_elements(private.question_progress(v_attempt.id)) p
    where not (p ->> 'resolved')::boolean;
  if v_unresolved > 0 then
    raise exception 'attempt_incomplete' using errcode = 'P0001';
  end if;

  select coalesce(sum(points_awarded), 0), count(*) filter (where attempt_number = 1 and is_correct)
    into v_points, v_first_correct
    from public.question_responses where quiz_attempt_id = v_attempt.id;
  v_score := floor(least(v_points, v_attempt.points_possible) * 100.0 / v_attempt.points_possible + 0.5)::int;
  v_stars := case when v_score >= 90 then 3 when v_score >= 70 then 2 else 1 end;

  update public.quiz_attempts
    set status = 'completed', score = v_score, correct_answers = v_first_correct, points_earned = v_points,
        stars = v_stars, completed_at = now()
    where id = v_attempt.id;

  v_streak := private.advance_streak(v_child_id);

  -- Practice rounds count for the streak and daily goal only.
  if v_attempt.kind = 'review' then
    return private.attempt_summary(v_attempt.id, false, '[]'::jsonb, '[]'::jsonb)
      || jsonb_build_object('streak', private.streak_state(v_child_id) || v_streak, 'dailyGoal', private.daily_goal(v_child_id));
  end if;

  select difficulty into v_difficulty from public.lessons where id = v_attempt.lesson_id;
  -- World states before this completion counted. The attempt row is not part of
  -- world_states, and lesson_progress is updated below.
  select coalesce(array_agg(world_id), '{}') into v_before from private.world_states(v_child_id) where unlocked;

  -- Rewards: one per idempotency key, ever. Mirrors calculateLessonRewards().
  insert into public.reward_events (child_profile_id, source_type, source_id, idempotency_key, xp_awarded, stars_awarded)
    values (v_child_id, 'lesson_completion', v_attempt.id, 'lesson:' || v_attempt.lesson_id || ':complete', 10 + 10 * v_difficulty, 0)
    on conflict (child_profile_id, idempotency_key) do nothing;
  insert into public.reward_events (child_profile_id, source_type, source_id, idempotency_key, xp_awarded, stars_awarded)
    select v_child_id, 'lesson_star', v_attempt.id, 'lesson:' || v_attempt.lesson_id || ':star:' || s, 5, 1
    from generate_series(1, v_stars) s
    on conflict (child_profile_id, idempotency_key) do nothing;
  if v_attempt.is_daily_challenge then
    insert into public.reward_events (child_profile_id, source_type, source_id, idempotency_key, xp_awarded, stars_awarded)
      values (v_child_id, 'daily_challenge', v_attempt.id,
              'daily:' || to_char((v_attempt.started_at at time zone 'utc')::date, 'YYYY-MM-DD'), 15, 0)
      on conflict (child_profile_id, idempotency_key) do nothing;
  end if;

  update public.lesson_progress
    set status = 'completed',
        best_score = greatest(best_score, v_score),
        best_stars = greatest(best_stars, v_stars),
        attempts_count = attempts_count + 1,
        current_question_index = v_attempt.total_questions,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where child_profile_id = v_child_id and lesson_id = v_attempt.lesson_id;

  with stats as (select private.learner_stats(v_child_id) as s),
  awarded as (
    insert into public.child_badges (child_profile_id, badge_id)
      select v_child_id, b.id from public.badges b, stats
      where b.is_active and private.badge_earned(b.unlock_rule, stats.s)
      on conflict (child_profile_id, badge_id) do nothing
      returning badge_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', b.key,
           'title', private.tr(b.translations, v_loc, 'title', b.title),
           'description', private.tr(b.translations, v_loc, 'description', b.description),
           'iconKey', b.icon_key
         ) order by b.display_order), '[]'::jsonb)
    into v_new_badges
    from awarded join public.badges b on b.id = awarded.badge_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', private.tr(w.translations, v_loc, 'title', w.title))
           order by w.display_order), '[]'::jsonb)
    into v_unlocked
    from private.world_states(v_child_id) ws join public.worlds w on w.id = ws.world_id
    where ws.unlocked and not (ws.world_id = any (v_before));

  return private.attempt_summary(v_attempt.id, false, v_new_badges, v_unlocked)
    || jsonb_build_object('streak', private.streak_state(v_child_id) || v_streak, 'dailyGoal', private.daily_goal(v_child_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- get_learner_overview: adds streak, dailyGoal and practice. Otherwise the same
-- as 20261028000001.
-- ---------------------------------------------------------------------------

create or replace function public.get_learner_overview(p_child_id uuid, p_locale text default 'en')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.child_profiles;
  v_today date := private.utc_today();
  v_daily uuid;
  v_loc text := private.locale(p_locale);
begin
  v_child := private.require_child(p_child_id);
  v_daily := private.daily_lesson(v_child.id, v_today);

  return jsonb_build_object(
    'child', jsonb_build_object(
      'id', v_child.id,
      'displayName', v_child.display_name,
      'avatarKey', v_child.avatar_key,
      'ageGroup', v_child.age_group,
      'learningLevelId', v_child.learning_level_id,
      'levelName', (select name from public.learning_levels where id = v_child.learning_level_id)
    ),
    'stats', private.learner_stats(v_child.id),
    'streak', private.streak_state(v_child.id),
    'dailyGoal', private.daily_goal(v_child.id),
    'practice', jsonb_build_object(
      'mistakes', (select count(*) from private.mistake_questions(v_child.id)),
      'available', exists (select 1 from private.mistake_questions(v_child.id))
        or exists (select 1 from public.lesson_progress where child_profile_id = v_child.id and status = 'completed')
    ),
    'worlds', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id,
          'title', private.tr(w.translations, v_loc, 'title', w.title),
          'description', private.tr(w.translations, v_loc, 'description', w.description),
          'themeKey', w.theme_key,
          'displayOrder', w.display_order,
          'unlocked', ws.unlocked,
          'lessonCount', ws.lesson_count,
          'completedCount', ws.completed_count,
          'lessonsToUnlockNext', ceil(ws.lesson_count * 0.5)::int,
          'lessons', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'id', l.id,
                'title', private.tr(l.translations, v_loc, 'title', l.title),
                'description', private.tr(l.translations, v_loc, 'description', l.description),
                'difficulty', l.difficulty,
                'estimatedMinutes', l.estimated_minutes,
                'displayOrder', l.display_order,
                'topicTitle', private.tr(t.translations, v_loc, 'title', t.title),
                'status', coalesce(lp.status, 'not_started'),
                'bestStars', coalesce(lp.best_stars, 0),
                'bestScore', coalesce(lp.best_score, 0)
              ) order by l.display_order), '[]'::jsonb)
            from public.lessons l
            join public.topics t on t.id = l.topic_id
            left join public.lesson_progress lp on lp.lesson_id = l.id and lp.child_profile_id = v_child.id
            where l.world_id = w.id and l.is_published and l.archived_at is null
          )
        ) order by w.display_order), '[]'::jsonb)
      from private.world_states(v_child.id) ws join public.worlds w on w.id = ws.world_id
    ),
    'daily', case when v_daily is null then null else jsonb_build_object(
      'lessonId', v_daily,
      'date', v_today,
      'title', (select private.tr(translations, v_loc, 'title', title) from public.lessons where id = v_daily),
      'completed', exists (
        select 1 from public.reward_events
        where child_profile_id = v_child.id and idempotency_key = 'daily:' || to_char(v_today, 'YYYY-MM-DD')
      ),
      'bonusXp', 15
    ) end,
    'badges', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'key', b.key,
          'title', private.tr(b.translations, v_loc, 'title', b.title),
          'description', private.tr(b.translations, v_loc, 'description', b.description),
          'iconKey', b.icon_key,
          'awardedAt', cb.awarded_at
        ) order by b.display_order), '[]'::jsonb)
      from public.badges b
      left join public.child_badges cb on cb.badge_id = b.id and cb.child_profile_id = v_child.id
      where b.is_active
    ),
    'recentAchievements', (
      select coalesce(jsonb_agg(x order by x ->> 'at' desc), '[]'::jsonb) from (
        (select jsonb_build_object('kind', 'badge', 'title', private.tr(b.translations, v_loc, 'title', b.title),
                                   'iconKey', b.icon_key, 'at', cb.awarded_at) as x
          from public.child_badges cb join public.badges b on b.id = cb.badge_id
          where cb.child_profile_id = v_child.id order by cb.awarded_at desc limit 5)
        union all
        (select jsonb_build_object('kind', 'lesson', 'title', private.tr(l.translations, v_loc, 'title', l.title),
                                   'stars', a.stars, 'score', a.score, 'at', a.completed_at)
          from public.quiz_attempts a join public.lessons l on l.id = a.lesson_id
          where a.child_profile_id = v_child.id and a.status = 'completed' order by a.completed_at desc limit 5)
      ) recent
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function private.streak_state(uuid) from public, anon, authenticated;
revoke all on function private.advance_streak(uuid) from public, anon, authenticated;
revoke all on function private.daily_goal(uuid) from public, anon, authenticated;
revoke all on function private.mistake_questions(uuid) from public, anon, authenticated;
revoke all on function private.review_questions(uuid, int) from public, anon, authenticated;

revoke all on function public.start_review(uuid, text) from public, anon;
grant execute on function public.start_review(uuid, text) to authenticated;
