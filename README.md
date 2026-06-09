# Parité

Parité is a mobile-first Vite React app for private trip membership and shared expense splitting. Phase 4.5 uses Supabase Auth email/password accounts, Supabase trips/members, invite codes, admin approval, shared Supabase expenses, manual trip exchange-rate defaults, and per-member display currency preferences.

Settlements are still local-only for now. Expenses, expense splits, and exchange-rate defaults are saved in Supabase.

## Prerequisites

- macOS Terminal
- Node.js and npm
- A Supabase project

Check your local versions:

```bash
node --version
npm --version
```

## Supabase Setup

You will use two different places:

- **Mac Terminal**: run commands from this project folder.
- **Supabase SQL Editor**: paste and run SQL inside the Supabase website.

Do not paste a filename like `supabase/migrations/202606090001_phase1_contract_repair.sql` into Supabase. Supabase needs the actual SQL text inside that file.

1. In Mac Terminal, go to this project folder:

```bash
cd /Users/nurtore.arynuruly/Projects/SaiHat
```

2. Copy the full migration SQL into your Mac clipboard.

This command copies the **contents inside** the SQL file:

```bash
pbcopy < supabase/migrations/202606090001_phase1_contract_repair.sql
```

Do not paste this command into Supabase. Run it in Mac Terminal.

Nothing obvious will print after this command. That is normal. It silently copies the SQL file contents. The copied text starts with:

```sql
create extension if not exists pgcrypto;
```

3. Open Supabase in your browser.
4. Open your project.
5. In the left sidebar, open **SQL Editor**.
6. Click **New query**.
7. Click inside the big SQL text box.
8. Press `Command + V` to paste the SQL text that the `pbcopy` command copied.
9. The pasted text should start with:

```sql
create extension if not exists pgcrypto;
```

10. Click **Run**.

This full migration is intended for a fresh project or a full repair pass. If your existing Supabase project is already working and you only need Phase 4.5 display currency, use the incremental patch below instead.

After running the migration, reload the Supabase API schema cache with a new SQL query:

```sql
notify pgrst, 'reload schema';
```

11. Confirm the required RPC functions exist by opening another **New query**, pasting this SQL, and clicking **Run**:

```sql
select
  proname,
  pg_get_function_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
and proname in (
  'create_trip_with_admin',
  'request_join_by_invite',
  'load_auth_workspace',
  'claim_legacy_member',
  'load_member_session',
  'approve_member',
  'reject_member',
  'remove_member',
  'update_exchange_rate',
  'update_member_display_currency',
  'create_expense_with_splits',
  'update_expense_with_splits',
  'delete_expense'
)
order by proname;
```

12. Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Use the anon key only. Never put the service role key in the browser app.

13. In Supabase, open **Authentication -> Providers -> Email**.

For easiest local testing, turn off email confirmations. If confirmations stay on, signup may show a check-email message before the account can log in.

## Phase 4.5 Incremental SQL Patch

If your current Supabase database already has trips, members, expenses, splits, and exchange rates working, run only this patch for Phase 4.5.

In Mac Terminal:

```bash
cd /Users/nurtore.arynuruly/Projects/SaiHat
pbcopy < supabase/migrations/202606090002_phase45_display_currency.sql
```

Then paste into Supabase **SQL Editor -> New query** with `Command + V` and click **Run**. This patch adds `members.display_currency`, creates `update_member_display_currency(member_id_input, display_currency_input)`, grants it to authenticated users, and reloads the API schema cache.

