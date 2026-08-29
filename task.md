# Task: Stateless Receipt Scan and Item-Based Splitting

## Objective

Implement an optional receipt-import path in Parité:

1. The user takes or selects one receipt image.
2. The browser prepares the image and sends it for receipt extraction.
3. The website displays editable item and adjustment rows.
4. The user manually assigns each item to one or more trip members.
5. Parité calculates exact member totals using deterministic integer-cent arithmetic.
6. The existing expense preview and save flow stores only the final expense and member splits.
7. The image and all temporary receipt data are discarded.

Use [the feasibility report](docs/receipt-item-splitting-feasibility.md) as the product and architecture reference.

## Non-negotiable constraints

- Do not save receipt images in Supabase Storage, Postgres, local disk, a queue, a cache, analytics, logs, or error-reporting payloads.
- Do not persist raw OCR, extracted items, or item assignments in the MVP.
- Do not expose provider or service-role secrets in browser code or `VITE_*` variables.
- Do not use an LLM to assign items, calculate money, or make saving decisions.
- Use a dedicated receipt parser as the default extraction provider. An image-capable LLM may only be a future fallback.
- Keep manual expense entry fully functional when scanning is disabled, canceled, unavailable, or unsuccessful.
- Require human review. Never silently save OCR output or infer who consumed an item.
- Use integer minor units for every allocation. Member shares must equal the printed receipt total exactly.
- The printed receipt total normally already includes tax and fees. Do not apply Parité's existing percentage fee again unless the user explicitly adds a separate percentage outside that total.
- Keep the implementation behind a feature flag until privacy, extraction quality, and device QA pass.

## Locked MVP decisions

- One JPG, PNG, or WebP image per scan.
- Supported receipt currencies remain AED, CNY, KZT, and USD.
- Items may be assigned to one or several members.
- A shared item is split equally in the MVP.
- Tax, tip, service charge, discount, rounding, and other receipt-level adjustments support proportional, equal, or manual allocation.
- The saved expense uses `fee_percent = 0` and the existing custom member split when its printed total already includes adjustments.
- No database schema change is needed for receipt content.
- No Workspace Agent is used in the runtime extraction path.

## Target architecture

```text
camera/file
  -> browser resize, orientation correction, and EXIF removal
  -> authenticated stateless Supabase Edge Function
  -> dedicated receipt OCR provider
  -> provider result deletion when supported
  -> normalized receipt JSON in browser memory
  -> editable review and manual member assignment
  -> deterministic custom split
  -> existing expense RPC
  -> revoke image URL and clear temporary state
```

The Edge Function is only an authentication, validation, secret-management, and normalization boundary. It must not become an image store or a general image-processing server.

## Provider gate

Implement a provider-neutral internal contract and one live provider adapter.

Preferred first adapter: Azure Document Intelligence `prebuilt-receipt`, because Parité may need Arabic, Kazakh, and Russian receipt support. Call Azure's delete-analysis-result endpoint before returning normalized JSON. Keep the adapter replaceable so AWS Textract or Google Document AI can be tested later.

Before live provider work:

- [ ] Confirm the selected provider and processing region.
- [ ] Confirm its retention, logging, training/data-use, and deletion settings satisfy the product promise.
- [ ] Obtain development credentials through the normal secret-management path.
- [ ] Define a low account-level provider spend cap.

If credentials or a provider decision are unavailable, implement and test the internal contract, fixtures, calculations, preprocessing, and UI with a local mock. Do not invent credentials, weaken authentication, or commit a secret. Record the live-integration blocker and stop at that boundary.

## Normalized data contract

Create receipt-specific modules outside `ExpensesTab.tsx`, for example under `src/features/receipt/`.

```ts
type ReceiptItemCandidate = {
  id: string
  rawName: string
  quantity?: string
  unitAmountMinor?: number
  lineTotalMinor: number
  confidence?: number
}

type ReceiptAdjustment = {
  id: string
  kind: 'tax' | 'tip' | 'service' | 'discount' | 'rounding' | 'other'
  label: string
  amountMinor: number // discounts are negative
  allocation: 'proportional' | 'equal' | 'manual'
}

type ReceiptExtractionResult = {
  merchant?: string
  purchasedAt?: string
  currency?: 'AED' | 'CNY' | 'KZT' | 'USD'
  subtotalMinor?: number
  totalMinor: number
  items: ReceiptItemCandidate[]
  adjustments: ReceiptAdjustment[]
  warnings: string[]
}
```

