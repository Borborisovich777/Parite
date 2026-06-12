# Parité

Parité is a mobile-first trip expense splitting app built with React, Vite, TypeScript, and Supabase. It supports private trips, invite-code joins with admin approval, manual exchange rates, personal display currency, service-fee-aware expenses, smart splits, persisted settlements, safe trip lifecycle controls, and CSV export.

## Current Features

- Supabase Auth email/password accounts.
- Multi-trip workspace switching with `parite_active_member_id` restore.
- Invite-code join flow with admin approval/rejection.
- Member roles with admin promotion and demotion.
- Safe leave, member removal, and close/archive trip flow.
- Closed and closing trips are protected by server-side read-only guards.
- Expenses in AED, CNY, and KZT with trip base-currency accounting.
- Manual trip exchange rates used automatically for expense conversion.
- Optional percentage service fee with fee-aware equal/custom splits.
- Soft-delete expenses and settlement timestamp guard for protected edits/deletes.
- Persisted settlements with receiver/admin confirmation, voiding, and paid/voided history.
- Open balances reconcile paid settlements and ignore voided settlements.
- Per-member display currency preference for read-only display conversion.
- Expenses, balances, and settlements CSV export.
- Full-width app-level error banner for blocking action errors.

## Prerequisites

- Node.js and npm.
- A Supabase project.
- A Cloudflare account with access to Cloudflare Pages.
- GitHub repository access.

Check local versions:

```bash
node --version
npm --version
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Use the Supabase anon key only. Do not put `SUPABASE_SERVICE_ROLE_KEY`, database passwords, Splitwise client secrets, OpenAI keys, Cloudflare API tokens, or any service credentials in frontend environment variables. Do not commit `.env.local`.

Start the dev server:

```bash
npm run dev
```

Open the URL printed by Vite, usually:

```txt
http://localhost:3000
```

## Supabase Setup

Use the Supabase SQL Editor to run migration SQL. Paste the SQL file contents, not the filename.

### Fresh Project Setup

For a new Supabase project, run the current repair/fresh migration:

```bash
pbcopy < supabase/migrations/202606090001_phase1_contract_repair.sql
```

Paste into **Supabase -> SQL Editor -> New query** and run it. Then reload the PostgREST schema cache:

```sql
notify pgrst, 'reload schema';
```

`supabase/migrations/202606080001_initial_tripbalance.sql` is a legacy early baseline kept for history. Use `202606090001_phase1_contract_repair.sql` for a current fresh setup.

### Existing Project Incremental Setup

If your Supabase project already has the earlier Parité schema, run these incremental patches in order:

1. `supabase/migrations/202606090002_phase45_display_currency.sql`
2. `supabase/migrations/202606100001_phase47b_persisted_settlements.sql`
3. `supabase/migrations/202606100002_phase47b2_settlement_expense_guard.sql`
4. `supabase/migrations/202606100003_phase47c_safe_leave_close.sql`
5. `supabase/migrations/202606100004_phase48b_service_fee.sql`
6. `supabase/migrations/202606110001_phase49_admin_settings.sql`
7. `supabase/migrations/202606110002_phase49a_admin_demotion.sql`

Each patch is intended to be pasted into the Supabase SQL Editor and run once. Most DDL is idempotent where practical. After the final patch, run:

```sql
notify pgrst, 'reload schema';
```

### Required RPC Surface

The current app expects these public RPCs to exist:

- `create_trip_with_admin`
- `request_join_by_invite`
- `load_auth_workspace`
- `list_my_workspaces`
- `claim_legacy_member`
- `load_member_session`
- `approve_member`
- `reject_member`
- `remove_member`
- `promote_member_to_admin`
- `demote_admin`
- `leave_trip`
- `start_trip_closure`
- `approve_trip_closure`
- `cancel_trip_closure`
- `regenerate_trip_invite_code`
- `update_trip_name`
- `update_exchange_rate`
- `update_member_display_currency`
- `create_expense_with_splits`
- `update_expense_with_splits`
- `delete_expense`
- `mark_settlement_paid`
- `void_settlement`

You can inspect installed functions with:

```sql
select
  proname,
  pg_get_function_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
order by proname;
```

## Supabase Auth

Open **Authentication -> Providers -> Email** in Supabase.

For local testing, disabling email confirmations can make sign-up faster. For production, choose the email confirmation policy you want and test the sign-up flow with that setting enabled.

## Safe Deployment Model

Use this flow for Parité:

```txt
GitHub repository -> pull request -> Cloudflare preview deployment -> manual review -> merge to main -> production deployment
```

Rules:

- Do not deploy directly to production.
- Do not push generated changes directly to `main`.
- Create changes on a branch.
- Open a pull request.
- Review the GitHub diff and Cloudflare preview URL.
- Merge to `main` only after the build passes and the preview looks correct.
- Keep production secrets out of source code.
- Keep Parité free-tier friendly for the 20-user beta.

## Cloudflare Pages Deployment

Create a Cloudflare Pages project connected to the GitHub repository.

Use these build settings:

```txt
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Production branch: main
```

Add only frontend-safe environment variables in the Cloudflare Pages dashboard:

```txt
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Do not add these values to browser-side Vite variables, committed files, screenshots, logs, or public issue comments:

```txt
SUPABASE_SERVICE_ROLE_KEY
SPLITWISE_CLIENT_SECRET
OPENAI_API_KEY
CLOUDFLARE_API_TOKEN
DATABASE_URL
JWT_SECRET
```

### Preview Deployments

Cloudflare Pages should create preview deployments for pull requests. Use those preview URLs to test changes before merging.

Expected safe workflow:

