-- Math Adventure: trusted learning operations.
--
-- Every function that writes learning records is SECURITY DEFINER, verifies the
-- caller owns the child profile, and runs in a single transaction. Answer keys,
-- scores, stars and XP are computed here; nothing the client sends is trusted
-- beyond the raw answer text. Rules mirror packages/shared (see tests/integration).

-- ---------------------------------------------------------------------------
-- Answer checking (mirrors packages/shared/src/math/number.ts and answers.ts)
-- ---------------------------------------------------------------------------

create or replace function private.normalize_input(p_input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               btrim(translate(p_input, E'−‒–—﹣－＋', '-------+'), E' \t\n\r\f\u000b '),
               '\s+', ' ', 'g'),
             '\s*/\s*', '/', 'g'),
           '^([+-]) ', '\1');
$$;

create or replace function private.parse_number(p_input text)
returns table (ok boolean, error text, num numeric, den numeric, notation text, lowest boolean)
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
  m text[];
  v_num numeric;
  v_den numeric;
  v_frac text;
begin
  if p_input is null then
    return query select false, 'not_a_number', null::numeric, null::numeric, null::text, null::boolean;
    return;
  end if;
  if char_length(p_input) > 64 then
    return query select false, 'too_long', null::numeric, null::numeric, null::text, null::boolean;
    return;
  end if;
  s := private.normalize_input(p_input);
  if s = '' then
    return query select false, 'empty', null::numeric, null::numeric, null::text, null::boolean;
    return;
  end if;
  if char_length(s) > 32 then
    return query select false, 'too_long', null::numeric, null::numeric, null::text, null::boolean;
    return;
  end if;

  m := regexp_match(s, '^([+-]?)([0-9]{1,9}) ([0-9]{1,9})/([0-9]{1,9})$');
  if m is not null then
    v_den := m[4]::numeric;
    if v_den = 0 then
      return query select false, 'divide_by_zero', null::numeric, null::numeric, null::text, null::boolean;
      return;
    end if;
    v_num := m[2]::numeric * v_den + m[3]::numeric;
    return query select true, null::text, case when m[1] = '-' then -v_num else v_num end, v_den, 'mixed',
      gcd(m[3]::numeric, v_den) = 1 and m[3]::numeric < v_den;
    return;
  end if;

  if position(' ' in s) > 0 then
    return query select false, 'not_a_number', null::numeric, null::numeric, null::text, null::boolean;
    return;
  end if;

  m := regexp_match(s, '^([+-]?)([0-9]{1,9})/([0-9]{1,9})$');
  if m is not null then
    v_den := m[3]::numeric;
    if v_den = 0 then
      return query select false, 'divide_by_zero', null::numeric, null::numeric, null::text, null::boolean;
      return;
    end if;
    v_num := m[2]::numeric;
    return query select true, null::text, case when m[1] = '-' then -v_num else v_num end, v_den, 'fraction',
      gcd(v_num, v_den) = 1;
    return;
  end if;

  m := regexp_match(s, '^([+-]?)([0-9]{1,3}(,[0-9]{3})+)$');
  if m is not null then
    v_num := replace(m[2], ',', '')::numeric;
    return query select true, null::text, case when m[1] = '-' then -v_num else v_num end, 1::numeric, 'integer', true;
    return;
  end if;

  m := regexp_match(s, '^([+-]?)([0-9]{0,12})(\.([0-9]{0,8}))?$');
  if m is not null then
    v_frac := coalesce(m[4], '');
    if char_length(m[2]) + char_length(v_frac) = 0 then
      return query select false, 'not_a_number', null::numeric, null::numeric, null::text, null::boolean;
      return;
    end if;
    v_num := (case when m[2] = '' then '0' else m[2] end || v_frac)::numeric;
    v_den := power(10::numeric, char_length(v_frac));
    return query select true, null::text, case when m[1] = '-' then -v_num else v_num end, v_den,
      case when m[3] is not null then 'decimal' else 'integer' end, true;
    return;
  end if;

  return query select false, 'not_a_number', null::numeric, null::numeric, null::text, null::boolean;
end;
$$;

