# Public repository security audit — 8 September 2026

## Findings and status

| Finding | Evidence | Remediation/status |
| --- | --- | --- |
| Private reference screenshots committed | `artifacts/ui-qa/comparison-groups-widget.png` contains personal group/member names; `comparison-expense-scroll-window.png` contains trip expenses and totals. Introduced by `fd1d29c`. | All 17 QA captures removed from the local Git index and preserved on disk. `artifacts/` is now ignored. Published branches/history still need cleanup. |
| Environment/backup/session ignore gaps | Only `.env` and `.env.local` were ignored; other environment variants, database copies, browser captures, and QA files were unprotected. | Expanded ignore rules, added safe environment template, tracked-file check, staged-secret pre-commit hook, and a CI history scan. The local hook is enabled. |
| GitHub secret protection disabled | Repository API reported both secret scanning and push protection disabled. | Enabled both on GitHub and verified the updated settings. The alerts endpoint returned an empty list at audit time. |
| Public access to internal database helpers | Source grants and default PUBLIC privileges permit direct execution of three SECURITY DEFINER helpers without membership checks. Live requests using the public key and a nonexistent UUID returned HTTP 200 for all three. No user records were requested. | Added and tested `202609080001_private_balance_helpers.sql`. Live application remains pending; the dashboard editor did not respond reliably. |

## Verification

- Refreshed remote refs; inspected 55 reachable commits and scanned all 331
  reachable text blobs with redacted pattern checks. Only fixed test strings
  matched the supplemental assignment check.
- Gitleaks v8.30.1 found no credentials in all fetched Git history (34 non-merge
  commits with scanned patches), or the current publishable source files.
- `.env.local` was not tracked or present in the fetched history. Its configured
  Supabase key is a public publishable key, not a service-role credential.
- Inspected the three public product screenshots; their names, amounts, and
  invite code match synthetic `src/lib/uiPreviewData.ts` fixtures.
- Ignore behavior: 24 private paths rejected, six intentional source/template
  paths allowed. A force-staged environment-file fixture fails the new check.
- Isolated PostgreSQL/PGlite test reproduced anonymous balance exposure before
  the migration, rejected all six direct calls afterward (three helpers × two
  browser roles), preserved owner-executed nested calls, and verified reruns.
- TypeScript checks, 34 unit tests, production build, and diff whitespace checks
  passed. The build retains its existing large-bundle warning.

## Remaining actions

1. Apply the tested migration through Supabase's SQL Editor, then confirm direct
   anonymous helper requests are denied. The migration only changes grants;
   it does not delete or alter account, trip, or expense records.
2. Publish the local removal and prevention changes. Local edits and staged
   removals do not remove files from GitHub by themselves.
3. Coordinate a rewrite removing `artifacts/ui-qa/` from every affected published
   branch/tag, followed by GitHub cached/PR-reference cleanup if needed. Rewriting
   shared history requires a force push and changes commit IDs. Existing clones
   and third-party copies cannot be recalled.

No credential rotation is indicated by the findings so far. This is not a
guarantee of no exposure: automated text scans do not inspect image pixels, and
the audit does not cover inaccessible forks, deleted remote refs, GitHub Actions
artifacts, or a complete review of every live database permission.
