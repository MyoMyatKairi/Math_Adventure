-- Math Adventure: Burmese (my) and Thai (th) translations.
--
-- English stays in the existing columns. Each content table gains a
-- `translations` jsonb column shaped { "my": { <field>: <text> }, "th": { ... } },
-- written by supabase/seed.sql (generated from packages/shared). The learner RPCs
-- take a p_locale argument and return text in that language, falling back to
-- English for anything untranslated. Learners may also type Myanmar (၀–၉) or
-- Thai (๐–๙) digits; they are read as 0–9.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.worlds add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');
alter table public.topics add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');
alter table public.lessons add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');
alter table public.lesson_sections add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');
alter table public.questions add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');
alter table public.badges add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');

comment on column public.questions.translations is
  'Per-language prompt, explanation, hint and word option labels. Like explanation, only security-definer functions read it.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Unknown or missing locales mean English.
create or replace function private.locale(p_locale text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_locale in ('my', 'th') then p_locale else 'en' end;
$$;

-- A translated text field, or the English value when there is no translation.
create or replace function private.tr(p_translations jsonb, p_locale text, p_field text, p_base text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(p_translations -> p_locale ->> p_field, ''), p_base);
$$;

-- A translated jsonb field (e.g. section content), or the English value.
create or replace function private.tr_json(p_translations jsonb, p_locale text, p_field text, p_base jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_translations -> p_locale -> p_field, p_base);
$$;

-- Multiple-choice options with word labels translated by option id. Ids never change.
create or replace function private.tr_options(p_options jsonb, p_translations jsonb, p_locale text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_options is null or p_translations -> p_locale -> 'options' is null then p_options
    else (
      select jsonb_agg(
               case when p_translations -> p_locale -> 'options' ? (o ->> 'id')
                    then jsonb_set(o, '{label}', p_translations -> p_locale -> 'options' -> (o ->> 'id'))
                    else o end
               order by ord)
      from jsonb_array_elements(p_options) with ordinality as e(o, ord)
    )
  end;
$$;

-- Mirrors normalizeInput() in packages/shared/src/math/number.ts, now including
-- Myanmar and Thai digits. Also fixes the earlier mapping, which had one dash
-- too many and so turned a full-width plus (＋) into a minus.
create or replace function private.normalize_input(p_input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               btrim(translate(p_input, E'၀၁၂၃၄၅၆၇၈၉๐๑๒๓๔๕๖๗๘๙−‒–—﹣－＋', '01234567890123456789------+'), E' \t\n\r\f\u000b '),
               '\s+', ' ', 'g'),
             '\s*/\s*', '/', 'g'),
           '^([+-]) ', '\1');
$$;

-- ---------------------------------------------------------------------------
-- RPCs, now with p_locale. Bodies match 20261019000002 apart from the
-- translated text fields.
-- ---------------------------------------------------------------------------

drop function public.start_lesson(uuid, uuid, boolean);
drop function public.submit_answer(uuid, uuid, text);
drop function public.complete_lesson(uuid);
drop function public.get_learner_overview(uuid);
drop function public.get_child_report(uuid);

create function public.start_lesson(p_child_id uuid, p_lesson_id uuid, p_daily boolean default false, p_locale text default 'en')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.child_profiles;
  v_lesson record;
  v_attempt public.quiz_attempts;
  v_question_ids uuid[];
  v_points int;
  v_resumed boolean := false;
  v_loc text := private.locale(p_locale);
begin
  v_child := private.require_child(p_child_id, true);

  select l.*, w.learning_level_id,
         private.tr(w.translations, v_loc, 'title', w.title) as world_title,
         private.tr(t.translations, v_loc, 'title', t.title) as topic_title
    into v_lesson
    from public.lessons l
    join public.worlds w on w.id = l.world_id and w.is_published and w.archived_at is null
    join public.topics t on t.id = l.topic_id and t.is_published and t.archived_at is null
    where l.id = p_lesson_id and l.is_published and l.archived_at is null;
  if not found or v_lesson.learning_level_id <> v_child.learning_level_id then
    raise exception 'lesson_not_available' using errcode = 'P0001';
  end if;
  if not coalesce((select unlocked from private.world_states(v_child.id) where world_id = v_lesson.world_id), false) then
    raise exception 'world_locked' using errcode = 'P0001';
  end if;
  if p_daily and private.daily_lesson(v_child.id, private.utc_today()) is distinct from p_lesson_id then
    raise exception 'not_daily_challenge' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.quiz_attempts
    where child_profile_id = v_child.id and lesson_id = p_lesson_id and status = 'in_progress'
    for update;
  if found then
    if v_attempt.started_at > now() - interval '1 day' and v_attempt.is_daily_challenge = p_daily then
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
    select array_agg(id order by display_order, id), sum(points)
      into v_question_ids, v_points
      from public.questions
      where lesson_id = p_lesson_id and is_published and archived_at is null;
    if v_question_ids is null then
      raise exception 'lesson_has_no_questions' using errcode = 'P0001';
    end if;
    insert into public.quiz_attempts (child_profile_id, lesson_id, is_daily_challenge, question_ids, total_questions, points_possible)
      values (v_child.id, p_lesson_id, p_daily, v_question_ids, cardinality(v_question_ids), v_points)
      returning * into v_attempt;
  end if;

  insert into public.lesson_progress (child_profile_id, lesson_id)
    values (v_child.id, p_lesson_id)
    on conflict (child_profile_id, lesson_id) do update set updated_at = now();

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'resumed', v_resumed,
    'isDailyChallenge', v_attempt.is_daily_challenge,
    'lesson', jsonb_build_object(
      'id', v_lesson.id,
      'title', private.tr(v_lesson.translations, v_loc, 'title', v_lesson.title),
      'description', private.tr(v_lesson.translations, v_loc, 'description', v_lesson.description),
      'learningObjective', private.tr(v_lesson.translations, v_loc, 'learning_objective', v_lesson.learning_objective),
      'difficulty', v_lesson.difficulty,
      'estimatedMinutes', v_lesson.estimated_minutes,
      'worldTitle', v_lesson.world_title,
      'topicTitle', v_lesson.topic_title
    ),
    'sections', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id,
          'type', s.section_type,
          'title', private.tr(s.translations, v_loc, 'title', s.title),
          'content', private.tr_json(s.translations, v_loc, 'content', s.content_json)
        ) order by s.display_order), '[]'::jsonb)
      from public.lesson_sections s where s.lesson_id = p_lesson_id
    ),
    -- Public question fields only: no answer_data, no explanation.
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

