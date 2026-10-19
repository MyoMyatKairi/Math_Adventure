import Link from 'next/link';
import { Logo } from '@/components/brand/icons';
import { Trail } from '@/components/brand/trail';
import { Visual } from '@/components/visuals/visual';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';

const LEVELS = [
  {
    name: 'Level 1',
    ages: 'Ages 5–7',
    topics: ['Counting to 20', 'Comparing numbers', 'Adding and subtracting', 'Shapes and patterns', 'Measuring length'],
    color: 'bg-lagoon-soft',
  },
  {
    name: 'Level 2',
    ages: 'Ages 8–10',
    topics: ['Place value', 'Times tables', 'Division', 'Fractions', 'Time, money and shapes'],
    color: 'bg-sun-soft',
  },
  {
    name: 'Level 3',
    ages: 'Ages 11–12',
    topics: ['Fractions and decimals', 'Percentages and ratios', 'Negative numbers', 'Area and perimeter', 'Algebra'],
    color: 'bg-plum-soft',
  },
];

async function signedIn() {
  try {
    return Boolean(await getUser());
  } catch {
    return false;
  }
}

export default async function LandingPage() {
  const isSignedIn = await signedIn();
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Math Adventure home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          {isSignedIn ? (
            <Button asChild>
              <Link href="/learn">Open my family</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/sign-up">Create account</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-14">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">A maths adventure for ages 5 to 12</h1>
            <p className="mt-5 max-w-[34ch] text-lg text-ink-soft sm:text-xl">
              Short lessons with pictures and number lines. Two tries at every question, with a hint in between. Stars to collect along the way.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">Create a free parent account</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-ink-soft">Free during early access. No ads. Children don&apos;t need an email address.</p>
          </div>
          <div className="rounded-[2.5rem] bg-paper px-2 py-6 shadow-[0_6px_0_0_var(--color-line)] sm:px-6">
            <Trail />
          </div>
        </section>

        <section aria-labelledby="levels" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="levels" className="font-display text-3xl font-extrabold">Three levels, one map</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Pick a starting level for each child. Ages are a guide, so you can move a child up or down whenever you like.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {LEVELS.map((l) => (
              <article key={l.name} className={`rounded-3xl p-6 ${l.color}`}>
                <h3 className="font-display text-2xl font-extrabold">{l.name}</h3>
                <p className="font-semibold text-ink-soft">{l.ages}</p>
                <ul className="mt-4 space-y-1.5">
                  {l.topics.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="how" className="font-display text-3xl font-extrabold">How a lesson goes</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              ['See it', 'A short idea with a picture, like a number line or a set of blocks.'],
              ['Watch an example', 'One problem solved step by step.'],
              ['Try five questions', 'Wrong first time? You get a hint and another go. Then the method is shown.'],
              ['Collect stars', 'Up to three stars per lesson. Finishing lessons opens new worlds.'],
            ].map(([title, text], i) => (
              <li key={title} className="relative">
                <span className="font-display text-5xl font-extrabold text-lagoon tabular">{i + 1}</span>
                <h3 className="mt-1 font-display text-xl font-bold">{title}</h3>
                <p className="mt-1 text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 grid items-center gap-6 rounded-3xl bg-paper p-6 shadow-[0_4px_0_0_var(--color-line)] md:grid-cols-2">
            <Visual visual={{ kind: 'number_line', min: 4, max: 12, step: 1, highlight: [6], jumps: [{ from: 6, to: 9 }] }} />
            <div>
              <p className="font-display text-2xl font-extrabold">What is 6 + 3?</p>
              <p className="mt-2 text-ink-soft">
                Start at 6 and jump 3 to the right. You land on 9. Every explanation shows the method, not just the answer.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="parents" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 rounded-[2.5rem] bg-ink p-8 text-white sm:p-12 md:grid-cols-2">
            <div>
              <h2 id="parents" className="font-display text-3xl font-extrabold">Built for parents to trust</h2>
              <p className="mt-3 text-white/80">
                You hold the account. Children learn inside your profile, with a nickname and an avatar, never their own login.
              </p>
              <Button asChild size="lg" variant="sun" className="mt-6">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </div>
            <ul className="space-y-4 text-white/90">
              <li>
                <strong className="block text-white">See what they practised</strong>
                Accuracy by topic, recent lessons and a weekly summary.
              </li>
              <li>
                <strong className="block text-white">No ads, chat or leaderboards</strong>
                Nothing to buy, nobody to message, no ranking against other children.
              </li>
              <li>
                <strong className="block text-white">Minimal data</strong>
                We ask for a nickname and an age group. No birth dates, photos or locations.
              </li>
              <li>
                <strong className="block text-white">Breaks are fine</strong>
                Daily challenges add a bonus but never take anything away for a missed day.
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-ink-soft sm:px-6">
        <p>Math Adventure is in early access. Content is reviewed for accuracy; tell us if you spot a mistake.</p>
      </footer>
    </>
  );
}