Treat provider JSON as untrusted input. Parse and validate it at the function boundary. Never pass provider-specific response objects into React components.

## Codex execution instructions

- Read this file and the linked feasibility report completely before implementation.
- Work through phases in order; do not begin live provider integration before the provider gate is satisfied.
- Mark a checkbox complete only after its implementation and stated acceptance checks pass.
- Keep a short dated note under the relevant phase for material decisions, deviations, blockers, and verification results.
- Preserve unrelated worktree changes and keep edits scoped to this feature.
- Prefer small, reviewable modules and pure functions. Do not move receipt logic wholesale into `ExpensesTab.tsx`.
- If a requirement conflicts with the privacy constraints, stop and record the conflict instead of weakening the constraints.
- Do not enable the feature in production or deploy it unless explicitly requested.

## Implementation plan

### Phase 0: Baseline and isolation

- [x] Review `git status` and preserve all unrelated user changes.
- [x] Run `npm run lint` and `npm run build`; record pre-existing failures before editing.
- [x] Add `VITE_RECEIPT_IMPORT_ENABLED`, defaulting to disabled when absent.
- [x] Create receipt modules/components rather than expanding the already-large `src/components/ExpensesTab.tsx` with all implementation details.
- [x] Add a test runner suitable for pure TypeScript logic if none exists, and add a non-watch test script.

Acceptance:

- Existing manual expense behavior and current build remain unchanged with the flag disabled.

2026-08-29 — Baseline `main` matched `origin/main`; existing untracked `docs/` and `task.md` were preserved. Initial lint/build were blocked only by the locally missing, already-declared `qrcode.react` dependency; dependencies were restored and current lint/build pass. Receipt import remains disabled unless `VITE_RECEIPT_IMPORT_ENABLED=true`.

### Phase 1: Pure receipt arithmetic

- [x] Implement validated money parsing into integer minor units.
- [x] Implement equal sharing of one item across selected members with deterministic remainder-cent allocation.
- [x] Aggregate each member's assigned-item subtotal.
- [x] Implement proportional, equal, and manual allocation for signed adjustments.
- [x] Reconcile items plus adjustments to the printed total.
- [x] Return clear validation errors for unassigned items, missing totals, unsupported currencies, invalid values, and unresolved differences.
- [x] Convert final receipt-currency shares through the existing exchange-rate path and preserve the existing split-total invariant.
- [x] Map final values into the current `ExpenseSplitInput[]` shape instead of adding a parallel balance system.

Required tests:

- [x] A 10.00 item shared by three members allocates 3.34, 3.33, and 3.33 in a stable order.
- [x] Repeated item names remain separate rows.
- [x] Positive tax and tip allocate correctly.
- [x] Negative discounts allocate correctly without producing an incorrect grand total.
- [x] Proportional allocation handles zero-subtotal members.
- [x] Manual adjustments must sum exactly.
- [x] Unassigned items block continuation.
- [x] Items plus adjustments must reconcile exactly to the total.
- [x] Currency conversion and remainder distribution equal the existing converted expense total.

2026-08-29 — Added validated minor-unit parsing, deterministic item and signed-adjustment allocation, exact reconciliation, existing-path currency conversion, and canonical `ExpenseSplitInput[]` mapping. All 29 receipt arithmetic and contract tests pass.

### Phase 2: Browser image lifecycle

- [x] Add camera/file selection with `accept="image/jpeg,image/png,image/webp"` and mobile rear-camera capture guidance.
- [x] Validate MIME type, decoded dimensions, and source size before processing. Reject SVG and unsupported formats.
- [x] Correct orientation and resize the long edge to approximately 1,600–2,000 pixels while preserving small text.
- [x] Target roughly 1–3 MB and strip EXIF/GPS during browser re-encoding.
- [x] Keep the preview in a revocable `Blob` URL.
- [x] Send multipart binary data, not Base64.
- [x] Revoke the preview URL and clear file/image state after save, cancel, replacement, navigation, timeout, or error.
- [x] Abort an in-flight request when the flow is closed.

