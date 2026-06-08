# SaiHat / TripBalance

A mobile-first web app for managing private trip members and preparing shared expense splitting across AED, CNY, and KZT.

This branch implements Phase 1 of the Supabase migration: persistent trips, invite codes, and members. Expense persistence is intentionally left for a later phase.

## Prerequisites

- macOS Terminal
- Node.js and npm
- A Supabase project

Check your installed versions:

```bash
node --version
npm --version
```

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor and run:

```txt
supabase/migrations/202606080001_initial_tripbalance.sql
```

3. Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://ijewbxyzttscwwscqtqp.supabase.co
VITE_SUPABASE_ANON_KEY=
```

Use the anon key only. Do not put the service role key in the browser app.

## Run Locally

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

## Verify

Run TypeScript checks:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

## Phase 1 Manual Test Checklist

- Create a new trip as admin with base currency AED, CNY, or KZT.
- Refresh the browser and confirm the trip still opens.
- Confirm the admin member persists after refresh.
- Confirm the invite code persists after refresh.
- Open another browser profile or private window.
- Join the trip using the invite code and a different display name.
- Confirm the second user lands on the pending approval screen.
- Return as admin and approve, reject, or remove the pending member.
- Confirm the mobile-first layout is unchanged.

## Phase 1 Notes

- The current browser stores only `tripbalance_member_access_token` in localStorage.
- Trips and members are persisted in Supabase.
- Expenses, splits, settlements, and payment flows are not implemented in Supabase yet.
- The Add Expense UI remains available for later phases, but saving expenses is intentionally disabled in Phase 1.