create function public.submit_answer(p_attempt_id uuid, p_question_id uuid, p_answer text, p_locale text default 'en')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_q public.questions;
  v_tries int;
  v_solved boolean;
  v_result text;
  v_correct boolean;
  v_number int;
  v_points int;
  v_resolved boolean;
  v_label text;
  v_loc text := private.locale(p_locale);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select a.* into v_attempt
    from public.quiz_attempts a
    join public.child_profiles c on c.id = a.child_profile_id
    where a.id = p_attempt_id and c.parent_id = (select auth.uid()) and c.archived_at is null
    for update of a;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_closed' using errcode = 'P0001';
  end if;
  if not (p_question_id = any (v_attempt.question_ids)) then
    raise exception 'question_not_in_attempt' using errcode = 'P0001';
  end if;
  if p_answer is null or char_length(p_answer) > 40 then
    return jsonb_build_object('status', 'invalid', 'reason', 'too_long');
  end if;

  select * into v_q from public.questions where id = p_question_id;

  select count(*), coalesce(bool_or(is_correct), false) into v_tries, v_solved
    from public.question_responses
    where quiz_attempt_id = p_attempt_id and question_id = p_question_id;
  if v_solved or v_tries >= 2 then
    raise exception 'question_already_answered' using errcode = 'P0001';
  end if;

  v_result := private.check_answer(v_q.question_type, v_q.answer_data, v_q.options, p_answer);
  if v_result like 'invalid:%' then
    -- Invalid input does not use up a try.
    return jsonb_build_object('status', 'invalid', 'reason', substr(v_result, 9));
  end if;

  v_correct := v_result = 'correct';
  v_number := v_tries + 1;
  v_points := case when not v_correct then 0 when v_number = 1 then v_q.points else floor(v_q.points * 0.5)::int end;
  v_resolved := v_correct or v_number >= 2;

  insert into public.question_responses (quiz_attempt_id, question_id, submitted_answer, is_correct, attempt_number, points_awarded)
    values (p_attempt_id, p_question_id, jsonb_build_object('value', p_answer), v_correct, v_number, v_points);

  update public.lesson_progress
    set current_question_index = (
          select count(*) from jsonb_array_elements(private.question_progress(p_attempt_id)) p
          where (p ->> 'resolved')::boolean
        ),
        updated_at = now()
    where child_profile_id = v_attempt.child_profile_id and lesson_id = v_attempt.lesson_id and status = 'in_progress';

  if v_resolved then
    v_label := case when v_q.question_type = 'multiple_choice'
      then (select o ->> 'label' from jsonb_array_elements(private.tr_options(v_q.options, v_q.translations, v_loc)) o
            where o ->> 'id' = v_q.answer_data ->> 'value')
      else v_q.answer_data ->> 'value' end;
  end if;

  return jsonb_build_object(
    'status', 'answered',
    'isCorrect', v_correct,
    'attemptNumber', v_number,
    'triesRemaining', case when v_resolved then 0 else 2 - v_number end,
    'resolved', v_resolved,
    'pointsAwarded', v_points,
    'hint', case when v_resolved then null else private.tr(v_q.translations, v_loc, 'hint', v_q.hint) end,
    'explanation', case when v_resolved then private.tr(v_q.translations, v_loc, 'explanation', v_q.explanation) else null end,
    'correctAnswer', v_label
  );
end;
$$;