-- Returns 'correct', 'incorrect' or 'invalid:<reason>'.
create or replace function private.check_answer(p_type text, p_answer jsonb, p_options jsonb, p_submitted text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_expected text := p_answer ->> 'value';
  v_format text := coalesce(p_answer ->> 'format', 'any');
  v_symbol text;
  s record;
  e record;
begin
  if p_submitted is null then
    return 'invalid:not_a_number';
  end if;

  if p_type = 'multiple_choice' then
    if not exists (select 1 from jsonb_array_elements(p_options) o where o ->> 'id' = btrim(p_submitted)) then
      return 'invalid:unknown_option';
    end if;
    return case when btrim(p_submitted) = v_expected then 'correct' else 'incorrect' end;
  end if;

  if p_type = 'compare' then
    v_symbol := translate(private.normalize_input(p_submitted), E'＜＞＝', '<>=');
    if v_symbol not in ('<', '>', '=') then
      return 'invalid:unknown_symbol';
    end if;
    return case when v_symbol = v_expected then 'correct' else 'incorrect' end;
  end if;

  select * into s from private.parse_number(p_submitted);
  if not s.ok then
    return 'invalid:' || s.error;
  end if;
  if (v_format = 'decimal' and s.notation not in ('integer', 'decimal'))
     or (v_format = 'fraction' and s.notation = 'decimal')
     or (v_format = 'simplest_fraction' and (s.notation = 'decimal' or (s.notation in ('fraction', 'mixed') and not s.lowest))) then
    return 'invalid:wrong_format';
  end if;
  select * into e from private.parse_number(v_expected);
  if not e.ok then
    raise exception 'corrupt answer key';
  end if;
  return case when s.num * e.den = e.num * s.den then 'correct' else 'incorrect' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ownership, progression and rewards helpers
-- ---------------------------------------------------------------------------

create or replace function private.require_child(p_child uuid, p_lock boolean default false)
returns public.child_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.child_profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_lock then
    select * into c from public.child_profiles
      where id = p_child and parent_id = (select auth.uid()) and archived_at is null
      for update;
  else
    select * into c from public.child_profiles
      where id = p_child and parent_id = (select auth.uid()) and archived_at is null;
  end if;
  if not found then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;
  return c;
end;
$$;

create or replace function private.utc_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'utc')::date;
$$;

-- World unlock state for a child's current level. Mirrors unlockedWorldIds() in packages/shared.
create or replace function private.world_states(p_child uuid)
returns table (world_id uuid, display_order int, lesson_count bigint, completed_count bigint, unlocked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select wo.id, wo.display_order,
      (select count(*) from public.lessons l
        where l.world_id = wo.id and l.is_published and l.archived_at is null) as lesson_count,
      (select count(*) from public.lessons l
        join public.lesson_progress lp on lp.lesson_id = l.id and lp.child_profile_id = p_child and lp.status = 'completed'
        where l.world_id = wo.id and l.is_published and l.archived_at is null) as completed_count
    from public.worlds wo
    join public.child_profiles c on c.id = p_child and c.learning_level_id = wo.learning_level_id
    where wo.is_published and wo.archived_at is null
  )
  select id, display_order, lesson_count, completed_count,
    coalesce(bool_and(completed_count >= ceil(lesson_count * 0.5)) over (
      order by display_order, id rows between unbounded preceding and 1 preceding
    ), true)
  from w;
$$;

-- Deterministic daily challenge: a lesson from an open world, preferring ones without 3 stars.
-- Once a daily attempt has started today, that lesson stays today's challenge even if
-- later progress (new stars, newly opened worlds) would change the pick.
create or replace function private.pick_daily_lesson(p_child uuid, p_day date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with open_lessons as (
    select l.id, ws.display_order as wo, l.display_order as lo, coalesce(lp.best_stars, 0) as stars
    from private.world_states(p_child) ws
    join public.lessons l on l.world_id = ws.world_id and l.is_published and l.archived_at is null
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.child_profile_id = p_child
    where ws.unlocked
  ),
  pool as (
    select id, row_number() over (order by wo, lo, id) - 1 as idx, count(*) over () as n
    from open_lessons
    where stars < 3 or not exists (select 1 from open_lessons where stars < 3)
  )
  select id from pool
  where idx = mod(abs(hashtext(p_child::text || ':' || p_day::text))::bigint, n);
$$;

create or replace function private.daily_lesson(p_child uuid, p_day date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.lesson_id from public.quiz_attempts a
      where a.child_profile_id = p_child and a.is_daily_challenge
        and (a.started_at at time zone 'utc')::date = p_day
      order by a.started_at, a.id limit 1),
    private.pick_daily_lesson(p_child, p_day)
  );
$$;

