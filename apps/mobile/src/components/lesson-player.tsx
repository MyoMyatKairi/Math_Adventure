import {
  friendlyError,
  invalidInputMessage,
  pickTranslation,
  precheckInput,
  type CompleteLessonResult,
  type InvalidReason,
  type QuestionProgress,
  type SectionContent,
  type StartLessonResult,
  type SubmitAnswerResult,
} from '@math-adventure/shared';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useLocale } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { ANSWER_INPUTS } from './answer-inputs';
import { Confetti } from './celebrate';
import { FlameIcon } from './streak';
import { Body, Button, Card, H1, H2, Message, StarRow } from './ui';
import { Visual } from './visual';

type Session = Pick<StartLessonResult, 'attemptId' | 'resumed' | 'questions' | 'progress'>;

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
 * With `mode="review"` it plays a practice round of earlier mistakes instead (no lesson).
 * All scoring happens on the server; this component only renders results.
 */
export function LessonPlayer({
  childId,
  lessonId,
  ageGroup,
  isDaily,
  onExit,
  mode = 'lesson',
  mistakes = 0,
}: {
  childId: string;
  lessonId?: string;
  ageGroup: '5-7' | '8-10' | '11-12';
  isDaily: boolean;
  onExit: () => void;
  mode?: 'lesson' | 'review';
  mistakes?: number;
}) {
  const { locale, t } = useLocale();
  const review = mode === 'review';
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<'intro' | 'practice' | 'complete'>('intro');
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>({});
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const [sections, setSections] = useState<SectionContent[] | null>(review ? [] : null);
  const [title, setTitle] = useState('');
  const [combo, setCombo] = useState(0);

  // Public curriculum (no answers) for the introduction and worked example.
  useEffect(() => {
    if (review || !lessonId) return;
    let live = true;
    Promise.all([
      supabase.from('lesson_sections').select('content_json, translations').eq('lesson_id', lessonId).order('display_order'),
      supabase.from('lessons').select('title, learning_objective, translations').eq('id', lessonId).single(),
    ]).then(([sec, les]) => {
      if (!live) return;
      if (sec.error || les.error) return setError(friendlyError(sec.error ?? les.error, locale));
      setSections((sec.data ?? []).map((r) => pickTranslation(r.content_json as SectionContent, r.translations, locale, 'content')));
      const tr = les.data.translations;
      setTitle(`${pickTranslation(les.data.title, tr, locale, 'title')}: ${pickTranslation(les.data.learning_objective, tr, locale, 'learning_objective')}`);
    });
    return () => {
      live = false;
    };
  }, [lessonId, locale, review]);

  async function start() {
    setBusy(true);
    setError(null);
    const { data, error: e } = review
      ? await supabase.rpc('start_review', { p_child_id: childId, p_locale: locale })
      : await supabase.rpc('start_lesson', { p_child_id: childId, p_lesson_id: lessonId, p_daily: isDaily, p_locale: locale });
    setBusy(false);
    if (e || !data) return setError(friendlyError(e, locale));
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
    if (!session || busy) return;
    const q = session.questions[index]!;
    const problem = precheckInput(q, answer);
    if (problem) return setInputError(invalidInputMessage(problem, q.answerFormat, locale));
    setBusy(true);
    setError(null);
    setInputError(null);
    const { data, error: e } = await supabase.rpc('submit_answer', { p_attempt_id: session.attemptId, p_question_id: q.id, p_answer: answer, p_locale: locale });
    setBusy(false);
    if (e || !data) return setError(friendlyError(e, locale));
    const r = data as SubmitAnswerResult;
    if (r.status === 'invalid') return setInputError(invalidInputMessage(r.reason as InvalidReason, q.answerFormat, locale));
    setProgress((p) => ({ ...p, [q.id]: { questionId: q.id, tries: r.attemptNumber, resolved: r.resolved, correct: r.isCorrect, pointsAwarded: r.pointsAwarded } }));
    if (r.isCorrect) {
      // Only first-try answers build a combo; a second-try save keeps it going.
      if (r.attemptNumber === 1) setCombo((n) => n + 1);
      setFeedback({ kind: 'correct', explanation: r.explanation, points: r.pointsAwarded, firstTry: r.attemptNumber === 1 });
    } else if (!r.resolved) {
      setCombo(0);
      setFeedback({ kind: 'retry', hint: r.hint });
      setAnswer('');
    } else {
      setCombo(0);
      setFeedback({ kind: 'reveal', explanation: r.explanation, correctAnswer: r.correctAnswer });
    }
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
    const { data, error: e } = await supabase.rpc('complete_lesson', { p_attempt_id: attemptId, p_locale: locale });
    setBusy(false);
    if (e || !data) return setError(friendlyError(e, locale));
    setResult(data as CompleteLessonResult);
    setPhase('complete');
  }

  function again() {
    setSession(null);
    setProgress({});
    setResult(null);
    setFeedback(null);
    setAnswer('');
    setIndex(0);
    setCombo(0);
    setPhase('intro');
  }

  if (phase === 'intro' && review) {
    return (
      <View style={{ gap: 16 }}>
        <Text style={{ color: colors.plumDark, fontWeight: '800' }}>{t('practice.title')}</Text>
        <H1>{mistakes > 0 ? t('practice.mistakes', { count: mistakes }) : t('practice.warmUp')}</H1>
        <Body>{t('practice.intro')}</Body>
        <Body muted>{t('practice.noXp')}</Body>
        {error ? <Message>{error}</Message> : null}
        <Button label={t('practice.start')} size="lg" onPress={start} loading={busy} />
        <Button label={t('common.back')} variant="ghost" onPress={onExit} />
      </View>
    );
  }

  if (phase === 'intro') {
    const intro = sections?.find((x) => x.kind === 'introduction');
    const example = sections?.find((x) => x.kind === 'worked_example');
    return (
      <View style={{ gap: 16 }}>
        <H1>{t(isDaily ? 'player.daily' : 'player.readyToLearn')}</H1>
        {title ? <Body muted>{title}</Body> : null}
        {!sections && !error ? <Body muted>{t('player.loadingLesson')}</Body> : null}
        {intro?.kind === 'introduction' ? (
          <Card>
            <Body>{intro.text}</Body>
            {intro.visual ? <Visual visual={intro.visual} /> : null}
          </Card>
        ) : null}
        {example?.kind === 'worked_example' ? (
          <Card tone="plum">
            <H2>{t('player.exampleTitle', { problem: example.problem })}</H2>
            {example.visual ? <Visual visual={example.visual} /> : null}
            {example.steps.map((step, i) => (
              <Body key={i}>{`${i + 1}. ${step}`}</Body>
            ))}
          </Card>
        ) : null}
        {error ? <Message>{error}</Message> : null}
        <Button label={t('player.startPractice')} size="lg" onPress={start} loading={busy} disabled={!sections} />
        <Button label={t('common.back')} variant="ghost" onPress={onExit} />
      </View>
    );
  }

  if (phase === 'practice' && session) {
    const q = session.questions[index]!;
    const Input = ANSWER_INPUTS[q.type];
    const locked = feedback?.kind === 'correct' || feedback?.kind === 'reveal';
    const isLast = firstUnresolved(session.questions, progress) >= session.questions.length;
    const resolvedCount = session.questions.filter((sq) => progress[sq.id]?.resolved).length;
    const pct = Math.max(4, Math.round((resolvedCount / session.questions.length) * 100));
    return (
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onExit} hitSlop={12} style={{ padding: 4 }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.inkSoft }}>✕</Text>
          </Pressable>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t('player.progressLabel', { done: resolvedCount, total: session.questions.length })}
            accessibilityValue={{ min: 0, max: session.questions.length, now: resolvedCount }}
            style={{ flex: 1, height: 16, borderRadius: 999, backgroundColor: colors.line, overflow: 'hidden' }}
          >
            <View style={{ width: `${pct}%`, height: '100%', borderRadius: 999, backgroundColor: combo >= 3 ? colors.ember : colors.lagoon }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
          <Text style={{ color: colors.inkSoft, fontWeight: '700' }} accessibilityRole="text">
            {t('player.questionOf', { n: index + 1, total: session.questions.length })}
          </Text>
          {combo >= 2 ? (
            <Animated.View key={combo} entering={ZoomIn.springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emberSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
              <FlameIcon size={16} />
              <Text style={{ fontWeight: '900', color: colors.emberDark }}>{t('player.combo', { count: combo })}</Text>
            </Animated.View>
          ) : null}
        </View>
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
                {t(feedback.firstTry ? 'player.correct' : 'player.gotIt')} {t('player.points', { count: feedback.points })}
              </Text>
              {feedback.explanation ? <Body>{feedback.explanation}</Body> : null}
            </Card>
          </Animated.View>
        ) : null}
        {feedback?.kind === 'retry' ? (
          <Animated.View entering={FadeInDown} accessibilityLiveRegion="polite" testID="feedback-retry">
            <Card tone="ember">
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.emberDark }}>{t('player.notQuite')}</Text>
              {feedback.hint ? <Body>{t('player.hintLine', { hint: feedback.hint })}</Body> : null}
            </Card>
          </Animated.View>
        ) : null}
        {feedback?.kind === 'reveal' ? (
          <Animated.View entering={FadeInDown} accessibilityLiveRegion="polite" testID="feedback-reveal">
            <Card tone="sky">
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{t('player.answerIsLine', { answer: feedback.correctAnswer ?? '' })}</Text>
              {feedback.explanation ? <Body>{feedback.explanation}</Body> : null}
              <Body muted>{t('player.mistakes')}</Body>
            </Card>
          </Animated.View>
        ) : null}
        {error ? <Message>{error}</Message> : null}
        {locked ? (
          <Button label={t(isLast ? (review ? 'player.continue2' : 'player.finish') : 'player.next')} size="lg" onPress={next} loading={busy} />
        ) : (
          <Button label={t('player.check')} size="lg" onPress={submit} loading={busy} disabled={answer.length === 0} />
        )}
      </View>
    );
  }

  if (phase === 'complete' && result) {
    const goalJustMet = !result.alreadyCompleted && result.dailyGoal.done === result.dailyGoal.target;
    const celebrate = !result.alreadyCompleted && (result.stars >= 2 || goalJustMet || result.streak.extended);
    return (
      <View style={{ gap: 16, alignItems: 'stretch' }}>
        <H1>{review ? t('practice.done') : t(result.stars === 3 ? 'player.brilliant' : result.stars === 2 ? 'player.great' : 'player.complete')}</H1>
        <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center' }}>
          <StarRow count={result.stars} size={56} />
        </Animated.View>
        <Body>{t('player.score', { correct: result.correctAnswers, total: result.totalQuestions, score: result.score })}</Body>
        {review ? (
          <Body muted>{t('practice.noXp')}</Body>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card tone="plum" style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.plumDark }}>+{result.xpAwarded}</Text>
              <Text style={{ fontWeight: '700' }}>{t('player.xpEarned')}</Text>
            </Card>
            <Card tone="sun" style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.sunDark }}>+{result.starsAwarded}</Text>
              <Text style={{ fontWeight: '700' }}>{t('player.newStars')}</Text>
            </Card>
          </View>
        )}
        {result.streak.extended ? (
          <Animated.View entering={FadeInDown}>
            <Card tone="ember" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FlameIcon size={32} />
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.emberDark, flex: 1 }}>
                {result.streak.current === 1 ? t('player.streakStart') : t('player.streakUp', { count: result.streak.current })}
              </Text>
            </Card>
          </Animated.View>
        ) : null}
        {result.streak.freezeEarned ? <Message tone="info">{`❄ ${t('player.freezeEarned')}`}</Message> : null}
        {result.streak.freezesUsed > 0 ? <Message tone="info">{`❄ ${t('player.freezeUsed')}`}</Message> : null}
        {goalJustMet ? <Message tone="success">{t('player.goalReached')}</Message> : null}
        {result.newBadges.map((b) => (
          <Message key={b.key} tone="success">{t('player.newBadgeLine', { title: b.title, description: b.description })}</Message>
        ))}
        {result.unlockedWorlds.length > 0 ? <Message tone="success">{t('player.newWorld', { worlds: result.unlockedWorlds.map((w) => w.title).join(', ') })}</Message> : null}
        {review ? <Button label={t('practice.again')} size="lg" onPress={again} /> : null}
        <Button label={t(review ? 'practice.backHome' : 'player.backToMap')} size={review ? 'md' : 'lg'} variant={review ? 'ghost' : 'primary'} onPress={onExit} />
        {celebrate ? <Confetti /> : null}
      </View>
    );
  }

  return error ? <Message>{error}</Message> : null;
}
