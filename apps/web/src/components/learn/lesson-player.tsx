'use client';

import {
  invalidInputMessage,
  precheckInput,
  type CompleteLessonResult,
  type InvalidReason,
  type QuestionProgress,
  type SectionContent,
  type StartLessonResult,
  type SubmitAnswerResult,
} from '@math-adventure/shared';
import { CheckCircle2, Flame, Lightbulb, RotateCcw, Snowflake, Sparkles, Target, Volume2, VolumeX, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BadgeMedal } from '@/components/brand/icons';
import { useLocale, useT } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Stars } from '@/components/ui/stars';
import { Visual } from '@/components/visuals/visual';
import { friendlyError } from '@/lib/errors';
import { playSound, setSoundEnabled, soundEnabled } from '@/lib/sounds';
import { getBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ANSWER_INPUTS } from './answer-inputs';
import { Confetti, CountUp } from './celebrate';

export interface LessonPlayerProps {
  childId: string;
  ageGroup: '5-7' | '8-10' | '11-12';
  /** A lesson, or a practice round of earlier mistakes (no lesson, no sections). */
  mode?: 'lesson' | 'review';
  lesson: { id: string; title: string; objective: string; worldTitle: string; worldId: string; minutes: number; status: string } | null;
  sections: { type: string; title: string; content: SectionContent }[];
  isDaily: boolean;
  nextLesson: { id: string; title: string } | null;
  /** Practice only: how many earlier mistakes are waiting. */
  mistakes?: number;
}

type Session = Pick<StartLessonResult, 'attemptId' | 'resumed' | 'questions' | 'progress'>;

type Feedback =
  | { kind: 'correct'; explanation: string | null; points: number }
  | { kind: 'retry'; hint: string | null }
  | { kind: 'reveal'; explanation: string | null; correctAnswer: string | null };

type Phase = 'intro' | 'example' | 'practice' | 'finishing' | 'complete';

/** Combo sizes that get their own cheer. */
const COMBO_CHEERS = new Set([3, 5, 10, 15, 20]);

export function firstUnresolved(questions: { id: string }[], progress: Record<string, QuestionProgress>): number {
  const i = questions.findIndex((q) => !progress[q.id]?.resolved);
  return i === -1 ? questions.length : i;
}

