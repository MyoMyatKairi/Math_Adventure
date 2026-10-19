import {
  friendlyError,
  invalidInputMessage,
  precheckInput,
  type CompleteLessonResult,
  type InvalidReason,
  type QuestionProgress,
  type SectionContent,
  type StartLessonResult,
  type SubmitAnswerResult,
} from '@math-adventure/shared';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { ANSWER_INPUTS } from './answer-inputs';
import { Body, Button, Card, H1, H2, Message, StarRow } from './ui';
import { Visual } from './visual';

type Feedback =
  | { kind: 'correct'; explanation: string | null; points: number; firstTry: boolean }
  | { kind: 'retry'; hint: string | null }
  | { kind: 'reveal'; explanation: string | null; correctAnswer: string | null };

export function firstUnresolved(questions: { id: string }[], progress: Record<string, QuestionProgress>) {
  const i = questions.findIndex((q) => !progress[q.id]?.resolved);
  return i === -1 ? questions.length : i;
}

/**
 * Native lesson flow: introduction, worked example, practice with two tries, completion.
 * All scoring happens on the server; this component only renders results.
 */
export function LessonPlayer({
  childId,
  lessonId,
  ageGroup,
  isDaily,
  onExit,
}: {
  childId: string;
  lessonId: string;
  ageGroup: '5-7' | '8-10' | '11-12';
  isDaily: boolean;
  onExit: () => void;
}) {
  const [session, setSession] = useState<StartLessonResult | null>(null);
  const [phase, setPhase] = useState<'intro' | 'practice' | 'complete'>('intro');
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>({});
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const [sections, setSections] = useState<SectionContent[] | null>(null);
  const [title, setTitle] = useState('');

  // Public curriculum (no answers) for the introduction and worked example.
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from('lesson_sections').select('content_json').eq('lesson_id', lessonId).order('display_order'),
      supabase.from('lessons').select('title, learning_objective').eq('id', lessonId).single(),
    ]).then(([sec, les]) => {
      if (!live) return;
      if (sec.error || les.error) return setError(friendlyError(sec.error ?? les.error));
      setSections((sec.data ?? []).map((r) => r.content_json as SectionContent));
      setTitle(`${les.data.title}: ${les.data.learning_objective}`);
    });
    return () => {
      live = false;
    };
  }, [lessonId]);

  async function start() {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('start_lesson', { p_child_id: childId, p_lesson_id: lessonId, p_daily: isDaily });
    setBusy(false);
    if (e || !data) return setError(friendlyError(e));
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
    if (!session || busy) return;
    const q = session.questions[index]!;
    const problem = precheckInput(q, answer);
    if (problem) return setInputError(invalidInputMessage(problem, q.answerFormat));
    setBusy(true);
    setError(null);
    setInputError(null);
    const { data, error: e } = await supabase.rpc('submit_answer', { p_attempt_id: session.attemptId, p_question_id: q.id, p_answer: answer });
    setBusy(false);
    if (e || !data) return setError(friendlyError(e));
    const r = data as SubmitAnswerResult;
    if (r.status === 'invalid') return setInputError(invalidInputMessage(r.reason as InvalidReason, q.answerFormat));
    setProgress((p) => ({ ...p, [q.id]: { questionId: q.id, tries: r.attemptNumber, resolved: r.resolved, correct: r.isCorrect, pointsAwarded: r.pointsAwarded } }));
    if (r.isCorrect) setFeedback({ kind: 'correct', explanation: r.explanation, points: r.pointsAwarded, firstTry: r.attemptNumber === 1 });
    else if (!r.resolved) {
      setFeedback({ kind: 'retry', hint: r.hint });
      setAnswer('');
    } else setFeedback({ kind: 'reveal', explanation: r.explanation, correctAnswer: r.correctAnswer });
  }

  function next() {
    if (!session) return;
    const at = firstUnresolved(session.questions, progress);
    setFeedback(null);
    setAnswer('');
    setInputError(null);
    if (at >= session.questions.length) void finish(session.attemptId);
    else setIndex(at);
  }

  async function finish(attemptId: string) {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('complete_lesson', { p_attempt_id: attemptId });
    setBusy(false);
    if (e || !data) return setError(friendlyError(e));
    setResult(data as CompleteLessonResult);
    setPhase('complete');
  }

  if (phase === 'intro') {
    const intro = sections?.find((x) => x.kind === 'introduction');
    const example = sections?.find((x) => x.kind === 'worked_example');
    return (
      <View style={{ gap: 16 }}>
        <H1>{isDaily ? "Today's challenge" : 'Ready to learn?'}</H1>
        {title ? <Body muted>{title}</Body> : null}
        {!sections && !error ? <Body muted>Loading the lesson…</Body> : null}
        {intro?.kind === 'introduction' ? (
          <Card>
            <Body>{intro.text}</Body>
            {intro.visual ? <Visual visual={intro.visual} /> : null}
          </Card>
        ) : null}
        {example?.kind === 'worked_example' ? (
          <Card tone="plum">
            <H2>{`Example: ${example.problem}`}</H2>
            {example.visual ? <Visual visual={example.visual} /> : null}
            {example.steps.map((step, i) => (
              <Body key={i}>{`${i + 1}. ${step}`}</Body>
            ))}
          </Card>
        ) : null}
        {error ? <Message>{error}</Message> : null}
        <Button label="Start practice" size="lg" onPress={start} loading={busy} disabled={!sections} />
        <Button label="Back" variant="ghost" onPress={onExit} />
      </View>
    );
  }

  if (phase === 'practice' && session) {
    const q = session.questions[index]!;
    const Input = ANSWER_INPUTS[q.type];
    const locked = feedback?.kind === 'correct' || feedback?.kind === 'reveal';
    const isLast = firstUnresolved(session.questions, progress) >= session.questions.length;
    return (
      <View style={{ gap: 16 }}>
        <Text style={{ color: colors.inkSoft, fontWeight: '700' }} accessibilityRole="text">
          Question {index + 1} of {session.questions.length}
        </Text>
        <H2>{q.prompt}</H2>
        {q.visual ? <Visual visual={q.visual} /> : null}
        <Input
          question={q}
          value={answer}
          onChange={(v) => {
            setAnswer(v);
            setInputError(null);
          }}
          onSubmit={submit}
          disabled={locked || busy}
          ageGroup={ageGroup}
        />
        {inputError ? <Message>{inputError}</Message> : null}
        {feedback?.kind === 'correct' ? (
          <Animated.View entering={ZoomIn.springify()} accessibilityLiveRegion="polite" testID="feedback-correct">
            <Card tone="lagoon">
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.lagoonDark }}>
                {feedback.firstTry ? 'Correct!' : 'You got it!'} +{feedback.points} points
              </Text>
              {feedback.explanation ? <Body>{feedback.explanation}</Body> : null}
            </Card>
          </Animated.View>
        ) : null}
        {feedback?.kind === 'retry' ? (
          <Animated.View entering={FadeInDown} accessibilityLiveRegion="polite" testID="feedback-retry">
            <Card tone="ember">
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.emberDark }}>Not quite. Have another go!</Text>
              {feedback.hint ? <Body>Hint: {feedback.hint}</Body> : null}
            </Card>
          </Animated.View>
        ) : null}
        {feedback?.kind === 'reveal' ? (
          <Animated.View entering={FadeInDown} accessibilityLiveRegion="polite" testID="feedback-reveal">
            <Card tone="sky">
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>The answer is {feedback.correctAnswer}</Text>
              {feedback.explanation ? <Body>{feedback.explanation}</Body> : null}
              <Body muted>Mistakes help us learn. You&apos;ll see this idea again.</Body>
            </Card>
          </Animated.View>
        ) : null}
        {error ? <Message>{error}</Message> : null}
        {locked ? (
          <Button label={isLast ? 'Finish lesson' : 'Next question'} size="lg" onPress={next} loading={busy} />
        ) : (
          <Button label="Check answer" size="lg" onPress={submit} loading={busy} disabled={answer.length === 0} />
        )}
      </View>
    );
  }

  if (phase === 'complete' && result) {
    return (
      <View style={{ gap: 16, alignItems: 'stretch' }}>
        <H1>{result.stars === 3 ? 'Brilliant work!' : result.stars === 2 ? 'Great job!' : 'Lesson complete!'}</H1>
        <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center' }}>
          <StarRow count={result.stars} size={56} />
        </Animated.View>
        <Body>
          {result.correctAnswers} of {result.totalQuestions} right first time, score {result.score}%
        </Body>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card tone="plum" style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.plumDark }}>+{result.xpAwarded}</Text>
            <Text style={{ fontWeight: '700' }}>XP earned</Text>
          </Card>
          <Card tone="sun" style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.sunDark }}>+{result.starsAwarded}</Text>
            <Text style={{ fontWeight: '700' }}>new stars</Text>
          </Card>
        </View>
        {result.newBadges.map((b) => (
          <Message key={b.key} tone="success">{`New badge: ${b.title}. ${b.description}`}</Message>
        ))}
        {result.unlockedWorlds.length > 0 ? <Message tone="success">{`New world open: ${result.unlockedWorlds.map((w) => w.title).join(', ')}!`}</Message> : null}
        <Button label="Back to the map" size="lg" onPress={onExit} />
      </View>
    );
  }

  return error ? <Message>{error}</Message> : null;
}