1. Create a branch.
2. Commit changes.
3. Open a pull request.
4. Wait for GitHub Actions and Cloudflare preview checks.
5. Test the preview URL.
6. Merge to `main` manually.
7. Let Cloudflare deploy production from `main`.

### Branch Protection Recommendation

Configure GitHub branch protection for `main` in repository settings:

- Require a pull request before merging.
- Require status checks to pass.
- Require the `Build / Typecheck and build` workflow.
- Block force pushes.
- Restrict direct pushes to `main` if possible.
- Require conversations to be resolved before merge.

This repository includes a GitHub Actions workflow that runs:

```bash
npm run lint
npm run build
```

The workflow is intended to make `npm run build` verification visible on pull requests before production deployment.

### Public Beta Pages

The deployment includes static public pages for beta readiness:

```txt
/privacy/
/terms/
/beta-access/
```

These pages are intentionally static, so they remain available without requiring Supabase login.

## Environment Variable Rules

Committed files may contain placeholders only. Use `.env.example` for names and example formats.

Allowed browser-side Vite variables:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never commit real `.env`, `.env.local`, production secrets, service role keys, OAuth secrets, private API keys, database passwords, or Cloudflare tokens.

## Verification Commands

Run TypeScript checks:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

Search for accidental direct table calls:

```bash
rg -n "supabase\.from\(" src supabase
```

Search for old user-facing app names:

```bash
rg -n "SaiHat|Saihat|saihat|TripBalance|Trip Balance|Tripbalance|tripbalance|trip_balance" .
```

The only expected old-name hits are legacy localStorage key strings used for compatibility.

## Local Storage And Session Notes

The active app stores only a non-secret active member preference with:

```txt
parite_active_member_id
```

For compatibility, a legacy `tripbalance_active_member_id` value is copied once into `parite_active_member_id` when the new key is missing. The old `tripbalance_member_access_token` key may be read once to claim a legacy member, then removed. Supabase Auth session storage is not cleared by this migration behavior.

## Security Notes

- The frontend uses only the Supabase anon key.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in Vite, Cloudflare Pages, browser code, logs, screenshots, or GitHub comments.
- Never expose `SPLITWISE_CLIENT_SECRET`, `OPENAI_API_KEY`, or `CLOUDFLARE_API_TOKEN` in frontend code.
- Do not commit `.env`, `.env.local`, or any file containing real secrets.
- Do not place database passwords in frontend environment variables.
- The frontend uses RPC-driven access and does not call `supabase.from(...)` directly.
- Server-side RPC validation is the source of truth for permissions and trip lifecycle guards.
- Do not add paid plans, payment logic, or billing integrations for the free beta.

## Free-Tier Discipline For 20 Users

- Avoid background polling loops.
- Avoid unnecessary refreshes after every view change.
- Keep landing and public assets small.
- Cache derived data in component state when practical.
- Avoid storing more user data than the app needs.
- Keep the beta invite-only until the deployment is stable.

## Post-Deployment Test Checklist

### Auth and Workspaces

- Sign up and log in.
- Create a trip.
- Join by invite from another account.
- Admin approves or rejects the pending member.
- Switch trips from the side menu.
- Reload and confirm the active trip restores.
- Log out and confirm the active workspace is cleared.

### Members and Roles

- Promote an approved member to admin.
- Demote another admin back to member.
- Confirm last-admin protections still block unsafe leave/remove/demotion.
- Remove a member only when their open balance is zero.

### Expenses

- Add a no-fee expense.
- Add a service-fee expense.
- Add a non-base-currency expense with an exchange rate.
- Use equal split.
- Use smart custom split.
- Use fee-aware custom split.
- Edit title, amount, currency/rate, payer, date, notes, participants, and split method.
- Delete an expense and confirm it disappears from normal lists, totals, search, and balances.
- Confirm protected edit/delete after a later paid settlement shows a friendly error.

### Balances and Settlements

- Confirm open balances match expected expense splits.
- Confirm a settlement as receiver or admin.
- Refresh and confirm the paid settlement persists.
- Void a settlement as receiver or admin.
- Confirm voided settlements remain in history but do not affect open balances.

### Lifecycle

- Confirm leaving is blocked with an open balance.
- Confirm member removal is blocked with an open balance.
- Confirm trip closure is blocked until everyone is settled.
- Start a close request.
- Approve closure from all currently approved members.
- Confirm closed trips remain visible and read-only.
- Confirm there is no delete-trip action.

### Display, Exchange, and Export

- Set personal display currency and confirm base accounting values remain unchanged.
- Confirm missing display conversion falls back safely.
- Update exchange rates as admin while the trip is active.
- Export expenses CSV.
- Export balances CSV.
- Export settlements CSV.
- Confirm CSV values escape commas, quotes, and newlines.

### Public Pages

- Open `/privacy/`.
- Open `/terms/`.
- Open `/beta-access/`.
- Confirm each page loads without requiring Supabase login.

### UI Reliability

- Confirm the app-level error banner is readable and dismissible.
- Confirm no raw SQL/PostgREST/RPC details appear in user-facing errors.
- Confirm mobile sticky header, bottom nav, modals, and sheets remain usable.
- Confirm ErrorBoundary fallback shows a friendly reload option if a render crash occurs.

## Troubleshooting

If an RPC is missing or a new function signature is not visible to the frontend, reload the Supabase schema cache:

```sql
notify pgrst, 'reload schema';
```

Wait a few seconds, refresh the app, and retry the action.

If create/join/load fails after deployment, check:

- Cloudflare Pages environment variables are set and redeployed.
- `.env.local` is present for local development.
- Supabase Auth settings allow your test flow.
- Supabase Auth site URL and redirect URLs match the Cloudflare Pages URL.
- The current migration path has been applied.
- The browser is logged in when calling auth-required RPCs.