## Run Locally On Mac

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Local Verification

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
rg -n "supabase\\.from\\(" src supabase
```

Check localStorage usage:

```bash
rg -n "localStorage" src
```

The active app stores only a non-secret active member preference with `tripbalance_active_member_id`. The old `tripbalance_member_access_token` key may be read once to claim a legacy member, then removed.

## If Create Trip Fails

First reload the Supabase API schema cache. In Supabase SQL Editor, run:

```sql
notify pgrst, 'reload schema';
```

Wait about 10 seconds, refresh the app, and try creating the trip again.

If it still fails, make sure you are logged in inside the app. Auth-based RPCs use `auth.uid()`, so calling them directly from SQL Editor is not the same as calling them from the logged-in app.

If the app fails after login, copy the visible app error message and check `.env.local`, then restart `npm run dev`.

## If Joining Says The Name Is Already Used

Display names must be unique inside a trip while the old member is pending, approved, or rejected. This prevents accidental duplicate member rows.

If a person logs in with the same Supabase account, the app restores the same member row across browsers and devices. A different account cannot take the same display name while the old member is pending, approved, or rejected.

Use a different display name, or ask the admin to remove the previous member entry and try again.

## Phase 4 Manual Test Checklist

- Sign up or log in as `admin@example.com`.
- Create a new trip as admin with base currency `CNY`.
- Refresh the browser and confirm the admin account and trip session restore.
- Confirm the invite code persists after refresh.
- Open another browser profile or private window.
- Sign up or log in as `user2@example.com`.
- Join the trip using the invite code as `User 2`.
- Confirm the second user lands on the pending approval screen without seeing trip details.
- Return as admin and approve, reject, or remove the pending member.
- Confirm an approved member can refresh and keep access.
- Log out and log back in as `user2@example.com`, then confirm the same member row loads.
- In a third browser/private window, log in as `user2@example.com` and confirm it restores the same membership without creating a duplicate.
- In a different account, try joining with display name `User 2` and confirm the app shows a friendly duplicate-name message.
- Confirm rejected or removed users cannot access trip details.
- Confirm the mobile-first layout is unchanged.
- Add `100 CNY`; confirm the exchange-rate field is hidden or disabled as `1` and converted amount is `100 CNY`.
- As admin, add `100 AED` with manual rate `1.95`; confirm converted amount is `195 CNY`.
- Add another AED expense and confirm `1.95` is prefilled.
- As admin, add `1000 KZT` with manual rate `0.014`; confirm converted amount is `14 CNY`.
- Add another KZT expense and confirm `0.014` is prefilled.
- Open the drawer, use **Exchange rates**, edit a default rate, and confirm the next expense uses the edited default.
- Confirm non-admin members can enter manual rates on expenses but cannot edit trip default rates.
- As the approved second user, add `Dinner`, `300 CNY`, paid by `User 2`, split equally with the admin.
- Refresh the admin browser and confirm `Dinner` appears.
- Confirm balances show the admin owes `User 2` `150 CNY`.
- Edit and delete an expense as the creator or admin, then refresh another browser and confirm the change appears.
- Confirm pending, rejected, and removed users cannot access the expense UI or exchange-rate settings.

## Phase 4.5 Manual Test Checklist

- Run the incremental Phase 4.5 SQL patch above, or rerun the full repair migration on a fresh project.
- Confirm old member rows still work with `display_currency` as `null`.
- Create trips with base currencies `AED`, `CNY`, and `KZT`; confirm the selected base currency is saved.
- In a `CNY` trip, set default rates `AED -> CNY = 1.8` and `KZT -> CNY = 0.013`.
- Open the drawer and set your display currency to `AED`.
- Confirm `180 CNY` displays as approximately `100 AED` with `180 CNY base`.
- Change your display currency to `KZT`.
- Confirm `13 CNY` displays as approximately `1000 KZT`.
- Change display currency back to **Same as trip base currency** and confirm amounts show in `CNY`.
- Refresh or log out/in and confirm your display currency preference persists.
- With two accounts in the same trip, set User A to `AED` and User B to `CNY`; confirm each user sees amounts in their own display currency.
- Remove the needed display-rate row or use a missing pair and confirm the app shows base currency plus “Display rate unavailable. Showing CNY.”
- Add an expense and confirm changing display currency does not change stored expense converted amounts or splits.
- Confirm the page background, primary actions, and destructive actions use the requested palette.

## Phase 4 Notes

- Supabase Auth `auth.users.id` is the stable account identity.
- `members.user_id` links a trip member row to an account.
- `members.display_name` is only a trip nickname.
- Old access tokens are kept only for legacy claiming and are no longer primary identity.
- Trips, members, expenses, expense splits, exchange-rate defaults, and member display-currency preferences are persisted in Supabase.
- Direct table reads/writes are not used by the frontend.
- Exchange rates are manual only. No automatic exchange-rate API is used.
- Admin-entered non-base expense rates update the trip default; non-admin expense rates apply only to that expense.
- `members.display_currency` is a per-trip membership preference. It does not change trip base currency or stored accounting values.
- Settlements are local-only and are not saved to Supabase yet.
- Payment flows and receipt scanning are not implemented yet.
