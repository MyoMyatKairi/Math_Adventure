'use client';

import { AGE_GROUPS, AVATAR_KEYS, LEARNING_LEVELS, levelForAgeGroup, type AgeGroup, type AvatarKey } from '@math-adventure/shared';
import { useActionState, useState, useTransition } from 'react';
import { createChildAction, deleteChildAction, updateChildAction } from '@/app/actions/children';
import type { FormState } from '@/app/actions/auth';
import { Avatar, avatarLabel } from '@/components/brand/avatar';
import { useT } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, FormMessage, Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export interface ChildFormValues {
  id?: string;
  displayName: string;
  avatarKey: AvatarKey;
  ageGroup: AgeGroup;
  learningLevelId: string;
}

export function ChildForm({ initial }: { initial?: ChildFormValues }) {
  const action = initial?.id ? updateChildAction.bind(null, initial.id) : createChildAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { status: 'idle' });
  const t = useT();
  const [avatar, setAvatar] = useState<AvatarKey>(initial?.avatarKey ?? 'fox');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initial?.ageGroup ?? '5-7');
  const [levelId, setLevelId] = useState<string>(initial?.learningLevelId ?? levelForAgeGroup('5-7').id);
  const [levelTouched, setLevelTouched] = useState(Boolean(initial));
  const [name, setName] = useState(initial?.displayName ?? '');

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.message && <FormMessage>{state.message}</FormMessage>}

      <Field label={t('child.nickname')} htmlFor="displayName" error={state.errors?.displayName} hint={t('child.nicknameHint')}>
        <Input
          id="displayName"
          name="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoComplete="off"
          aria-invalid={state.errors?.displayName ? true : undefined}
          aria-describedby={state.errors?.displayName ? 'displayName-error' : undefined}
          required
          className="h-11 sm:max-w-sm"
        />
      </Field>

      <fieldset>
        <legend className="font-semibold">{t('child.avatar')}</legend>
        <input type="hidden" name="avatarKey" value={avatar} />
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('child.avatar')}>
          {AVATAR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={avatar === k}
              aria-label={avatarLabel(k, t)}
              title={avatarLabel(k, t)}
              onClick={() => setAvatar(k)}
              className={cn(
                'grid h-14 w-14 place-items-center rounded-xl border-2 transition-colors',
                avatar === k ? 'border-lagoon bg-lagoon-soft' : 'border-line bg-paper hover:border-ink-soft',
              )}
            >
              <Avatar avatarKey={k} className="h-10 w-10" />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold">{t('child.ageGroup')}</legend>
        <input type="hidden" name="ageGroup" value={ageGroup} />
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border-2 border-line bg-chalk p-1 sm:max-w-sm" role="radiogroup" aria-label={t('child.ageGroup')}>
          {AGE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={ageGroup === g}
              onClick={() => {
                setAgeGroup(g);
                if (!levelTouched) setLevelId(levelForAgeGroup(g).id);
              }}
              className={cn(
                'h-10 rounded-lg text-sm font-bold transition-colors',
                ageGroup === g ? 'bg-paper text-lagoon-dark shadow-[0_1px_0_0_var(--color-line)] ring-2 ring-lagoon' : 'text-ink-soft hover:text-ink',
              )}
            >
              {g.replace('-', '–')}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold">{t('child.level')}</legend>
        <p className="text-sm text-ink-soft">{t('child.levelLead')}</p>
        <input type="hidden" name="learningLevelId" value={levelId} />
        <div className="mt-2 space-y-2" role="radiogroup" aria-label={t('child.level')}>
          {LEARNING_LEVELS.map((l) => {
            const selected = levelId === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setLevelId(l.id);
                  setLevelTouched(true);
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                  selected ? 'border-lagoon bg-lagoon-soft' : 'border-line bg-paper hover:border-ink-soft',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                    selected ? 'border-lagoon' : 'border-line',
                  )}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-lagoon" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold leading-snug">
                    {t(`level.${l.key}`)}{' '}
                    <span className="text-sm font-semibold text-ink-soft">· {t('child.levelAges', { min: l.minimumAge, max: l.maximumAge })}</span>
                  </span>
                  <span className="block text-sm leading-snug text-ink-soft">{t(`level.topics.${l.key}`)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {state.errors?.learningLevelId && <p className="mt-1 text-sm text-ember-dark">{state.errors.learningLevelId}</p>}
      </fieldset>

      <div className="border-t-2 border-line pt-5">
        <Button type="submit" loading={pending} className="w-full sm:w-auto">
          {t(initial?.id ? 'child.save' : 'child.add')}
        </Button>
      </div>
    </form>
  );
}

export function DeleteChildButton({ childId, name }: { childId: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const t = useT();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{t('child.delete')}</Button>
      </DialogTrigger>
      <DialogContent title={t('child.confirmTitle', { name })} description={t('child.confirmBody', { name })}>
        {error && <FormMessage>{error}</FormMessage>}
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">{t('child.keep')}</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteChildAction(childId);
                if (r?.message) setError(r.message);
              })
            }
          >
            {t('child.deleteForever')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
