# `extract-receipt` Edge Function

Authenticated, stateless receipt extraction for Parité. The function accepts one binary image, verifies
platform and trip access, delegates extraction to a provider adapter, deletes the provider analysis result,
and returns only the normalized receipt contract.

It does not use Supabase Storage, persist receipt content in Postgres, create a temporary file, or log
request/response bodies. The only durable state is metadata-only monthly quota counters containing a user ID,
UTC month, and count. Do not add receipt text, provider responses, image bytes, authorization headers,
filenames, merchant data, or trip IDs to those counters, logs, or exception metadata.

Apply `supabase/migrations/202608300001_receipt_scan_quota.sql` before deploying this function. The function
fails closed and does not call the extraction provider when the quota RPC is absent or unavailable.

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
- `RECEIPT_PROVIDER_MAX_POLLS` (defaults to 20)
- `RECEIPT_PROVIDER_POLL_INTERVAL_MS` (defaults to and is clamped to at least 1,100 ms)
- `RECEIPT_DELETE_TIMEOUT_MS`, `RECEIPT_DELETE_MAX_ATTEMPTS`, and `RECEIPT_DELETE_RETRY_DELAY_MS`

Keep the normal Supabase JWT verification enabled when deploying this function. The handler also verifies the
token with Supabase Auth, checks the platform account is approved, and checks the user has an approved
membership in the submitted trip before creating an Azure analysis job.

## Quota behavior

- Each approved account receives 10 provider attempts per UTC calendar month.
- Parité reserves at most 450 provider attempts across all accounts per UTC month. This leaves 50 pages of
  headroom under Azure F0's currently documented 500-page monthly allowance.
- The reservation is an atomic Postgres transaction immediately before the Azure call. Authentication,
  malformed images, failed membership checks, and missing provider configuration do not consume a scan.
- Once reserved, an attempt counts even if the provider times out, rejects the image, returns malformed data,
  or cannot complete privacy cleanup. At that point Azure acceptance and billing may be ambiguous, so the
  counter is deliberately not refunded.
- The 450 cap has room for 45 users to use all 10 scans. Additional users share whatever capacity remains.
  Calls made directly to the same Azure resource are outside Parité's counter, so keep Azure's account quota
  and alerting enabled as a second boundary.

The authenticated `get_my_receipt_scan_quota` RPC returns only the caller's limit, used count, remaining
count, reset timestamp, and an availability reason. It never exposes the global count. Direct access to both
counter tables and the reservation RPC is denied to browser roles; only the Edge Function's service role can
reserve.

Azure F0 also currently limits both Analyze requests and result GET requests to one per second at the resource
level. The 1,100 ms polling floor protects a single job's polling cadence, but it does not serialize
concurrent Edge Function invocations. Resource-wide concurrency, throttling, and bounded 429 behavior must be
exercised during the live provider rollout; production enablement remains blocked until that check passes.

The monthly counters protect Azure calls, not arbitrary traffic to the Edge Function. The browser's
lightweight status check prevents normal exhausted users from uploading another image, but a custom client can
still send request bodies that fail before reservation. Configure a gateway-level per-user request limit
before production so repeated invalid, nonmember, or already-exhausted uploads cannot waste Edge bandwidth and
memory.

## Request and response

Send `multipart/form-data` with exactly two fields:

- `trip_id`: trip UUID
- `image`: one `image/jpeg`, `image/png`, or `image/webp` file

The success body is the provider-neutral `ReceiptExtractionResult` at the top level. Successful reservations
also expose `X-Receipt-Scans-Limit`, `X-Receipt-Scans-Remaining`, and `X-Receipt-Scans-Reset-At` response
headers. Failure bodies use `{ "error": "...", "code": "..." }` with no provider payload or receipt content.
Personal quota exhaustion uses `receipt_quota_exceeded`; shared-capacity exhaustion uses
`receipt_capacity_reached`. Both return HTTP 429 and do not call Azure. All responses use
`Cache-Control: no-store`.

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

The tests use in-memory fakes and never call Azure or Supabase. SQL boundary and concurrency checks
(10th/11th, 450th/451st, UTC rollover, and parallel reservations) still require a local or staging Supabase
database. A live provider test remains blocked until the provider gate is approved and development secrets are
supplied through the normal Supabase secret-management path.
