# Parité

Parité is a mobile-first trip expense splitting app built with React, Vite, TypeScript, and Supabase. It supports private trips, invite-code joins with admin approval, manual exchange rates, personal display currency, service-fee-aware expenses, smart splits, persisted settlements, safe trip lifecycle controls, and CSV export.

## Current Features

- Supabase Auth email/password accounts.
- New-account registration with platform-admin approval before app access.
- Multi-trip workspace switching with `parite_active_member_id` restore.
- Invite-code join flow with admin approval/rejection.
- Member roles with admin promotion and demotion.
- Safe leave, member removal, and close/archive trip flow.
- Closed and closing trips are protected by server-side read-only guards.
- Expenses in AED, CNY, KZT, and USD with trip base-currency accounting.
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
- A deployment target such as Vercel.

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

Use the Supabase anon key only. Do not put `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or any service credentials in frontend environment variables. Do not commit `.env.local`.

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

Then apply the incremental patches listed below in order so the fresh project has the current feature and guard updates.

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
8. `supabase/migrations/202606110003_phase53_usd_currency.sql`
9. `supabase/migrations/202607170001_account_approval.sql`
10. `supabase/migrations/202607170002_voided_settlement_expense_guard.sql`

Each patch is intended to be pasted into the Supabase SQL Editor and run once. Most DDL is idempotent where practical. After the final patch, run:

```sql
notify pgrst, 'reload schema';
```

### Required RPC Surface

The current app expects these public RPCs to exist:

- `create_trip_with_admin`
- `get_my_account_access`
- `list_pending_account_access`
- `approve_account`
- `reject_account`
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

Turn on **Allow new users to sign up**. Application access is still private: the
account approval migration makes every new account pending until the platform
admin approves it in Parité. Existing accounts remain approved, and the earliest
existing account becomes the initial platform admin. On an empty project, the
first signup becomes the initial admin.

For local testing, disabling email confirmations can make sign-up faster. For production, choose the email confirmation policy you want and test the sign-up flow with that setting enabled.

## Vercel Deployment

1. Connect the GitHub repository to Vercel.
2. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ACCOUNT_APPROVAL_MODE=required` after migrations `202607170001` and `202607170002` are applied and verified
3. Use build command:

```bash
npm run build
```

4. Use output directory:

```txt
dist
```

5. Deploy and open the production URL.
6. Verify Supabase Auth redirect/site URL settings match your deployed domain if your auth configuration requires it.

Do not add service role keys or database passwords to Vercel for this frontend app.

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
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in Vite, Vercel, browser code, logs, or screenshots.
- Do not commit `.env.local`.
- Do not place database passwords in frontend environment variables.
- The frontend uses RPC-driven access and does not call `supabase.from(...)` directly.
- Server-side RPC validation is the source of truth for permissions and trip lifecycle guards.

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

Account approval temporarily defaults to compatibility mode when the exact
`get_my_account_access` RPC is absent, so deploying the frontend before migration
`202607170001_account_approval.sql` does not lock out signed-in users. While the
migration is absent, every authenticated account follows the legacy access model;
the account-approval queue and platform-admin actions remain unavailable.
After that migration is installed and verified, set
`VITE_ACCOUNT_APPROVAL_MODE=required` in production and redeploy to fail closed if
the account-access RPC ever becomes unavailable.

If create/join/load fails after deployment, check:

- Vercel env vars are set and redeployed.
- `.env.local` is present for local development.
- Supabase Auth settings allow your test flow.
- The current migration path has been applied.
- The browser is logged in when calling auth-required RPCs.