export function LessonPlayer({ childId, ageGroup, mode = 'lesson', lesson, sections, isDaily, nextLesson, mistakes = 0 }: LessonPlayerProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const review = mode === 'review';
  const [phase, setPhase] = useState<Phase>('intro');
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>({});
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const [exampleStep, setExampleStep] = useState(1);
  const [shake, setShake] = useState(0);
  const [combo, setCombo] = useState(0);
  // The sound toggle only shows after the learner starts, so reading storage here can't break hydration.
  const [sound, setSound] = useState(() => typeof window !== 'undefined' && soundEnabled());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const intro = sections.find((s) => s.content.kind === 'introduction')?.content as Extract<SectionContent, { kind: 'introduction' }> | undefined;
  const example = sections.find((s) => s.content.kind === 'worked_example')?.content as Extract<SectionContent, { kind: 'worked_example' }> | undefined;
  const summary = sections.find((s) => s.content.kind === 'summary')?.content as Extract<SectionContent, { kind: 'summary' }> | undefined;
  const exitHref = review ? '/learn/home' : lesson ? `/learn/world/${lesson.worldId}` : '/learn/map';

  // Move focus to the new heading when the screen changes, for keyboard and screen reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [phase, index]);

  // Once a question is resolved, Enter (or Space) moves on.
  useEffect(() => {
    if (feedback?.kind === 'correct' || feedback?.kind === 'reveal') continueRef.current?.focus();
  }, [feedback]);

  function toggleSound() {
    setSoundEnabled(!sound);
    setSound(!sound);
    if (!sound) setTimeout(() => playSound('correct'), 0);
  }

  async function start() {
    setBusy(true);
    setError(null);
    const client = getBrowserClient();
    const { data, error: rpcError } = review
      ? await client.rpc('start_review', { p_child_id: childId, p_locale: locale })
      : await client.rpc('start_lesson', { p_child_id: childId, p_lesson_id: lesson!.id, p_daily: isDaily, p_locale: locale });
    setBusy(false);
    if (rpcError || !data) return setError(friendlyError(rpcError, locale));
    const s = data as Session;
    const map = Object.fromEntries(s.progress.map((p) => [p.questionId, p]));
    setSession(s);
    setProgress(map);
    setCombo(0);
    const at = firstUnresolved(s.questions, map);
    if (at >= s.questions.length) return finish(s.attemptId);
    setIndex(at);
    setPhase('practice');
  }

  async function submit() {
    if (!session || busy || feedback?.kind === 'correct' || feedback?.kind === 'reveal') return;
    const q = session.questions[index]!;
    const problem: InvalidReason | null = precheckInput(q, answer);
    if (problem) {
      setInputError(invalidInputMessage(problem, q.answerFormat, locale));
      return;
    }
    setBusy(true);
    setError(null);
    setInputError(null);
    const { data, error: rpcError } = await getBrowserClient().rpc('submit_answer', {
      p_attempt_id: session.attemptId,
      p_question_id: q.id,
      p_answer: answer,
      p_locale: locale,
    });
    setBusy(false);
    if (rpcError || !data) return setError(friendlyError(rpcError, locale));
    const r = data as SubmitAnswerResult;
    if (r.status === 'invalid') {
      setInputError(invalidInputMessage(r.reason as InvalidReason, q.answerFormat, locale));
      return;
    }
    setProgress((p) => ({
      ...p,
      [q.id]: { questionId: q.id, tries: r.attemptNumber, resolved: r.resolved, correct: r.isCorrect, pointsAwarded: r.pointsAwarded },
    }));
    if (r.isCorrect) {
      // Only first-try answers build a combo; a second-try save keeps it going.
      const nextCombo = r.attemptNumber === 1 ? combo + 1 : combo;
      setCombo(nextCombo);
      playSound(r.attemptNumber === 1 && COMBO_CHEERS.has(nextCombo) ? 'combo' : 'correct');
      setFeedback({ kind: 'correct', explanation: r.explanation, points: r.pointsAwarded });
    } else if (!r.resolved) {
      setCombo(0);
      playSound('retry');
      setFeedback({ kind: 'retry', hint: r.hint });
      setShowHint(true);
      setAnswer('');
      setShake((n) => n + 1);
    } else {
      setCombo(0);
      playSound('reveal');
      setFeedback({ kind: 'reveal', explanation: r.explanation, correctAnswer: r.correctAnswer });
    }
  }

  function next() {
    if (!session) return;
    const at = firstUnresolved(session.questions, progress);
    setFeedback(null);
    setAnswer('');
    setShowHint(false);
    setInputError(null);
    if (at >= session.questions.length) void finish(session.attemptId);
    else setIndex(at);
  }

  async function finish(attemptId: string) {
    setPhase('finishing');
    setError(null);
    const { data, error: rpcError } = await getBrowserClient().rpc('complete_lesson', { p_attempt_id: attemptId, p_locale: locale });
    if (rpcError || !data) {
      setError(friendlyError(rpcError, locale));
      return;
    }
    setResult(data as CompleteLessonResult);
    setPhase('complete');
    playSound('complete');
    router.refresh();
  }

  function playAgain() {
    setSession(null);
    setProgress({});
    setResult(null);
    setFeedback(null);
    setAnswer('');
    setIndex(0);
    setExampleStep(1);
    setCombo(0);
    setPhase('intro');
  }

  // -------------------------------------------------------------------------

  if (phase === 'intro' && review) {
    return (
      <Screen>
        <p className="flex items-center gap-2 font-semibold text-ink-soft">
          <Target className="h-5 w-5 text-plum" aria-hidden="true" /> {t('practice.title')}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-3xl font-extrabold focus:outline-none sm:text-4xl">
          {mistakes > 0 ? t('practice.mistakes', { count: mistakes }) : t('practice.warmUp')}
        </h1>
        <p className="mt-3 text-lg">{t('practice.intro')}</p>
        <p className="mt-2 text-ink-soft">{t('practice.noXp')}</p>
        {error && <div className="mt-4"><FormMessage>{error}</FormMessage></div>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="xl" onClick={start} loading={busy}>
            {t('practice.start')}
          </Button>
          <Button asChild size="xl" variant="ghost">
            <Link href="/learn/home">{t('common.back')}</Link>
          </Button>
        </div>
      </Screen>
    );
  }

  if (phase === 'intro' && lesson) {
    return (
      <Screen>
        <p className="font-semibold text-ink-soft">
          {lesson.worldTitle}
          {isDaily && <span className="ml-2 rounded-full bg-sun-soft px-2 py-0.5 text-sm font-bold text-sun-dark">{t('player.daily')}</span>}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-3xl font-extrabold focus:outline-none sm:text-4xl">
          {lesson.title}
        </h1>
        <p className="mt-2 rounded-2xl bg-lagoon-soft px-4 py-2 font-semibold text-lagoon-dark">{t('player.goal', { objective: lesson.objective })}</p>
        {intro && (
          <div className="mt-6">
            <p className="text-xl leading-relaxed">{intro.text}</p>
            {intro.visual && <Visual visual={intro.visual} className="mt-5" />}
          </div>
        )}
        {error && <div className="mt-4"><FormMessage>{error}</FormMessage></div>}
        <div className="mt-8 flex flex-wrap gap-3">
          {example ? (
            <Button size="lg" onClick={() => setPhase('example')}>
              {t('player.showExample')}
            </Button>
          ) : (
            <Button size="lg" onClick={start} loading={busy}>
              {t('player.startPractice')}
            </Button>
          )}
          {lesson.status === 'in_progress' && (
            <Button size="lg" variant="secondary" onClick={start} loading={busy}>
              {t('player.continue')}
            </Button>
          )}
        </div>
      </Screen>
    );
  }

  if (phase === 'example' && example) {
    const done = exampleStep >= example.steps.length;
    return (
      <Screen>
        <p className="font-semibold text-ink-soft">{t('player.workedExample')}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-3xl font-extrabold focus:outline-none">
          {example.problem}
        </h1>
        {example.visual && <Visual visual={example.visual} className="mt-5" />}
        <ol className="mt-6 space-y-3" aria-live="polite">
          {example.steps.slice(0, exampleStep).map((s, i) => (
            <li key={i} className="flex animate-rise gap-3 rounded-2xl bg-paper p-4 shadow-[0_3px_0_0_var(--color-line)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-plum font-display font-extrabold text-white">{i + 1}</span>
              <span className="text-lg">{s}</span>
            </li>
          ))}
        </ol>
        {error && <div className="mt-4"><FormMessage>{error}</FormMessage></div>}
        <div className="mt-8 flex flex-wrap gap-3">
          {!done ? (
            <Button size="lg" onClick={() => setExampleStep((n) => n + 1)}>
              {t('player.nextStep')}
            </Button>
          ) : (
            <Button size="lg" onClick={start} loading={busy}>
              {t('player.startPractice')}
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={() => setPhase('intro')}>
            {t('common.back')}
          </Button>
        </div>
      </Screen>
    );
  }

  if ((phase === 'practice' || phase === 'finishing') && session) {
    const q = session.questions[index]!;
    const Input = ANSWER_INPUTS[q.type];
    const locked = feedback?.kind === 'correct' || feedback?.kind === 'reveal' || phase === 'finishing';
    const isLast = firstUnresolved(session.questions, progress) >= session.questions.length;
    const resolvedCount = session.questions.filter((sq) => progress[sq.id]?.resolved).length;
    const pct = Math.round((resolvedCount / session.questions.length) * 100);
    return (
      <Screen>
        {/* Top bar: leave, progress, sound. */}
        <div className="flex items-center gap-3">
          <Link href={exitHref} aria-label={t('common.close')} className="rounded-full p-1.5 text-ink-soft hover:bg-paper hover:text-ink">
            <X className="h-6 w-6" aria-hidden="true" />
          </Link>
          <div
            role="progressbar"
            aria-label={t('player.progressLabel', { done: resolvedCount, total: session.questions.length })}
            aria-valuemin={0}
            aria-valuemax={session.questions.length}
            aria-valuenow={resolvedCount}
            className="h-4 flex-1 overflow-hidden rounded-full bg-line/70"
          >
            <div
              className={cn('relative h-full rounded-full transition-[width] duration-500', combo >= 3 ? 'bg-ember' : 'bg-lagoon')}
              style={{ width: `${Math.max(pct, 4)}%` }}
            >
              <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={t(sound ? 'player.soundOff' : 'player.soundOn')}
            className="rounded-full p-1.5 text-ink-soft hover:bg-paper hover:text-ink"
          >
            {sound ? <Volume2 className="h-6 w-6" aria-hidden="true" /> : <VolumeX className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>

        <div className="mt-3 flex min-h-7 items-center justify-between gap-3">
          <p className="font-semibold text-ink-soft">{t('player.questionOf', { n: index + 1, total: session.questions.length })}</p>
          {combo >= 2 && (
            <p key={combo} className="flex animate-pop items-center gap-1 rounded-full bg-ember-soft px-3 py-0.5 font-display font-extrabold text-ember-dark">
              <Zap className="h-4 w-4 fill-ember text-ember" aria-hidden="true" />
              {t('player.combo', { count: combo })}
            </p>
          )}
        </div>
        {session.resumed && <p className="mt-1 text-sm font-semibold text-plum-dark">{t('player.resumed')}</p>}

        <h1 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-2xl font-extrabold leading-snug focus:outline-none sm:text-3xl">
          {q.prompt}
        </h1>
        {q.visual && <Visual visual={q.visual} className="mt-5" />}

        <div key={shake} className={cn('mt-6', shake > 0 && feedback?.kind === 'retry' && 'animate-wobble')}>
          <Input question={q} value={answer} onChange={(v) => { setAnswer(v); setInputError(null); }} onSubmit={submit} disabled={locked || busy} ageGroup={ageGroup} />
        </div>

        {inputError && (
          <p role="alert" className="mt-3 text-center font-semibold text-ember-dark">
            {inputError}
          </p>
        )}
        {showHint && q.hint && feedback?.kind !== 'retry' && !locked && (
          <p className="mt-4 flex gap-2 rounded-2xl bg-plum-soft p-4 text-lg">
            <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-plum" aria-hidden="true" />
            {q.hint}
          </p>
        )}
        {error && <div className="mt-4"><FormMessage>{error}</FormMessage></div>}

        {/* Room for the answer sheet fixed to the bottom of the screen. */}
        <div aria-hidden="true" className="h-56 sm:h-48" />

        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 border-t-2',
            feedback?.kind === 'correct' ? 'animate-sheet border-lagoon/30 bg-lagoon-soft'
              : feedback?.kind === 'retry' ? 'animate-sheet border-ember/30 bg-ember-soft'
              : feedback?.kind === 'reveal' ? 'animate-sheet border-sky/30 bg-sky-soft'
              : 'border-line bg-paper',
          )}
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:px-6 sm:py-5">
            <div aria-live="polite" className="min-w-0 flex-1">
              {feedback?.kind === 'correct' && (
                <>
                  <p className="flex items-center gap-2 font-display text-2xl font-extrabold text-lagoon-dark">
                    <CheckCircle2 className="h-8 w-8 animate-pop" aria-hidden="true" />
                    {t(progress[q.id]?.tries === 1 ? 'player.correct' : 'player.gotIt')}
                    <span className="rounded-full bg-paper px-3 py-0.5 text-base tabular">{t('player.points', { count: feedback.points })}</span>
                  </p>
                  {feedback.explanation && <p className="mt-1 text-lg">{feedback.explanation}</p>}
                </>
              )}
              {feedback?.kind === 'retry' && (
                <>
                  <p className="font-display text-xl font-extrabold text-ember-dark">{t('player.notQuite')}</p>
                  {feedback.hint && showHint && (
                    <p className="mt-1 flex gap-2 text-lg">
                      <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-plum" aria-hidden="true" />
                      <span>
                        <span className="font-bold">{t('player.hint')}</span> {feedback.hint}
                      </span>
                    </p>
                  )}
                </>
              )}
              {feedback?.kind === 'reveal' && (
                <>
                  <p className="font-display text-xl font-extrabold">
                    {t('player.answerIs')} <span className="rounded-lg bg-paper px-2 tabular">{feedback.correctAnswer}</span>
                  </p>
                  {feedback.explanation && <p className="mt-1 text-lg">{feedback.explanation}</p>}
                  <p className="mt-1 text-ink-soft">{t('player.mistakes')}</p>
                </>
              )}
              {!feedback && !locked && q.hint && !showHint && (
                <Button variant="ghost" onClick={() => setShowHint(true)}>
                  <Lightbulb className="h-5 w-5" aria-hidden="true" /> {t('player.needHint')}
                </Button>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {phase === 'finishing' && error && (
                <Button size="xl" variant="secondary" onClick={() => finish(session.attemptId)}>
                  {t('player.saveAgain')}
                </Button>
              )}
              {locked ? (
                <Button
                  ref={continueRef}
                  size="xl"
                  className="w-full sm:w-auto"
                  onClick={next}
                  loading={phase === 'finishing' && !error}
                  disabled={phase === 'finishing' && !error}
                >
                  {t(isLast ? (review ? 'player.continue2' : 'player.finish') : 'player.next')}
                </Button>
              ) : (
                <Button size="xl" className="w-full sm:w-auto" onClick={submit} loading={busy} disabled={answer.length === 0}>
                  {t('player.check')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Screen>
    );
  }

  if (phase === 'finishing') {
    return (
      <Screen>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-extrabold focus:outline-none">
          {t('player.saving')}
        </h1>
        {error && (
          <div className="mt-4 space-y-3">
            <FormMessage>{error}</FormMessage>
            {session && <Button onClick={() => finish(session.attemptId)}>{t('player.saveAgain')}</Button>}
          </div>
        )}
      </Screen>
    );
  }

  if (phase === 'complete' && result) {
    const goalJustMet = !result.alreadyCompleted && result.dailyGoal.done === result.dailyGoal.target;
    return (
      <Screen>
        {!result.alreadyCompleted && (result.stars >= 2 || goalJustMet || result.streak.extended) && <Confetti />}
        <div className="text-center">
          <p className="font-semibold text-ink-soft">{review ? t('practice.title') : lesson?.title}</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-4xl font-extrabold focus:outline-none">
            {review ? t('practice.done') : t(result.stars === 3 ? 'player.brilliant' : result.stars === 2 ? 'player.great' : 'player.complete')}
          </h1>
          <div className="mt-6 flex justify-center">
            <Stars count={result.stars} size="h-16 w-16 animate-pop" />
          </div>
          <p className="mt-4 text-xl tabular">{t('player.score', { correct: result.correctAnswers, total: result.totalQuestions, score: result.score })}</p>

          <div className={cn('mx-auto mt-6 grid max-w-md gap-3', review ? 'grid-cols-1' : 'grid-cols-2')}>
            {!review && (
              <>
                <div className="rounded-3xl bg-plum-soft p-4">
                  <p className="font-display text-3xl font-extrabold text-plum-dark tabular">
                    +<CountUp value={result.xpAwarded} />
                  </p>
                  <p className="text-sm font-semibold">{t('player.xpEarned')}</p>
                </div>
                <div className="rounded-3xl bg-sun-soft p-4">
                  <p className="font-display text-3xl font-extrabold text-sun-dark tabular">
                    +<CountUp value={result.starsAwarded} />
                  </p>
                  <p className="text-sm font-semibold">{t('player.newStars')}</p>
                </div>
              </>
            )}
          </div>
          {!review && result.xpAwarded === 0 && (
            <p className="mt-3 text-ink-soft">{t(result.bestStars === 3 ? 'player.allStars' : 'player.beatBest')}</p>
          )}
          {result.dailyBonusXp > 0 && <p className="mt-3 font-semibold text-sun-dark">{t('player.dailyBonus', { xp: result.dailyBonusXp })}</p>}
          {review && <p className="mt-3 text-ink-soft">{t('practice.noXp')}</p>}
        </div>

        {(result.streak.extended || goalJustMet) && (
          <ul className="mx-auto mt-6 max-w-md space-y-2">
            {result.streak.extended && (
              <li className="flex animate-rise items-center gap-3 rounded-3xl bg-ember-soft p-4 font-display text-lg font-extrabold text-ember-dark">
                <Flame className="h-8 w-8 animate-pop fill-ember text-ember" aria-hidden="true" />
                {result.streak.current === 1 ? t('player.streakStart') : t('player.streakUp', { count: result.streak.current })}
              </li>
            )}
            {result.streak.freezeEarned && (
              <li className="flex animate-rise items-center gap-3 rounded-3xl bg-sky-soft p-4 font-semibold">
                <Snowflake className="h-6 w-6 text-sky" aria-hidden="true" /> {t('player.freezeEarned')}
              </li>
            )}
            {result.streak.freezesUsed > 0 && (
              <li className="flex animate-rise items-center gap-3 rounded-3xl bg-sky-soft p-4 font-semibold">
                <Snowflake className="h-6 w-6 text-sky" aria-hidden="true" /> {t('player.freezeUsed')}
              </li>
            )}
            {goalJustMet && (
              <li className="flex animate-rise items-center gap-3 rounded-3xl bg-lagoon-soft p-4 font-display text-lg font-extrabold text-lagoon-dark">
                <Target className="h-7 w-7" aria-hidden="true" /> {t('player.goalReached')}
              </li>
            )}
          </ul>
        )}

        {result.newBadges.length > 0 && (
          <section aria-labelledby="new-badges" className="mt-8 rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
            <h2 id="new-badges" className="flex items-center gap-2 font-display text-xl font-extrabold">
              <Sparkles className="h-5 w-5 text-sun-dark" aria-hidden="true" /> {t('player.newBadges', { count: result.newBadges.length })}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-4">
              {result.newBadges.map((b) => (
                <li key={b.key} className="flex items-center gap-3">
                  <BadgeMedal iconKey={b.iconKey} earned className="animate-pop" />
                  <span>
                    <span className="block font-bold">{b.title}</span>
                    <span className="text-sm text-ink-soft">{b.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {result.unlockedWorlds.length > 0 && (
          <div className="mt-4">
            <FormMessage tone="success">{t('player.newWorld', { worlds: result.unlockedWorlds.map((w) => w.title).join(', ') })}</FormMessage>
          </div>
        )}
        {summary && (
          <section aria-labelledby="remember" className="mt-6 rounded-3xl bg-lagoon-soft p-5">
            <h2 id="remember" className="font-display text-lg font-extrabold">
              {t('player.remember')}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {summary.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {review ? (
            <>
              <Button size="lg" onClick={playAgain}>
                <RotateCcw className="h-5 w-5" aria-hidden="true" /> {t('practice.again')}
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/learn/home">{t('practice.backHome')}</Link>
              </Button>
            </>
          ) : (
            <>
              {nextLesson && (
                <Button asChild size="lg">
                  <Link href={`/learn/lesson/${nextLesson.id}`}>{t('player.nextLesson', { title: nextLesson.title })}</Link>
                </Button>
              )}
              <Button size="lg" variant="secondary" onClick={playAgain}>
                <RotateCcw className="h-5 w-5" aria-hidden="true" /> {t('player.practiseAgain')}
              </Button>
              {lesson && (
                <Button asChild size="lg" variant="ghost">
                  <Link href={`/learn/world/${lesson.worldId}`}>{t('player.backTo', { world: lesson.worldTitle })}</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </Screen>
    );
  }

  return null;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl">{children}</div>;
}
