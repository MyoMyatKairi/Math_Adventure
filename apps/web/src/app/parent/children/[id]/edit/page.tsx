import type { AgeGroup, AvatarKey } from '@math-adventure/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChildForm, DeleteChildButton } from '@/components/parent/child-form';
import { requireParentArea } from '@/lib/parent-area';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit learner' };

export default async function EditChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireParentArea(`/parent/children/${id}/edit`);
  const supabase = await createClient();
  const { data: child } = await supabase
    .from('child_profiles')
    .select('id, display_name, avatar_key, age_group, learning_level_id')
    .eq('id', id)
    .maybeSingle();
  if (!child) notFound();

  return (
    <div className="max-w-2xl">
      <Link href={`/parent/children/${id}`} className="text-sm font-semibold text-lagoon-dark underline underline-offset-4">
        Back to {child.display_name}&apos;s progress
      </Link>
      <h1 className="mt-3 font-display text-3xl font-extrabold">Edit {child.display_name}</h1>
      <p className="mt-1 text-ink-soft">Changing the level switches the adventure map. Earned stars and badges are kept.</p>
      <div className="mt-8 rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)]">
        <ChildForm
          initial={{
            id: child.id,
            displayName: child.display_name,
            avatarKey: child.avatar_key as AvatarKey,
            ageGroup: child.age_group as AgeGroup,
            learningLevelId: child.learning_level_id,
          }}
        />
      </div>
      <section className="mt-8 rounded-3xl border-2 border-ember/30 bg-ember-soft/50 p-6">
        <h2 className="font-display text-xl font-bold">Delete this profile</h2>
        <p className="mt-1 text-ink-soft">Removes all of {child.display_name}&apos;s learning history from Math Adventure.</p>
        <div className="mt-4">
          <DeleteChildButton childId={child.id} name={child.display_name} />
        </div>
      </section>
    </div>
  );
}
