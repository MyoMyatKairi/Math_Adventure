import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Trail } from '@/components/brand/trail';
import { LanguageSwitcher } from '@/components/i18n';
import { Visual } from '@/components/visuals/visual';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';
import { getT } from '@/lib/i18n';

const LEVELS = [
  { key: 'level_1', topics: 'landing.l1.topics', ages: '5–7', color: 'bg-lagoon-soft' },
  { key: 'level_2', topics: 'landing.l2.topics', ages: '8–10', color: 'bg-sun-soft' },
  { key: 'level_3', topics: 'landing.l3.topics', ages: '11–12', color: 'bg-plum-soft' },
] as const;

async function signedIn() {
  try {
    return Boolean(await getUser());
  } catch {
    return false;
  }
}

export default async function LandingPage() {
  const isSignedIn = await signedIn();
  const t = await getT();
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label={t('app.homeLink')}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          <LanguageSwitcher />
          {isSignedIn ? (
            <Button asChild>
              <Link href="/learn">{t('landing.openFamily')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/sign-in">{t('landing.signIn')}</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/sign-up">{t('landing.createAccount')}</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-14">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">{t('landing.title')}</h1>
            <p className="mt-5 max-w-[34ch] text-lg text-ink-soft sm:text-xl">
              {t('landing.lead')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">{t('landing.createFree')}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/sign-in">{t('landing.signIn')}</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-ink-soft">{t('landing.freeNote')}</p>
          </div>
          <div className="rounded-[2.5rem] bg-paper px-2 py-6 shadow-[0_6px_0_0_var(--color-line)] sm:px-6">
            <Trail />
          </div>
        </section>

        <section aria-labelledby="levels" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="levels" className="font-display text-3xl font-extrabold">{t('landing.levelsTitle')}</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            {t('landing.levelsLead')}
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {LEVELS.map((l) => (
              <article key={l.key} className={`rounded-3xl p-6 ${l.color}`}>
                <h3 className="font-display text-2xl font-extrabold">{t(`level.${l.key}`)}</h3>
                <p className="font-semibold text-ink-soft">{t('common.ages', { range: l.ages })}</p>
                <ul className="mt-4 space-y-1.5">
                  {t(l.topics).split('|').map((topic) => (
                    <li key={topic} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                      {topic}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="how" className="font-display text-3xl font-extrabold">{t('landing.howTitle')}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {([1, 2, 3, 4] as const).map((n) => [t(`landing.step${n}.title`), t(`landing.step${n}.text`)]).map(([title, text], i) => (
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
              <p className="font-display text-2xl font-extrabold">{t('landing.demoQuestion')}</p>
              <p className="mt-2 text-ink-soft">{t('landing.demoText')}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="parents" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 rounded-[2.5rem] bg-ink p-8 text-white sm:p-12 md:grid-cols-2">
            <div>
              <h2 id="parents" className="font-display text-3xl font-extrabold">{t('landing.parentsTitle')}</h2>
              <p className="mt-3 text-white/80">{t('landing.parentsLead')}</p>
              <Button asChild size="lg" variant="sun" className="mt-6">
                <Link href="/sign-up">{t('landing.getStarted')}</Link>
              </Button>
            </div>
            <ul className="space-y-4 text-white/90">
              {([1, 2, 3, 4] as const).map((n) => (
                <li key={n}>
                  <strong className="block text-white">{t(`landing.trust${n}.title`)}</strong>
                  {t(`landing.trust${n}.text`)}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-ink-soft sm:px-6">
        <p>{t('landing.footer')}</p>
      </footer>
    </>
  );
}