Acceptance:

- Browser tools show no Storage upload and no Base64 image request.
- Repeated scan/cancel cycles do not retain stale object URLs or images in application state.

2026-08-29 — Browser preprocessing validates decoded images, corrects EXIF orientation, re-encodes metadata-free JPEGs at a 3 MB ceiling, uses revocable Blob URLs, and sends multipart binary. One reset path now handles cancel, replacement, navigation, timeout/error teardown, and in-flight abort; enabled mock QA confirmed the post-cancel receipt session is removed.

### Phase 3: Stateless extraction endpoint

- [x] Add an authenticated Supabase Edge Function for receipt extraction.
- [x] Verify the Supabase session and approved membership of the supplied trip before calling the provider.
- [x] Accept exactly one multipart image with strict type, size, dimension, and timeout limits.
- [x] Never write request bytes to Storage, Postgres, disk, cache, or a queue.
- [x] Ensure application, platform, analytics, and exception logs exclude request/response bodies and receipt text.
- [x] Call the selected provider adapter and normalize its output to `ReceiptExtractionResult`.
- [x] Bound provider polling and total request duration.
- [x] Delete the provider analysis result before responding when the provider supports deletion. Use a bounded retry for deletion.
- [x] If deletion fails, return a sanitized privacy error rather than claiming successful deletion; do not return extracted receipt content.
- [x] Release references to image and provider response buffers after processing.
- [x] Return sanitized errors for authentication, limits, timeout, extraction failure, malformed output, and deletion failure.
- [ ] Allow one in-flight scan in the client and configure provider/account quotas. Add durable server-side rate limiting only if available without storing receipt content.

Acceptance:

- Repository search finds no receipt Storage write or image logging path.
- A successful request returns only normalized JSON after required provider deletion succeeds.
- Invalid or unauthenticated requests do not call the provider.
- Provider timeout and deletion-failure paths expose no receipt data.

2026-08-29 — Added a stateless authenticated Edge Function and provider-neutral contract. The Azure `prebuilt-receipt` adapter is implemented behind inactive configuration and tested with in-memory fakes; deletion must succeed before normalized data is returned. The client aborts any previous request before starting another, so only one scan is active per browser flow. Deno check/fmt/lint pass and 12/12 Edge tests pass. Provider gate, live integration, quota/spend configuration, and durable rate limiting remain blocked. No credentials, deployment, or live provider call were attempted.

### Phase 4: Receipt review and assignment UI

- [x] Add a **Scan receipt** entry beside the existing manual expense path when the feature flag is enabled.
- [ ] Build separate capture, receipt-review, item-assignment, and final-review components.
- [x] Keep the local image visible during review with zoom/rotate support where practical.
- [x] Show editable merchant/title, date, currency, subtotal, total, item names, quantities, prices, and adjustments.
- [x] Mark low-confidence or inconsistent fields with text such as **Needs check**.
- [x] Let users add, edit, exclude, or restore item and adjustment rows.
- [x] Require explicit assignment of every included item.
- [x] Support one or multiple member chips per item, plus **Payer**, **Everyone**, and **Assign all** shortcuts.
- [x] Support proportional, equal, and manual adjustment allocation.
- [x] Show live per-member totals and reconciliation status.
- [x] Provide manual-entry and totals-only fallbacks after extraction failure.
- [x] Prevent duplicate submissions and preserve the existing full-screen/sticky-action visual pattern.

Accessibility acceptance:

- [x] Interactive targets are at least 44–48 px.
- [x] Inputs and assignment controls have explicit accessible names.
- [x] Processing and validation changes are announced to screen readers.
- [x] Warnings do not rely on color alone.
- [x] Keyboard focus is visible and follows the modal/sheet flow correctly.

2026-08-29 — The mock-backed four-step flow now covers capture, editable receipt review, exclusion/restoration, zoom/rotation, item assignment, live exact totals, final review, and totals-only/manual fallback. Keyboard focus trapping and restoration were exercised, including reverse-tab wrapping. The logical stages remain in one isolated `ReceiptImportFlow` component; splitting those stages into smaller React components remains open as a maintainability refactor.

