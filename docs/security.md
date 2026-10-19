# Security and privacy

## Model

- Parents authenticate with Supabase Auth (email + password). Passwords are handled by Supabase; the app never stores them.
- Children are profiles inside a parent account: nickname, avatar, age group, level. No email, birth date, photo, location or legal name.
- Clients hold only the anon/publishable key. The service-role key is never used by either app. `pnpm check:secrets` scans the repo for secret keys and committed `.env` files.

## Row level security

RLS is enabled on every table, and default Supabase grants are revoked, so access is explicit:

- Curriculum: anonymous and signed-in users can read published, non-archived worlds, topics, lessons, sections, levels and badges.
- `questions`: no policy for learners. Answer keys and explanations are never selectable by `anon` or parents (verified by tests over SQL and the REST API).
- `child_profiles`: parents manage only rows where `parent_id = auth.uid()`. `parent_id` isn't an insertable column; it defaults to the caller.
- Learning records: parents can read their own children's records; nobody but the trusted functions can write them.
- `profiles.role`: clients can update `display_name` only; a sign-up `role` in metadata is ignored.
- Admin writes to curriculum require `profiles.role = 'admin'`, checked in the database.

## Trusted functions

`start_lesson`, `submit_answer`, `complete_lesson`, `get_learner_overview`, `get_child_report`, `get_parent_overview` are `SECURITY DEFINER` with `search_path = ''`. Each verifies the caller owns the child (and the child isn't archived), and `start_lesson` also checks publication, level and world unlock. Clients send raw answer text only; correctness, points, score, stars, XP, badges and completion are computed in the database. Helper functions live in a `private` schema that isn't exposed by the API and isn't executable by clients.

Abuse limits:

- Two tries per question; answered questions can't be re-submitted.
- Input over 40 characters is rejected; invalid input doesn't use a try.
- 60 lesson attempts per child per hour.
- Rewards are idempotent per key and serialized per child with row locks; concurrent duplicate completions award once (tested).
- Supabase Auth rate limits sign-in, sign-up and password reset.

## Web specifics

- Session cookies are managed by `@supabase/ssr`; the proxy (`src/proxy.ts`) refreshes them and redirects signed-out users away from `/learn`, `/parent`, `/parent-gate` and `/reset-password`.
- Server code verifies the user with `auth.getUser()` (server-validated), not just the cookie.
- The parent area requires a recent password check: an HMAC-signed, httpOnly, 30-minute cookie keyed to the user (`PARENT_GATE_SECRET`). Entering learner mode clears it.
- Password reset responses are identical whether or not the email exists. Redirect targets are restricted to same-site paths.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, restrictive `Permissions-Policy`.
- Child ids appear only in signed-in parent URLs (`/parent/children/<uuid>`) and are useless without the owning session.

## Mobile specifics

- Supabase session in AsyncStorage (the Supabase-recommended store; SecureStore's 2 KB item limit is too small for sessions). Active child id in SecureStore.
- The parent unlock lives in memory only, so it resets when the app restarts.

## Child privacy

- No public profiles, chat, leaderboards, ads, analytics or third-party trackers. No third-party fonts or scripts are loaded at runtime.
- Parents can permanently delete a child profile, which cascades to all of that child's learning records.
- Children cannot reach account settings without the parent's password.

### Before public launch (not done; needs legal review)

This MVP has **not** been reviewed for legal compliance and makes no compliance claim. Before launch:

- Get a legal review for COPPA (US), UK Age Appropriate Design Code, GDPR/GDPR-K and any other target markets.
- Decide on verifiable parental consent appropriate to the data collected, and add a consent step to sign-up if required.
- Publish a privacy policy and terms; add data export and account deletion flows for parents (child deletion exists; full account deletion doesn't yet).
- Configure Supabase Auth for production: email confirmation on, custom SMTP, CAPTCHA, leaked-password protection, sensible rate limits.
- Choose data residency for the Supabase project, set retention for logs and backups, and sign a DPA with Supabase and Vercel.
- Confirm the hosting providers' logs don't capture request bodies containing children's nicknames.

## Known security limitations

- No audit log of admin content changes.
- The daily challenge uses UTC days.
- Rate limiting is per child (attempts) plus Supabase Auth defaults; there's no per-IP limit on RPCs beyond what the platform provides.
- `debug_check_answer` exists for parity tests and is executable by `service_role` only.
