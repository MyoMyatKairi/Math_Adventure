'use client';

import { AGE_GROUPS, AVATAR_KEYS, LEARNING_LEVELS, levelForAgeGroup, type AgeGroup, type AvatarKey } from '@math-adventure/shared';
import { useActionState, useState, useTransition } from 'react';
import { createChildAction, deleteChildAction, updateChildAction } from '@/app/actions/children';
import type { FormState } from '@/app/actions/auth';
import { Avatar, avatarLabel } from '@/components/brand/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, FormMessage, Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

const LEVEL_TOPICS: Record<string, string> = {
  level_1: 'Counting, adding and taking away, shapes, patterns, measuring',
  level_2: 'Place value, times tables, division, fractions, time and money',
  level_3: 'Decimals, percentages, ratios, negative numbers, area, algebra',
};

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
  const [avatar, setAvatar] = useState<AvatarKey>(initial?.avatarKey ?? 'fox');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initial?.ageGroup ?? '5-7');
  const [levelId, setLevelId] = useState<string>(initial?.learningLevelId ?? levelForAgeGroup('5-7').id);
  const [levelTouched, setLevelTouched] = useState(Boolean(initial));
  const [name, setName] = useState(initial?.displayName ?? '');

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.message && <FormMessage>{state.message}</FormMessage>}

      <Field label="Nickname" htmlFor="displayName" error={state.errors?.displayName} hint="A first name or nickname is plenty. It’s only shown inside your account.">
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
        <legend className="font-semibold">Avatar</legend>
        <input type="hidden" name="avatarKey" value={avatar} />
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
          {AVATAR_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={avatar === k}
              aria-label={avatarLabel(k)}
              title={avatarLabel(k)}
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
        <legend className="font-semibold">Age group</legend>
        <input type="hidden" name="ageGroup" value={ageGroup} />
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border-2 border-line bg-chalk p-1 sm:max-w-sm" role="radiogroup" aria-label="Age group">
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
        <legend className="font-semibold">Starting level</legend>
        <p className="text-sm text-ink-soft">We suggest one from the age group. Choose another if it suits your child better.</p>
        <input type="hidden" name="learningLevelId" value={levelId} />
        <div className="mt-2 space-y-2" role="radiogroup" aria-label="Starting level">
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
                    {l.name} <span className="text-sm font-semibold text-ink-soft">· ages {l.minimumAge}–{l.maximumAge}</span>
                  </span>
                  <span className="block text-sm leading-snug text-ink-soft">{LEVEL_TOPICS[l.key]}</span>
                </span>
              </button>
            );
          })}
        </div>
        {state.errors?.learningLevelId && <p className="mt-1 text-sm text-ember-dark">{state.errors.learningLevelId}</p>}
      </fieldset>

      <div className="border-t-2 border-line pt-5">
        <Button type="submit" loading={pending} className="w-full sm:w-auto">
          {initial?.id ? 'Save changes' : 'Add learner'}
        </Button>
      </div>
    </form>
  );
}

export function DeleteChildButton({ childId, name }: { childId: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Delete profile</Button>
      </DialogTrigger>
      <DialogContent
        title={`Delete ${name}'s profile?`}
        description={`This permanently removes ${name}'s stars, badges, lesson history and progress. This can’t be undone.`}
      >
        {error && <FormMessage>{error}</FormMessage>}
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Keep profile</Button>
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
            Delete permanently
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
