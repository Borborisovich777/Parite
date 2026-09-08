# Design QA — expense viewport, Groups menu, and first-run tour

## Source visual truth

- Expense viewport and Groups menu references were supplied privately.
- QA images under `artifacts/` are local-only evidence. Some comparisons include
  private reference data, so the images must not be committed or published.

The intended result keeps the established Parité visual system while removing the unused band above mobile navigation, consolidating group actions, limiting a long group list to three rows by default, removing the duplicate Switch group control, and placing Export immediately before Log out.

## Implementation evidence

- Local URL: `http://localhost:3001/?preview=ui`
- Guided-tour URL: `http://localhost:3001/?preview=ui&tour=1`
- Primary mobile viewport: `390 × 844`
- Reference-matched viewport: `451 × 774` (the supplied expense screenshot is `902 × 1548`, consistent with a 2× capture)
- Desktop viewport: `1280 × 900`
- State: preview Expenses tab with seeded group data; side menu tested with five preview groups
- Mobile captures:
  - `artifacts/ui-qa/mobile-expense-scroll-390x844.png`
  - `artifacts/ui-qa/mobile-expense-scroll-end-390x844.png`
  - `artifacts/ui-qa/mobile-groups-collapsed-390x844.png`
  - `artifacts/ui-qa/mobile-groups-expanded-390x844.png`
- Reference-matched captures:
  - `artifacts/ui-qa/mobile-expense-scroll-451x774.png`
  - `artifacts/ui-qa/mobile-groups-collapsed-451x774.png`
- Desktop captures:
  - `artifacts/ui-qa/desktop-expense-scroll-1280x900.png`
  - `artifacts/ui-qa/desktop-groups-collapsed-1280x900.png`
- Full-view comparison:
  - `artifacts/ui-qa/comparison-expense-scroll-window.png`
- Focused Groups-region comparison:
  - `artifacts/ui-qa/comparison-groups-widget.png`

## Findings

### Fonts and typography

- Passed: the existing Inter, Outfit, and JetBrains Mono hierarchy is preserved; group names, currencies, statuses, expense titles, and monetary labels retain their prior weights and wrapping behavior.
- Passed: integrated Create group and Join group labels remain readable at 390px and 451px without clipping.

### Spacing and layout rhythm

- Passed: the expense list now reaches the mobile navigation boundary without the previous extra 80px inset. At 390 × 844 the list ends at y=775 and the navigation begins at y=778.
- Passed: the document remains exactly one viewport high; only the expense rows scroll while the header, search/filter controls, and navigation remain fixed in their intended regions.
- Passed: the final expense ends at y=759 after scrolling, safely above the navigation at y=778, with a normal 16px list tail.
- Passed: Groups, its three visible rows, the disclosure control, and the integrated create/join actions form one card with consistent spacing.
- Passed: Export is the final card immediately before Log out on both mobile and desktop.

### Colors and visual tokens

- Passed: existing surface, border, mint action, positive, and negative tokens are reused. No new color system or off-brand treatment was introduced.
- Passed: the active group remains visually distinct without overpowering the list or action controls.

### Image quality and icon fidelity

- Passed: existing library icons are preserved for group actions, disclosure, exports, and logout. No placeholder, text-glyph, CSS-drawn, or custom SVG assets were introduced.
- Passed: reference and implementation captures remain sharp at their native viewports.

### Copy and content

- Passed: the duplicate Switch group label is absent from the side menu.
- Passed: Groups shows exactly three rows while collapsed and five after activating “Show 2 more groups”; the control changes to “Show fewer groups” with `aria-expanded=true`.
- Passed: Create group and Join group are inside the Groups card.
- Passed: existing export labels and behavior are unchanged.
- Accepted intentional difference: preview group names and amounts differ from the user screenshots because the local preview uses seeded QA data; component hierarchy and behavior are the comparison target.

### Interaction, responsiveness, and accessibility

- Passed: the group disclosure has `aria-controls` and a correct changing `aria-expanded` state.
- Passed: the active group is kept first when collapsed, so it remains visible even with more than three groups.
- Passed: mobile expense scrolling reaches the final row without moving the page or covering it with navigation.
- Passed: at 1280 × 900 the mobile navigation is hidden, the desktop tab row is visible, the expense scroller fills the shell, and all reorganized menu controls remain reachable.
- Passed: no Switch group buttons remain in the side menu, while selecting a group card still uses the existing workspace-switch action.
- Passed: browser console inspection found no warnings or errors.

### First-run guided tour

- Passed: a nine-step, game-style first quest introduces Menu, Groups, Add expense, Search, Balances, Settlement history, and Members before a completion screen.
- Passed: each functional step resolves the visible mobile or desktop control, places a high-contrast spotlight around it, and shows an animated pointer/tap cue without activating data-changing actions.
- Passed: Groups opens automatically for its step; Balances, Settlement history, and Members reveal their corresponding destinations as the sequence progresses.
- Passed: completion and skip state is stored per immutable account ID on the current device; a replay action remains available in the avatar menu for approved, active groups.
- Passed: the modal traps focus, supports Escape, restores focus to the header menu, exposes progress semantics and live step announcements, and removes motion for reduced-motion users.
- Passed: responsive checks covered `320 × 568`, `390 × 844`, `568 × 320`, and `1280 × 900`, including live viewport resizing and short-screen scrolling.
- Passed: replay is unavailable for pending or read-only groups so the tour does not advertise controls that are intentionally hidden.

## Comparison history

1. Initial code inspection found that the app shell already reserved the 66px mobile navigation plus safe area, while the Expenses root added another 80px bottom padding. Severity: P1. Removed the duplicate root padding and reduced the list tail from 64px to 16px.
2. Initial Groups inspection found two Switch group controls plus detached Create group and Join group actions. Severity: P2. Removed both duplicate controls from the side menu and integrated the actions into the Groups card.
3. A five-group interaction pass verified the new default three-row state, but required a clear disclosure state. The final control exposes the hidden count and changes to Show fewer groups when expanded.
4. Mobile checks at 390 × 844 and 451 × 774, scroll-end verification, desktop checks at 1280 × 900, and the final side-by-side comparisons found no remaining P0, P1, or P2 issues.
5. Guided-tour checks traversed all nine steps on mobile and desktop, verified the correct responsive navigation target, exercised Back, Next, Finish, Skip, Escape, replay, focus restoration, orientation changes, and the short-viewport fallback.

## Verification

- Primary interactions tested: open/close side menu, expand group list, scroll expense list to its final row, responsive navigation changes, and the complete first-run guided quest.
- Browser console: no warnings or errors.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Final result: passed