create or replace function private.learner_stats(p_child uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lessonsCompleted', (select count(*) from public.lesson_progress where child_profile_id = p_child and status = 'completed'),
    'totalStars', (select coalesce(sum(stars_awarded), 0) from public.reward_events where child_profile_id = p_child),
    'totalXp', (select coalesce(sum(xp_awarded), 0) from public.reward_events where child_profile_id = p_child),
    'perfectLessons', (select count(*) from public.lesson_progress where child_profile_id = p_child and best_stars = 3),
    'dailyChallenges', (select count(*) from public.reward_events where child_profile_id = p_child and source_type = 'daily_challenge'),
    'worldsCompleted', (
      select count(*) from public.worlds w
      where w.is_published and w.archived_at is null
        and exists (select 1 from public.lessons l where l.world_id = w.id and l.is_published and l.archived_at is null)
        and not exists (
          select 1 from public.lessons l
          where l.world_id = w.id and l.is_published and l.archived_at is null
            and not exists (
              select 1 from public.lesson_progress lp
              where lp.lesson_id = l.id and lp.child_profile_id = p_child and lp.status = 'completed'
            )
        )
    )
  );
$$;

-- Mirrors isBadgeEarned() in packages/shared.
create or replace function private.badge_earned(p_rule jsonb, p_stats jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((p_stats ->> case p_rule ->> 'type'
      when 'lessons_completed' then 'lessonsCompleted'
      when 'total_stars' then 'totalStars'
      when 'perfect_lessons' then 'perfectLessons'
      when 'worlds_completed' then 'worldsCompleted'
      when 'daily_challenges' then 'dailyChallenges'
    end)::int >= (p_rule ->> 'count')::int, false);
$$;

create or replace function private.question_progress(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'questionId', q.qid,
      'tries', coalesce(r.tries, 0),
      'correct', coalesce(r.correct, false),
      'resolved', coalesce(r.correct, false) or coalesce(r.tries, 0) >= 2,
      'pointsAwarded', coalesce(r.points, 0)
    ) order by q.ord), '[]'::jsonb)
  from public.quiz_attempts a
  cross join lateral unnest(a.question_ids) with ordinality as q(qid, ord)
  left join lateral (
    select count(*) as tries, bool_or(is_correct) as correct, sum(points_awarded) as points
    from public.question_responses
    where quiz_attempt_id = a.id and question_id = q.qid
  ) r on true
  where a.id = p_attempt;
$$;

-- ---------------------------------------------------------------------------
-- RPC: start_lesson
-- ---------------------------------------------------------------------------

