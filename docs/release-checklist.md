# Release readiness checklist

## Verified in development (2026-10-20)

- [x] `pnpm typecheck`: shared, web, mobile
- [x] `pnpm lint`: ESLint (web) and no-eval scan (all packages)
- [x] Unit tests: shared 132, web 8, mobile 15 (all passing)
- [x] Integration tests against local Supabase: 33 passing (RLS isolation, answer-key privacy over SQL and REST, idempotent and concurrent rewards, world locks, daily challenge, reports, TS/SQL parity)
- [x] Playwright: full parent → child → lesson → rewards → parent report → reload journey; signed-out redirects; phone-width landing page
- [x] `supabase db lint`: no errors or warnings
- [x] Web production build (`next build`)
- [x] Mobile Metro/Hermes iOS bundle (`expo export --platform ios`)
- [x] Secret scan clean

## Not verified here

- [ ] Mobile app on a physical device or simulator (no simulator in the build environment). Navigation, controls and states are covered by RNTL tests only.
- [ ] Password-reset email round trip (flow implemented; Mailpit not exercised by automated tests).
- [ ] Production Supabase configuration, Vercel deployment, EAS builds.
- [ ] Screen-reader pass with VoiceOver/TalkBack and a full WCAG audit.

## Before launch

- [ ] Legal review and parental-consent decision (see `docs/security.md`)
- [ ] Privacy policy, terms, full parent account deletion and data export
- [ ] Production auth settings: email confirmation, SMTP, CAPTCHA, redirect URLs, rate limits
- [ ] `PARENT_GATE_SECRET` set in Vercel; no service-role key anywhere in client env
- [ ] Migrations pushed, seed loaded, RLS spot-checked on the production project
- [ ] Content review of all 225 questions by a teacher (automated validation checks consistency, not pedagogy)
- [ ] Error monitoring that doesn't capture child data
- [ ] App-store children's category requirements reviewed
