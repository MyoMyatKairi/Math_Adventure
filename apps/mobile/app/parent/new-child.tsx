import { childProfileInputSchema, fieldErrors, friendlyError } from '@math-adventure/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChildFields, defaultChild } from '../../src/components/child-fields';
import { Body, Button, H1, Message, Screen } from '../../src/components/ui';
import { useLocale } from '../../src/lib/i18n';
import { supabase } from '../../src/lib/supabase';

export default function NewChild() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [value, setValue] = useState(defaultChild());
  const [levelTouched, setLevelTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = childProfileInputSchema.safeParse(value);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error, locale));
    setErrors({});
    setBusy(true);
    const { error: e } = await supabase.from('child_profiles').insert({
      display_name: parsed.data.displayName,
      avatar_key: parsed.data.avatarKey,
      age_group: parsed.data.ageGroup,
      learning_level_id: parsed.data.learningLevelId,
    });
    setBusy(false);
    if (e) return setError(friendlyError(e, locale));
    router.back();
  }

  return (
    <Screen>
      <H1>{t('child.newTitle')}</H1>
      <Body muted>{t('child.newLead')}</Body>
      {error ? <Message>{error}</Message> : null}
      <ChildFields value={value} onChange={setValue} errors={errors} levelTouched={levelTouched} setLevelTouched={setLevelTouched} />
      <Button label={t('child.add')} size="lg" onPress={save} loading={busy} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
