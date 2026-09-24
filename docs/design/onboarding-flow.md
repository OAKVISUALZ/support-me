# Onboarding Flow for New Creators — Design Spec

Status: **Design / Handoff-ready** · Owner: UI/UX · Consumers: `frontend/` (Next.js)

Tracks issues: **#49** — *UI/UX: Design onboarding flow for new creators*

---

## 1. Problem

A brand-new creator signs up today and lands straight on the authenticated hub
(`/app`) with no guidance on what to do first. The very first actions that make
the platform useful — set a username, set a donation goal, get their shareable
link/QR — are spread across three different pages and only discoverable by
exploring. First-run abandonment risk is high.

This spec designs a short onboarding checklist that:

- appears only for first-time creators,
- guides them through the key first-run actions,
- shows progress as they complete steps,
- can be exited/ dismissed without blocking use of the app,
- is implementable directly from this document.

## 2. Goals & Non-goals

Goals:

1. A designed onboarding flow covering the key first-run actions
   (set username, set goal, get share link/QR, optionally connect payout wallet).
2. A clear specification for how progress is shown and how a creator exits/dismisses it.
3. Handoff spec the frontend team can implement directly.

Non-goals (out of scope for this ticket):

- Multi-screen wizard that blocks the app before a creator can use it.
- Email/notification onboarding sequences.
- Redesigning the existing username (`/auth/username`) or settings pages.
- Backend schema changes (progress derivation uses **existing** profile data).

## 3. Design Decisions (short version)

1. **Checklist, not wizard** — a dismissible card on `/app` (the post-login hub),
   not a blocking multi-step flow. First-run guidance should help, never trap.
2. **Derive completion from real data instead of extra state** where possible, so
   progress can never be faked or get stale:
   - *Set username* → completed as soon as the creator leaves `/auth/username`
     (a `hasProfile` creator always has a username).
   - *Set goal* → `creator.donationGoal > 0`.
   - *Share link/QR* → set a local flag when the creator copies/shares their
     profile link (`/app`) or opens the Share card/QR modal (`/dashboard`).
   - *Payout wallet* → `creator.walletAddress` present. *Optional* step.
3. **Three required steps + one optional step.** The card shows "n of 3 done".
4. **Exit affordances everywhere**: a ✕ dismiss button (hides for 7 days) and no
   focus trap; the card never covers the page chrome or blocks navigation.
5. **Auto-complete state**: when all 3 required steps are done the card flips to
   a short success state, then collapses/hides.

## 4. When It Appears

| Scenario | Behavior |
| --- | --- |
| First sign-in after creating username (`/auth/username` → `/app`) | Show card, step 1 already checked. |
| Returning creator, required steps incomplete, not dismissed within last 7 days | Show card with current progress. |
| Returning creator, all required steps complete | No card (or collapsed success banner; see §7, state C). |
| Creator dismissed the card < 7 days ago | No card until the 7-day window lapses. |
| Existing creators who created profiles before this feature ships | Default `dismissedAt` is set at first load so nobody who already has a profile is suddenly shown onboarding. |

Detection logic (frontend, `localStorage` key `supportme:onboarding`):

```js
{
  version: 1,
  dismissedAt: null | ISO string,   // set when user hits ✕
  shareSeen: false,                 // set when link copied/shared or Share card opened
}
```

"Has an existing profile" test is `hasProfile === true` from
`/api/auth/verify` (already returned by `loginWithWallet()`).

## 5. Checklist Steps

Order matters — each step references the page that already implements it:

| # | Step | Required | "Done" definition | Destination link |
| --- | --- | --- | --- | --- |
| 1 | Connect your wallet | Required | Already true by the time they reach `/app`; shown as checked | — |
| 2 | Set your username | Required | Username created at `/auth/username`; shown as checked | `/auth/username` (only reachable pre-profile) |
| 3 | Set a monthly goal | Required | `creator.donationGoal > 0` | `/settings` (field: "Monthly goal") |
| 4 | Get your share link & QR | Required | Copied/shared profile link or opened Share/QR card once | `/dashboard` → **Share** button (ShareCard + QR) |
| 5 | Connect your payout wallet | Optional | `creator.walletAddress` present | `/settings` (wallet section) |

All steps are links (`<a>`) so the card still works without JavaScript.

## 6. Visual Design

Uses the existing neobrutalism system (`app/globals.css`): hard `2px` ink
borders, `rounded-xl`, `box-shadow: 4px 4px 0 0 #0a0a0a`, flat fills, tokens
`ink #0a0a0a`, `background #fdfcf7`, `primary #7c3aed`, brand fills.

### A. Card — default (incomplete) state

Shown inside the `/app` hub, above the "Your profile" block, full content width.

