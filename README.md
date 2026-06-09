# Parité

Parité is a mobile-first Vite React app for private trip membership and shared expense splitting. Phase 1 uses Supabase only for trips, members, invite codes, admin approval, and browser access-token restore.

Expense persistence is intentionally disabled in Phase 1. The Add Expense UI remains in the app for later phases.

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
cd /Users/nurtore.arynuruly/Projects/Parité
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

This migration is idempotent and is safe to run after a partial or older Phase 1 setup. Do not patch one RPC at a time.

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
  'load_member_session',
  'approve_member',
  'reject_member',
  'remove_member'
)
order by proname;
```

12. Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Use the anon key only. Never put the service role key in the browser app.

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

Search for accidental direct table/auth/expense persistence calls:

```bash
rg -n "supabase\\.from\\(|signIn|auth\\.|create_expense|update_expense|delete_expense" src supabase
```

Check localStorage usage:

```bash
rg -n "localStorage" src
```

The active app should only store the current browser member token with `tripbalance_member_access_token`.

## Phase 1 Manual Test Checklist

- Create a new trip as admin with base currency AED, CNY, or KZT.
- Refresh the browser and confirm the admin session restores.
- Confirm the invite code persists after refresh.
- Open another browser profile or private window.
- Join the trip using the invite code and a different display name.
- Confirm the second user lands on the pending approval screen without seeing trip details.
- Return as admin and approve, reject, or remove the pending member.
- Confirm an approved member can refresh and keep access.
- Confirm rejected or removed users cannot access trip details.
- Confirm the mobile-first layout is unchanged.
- Confirm Add Expense is still visible but saving expenses shows the Phase 1 disabled message.

## Phase 1 Notes

- Supabase Auth is not used yet.
- The current browser is identified by the app-managed member access token.
- Trips and members are persisted in Supabase.
- Direct table reads/writes are not used by the frontend.
- Expenses, splits, settlements, payment flows, and receipt scanning are not implemented in Supabase yet.
