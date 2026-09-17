// Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-expense-metadata.mjs
// A disposable PostgreSQL database; never connects to Supabase or production.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user_id', true), '')::uuid$$;
create table trips(id uuid primary key, status text);
create table members(id uuid primary key, user_id uuid, trip_id uuid, status text, role text);
create table expenses(id uuid primary key, trip_id uuid, created_by_member_id uuid, created_at timestamptz, updated_at timestamptz,
  deleted_at timestamptz, title text, expense_date date, notes text, amount numeric, subtotal_amount numeric,
  fee_amount numeric, fee_percent numeric, fee_label text, exchange_rate_to_base numeric, converted_amount numeric, paid_by_member_id uuid);
create table expense_splits(id uuid primary key, expense_id uuid, member_id uuid, amount_owed numeric, subtotal_amount_owed numeric, fee_amount_owed numeric);
create table settlements(id uuid primary key, trip_id uuid, status text, created_at timestamptz, paid_at timestamptz);
create function load_auth_workspace(uuid) returns jsonb language sql as $$select jsonb_build_object('expenses', (select jsonb_agg(e) from expenses e))$$;
insert into trips values ('00000000-0000-0000-0000-000000000001','active');
insert into members values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','approved','member');
insert into expenses values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','2026-09-17T01:00Z','2026-09-17T01:00Z',null,'Dinner','2026-09-17','',33,30,3,10,'Fee',3.672531,121.19,'00000000-0000-0000-0000-000000000002');
insert into expense_splits values ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',121.19,110.18,11.01);
set test.user_id = '00000000-0000-0000-0000-000000000003';
`);
await db.exec(await readFile(new URL('../supabase/migrations/202609170001_expense_metadata.sql', import.meta.url),'utf8'));
const snapshot = async () => (await db.query(`select to_jsonb(e) - 'title' - 'notes' - 'expense_date' - 'updated_at' - 'created_at' || jsonb_build_object('created_at', extract(epoch from e.created_at)) as financial from expenses e`)).rows;
const original = await snapshot();
const originalSplits = (await db.query('select * from expense_splits')).rows;
const save = () => db.query(`select update_expense_metadata('00000000-0000-0000-0000-000000000004','Dinner','2026-09-10','Corrected date')`);
for (const tz of ['Asia/Dubai','America/Los_Angeles','Pacific/Kiritimati']) {
  await db.exec(`set timezone = '${tz}'`); await save();
  assert.equal((await db.query('select expense_date::text from expenses')).rows[0].expense_date,'2026-09-10');
  assert.deepEqual(await snapshot(),original);
  assert.deepEqual((await db.query('select * from expense_splits')).rows,originalSplits);
}
await db.exec(`insert into settlements values ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','paid','2026-09-17T02:00Z',null)`);
await assert.rejects(save, /paid settlement/);
await db.exec(`update settlements set status='voided'`); await save();
await db.exec(`update trips set status='closed'`); await assert.rejects(save,/read-only/);
await db.exec(`update trips set status='active'; update members set status='pending'`); await assert.rejects(save,/Approved trip member/);
await db.exec(`update members set status='approved'; update expenses set created_by_member_id='00000000-0000-0000-0000-000000000099'`); await assert.rejects(save,/creator or trip admin/);
await db.exec(`update members set role='admin'`); await save();
assert.equal((await db.query('select count(*)::int as count from expenses')).rows[0].count,1);
await db.exec(`set test.user_id = ''`); await assert.rejects(save,/Approved trip member/);
// Exercise the repository's existing create/update RPC bodies too, without changing them.
await db.exec(`
set test.user_id = '00000000-0000-0000-0000-000000000003';
create type currency_code as enum ('AED','CNY','KZT','USD');
alter table trips add column base_currency currency_code default 'AED';
alter table expenses add column currency currency_code default 'AED';
alter table expenses alter column id set default gen_random_uuid();
alter table expenses alter column created_at set default now();
alter table expenses alter column updated_at set default now();
alter table expense_splits alter column id set default gen_random_uuid();
`);
const accountingMigration = await readFile(new URL('../supabase/migrations/202606100004_phase48b_service_fee.sql', import.meta.url), 'utf8');
await db.exec(accountingMigration.slice(accountingMigration.indexOf('create or replace function public.create_expense_with_splits'), accountingMigration.indexOf('grant execute on function public.create_expense_with_splits')));
await db.query(`select create_expense_with_splits('00000000-0000-0000-0000-000000000001','Backdated purchase',30,'AED',1,30,'00000000-0000-0000-0000-000000000002','2026-09-10','', '[{"member_id":"00000000-0000-0000-0000-000000000002","amount_owed":30}]'::jsonb)`);
const created = (await db.query(`select id, expense_date::text from expenses where title='Backdated purchase'`)).rows[0];
assert.equal(created.expense_date, '2026-09-10');
await db.query(`select update_expense_with_splits($1,'Backdated purchase',90,'AED',1,90,'00000000-0000-0000-0000-000000000002','2026-09-09','', '[{"member_id":"00000000-0000-0000-0000-000000000002","amount_owed":90}]'::jsonb)`, [created.id]);
assert.deepEqual((await db.query('select amount::float, expense_date::text from expenses where id=$1',[created.id])).rows[0], {amount:90,expense_date:'2026-09-09'});
assert.equal((await db.query('select count(*)::int as count from expenses')).rows[0].count,2);
assert.equal((await db.query('select count(*)::int as count from expense_splits where expense_id=$1',[created.id])).rows[0].count,1);
assert.equal((await db.query(`select has_function_privilege('anon','public.update_expense_metadata(uuid,text,date,text)','execute') as allowed`)).rows[0].allowed,false);
assert.equal((await db.query(`select has_function_privilege('authenticated','public.update_expense_metadata(uuid,text,date,text)','execute') as allowed`)).rows[0].allowed,true);
await db.exec('set role authenticated'); await save(); await db.exec('reset role');
await db.close();
console.log('PASS: existing create/update RPC backdating and identity checks; metadata RPC permissions; metadata persistence in 3 timezones; exact financial/split preservation; no duplicate; settlement, membership, ownership, admin and closed-group guards.');
