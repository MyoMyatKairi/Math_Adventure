import { childProfileInputSchema, fieldErrors, friendlyError, overallAccuracy, summarizeTopics, type ChildReport } from '@math-adventure/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ChildFields, type ChildValues } from '../../../src/components/child-fields';
import { Body, Button, Card, ConfirmDialog, ErrorState, H1, H2, Loading, Message, Meter, Screen } from '../../../src/components/ui';
import { useSession } from '../../../src/lib/session';
import { supabase } from '../../../src/lib/supabase';
import { useRpc } from '../../../src/lib/use-rpc';
import { colors } from '../../../src/theme';

export default function ChildReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeChildId, setActiveChild } = useSession();
  const { data, error, loading, reload } = useRpc<ChildReport>('get_child_report', { p_child_id: id });
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
  if (error || !data || !values) return <Screen scroll={false}><ErrorState message={error ?? 'Not found'} onRetry={reload} /></Screen>;

  const topics = summarizeTopics(data.topics);
  const accuracy = overallAccuracy(data.topics);

  async function save() {
    const parsed = childProfileInputSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const { error: e } = await supabase
      .from('child_profiles')
      .update({ display_name: parsed.data.displayName, avatar_key: parsed.data.avatarKey, age_group: parsed.data.ageGroup, learning_level_id: parsed.data.learningLevelId })
      .eq('id', id);
    setBusy(false);
    if (e) return setMsg({ tone: 'error', text: friendlyError(e) });
    setEditing(false);
    setMsg({ tone: 'success', text: 'Changes saved.' });
    void reload();
  }

  async function remove() {
    setBusy(true);
    const { error: e } = await supabase.from('child_profiles').delete().eq('id', id);
    setBusy(false);
    setConfirm(false);
    if (e) return setMsg({ tone: 'error', text: friendlyError(e) });
    if (activeChildId === id) await setActiveChild(null);
    router.replace('/parent');
  }

  return (
    <Screen>
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
      <H1>{data.child.displayName}</H1>
      <Body muted>{`${data.child.levelName}, ages ${data.child.ageGroup.replace('-', '–')}`}</Body>
      {msg ? <Message tone={msg.tone}>{msg.text}</Message> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '900' }}>{data.stats.lessonsCompleted}</Text>
          <Body muted>lessons</Body>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '900' }}>{accuracy === null ? '—' : `${accuracy}%`}</Text>
          <Body muted>first try</Body>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '900' }}>{data.stats.totalStars}</Text>
          <Body muted>stars</Body>
        </Card>
      </View>
      {data.recentActivity.length === 0 ? <Message tone="info">{`${data.child.displayName} hasn’t finished a lesson yet.`}</Message> : null}
      <Card>
        <H2>Progress by topic</H2>
        {topics.map((t) => (
          <View key={t.topicId} style={{ gap: 4, marginTop: 6 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{t.topicTitle}</Text>
            <Meter value={t.accuracy ?? 0} max={100} label={t.accuracy === null ? `${t.topicTitle}: no answers yet` : `${t.topicTitle}: ${t.accuracy}% first try`} />
            <Body muted>{t.message}</Body>
          </View>
        ))}
      </Card>
      <Card>
        <H2>Recent lessons</H2>
        {data.recentActivity.slice(0, 6).map((a) => (
          <Body key={a.attemptId}>{`${a.lessonTitle}: ${a.correctAnswers}/${a.totalQuestions} first try, ${a.stars} stars`}</Body>
        ))}
        {data.recentActivity.length === 0 ? <Body muted>Nothing yet.</Body> : null}
      </Card>
      {editing ? (
        <Card>
          <H2>Edit profile and level</H2>
          <ChildFields value={values} onChange={setValues} errors={errors} levelTouched setLevelTouched={() => {}} />
          <Button label="Save changes" onPress={save} loading={busy} />
          <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
        </Card>
      ) : (
        <Button label="Edit profile and level" variant="secondary" onPress={() => setEditing(true)} />
      )}
      <Button label="Delete profile" variant="ghost" onPress={() => setConfirm(true)} />
      <ConfirmDialog
        visible={confirm}
        title={`Delete ${data.child.displayName}'s profile?`}
        body="This permanently removes their stars, badges, lesson history and progress."
        confirmLabel="Delete permanently"
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
        loading={busy}
      />
    </Screen>
  );
}