create or replace function public.start_lesson(p_child_id uuid, p_lesson_id uuid, p_daily boolean default false)
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
begin
  v_child := private.require_child(p_child_id, true);

  select l.*, w.learning_level_id, w.title as world_title, t.title as topic_title
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
      'title', v_lesson.title,
      'description', v_lesson.description,
      'learningObjective', v_lesson.learning_objective,
      'difficulty', v_lesson.difficulty,
      'estimatedMinutes', v_lesson.estimated_minutes,
      'worldTitle', v_lesson.world_title,
      'topicTitle', v_lesson.topic_title
    ),
    'sections', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'type', s.section_type, 'title', s.title, 'content', s.content_json)
        order by s.display_order), '[]'::jsonb)
      from public.lesson_sections s where s.lesson_id = p_lesson_id
    ),
    -- Public question fields only: no answer_data, no explanation.
    'questions', (
      select jsonb_agg(jsonb_build_object(
          'id', q.id,
          'type', q.question_type,
          'prompt', q.prompt,
          'visual', q.visual_data,
          'options', q.options,
          'hint', q.hint,
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
-- RPC: submit_answer
-- ---------------------------------------------------------------------------

create or replace function public.submit_answer(p_attempt_id uuid, p_question_id uuid, p_answer text)
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
      then (select o ->> 'label' from jsonb_array_elements(v_q.options) o where o ->> 'id' = v_q.answer_data ->> 'value')
      else v_q.answer_data ->> 'value' end;
  end if;

  return jsonb_build_object(
    'status', 'answered',
    'isCorrect', v_correct,
    'attemptNumber', v_number,
    'triesRemaining', case when v_resolved then 0 else 2 - v_number end,
    'resolved', v_resolved,
    'pointsAwarded', v_points,
    'hint', case when v_resolved then null else v_q.hint end,
    'explanation', case when v_resolved then v_q.explanation else null end,
    'correctAnswer', v_label
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: complete_lesson (idempotent)
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

create or replace function public.complete_lesson(p_attempt_id uuid)
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
  select coalesce(jsonb_agg(jsonb_build_object('key', b.key, 'title', b.title, 'description', b.description, 'iconKey', b.icon_key)
           order by b.display_order), '[]'::jsonb)
    into v_new_badges
    from awarded join public.badges b on b.id = awarded.badge_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title) order by w.display_order), '[]'::jsonb)
    into v_unlocked
    from private.world_states(v_child_id) ws join public.worlds w on w.id = ws.world_id
    where ws.unlocked and not (ws.world_id = any (v_before));

  return private.attempt_summary(v_attempt.id, false, v_new_badges, v_unlocked);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: learner overview (dashboard + adventure map)
-- ---------------------------------------------------------------------------

create or replace function public.get_learner_overview(p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.child_profiles;
  v_today date := private.utc_today();
  v_daily uuid;
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
          'title', w.title,
          'description', w.description,
          'themeKey', w.theme_key,
          'displayOrder', w.display_order,
          'unlocked', ws.unlocked,
          'lessonCount', ws.lesson_count,
          'completedCount', ws.completed_count,
          'lessonsToUnlockNext', ceil(ws.lesson_count * 0.5)::int,
          'lessons', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'id', l.id,
                'title', l.title,
                'description', l.description,
                'difficulty', l.difficulty,
                'estimatedMinutes', l.estimated_minutes,
                'displayOrder', l.display_order,
                'topicTitle', t.title,
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
      'title', (select title from public.lessons where id = v_daily),
      'completed', exists (
        select 1 from public.reward_events
        where child_profile_id = v_child.id and idempotency_key = 'daily:' || to_char(v_today, 'YYYY-MM-DD')
      ),
      'bonusXp', 15
    ) end,
    'badges', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'key', b.key, 'title', b.title, 'description', b.description, 'iconKey', b.icon_key,
          'awardedAt', cb.awarded_at
        ) order by b.display_order), '[]'::jsonb)
      from public.badges b
      left join public.child_badges cb on cb.badge_id = b.id and cb.child_profile_id = v_child.id
      where b.is_active
    ),
    'recentAchievements', (
      select coalesce(jsonb_agg(x order by x ->> 'at' desc), '[]'::jsonb) from (
        (select jsonb_build_object('kind', 'badge', 'title', b.title, 'iconKey', b.icon_key, 'at', cb.awarded_at) as x
          from public.child_badges cb join public.badges b on b.id = cb.badge_id
          where cb.child_profile_id = v_child.id order by cb.awarded_at desc limit 5)
        union all
        (select jsonb_build_object('kind', 'lesson', 'title', l.title, 'stars', a.stars, 'score', a.score, 'at', a.completed_at)
          from public.quiz_attempts a join public.lessons l on l.id = a.lesson_id
          where a.child_profile_id = v_child.id and a.status = 'completed' order by a.completed_at desc limit 5)
      ) recent
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: parent reports
-- ---------------------------------------------------------------------------

create or replace function public.get_child_report(p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.child_profiles;
  v_today date := private.utc_today();
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
          'topicTitle', t.title,
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
          'lessonTitle', l.title,
          'topicTitle', t.title,
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

create or replace function public.get_parent_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'displayName', c.display_name,
        'avatarKey', c.avatar_key,
        'ageGroup', c.age_group,
        'learningLevelId', c.learning_level_id,
        'levelName', lv.name,
        'stats', private.learner_stats(c.id),
        'lastActiveAt', (select max(a.started_at) from public.quiz_attempts a where a.child_profile_id = c.id)
      ) order by c.created_at), '[]'::jsonb)
    from public.child_profiles c
    join public.learning_levels lv on lv.id = c.learning_level_id
    where c.parent_id = (select auth.uid()) and c.archived_at is null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: only the RPCs are callable, and only by signed-in parents.
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.owns_child(uuid) to authenticated;

revoke all on function public.start_lesson(uuid, uuid, boolean) from public, anon;
revoke all on function public.submit_answer(uuid, uuid, text) from public, anon;
revoke all on function public.complete_lesson(uuid) from public, anon;
revoke all on function public.get_learner_overview(uuid) from public, anon;
revoke all on function public.get_child_report(uuid) from public, anon;
revoke all on function public.get_parent_overview() from public, anon;

grant execute on function public.start_lesson(uuid, uuid, boolean) to authenticated;
grant execute on function public.submit_answer(uuid, uuid, text) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.get_learner_overview(uuid) to authenticated;
grant execute on function public.get_child_report(uuid) to authenticated;
grant execute on function public.get_parent_overview() to authenticated;

-- Test-only parity helper: exposes the pure answer checker to the service role
-- so integration tests can compare it with the TypeScript implementation.
create or replace function public.debug_check_answer(p_type text, p_answer jsonb, p_options jsonb, p_submitted text)
returns text
language sql
immutable
set search_path = ''
as $$
  select private.check_answer(p_type, p_answer, p_options, p_submitted);
$$;
revoke all on function public.debug_check_answer(text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.debug_check_answer(text, jsonb, jsonb, text) to service_role;
grant usage on schema private to service_role;
grant execute on function private.check_answer(text, jsonb, jsonb, text) to service_role;
grant execute on function private.parse_number(text) to service_role;
grant execute on function private.normalize_input(text) to service_role;
