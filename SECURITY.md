# Security and private data

## Public repository rules

Everything committed to this repository can become public, including older
commits and branches. `.gitignore` does not remove previously committed files.

- Store environment values in ignored `.env.*` files. Commit only sanitized
  `.env.example`, `.env.sample`, or `.env.template` files.
- Every `VITE_*` value is browser-visible. Use only the Supabase public anon or
  publishable key in the frontend; keep service-role and OCR credentials in
  server-side secret storage. See [Supabase's API key guidance](https://supabase.com/docs/guides/api/api-keys).
- Keep screenshots, receipt photos, account/session captures, financial exports,
  and database backups out of Git. Use ignored `artifacts/`, `receipts/`,
  `exports/`, and `backups/` folders. Do not put private files in `public/`:
  everything there ships with the website.
- Use synthetic preview data for any intentionally published product images.
  Inspect images manually: text secret scanners do not audit pixels.

## Checks before publication

```sh
npm run security:files
# Requires Gitleaks installed on PATH, for example: brew install gitleaks
npm run security:secrets
```

The checked-in pre-commit hook rejects ignored files that were already tracked
or force-added, and scans staged changes with redacted Gitleaks output. To enable
it in a fresh clone after installing Gitleaks:

```sh
git config core.hooksPath .githooks
```

The GitHub workflow repeats the tracked-file check and scans fetched history
using a checksum-pinned scanner. Keep GitHub secret scanning and push protection
enabled in repository Settings → Security. CI runs after publication; the local
hook and [GitHub push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
help catch credentials before publication. These checks cannot guarantee that
all forms of private data will be detected.

## Database permissions

Apply `supabase/migrations/202609080001_private_balance_helpers.sql` after the
earlier migrations. It revokes direct browser execution of `member_open_balance`,
`trip_approved_members_settled`, and `trip_approved_admin_count`. These internal
`SECURITY DEFINER` helpers accept arbitrary IDs and have no membership check.
The owner can still call them from the app's authorized database functions.

Run `supabase/tests/private_balance_helpers.sql` as the function owner in an
isolated test database after migrations to check the resulting grants. Applying
this source change to Git alone does not update a deployed Supabase database.

## If private material was already committed

1. Revoke or rotate an exposed credential at its issuer immediately. A clean
   latest commit does not make an old credential safe.
2. Remove private files from tracking while keeping needed local copies:
   `git rm --cached -r -- artifacts/ui-qa`.
3. Publish the removal and prevention changes. Old versions remain reachable.
4. Coordinate a history rewrite that removes the affected paths from all
   published branches/tags. This changes commit IDs and requires a force push;
   collaborators must refresh their clones without restoring the old history.
5. Follow [GitHub's sensitive-data removal instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
   for cached views, pull-request references, and forks. Rewriting this repository
   cannot recall copies that others have already downloaded.

Do not paste credentials or private screenshots into public issues or scan reports.
