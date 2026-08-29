# `extract-receipt` Edge Function

Authenticated, stateless receipt extraction for Parité. The function accepts one binary image, verifies
platform and trip access, delegates extraction to a provider adapter, deletes the provider analysis result,
and returns only the normalized receipt contract.

It does not use Supabase Storage, write to Postgres, create a temporary file, or log request/response bodies.
Do not add receipt text, provider responses, image bytes, authorization headers, or filenames to logs or
exception metadata.

## Provider gate

The live adapter is deliberately inactive until the deployment environment sets `RECEIPT_PROVIDER=azure`.
Before doing that, the owner must confirm the Azure resource region, retention/logging/training terms,
immediate-delete behavior, account quota, and spend cap. No credentials are included in this repository.

Required server secrets/environment:

- `SUPABASE_URL` (provided by Supabase)
- `SUPABASE_ANON_KEY` (provided by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (provided by Supabase; server only)
- `RECEIPT_PROVIDER=azure`
- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_DOCUMENT_INTELLIGENCE_KEY`

Optional bounded settings:

- `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION` (defaults to `2024-11-30`)
- `RECEIPT_MAX_IMAGE_BYTES` (defaults to 4 MiB; hard cap 10 MiB)
- `RECEIPT_MAX_IMAGE_PIXELS` (defaults to 20 million; hard cap 40 million)
- `RECEIPT_MAX_IMAGE_EDGE` (defaults to 8,000; hard cap 10,000)
- `RECEIPT_REQUEST_TIMEOUT_MS` (defaults to 30 seconds; hard cap 45 seconds)
- `RECEIPT_PROVIDER_MAX_POLLS` and `RECEIPT_PROVIDER_POLL_INTERVAL_MS`
- `RECEIPT_DELETE_TIMEOUT_MS`, `RECEIPT_DELETE_MAX_ATTEMPTS`, and `RECEIPT_DELETE_RETRY_DELAY_MS`

Keep the normal Supabase JWT verification enabled when deploying this function. The handler also verifies the
token with Supabase Auth, checks the platform account is approved, and checks the user has an approved
membership in the submitted trip before creating an Azure analysis job.

## Request and response

Send `multipart/form-data` with exactly two fields:

- `trip_id`: trip UUID
- `image`: one `image/jpeg`, `image/png`, or `image/webp` file

The success body is the provider-neutral `ReceiptExtractionResult` at the top level. Failure bodies have the
stable browser contract `{ "error": "..." }` with no provider payload or receipt content. All responses use
`Cache-Control:
no-store`.

The Azure operation URL is accepted only when it has the configured Azure origin, expected `prebuilt-receipt`
result path, and API version. Deletion uses a fresh, bounded signal so browser cancellation cannot skip
cleanup. A deletion failure suppresses the extracted result and returns a sanitized privacy error.

One provider-level residual risk cannot be removed in application code: if Azure accepts the initial bytes but
the connection fails before `Operation-Location` reaches this function, or Azure returns a missing/malformed
operation header after accepting the bytes, there is no trustworthy result ID available to delete. No
extracted content is returned in those cases, and Azure's contracted transient-retention policy applies. The
provider gate must explicitly accept these failure modes before the feature is enabled.

## Local verification

From this directory:

```sh
deno task check
deno task test
deno fmt --check
deno lint
```

The tests use in-memory fakes and never call Azure or Supabase. A live integration test remains blocked until
the provider gate is approved and development secrets are supplied through the normal Supabase
secret-management path.