create function public.complete_lesson(p_attempt_id uuid, p_locale text default 'en')
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
    return private.attempt_summary(v_attempt.id, true, '[]'::jsonb, '[]'::jsonb);
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
  select difficulty into v_difficulty from public.lessons where id = v_attempt.lesson_id;

  select coalesce(array_agg(world_id), '{}') into v_before from private.world_states(v_child_id) where unlocked;

  update public.quiz_attempts
    set status = 'completed', score = v_score, correct_answers = v_first_correct, points_earned = v_points,
        stars = v_stars, completed_at = now()
    where id = v_attempt.id;

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

  return private.attempt_summary(v_attempt.id, false, v_new_badges, v_unlocked);
end;
$$;

create function public.get_learner_overview(p_child_id uuid, p_locale text default 'en')
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

create function public.get_child_report(p_child_id uuid, p_locale text default 'en')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.child_profiles;
  v_today date := private.utc_today();
  v_loc text := private.locale(p_locale);
begin
  v_child := private.require_child(p_child_id);
  return jsonb_build_object(
    'child', jsonb_build_object(
      'id', v_child.id,
      'displayName', v_child.display_name,
      'avatarKey', v_child.avatar_key,
      'ageGroup', v_child.age_group,
      'learningLevelId', v_child.learning_level_id,
      'levelName', (select name from public.learning_levels where id = v_child.learning_level_id),
      'createdAt', v_child.created_at
    ),
    'stats', private.learner_stats(v_child.id),
    'levelLessonCount', (
      select count(*) from public.lessons l join public.worlds w on w.id = l.world_id
      where w.learning_level_id = v_child.learning_level_id and l.is_published and l.archived_at is null
    ),
    'topics', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'topicId', t.id,
          'topicTitle', private.tr(t.translations, v_loc, 'title', t.title),
          'questionsAnswered', coalesce(r.answered, 0),
          'firstTryCorrect', coalesce(r.first_correct, 0),
          'lessonsCompleted', (
            select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
            where lp.child_profile_id = v_child.id and lp.status = 'completed' and l.topic_id = t.id
          ),
          'lessonCount', (select count(*) from public.lessons l where l.topic_id = t.id and l.is_published and l.archived_at is null)
        ) order by t.learning_level_id, t.display_order), '[]'::jsonb)
      from public.topics t
      left join lateral (
        select count(*) as answered, count(*) filter (where qr.is_correct) as first_correct
        from public.question_responses qr
        join public.quiz_attempts a on a.id = qr.quiz_attempt_id
        join public.questions q on q.id = qr.question_id
        join public.lessons l on l.id = q.lesson_id
        where a.child_profile_id = v_child.id and qr.attempt_number = 1 and l.topic_id = t.id
      ) r on true
      where t.is_published and t.archived_at is null
        and (t.learning_level_id = v_child.learning_level_id or coalesce(r.answered, 0) > 0)
    ),
    'recentActivity', (
      select coalesce(jsonb_agg(x order by x ->> 'completedAt' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'attemptId', a.id,
          'lessonTitle', private.tr(l.translations, v_loc, 'title', l.title),
          'topicTitle', private.tr(t.translations, v_loc, 'title', t.title),
          'score', a.score,
          'stars', a.stars,
          'correctAnswers', a.correct_answers,
          'totalQuestions', a.total_questions,
          'isDailyChallenge', a.is_daily_challenge,
          'completedAt', a.completed_at
        ) as x
        from public.quiz_attempts a
        join public.lessons l on l.id = a.lesson_id
        join public.topics t on t.id = l.topic_id
        where a.child_profile_id = v_child.id and a.status = 'completed'
        order by a.completed_at desc
        limit 20
      ) recent
    ),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
          'date', d::date,
          'lessonsCompleted', (
            select count(*) from public.quiz_attempts a
            where a.child_profile_id = v_child.id and a.status = 'completed'
              and (a.completed_at at time zone 'utc')::date = d::date
          ),
          'questionsAnswered', (
            select count(*) from public.question_responses qr join public.quiz_attempts a on a.id = qr.quiz_attempt_id
            where a.child_profile_id = v_child.id and qr.attempt_number = 1
              and (qr.answered_at at time zone 'utc')::date = d::date
          )
        ) order by d)
      from generate_series(v_today - 6, v_today, interval '1 day') d
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: same as before, for the new signatures.
-- ---------------------------------------------------------------------------

revoke all on function private.locale(text) from public, anon, authenticated;
revoke all on function private.tr(jsonb, text, text, text) from public, anon, authenticated;
revoke all on function private.tr_json(jsonb, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.tr_options(jsonb, jsonb, text) from public, anon, authenticated;

revoke all on function public.start_lesson(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.submit_answer(uuid, uuid, text, text) from public, anon;
revoke all on function public.complete_lesson(uuid, text) from public, anon;
revoke all on function public.get_learner_overview(uuid, text) from public, anon;
revoke all on function public.get_child_report(uuid, text) from public, anon;

grant execute on function public.start_lesson(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.submit_answer(uuid, uuid, text, text) to authenticated;
grant execute on function public.complete_lesson(uuid, text) to authenticated;
grant execute on function public.get_learner_overview(uuid, text) to authenticated;
grant execute on function public.get_child_report(uuid, text) to authenticated;