```
┌──────────────────────────────────────────────────────────────┐
│  Welcome! Let's get you set up.                    [ ✕ ]      │  <- header row
│  Complete the 4 steps below to start receiving tips.         │
│                                                              │
│  ● 3 / 4  [██████████░░░░░░░░]                                │  <- progress
│                                                              │
│  ✓  Connect your wallet             connected                 │  <- step rows
│  ✓  Set your username               @my_handle                │
│  →  Set a monthly goal              Go to settings   →        │  <- active step
│  ○  Get your share link & QR        Open dashboard    →       │
│  ◌  Connect payout wallet (opt.)    Go to settings    →       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Step row states

| Glyph | State | Style |
| --- | --- | --- |
| `◌` | Pending | `text-muted`, chevron link right; copy = step title + destination |
| `→` | Active (next incomplete) | Bold `text-ink`, destination highlighted, on a `bg-brand-yellow` band so the eye lands on "do this next" |
| `✓` | Complete | `text-ink` with a filled check, sub-copy shows the achieved value (@handle / goal amount, bold) |

### B. Card — mobile / narrow

Below `640px` the card stacks: header above progress, one step per row (already
how the layout reads). The ✕ stays top-right and is a 40×40px hit target
(minimum touch size). Progress bar fixed height 12px.

### C. Success state (all required steps done)

Replaces the checklist with a one-line banner, still dismissible:

```
┌──────────────────────────────────────────────────────────┐
│  🎉 You're all set! Share your link to get your first tip │  [ ✕ ]
└──────────────────────────────────────────────────────────┘
```
Auto-collapses (hides) after the creator dismisses or clicks the link.

## 7. Behavior & Dismissal

| Event | Behavior |
| --- | --- |
| Click a step | Navigate to the step's page (native link). |
| Click ✕ | Hide card; write `dismissedAt = now` to localStorage; card hidden for 7 days. |
| Step completes elsewhere (e.g. goal saved in settings) | On return to `/app`, card re-derives progress and re-renders with that step checked. |
| All 3 required steps complete | Switch to success state (§6.C). Card is no longer shown on later sessions. |
| Animated transitions | Optional: `transition-all duration-100` matching `.btn-brutal` feel; progress bar width animates. No entrance/exit animation library needed. |

Props for the component (handoff):

```tsx
interface OnboardingChecklistProps {
  creator: { username: string; donationGoal: number | null; walletAddress: string | null };
  storage: OnboardingStorage;            // from localStorage, see §4
  onDismiss: () => void;                 // persists dismissedAt
  onShareSeen: () => void;               // called when share link copied/shared or Share card opened
}
```

## 8. Copy Spec

| Element | Copy |
| --- | --- |
| Header | "Welcome! Let's get you set up." |
| Subcopy | "Complete the steps below to start receiving tips." |
| Progress | "3 / 4" with bar; screen-reader label `aria-label="3 of 4 steps complete"`. |
| Step: wallet | done sub-copy: "connected" |
| Step: username | done sub-copy: `@handle` |
| Step: goal | pending/active sub-copy: "Go to settings" |
| Step: share | pending/active sub-copy: "Open dashboard"; done sub-copy: "Link ready" |
| Step: payout | optional — sub-copy: "Go to settings" |
| Success | "You're all set! Share your link to get your first tip." |

## 9. Accessibility

- The card is a real `<aside>`/`<section>` with `role="region"` + a labelled heading.
- ✕ button has `aria-label="Dismiss onboarding"`.
- Progress is conveyed to screen readers (progressbar role or text equivalent).
- Active step is focusable and keyboard-accessible (`tabIndex={0}` + Enter/Space).
- Colour is not the only differentiator (glyphs + bold, per the existing system).

## 10. Acceptance Criteria Map

| Acceptance criterion | Where covered |
| --- | --- |
| A designed onboarding flow exists covering the key first-run actions | §5 (steps) — set username, set goal, get share link/QR, payout wallet |
| Design specifies how progress is shown | §5, §6.A progress bar + n of N counter |
| Design specifies how a creator exits/dismisses it | §6 (✕), §7 (dismissal/7-day window), success auto-hide |

## 11. Implementation Checklist (frontend handoff)

- [ ] Add `frontend/components/OnboardingChecklist.tsx` implementing §6/§7.
- [ ] In `frontend/app/app/page.tsx`, derive `show` using §4 logic and render the card above "Your profile".
- [ ] Fire `onShareSeen` from `copyProfile`/`shareProfile` (`app/app/page.tsx`) and from the `ShareCard` modal toggle (`app/dashboard/page.tsx`).
- [ ] No backend, Prisma, or contract changes. Completion is derived from existing `creator` fields + two localStorage flags.