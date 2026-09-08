# Public repository security audit — 8 September 2026

## Findings and status

| Finding | Evidence | Remediation/status |
| --- | --- | --- |
| Private reference screenshots committed | QA comparison images contained personal group/member names, trip expenses, and totals. | All 17 captures removed from Git and preserved locally. The entire QA image directory was purged from all 14 published branches and local refs. GitHub's internal PR references and caches require Support cleanup. |
| Environment/backup/session ignore gaps | Only `.env` and `.env.local` were ignored; other environment variants, database copies, browser captures, and QA files were unprotected. | Expanded ignore rules, added safe environment template, tracked-file check, staged-secret pre-commit hook, and a CI history scan. The local hook is enabled. |
| GitHub secret protection disabled | Repository API reported both secret scanning and push protection disabled. | Enabled both on GitHub and verified the updated settings. The alerts endpoint returned an empty list at audit time. |
| Public access to internal database helpers | Source grants and default PUBLIC privileges permitted direct execution of three SECURITY DEFINER helpers without membership checks. Live requests using the public key and a nonexistent UUID returned HTTP 200 for all three. No user records were requested. | Added and tested `202609080001_private_balance_helpers.sql`, then applied the equivalent grants change in production. All three anonymous requests now return HTTP 401 with PostgreSQL permission-denied code `42501`. |

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
- Compared all 58 commits in the remote rewrite against the recovery copy:
  every file outside the removed QA image directory was preserved exactly.
- Published all 14 rewritten branches with an atomic push and explicit old-SHA
  leases, then verified the remote tips. No branches or tags were deleted.
- A fresh GitHub clone contains none of the removed QA paths or their original
  Git objects across published branches. An old screenshot is still served via
  its previous commit URL, confirming that GitHub Support cleanup is necessary.
- Existing GitHub branch protections remain active and unchanged. The published
  `Public repository safety` workflow passed.
- Sanitized local branches and synchronized this checkout to prevent accidental
  reintroduction of the old history. Private recovery bundles are stored only
  in the ignored local `.security-tools/` directory; do not publish them.
- Applied the database permission fix through the Supabase SQL Editor, which
  reported success. Verified all three anonymous requests are denied afterward.
  Live ACLs now grant execution only to `postgres` and `service_role`; `PUBLIC`,
  `anon`, and `authenticated` grants are absent from all three helpers.

## Remaining actions

1. Ask GitHub Support to remove cached views, clear affected internal PR refs,
   and garbage-collect the old screenshots. The rewrite affects 19 PR head refs;
   there were no forks at audit time. A support request with the exact cleanup
   metadata is prepared locally in `.security-tools/github-support-request.md`.
2. Other existing clones must be recloned or carefully rebased onto the new
   history. Do not merge or push old branches back into this repository.
   Third-party copies cannot be recalled.

No credential rotation is indicated by the findings so far. This is not a
guarantee of no exposure: automated text scans do not inspect image pixels, and
the audit does not cover inaccessible forks, deleted remote refs, GitHub Actions
artifacts, or a complete review of every live database permission.
