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
import { CheckCircle2, Lightbulb, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BadgeMedal } from '@/components/brand/icons';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Stars } from '@/components/ui/stars';
import { Visual } from '@/components/visuals/visual';
import { friendlyError } from '@/lib/errors';
import { getBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ANSWER_INPUTS } from './answer-inputs';

export interface LessonPlayerProps {
  childId: string;
  ageGroup: '5-7' | '8-10' | '11-12';
  lesson: { id: string; title: string; objective: string; worldTitle: string; worldId: string; minutes: number; status: string };
  sections: { type: string; title: string; content: SectionContent }[];
  isDaily: boolean;
  nextLesson: { id: string; title: string } | null;
}

type Feedback =
  | { kind: 'correct'; explanation: string | null; points: number }
  | { kind: 'retry'; hint: string | null }
  | { kind: 'reveal'; explanation: string | null; correctAnswer: string | null };

type Phase = 'intro' | 'example' | 'practice' | 'finishing' | 'complete';

export function firstUnresolved(questions: { id: string }[], progress: Record<string, QuestionProgress>): number {
  const i = questions.findIndex((q) => !progress[q.id]?.resolved);
  return i === -1 ? questions.length : i;
}

export function LessonPlayer({ childId, ageGroup, lesson, sections, isDaily, nextLesson }: LessonPlayerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [session, setSession] = useState<StartLessonResult | null>(null);
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  const intro = sections.find((s) => s.content.kind === 'introduction')?.content as Extract<SectionContent, { kind: 'introduction' }> | undefined;
  const example = sections.find((s) => s.content.kind === 'worked_example')?.content as Extract<SectionContent, { kind: 'worked_example' }> | undefined;
  const summary = sections.find((s) => s.content.kind === 'summary')?.content as Extract<SectionContent, { kind: 'summary' }> | undefined;

  // Move focus to the new heading when the screen changes, for keyboard and screen reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [phase, index]);

  async function start() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await getBrowserClient().rpc('start_lesson', {
      p_child_id: childId,
      p_lesson_id: lesson.id,
      p_daily: isDaily,
    });
    setBusy(false);
    if (rpcError || !data) return setError(friendlyError(rpcError));
    const s = data as StartLessonResult;
    const map = Object.fromEntries(s.progress.map((p) => [p.questionId, p]));
    setSession(s);
    setProgress(map);
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
      setInputError(invalidInputMessage(problem, q.answerFormat));
      return;
    }
    setBusy(true);
    setError(null);
    setInputError(null);
    const { data, error: rpcError } = await getBrowserClient().rpc('submit_answer', {
      p_attempt_id: session.attemptId,
      p_question_id: q.id,
      p_answer: answer,
    });
    setBusy(false);
    if (rpcError || !data) return setError(friendlyError(rpcError));
    const r = data as SubmitAnswerResult;
    if (r.status === 'invalid') {
      setInputError(invalidInputMessage(r.reason as InvalidReason, q.answerFormat));
      return;
    }
    setProgress((p) => ({
      ...p,
      [q.id]: { questionId: q.id, tries: r.attemptNumber, resolved: r.resolved, correct: r.isCorrect, pointsAwarded: r.pointsAwarded },
    }));
    if (r.isCorrect) {
      setFeedback({ kind: 'correct', explanation: r.explanation, points: r.pointsAwarded });
    } else if (!r.resolved) {
      setFeedback({ kind: 'retry', hint: r.hint });
      setShowHint(true);
      setAnswer('');
      setShake((n) => n + 1);
    } else {
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
    const { data, error: rpcError } = await getBrowserClient().rpc('complete_lesson', { p_attempt_id: attemptId });
    if (rpcError || !data) {
      setError(friendlyError(rpcError));
      return;
    }
    setResult(data as CompleteLessonResult);
    setPhase('complete');
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
    setPhase('intro');
  }

  // -------------------------------------------------------------------------

  if (phase === 'intro') {
    return (
      <Screen>
        <p className="font-semibold text-ink-soft">
          {lesson.worldTitle}
          {isDaily && <span className="ml-2 rounded-full bg-sun-soft px-2 py-0.5 text-sm font-bold text-sun-dark">Today&apos;s challenge</span>}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-3xl font-extrabold focus:outline-none sm:text-4xl">
          {lesson.title}
        </h1>
        <p className="mt-2 rounded-2xl bg-lagoon-soft px-4 py-2 font-semibold text-lagoon-dark">Goal: {lesson.objective}</p>
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
              Show me an example
            </Button>
          ) : (
            <Button size="lg" onClick={start} loading={busy}>
              Start practice
            </Button>
          )}
          {lesson.status === 'in_progress' && (
            <Button size="lg" variant="secondary" onClick={start} loading={busy}>
              Continue where I stopped
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
        <p className="font-semibold text-ink-soft">Worked example</p>
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
              Next step
            </Button>
          ) : (
            <Button size="lg" onClick={start} loading={busy}>
              Start practice
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={() => setPhase('intro')}>
            Back
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
    return (
      <Screen>
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-ink-soft">
            Question {index + 1} of {session.questions.length}
          </p>
          <ol className="flex gap-1.5" aria-label="Question progress">
            {session.questions.map((sq, i) => {
              const p = progress[sq.id];
              return (
                <li
                  key={sq.id}
                  aria-label={`Question ${i + 1}: ${p?.resolved ? (p.correct ? 'correct' : 'finished') : i === index ? 'current' : 'to do'}`}
                  className={cn(
                    'h-3 w-3 rounded-full sm:h-3.5 sm:w-8',
                    p?.resolved ? (p.correct ? 'bg-lagoon' : 'bg-ember') : i === index ? 'bg-plum' : 'bg-line',
                  )}
                />
              );
            })}
          </ol>
        </div>
        {session.resumed && (
          <p className="mt-2 text-sm font-semibold text-plum-dark">Welcome back! You’re picking up where you stopped.</p>
        )}
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

        <div aria-live="polite" className="mt-5">
          {feedback?.kind === 'correct' && (
            <div className="rounded-3xl bg-lagoon-soft p-5">
              <p className="flex items-center gap-2 font-display text-2xl font-extrabold text-lagoon-dark">
                <CheckCircle2 className="h-8 w-8 animate-pop" aria-hidden="true" />
                {progress[q.id]?.tries === 1 ? 'Correct!' : 'You got it!'}
                <span className="ml-auto rounded-full bg-paper px-3 py-1 text-base tabular">+{feedback.points} points</span>
              </p>
              {feedback.explanation && <p className="mt-2 text-lg">{feedback.explanation}</p>}
            </div>
          )}
          {feedback?.kind === 'retry' && (
            <div className="rounded-3xl bg-ember-soft p-5">
              <p className="font-display text-xl font-extrabold text-ember-dark">Not quite. Have another go!</p>
              {feedback.hint && showHint && (
                <p className="mt-2 flex gap-2 text-lg">
                  <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-plum" aria-hidden="true" />
                  <span>
                    <span className="font-bold">Hint:</span> {feedback.hint}
                  </span>
                </p>
              )}
            </div>
          )}
          {feedback?.kind === 'reveal' && (
            <div className="rounded-3xl bg-sky-soft p-5">
              <p className="font-display text-xl font-extrabold">
                The answer is <span className="rounded-lg bg-paper px-2 tabular">{feedback.correctAnswer}</span>
              </p>
              {feedback.explanation && <p className="mt-2 text-lg">{feedback.explanation}</p>}
              <p className="mt-2 text-ink-soft">Mistakes help us learn. You&apos;ll see this idea again.</p>
            </div>
          )}
        </div>

        {error && <div className="mt-4"><FormMessage>{error}</FormMessage></div>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {locked ? (
            <Button size="xl" onClick={next} loading={phase === 'finishing' && !error} disabled={phase === 'finishing' && !error}>
              {isLast ? 'Finish lesson' : 'Next question'}
            </Button>
          ) : (
            <Button size="xl" onClick={submit} loading={busy} disabled={answer.length === 0}>
              Check answer
            </Button>
          )}
          {!locked && q.hint && !showHint && (
            <Button variant="ghost" onClick={() => setShowHint(true)}>
              <Lightbulb className="h-5 w-5" aria-hidden="true" /> Need a hint?
            </Button>
          )}
          {phase === 'finishing' && error && (
            <Button variant="secondary" onClick={() => finish(session.attemptId)}>
              Try saving again
            </Button>
          )}
        </div>
        {showHint && q.hint && feedback?.kind !== 'retry' && !locked && (
          <p className="mt-3 flex gap-2 rounded-2xl bg-plum-soft p-4 text-lg">
            <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-plum" aria-hidden="true" />
            {q.hint}
          </p>
        )}
      </Screen>
    );
  }

  if (phase === 'finishing') {
    return (
      <Screen>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-extrabold focus:outline-none">
          Saving your progress…
        </h1>
        {error && (
          <div className="mt-4 space-y-3">
            <FormMessage>{error}</FormMessage>
            {session && <Button onClick={() => finish(session.attemptId)}>Try saving again</Button>}
          </div>
        )}
      </Screen>
    );
  }

  if (phase === 'complete' && result) {
    return (
      <Screen>
        <div className="text-center">
          <p className="font-semibold text-ink-soft">{lesson.title}</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-4xl font-extrabold focus:outline-none">
            {result.stars === 3 ? 'Brilliant work!' : result.stars === 2 ? 'Great job!' : 'Lesson complete!'}
          </h1>
          <div className="mt-6 flex justify-center">
            <Stars count={result.stars} size="h-16 w-16 animate-pop" />
          </div>
          <p className="mt-4 text-xl tabular">
            {result.correctAnswers} of {result.totalQuestions} right first time, score {result.score}%
          </p>
          <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-3xl bg-plum-soft p-4">
              <p className="font-display text-3xl font-extrabold text-plum-dark tabular">+{result.xpAwarded}</p>
              <p className="text-sm font-semibold">XP earned</p>
            </div>
            <div className="rounded-3xl bg-sun-soft p-4">
              <p className="font-display text-3xl font-extrabold text-sun-dark tabular">+{result.starsAwarded}</p>
              <p className="text-sm font-semibold">new stars</p>
            </div>
          </div>
          {result.xpAwarded === 0 && (
            <p className="mt-3 text-ink-soft">
              {result.bestStars === 3 ? 'You already have every star here. Practice still makes you stronger!' : 'Beat your best score to earn more stars.'}
            </p>
          )}
          {result.dailyBonusXp > 0 && <p className="mt-3 font-semibold text-sun-dark">Includes {result.dailyBonusXp} XP daily challenge bonus.</p>}
        </div>

        {result.newBadges.length > 0 && (
          <section aria-labelledby="new-badges" className="mt-8 rounded-3xl bg-paper p-5 shadow-[0_4px_0_0_var(--color-line)]">
            <h2 id="new-badges" className="flex items-center gap-2 font-display text-xl font-extrabold">
              <Sparkles className="h-5 w-5 text-sun-dark" aria-hidden="true" /> New {result.newBadges.length === 1 ? 'badge' : 'badges'}
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
            <FormMessage tone="success">New world open: {result.unlockedWorlds.map((w) => w.title).join(', ')}!</FormMessage>
          </div>
        )}
        {summary && (
          <section aria-labelledby="remember" className="mt-6 rounded-3xl bg-lagoon-soft p-5">
            <h2 id="remember" className="font-display text-lg font-extrabold">
              Remember
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {summary.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {nextLesson && (
            <Button asChild size="lg">
              <Link href={`/learn/lesson/${nextLesson.id}`}>Next: {nextLesson.title}</Link>
            </Button>
          )}
          <Button size="lg" variant="secondary" onClick={playAgain}>
            <RotateCcw className="h-5 w-5" aria-hidden="true" /> Practise again
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href={`/learn/world/${lesson.worldId}`}>Back to {lesson.worldTitle}</Link>
          </Button>
        </div>
      </Screen>
    );
  }

  return null;
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl">{children}</div>;
}