2026-08-29 — Follow-up after preview QA: mock extraction returns fixed sample rows and is now labeled explicitly before, during, and after image selection. Mock extraction remains opt-in through an explicit development-only flag; live OCR still requires the provider gate and Edge Function configuration below.

### Phase 5: Existing expense-flow integration

- [x] Populate the existing expense title, date, currency, payer, amount, and exchange-rate fields from reviewed values.
- [x] Set the saved amount to the printed grand total.
- [x] Use `fee_percent = 0` for a total that already includes tax, tip, service charge, or other fees.
- [x] Feed calculated member amounts into the existing custom-split builder and preview.
- [x] Save through the current `create_expense_with_splits` path; do not add receipt tables or a second financial write path.
- [x] Preserve all current membership, payer, currency, conversion, and split-total validation.
- [x] On successful save, clear all receipt image, OCR, item, assignment, and adjustment state.
- [x] On editing an already-saved expense, show only the existing aggregate data; do not imply that discarded receipt details can be reconstructed.

Acceptance:

- Balances and settlements consume the new expense exactly like a manually created custom-split expense.
- The stored member splits equal the converted expense total.
- No receipt image, OCR response, item row, or assignment appears in Supabase data or subsequent workspace payloads.

2026-08-29 — Receipt handoff populates the existing expense form, forces `fee_percent = 0`, and passes exact converted member shares into the current custom-split preview and save callback. The 167.20 AED mock receipt reconciled to 62.15, 44.55, 30.25, and 30.25 AED. No receipt table or second financial write path was added; no live database save was performed during QA.

### Phase 6: Verification and rollout

- [x] Run the full unit test suite.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Test feature-flag disabled and enabled states.
- [x] Test mobile sizes 390×844 and 451×744, desktop 1280×900, and landscape.
- [ ] Test camera capture, file upload, cancel, replacement, timeout, retry, offline state, provider failure, and manual fallback.
- [ ] Test glare, rotation, long thermal paper, repeated items, quantities, discounts, unsupported currency, and total mismatch.
- [ ] Inspect browser network traffic, Supabase Storage, database writes, function logs, and error reporting to verify the privacy invariant.
- [ ] Benchmark 30–50 representative receipts in the required languages before production enablement.
- [ ] Record exact-total accuracy, line-item recall, correction rate, reconciliation failure, latency, and provider cost per accepted receipt.
- [x] Keep the production feature flag disabled until privacy review and go/no-go criteria pass.

2026-08-29 — Verification passes: frontend tests 29/29, Edge tests 12/12, TypeScript lint, production build, Deno check/fmt/lint, and `git diff --check`. Enabled mock QA covered 390×844, 451×744, 1280×900, landscape, file upload, cancellation cleanup, exact assignment, exclusion/restoration, zoom/rotation, totals-only fallback, and existing-preview handoff; the disabled state was tested separately and left the manual form unchanged. The build retains the existing large-chunk warning. Hardware camera, complete offline/provider failure coverage, live privacy inspection, and the representative-receipt benchmark remain open. Production enablement remains blocked and the flag defaults off.

## Definition of done

- A signed-in approved trip member can scan one receipt, review and correct extracted rows, manually assign all included items, allocate adjustments, and save an exact custom split.
- The existing manual expense flow remains unchanged.
- Arithmetic is deterministic, cent-safe, tested, and always reconciles before saving.
- Parité never persistently stores the receipt image, raw OCR, items, or assignments.
- Provider-side analysis data is deleted before success is reported when deletion is part of the selected provider contract.
- Secrets remain server-side, receipt contents are absent from logs, and invalid users cannot spend provider quota.
- Lint, build, unit tests, responsive QA, failure-path QA, and privacy inspection pass.

## Out of scope

- Automatic inference of who consumed an item.
- Persistent receipt images or post-save receipt viewing.
- Persistent item-level audit history or post-save reassignment.
- Multiple receipts, multi-page stitching, refunds, or multiple payers.
- Collaborative real-time item claiming.
- Learned assignment suggestions, translation, or merchant-specific templates.
- A multimodal LLM as the primary extraction engine.
