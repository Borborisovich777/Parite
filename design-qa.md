# Design QA — mobile expense experience

## Source of truth

- Primary visual direction: `/var/folders/p5/3lk7_p691q3dpbz7ztx_bpfc0000gp/T/codex-clipboard-2450719b-4d85-4daa-8a8b-87d0bcc0d73f.png`
- Amount-first expense flow: `/var/folders/p5/3lk7_p691q3dpbz7ztx_bpfc0000gp/T/codex-clipboard-6f1fea0a-19a9-4a2f-987f-fd35165d6027.png`
- Supporting list and avatar direction: `/var/folders/p5/3lk7_p691q3dpbz7ztx_bpfc0000gp/T/codex-clipboard-518111bf-ad79-4188-b8fd-9e75cb1c24b4.png`

The intended result is a mobile-first, friendly shared-expense UI with compact, glanceable rows; semantic owed/owing colors; colorful expense icons; recognizable member avatars; and an amount-first add-expense flow. Existing product behavior and persistence contracts remain the source of truth where the illustrations differ from the app.

## Test state

- URL: `http://localhost:3000/?preview=ui`
- Viewport: `390 × 844`
- Browser state: mock preview, Expenses tab, seeded Dubai group data
- Add-expense state: amount `52.80`, title `Dinner at Orfali`, inferred Restaurant icon
- Full-view implementation captures:
  - `artifacts/ui-qa/expense-overview-390x844.png`
  - `artifacts/ui-qa/add-expense-390x844.png`
- Full-view comparison evidence:
  - `artifacts/ui-qa/comparison-overview.png`
  - `artifacts/ui-qa/comparison-add-form.png`
- Focused expense-row evidence:
  - `artifacts/ui-qa/comparison-expense-rows-focus.png`

## Findings

### Visual fidelity

- Passed: the expense list follows the reference hierarchy with date sections, compact icon-led rows, payer metadata, right-aligned totals, and semantic lent/borrowed labels.
- Passed: the amount-first form follows the reference flow while adapting it to the current app's payer, fee, and review behavior.
- Passed: mint, pale blue, peach, violet, and rose surfaces establish a related but clearer category system without overwhelming monetary data.
- Passed: the three-tab mobile navigation and floating add action remain visually prominent and reachable.
- Accepted intentional difference: the implementation uses the current group header and app navigation instead of recreating Splitwise-specific Groups, Charts, Export, or keyboard chrome.

### Interaction and responsive behavior

- Passed: viewport width and document width both measured `390px`; no horizontal overflow was present.
- Passed: the add-expense experience occupies the full mobile viewport and is not trapped beneath the app header or bottom navigation.
- Passed: all seven category groups render in the icon picker, with 40 expense choices plus picker controls.
- Passed: title inference selected Restaurant for `Dinner at Orfali`; amount/title entry, review, and preview-only save were exercised.
- Passed: a manual Taxi choice for the non-matching title `Quarterly sync` remained Taxi after save; the preference is presentation-only and device-local.
- Passed: balances, members, member breakdown, avatar customization, and the side menu were opened and visually checked.
- Passed: avatar selection persists through the versioned, validated device-local preference layer and does not modify member records.
- Passed: desktop expansion was checked at `1024 × 900` without horizontal overflow.

### Accessibility and implementation safety

- Passed: primary mobile controls meet the 44px target intent, focus-visible styles are present, icon buttons have accessible names, dialogs have headings, and semantic positive/negative information is also expressed in text.
- Passed: the avatar dialog is portaled outside the app root, marks background content inert/hidden, receives initial focus, loops focus from first to last control, closes with Escape, and restores focus.
- Passed: avatar Reset now changes draft state only; closing without Save preserves the existing Cat/Rose preference in the tested state.
- Passed: primary action green (`#4fa889`) against Slate 950 has a computed 7.01:1 contrast ratio, including the shell-level action override; decorative logo foreground was updated to the same dark tone.
- Passed: `npm run lint` and `npm run build` complete successfully.
- Passed: `git diff --check` is clean.
- Passed: no changes exist in `src/types.ts`, `src/lib/tripRepository.ts`, `src/lib/supabase.ts`, or `supabase/`.

## Comparison history

1. Initial browser pass found the add-expense overlay constrained by an animated ancestor, leaving the app header and navigation visible. Severity: P1. Fixed by removing the transformed ancestor while open and anchoring the form to the full viewport.
2. Initial avatar-picker pass found its footer clipped on short mobile viewports. Severity: P1. Fixed with a bounded flex layout and independently scrolling picker content.
3. Independent audit found that an explicit non-inferred expense icon was lost after save. Severity: P1. Fixed with a versioned, group/title-scoped device-local visual preference that leaves expense records and callback payloads unchanged.
4. Independent audit found incomplete focus isolation in the avatar dialog. Severity: P2. Fixed with a body portal, inert background, initial/return focus, Escape handling, and a keyboard focus loop.
5. Independent audit found two primary action labels below the 4.5:1 text-contrast threshold, including a shell-level override that initially kept the darker semantic green. Severity: P2. Fixed by separating action green (`#4fa889`) from semantic positive green, yielding 7.01:1 against Slate 950.
6. Independent audit found Reset persisted before Save. Severity: P2. Fixed so Reset edits the draft and only Save commits the reset.
7. Final side-by-side and interaction pass found no remaining P0, P1, or P2 issues. The implementation captures above are post-fix evidence.

Final result: passed
