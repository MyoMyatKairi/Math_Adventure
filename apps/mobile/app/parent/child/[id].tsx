import { ageRange, childProfileInputSchema, fieldErrors, friendlyError, levelName, overallAccuracy, summarizeTopics, type ChildReport } from '@math-adventure/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ChildFields, type ChildValues } from '../../../src/components/child-fields';
import { Body, Button, Card, ConfirmDialog, ErrorState, H1, H2, Loading, Message, Meter, Screen } from '../../../src/components/ui';
import { useLocale } from '../../../src/lib/i18n';
import { useSession } from '../../../src/lib/session';
import { supabase } from '../../../src/lib/supabase';
import { useRpc } from '../../../src/lib/use-rpc';
import { colors } from '../../../src/theme';

export default function ChildReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeChildId, setActiveChild } = useSession();
  const { locale, t } = useLocale();
  const { data, error, loading, reload } = useRpc<ChildReport>('get_child_report', { p_child_id: id, p_locale: locale });
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ChildValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setValues({ displayName: data.child.displayName, avatarKey: data.child.avatarKey, ageGroup: data.child.ageGroup, learningLevelId: data.child.learningLevelId });
  }, [data]);

  if (loading && !data) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !data || !values) return <Screen scroll={false}><ErrorState message={error ?? t('common.notFound')} onRetry={reload} /></Screen>;

  const topics = summarizeTopics(data.topics, locale);
  const accuracy = overallAccuracy(data.topics);

  async function save() {
    const parsed = childProfileInputSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error, locale));
    setBusy(true);
    const { error: e } = await supabase
      .from('child_profiles')
      .update({ display_name: parsed.data.displayName, avatar_key: parsed.data.avatarKey, age_group: parsed.data.ageGroup, learning_level_id: parsed.data.learningLevelId })
      .eq('id', id);
    setBusy(false);
    if (e) return setMsg({ tone: 'error', text: friendlyError(e, locale) });
    setEditing(false);
    setMsg({ tone: 'success', text: t('report.saved') });
    void reload();
  }

  async function remove() {
    setBusy(true);
    const { error: e } = await supabase.from('child_profiles').delete().eq('id', id);
    setBusy(false);
    setConfirm(false);
    if (e) return setMsg({ tone: 'error', text: friendlyError(e, locale) });
    if (activeChildId === id) await setActiveChild(null);
    router.replace('/parent');
  }

  return (
    <Screen>
      <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      <H1>{data.child.displayName}</H1>
      <Body muted>{t('common.levelAges', { level: levelName(data.child.learningLevelId, t, data.child.levelName), range: ageRange(data.child.ageGroup) })}</Body>
      {msg ? <Message tone={msg.tone}>{msg.text}</Message> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '900' }}>{data.stats.lessonsCompleted}</Text>
          <Body muted>{t('report.lessonsShort')}</Body>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '900' }}>{accuracy === null ? '—' : `${accuracy}%`}</Text>
          <Body muted>{t('report.firstTryShort')}</Body>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '900' }}>{data.stats.totalStars}</Text>
          <Body muted>{t('report.starsShort')}</Body>
        </Card>
      </View>
      {data.recentActivity.length === 0 ? <Message tone="info">{t('report.noLessonYet', { name: data.child.displayName })}</Message> : null}
      <Card>
        <H2>{t('report.topics')}</H2>
        {topics.map((topic) => (
          <View key={topic.topicId} style={{ gap: 4, marginTop: 6 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{topic.topicTitle}</Text>
            <Meter
              value={topic.accuracy ?? 0}
              max={100}
              label={topic.accuracy === null ? t('charts.noAnswersFor', { topic: topic.topicTitle }) : t('charts.accuracyShort', { topic: topic.topicTitle, accuracy: topic.accuracy })}
            />
            <Body muted>{topic.message}</Body>
          </View>
        ))}
      </Card>
      <Card>
        <H2>{t('report.recent')}</H2>
        {data.recentActivity.slice(0, 6).map((a) => (
          <Body key={a.attemptId}>{t('report.recentShort', { lesson: a.lessonTitle, correct: a.correctAnswers, total: a.totalQuestions, stars: a.stars })}</Body>
        ))}
        {data.recentActivity.length === 0 ? <Body muted>{t('report.nothingYet')}</Body> : null}
      </Card>
      {editing ? (
        <Card>
          <H2>{t('report.edit')}</H2>
          <ChildFields value={values} onChange={setValues} errors={errors} levelTouched setLevelTouched={() => {}} />
          <Button label={t('child.save')} onPress={save} loading={busy} />
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} />
        </Card>
      ) : (
        <Button label={t('report.edit')} variant="secondary" onPress={() => setEditing(true)} />
      )}
      <Button label={t('child.delete')} variant="ghost" onPress={() => setConfirm(true)} />
      <ConfirmDialog
        visible={confirm}
        title={t('child.confirmTitle', { name: data.child.displayName })}
        body={t('child.confirmBody', { name: data.child.displayName })}
        confirmLabel={t('child.deleteForever')}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
        loading={busy}
      />
    </Screen>
  );
}
