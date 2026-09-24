# Embeddable Donation Widget — Design Spec

Status: **Design / Handoff-ready** · Owner: UI/UX · Consumers: `frontend/` (Next.js)

Tracks issues: **#22** — *UI/UX: Design embeddable donation widget*

---

## 1. Problem & Goal

Creators currently accept donations only via a shareable link. The README
Roadmap calls for **embeddable donation widgets** so creators can accept
donations directly on their own site. This spec designs:

1. the widget itself — its visual states (default, loading, success, error) at a
   small, embeddable size, in light and dark themes and constrained widths;
2. the creator-facing embed/setup flow (how a creator gets their embed snippet);
3. everything in a form the frontend team can implement directly from.

## 2. Design Decisions (short version)

1. **Single self-contained iframe.** The widget is one `<iframe>` pointing at a
   public embed route (`/{username}/embed`). The iframe isolates the third-party
   site's CSS/JS from ours (and vice versa) so it renders predictably anywhere.
2. **Small, column-first layout.** Optimal width **280px**, min **240px**, max
   **360px**. Content stacks vertically (header → amount row → asset/memo →
   donate button → link-out), so it survives arbitrary container widths.
3. **Tokens, not hard-coded styles.** The iframe shell is styled with CSS custom
   properties passed via a scoped stylesheet; the same component renders dark
   and light from a `theme` query param (defaults to the site's `prefers-color-scheme`).
4. **No recurring donations in v1 of the widget.** Scope = one-off tips (XLM or
   USDC) so the states stay small and testable.
5. **Security first**: `sandbox` iframe attribute, no `allow-same-origin` cookie
   access needed beyond the widget's own origin, and the snippet supports an
   optional fixed size; no autoplay of transactions.

## 3. The Embed Snippet

One `<script>` + one line of HTML the creator pastes. Implementation detail for
frontend: the snippet boots a tiny loader that injects the iframe:

```html
<!-- Paste this where you want the widget -->
<div data-supportme-widget="my_handle" data-theme="auto" data-size="280"></div>
<script
  src="https://support-mee.vercel.app/widget.js"
  data-username="my_handle"
  data-theme="auto"
  defer
></script>
```

The loader builds:

```html
<iframe
  src="https://support-mee.vercel.app/my_handle/embed?theme=auto&asset=XLM"
  title="Support my work"
  loading="lazy"
  width="280"
  height="420"
  frameborder="0"
  scrolling="no"
  sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
></iframe>
```

### Embed options (query params)

| Param | Values | Default | Notes |
| --- | --- | --- | --- |
| `theme` | `light` / `dark` / `auto` | `auto` | `auto` = match `prefers-color-scheme` inside the iframe |
| `asset` | `XLM` / `USDC` | `XLM` | Only if creator accepts that asset |
| palette overrides | `bg`, `accent`, `ink` (hex) | design tokens | For creators embedding on branded sites |

Sizes: single "width" knob (240–360). Height is fixed per state so the iframe
doesn't jump (≈420px default, ≈180px for success/error states — see §6
`resize-iframe` message).

## 4. Visual Design & Tokens

Mirrors the neobrutalism system but **reduced** for a 280px canvas: 2px ink
borders, `rounded-xl`, 3px offset shadow, flat fills. YouTube-comparable visual
recognition: small, but unmistakably SupportMe.

CSS custom properties set on the iframe document root:

```css
:root[data-theme='light'] {
  --w-bg: #ffffff;      --w-panel: #fdfcf7;   --w-ink: #0a0a0a;
  --w-muted: #57534e;   --w-accent: #7c3aed;  --w-border: #0a0a0a;
  --w-success: #b4f461; --w-error: #ff9db1;   --w-lime: #b4f461;
}
:root[data-theme='dark'] {
  --w-bg: #101014;      --w-panel: #0a0a0a;   --w-ink: #fdfcf7;
  --w-muted: #a8a29e;   --w-accent: #a78bfa;  --w-border: #fdfcf7;
  --w-success: #b4f461; --w-error: #ff9db1;   --w-lime: #b4f461;
}
```

## 5. Visual States

### 5.1 Default

```
┌──────────────────────────────┐   width 280 × height ~420
│  ⚡ Support my work           │   label band, flat, bold 12px
│  ┌──────────────────────────┐ │
│  │  • • •                   │ │   mini tip-jar / avatar mark (32px) — creator avatar
│  └──────────────────────────┘ │
│  @my_handle                   │   creator handle, 14px bold
│  Goal  12.5 / 50 XLM     ●●●░ │   optional goal bar (only if creator set a goal)
│  Amount   [ 5 ]  ( XLM ▾ )    │   preset chips: 1 / 5 / 10 / custom
│  [ Leave a note… ]            │   optional memo input
│  ┌──────────────────────────┐ │
│  │      DONATE 5 XLM         │ │   primary CTA, accent fill, full-width
│  └──────────────────────────┘ │
│  Secured by SupportMe · powered by Stellar · [Open ↗] │  footer, 10px
└──────────────────────────────┘
```

### 5.2 Loading (transitional state for any async step: simulate, sign, submit)

```
┌──────────────────────────────┐
│  ⚡ Support my work           │
│  ┌──────────────────────────┐ │
│  │   (28px skeleton block)  │ │   pulsing skeleton
│  └──────────────────────────┘ │
│  @my_handle                   │
│  Amount [ 5 ] ( XLM ▾ )       │
│  ┌──────────────────────────┐ │
│  │   Checking your wallet…   │ │   CTA swap → spinner + status text
│  └──────────────────────────┘ │
└──────────────────────────────┘
```

Status copy ladder (from the existing donation flow):
`Preparing transaction…` → `Waiting for wallet approval…` →
`Submitting…` → `Confirming on the network…`

### 5.3 Success

```
┌──────────────────────────────┐   height shrinks to ~180
│  ┌──────────────────────────┐ │
│  │   5 XLM  sent to @my_handle │ │   success fill (lime), bold 16px
│  └──────────────────────────┘ │
│  Thank you for supporting!    │   support line
│  [ 0xabc…def ] (link, 10px)   │   tx hash → stellar.expert
│  [ Back ]                     │   secondary → returns to Default
└──────────────────────────────┘
```

### 5.4 Error

```
┌──────────────────────────────┐   height shrinks to ~180
│  ┌──────────────────────────┐ │
│  │  //  Payment failed       │ │   error fill (brand-pink), bold 16px
│  └──────────────────────────┘ │
│  <specific, actionable copy>  │   see §7 error copy table
│  [ Try again ]   [ Cancel ]   │   retry = re-runs the failed step in-place
└──────────────────────────────┘
```

Error copy reuses the wallet-error categorization contract
(`frontend/lib/walletErrors.js`) so the widget and the site show **the same**
messages: no-wallet → install links (as small inline links, not a full list);
user-rejected → "resume when ready"; wrong-network → "switch to testnet".

## 6. Responsive / Constrained-Width Behavior

| Width | Behavior |
| --- | --- |
| ≥ 320px | Preset chips + memo on one row; goal progress full width. |
| 240–319px | Vertical stack (chips wrap), memo below amount, everything 100% width; footer trims "Secured by SupportMe" → "Powered by Stellar". |
| < 240px | Loader refuses to render (shows one-line fallback linking to the profile page). |
| Text scale (200% browser zoom) | Layout must not overflow horizontally; `overflow-wrap: anywhere`. |

Height jumps between states (default ≈420 vs success/error ≈180) are handled by
a `window.parent.postMessage({ type: 'resize-iframe', height })` from inside the
iframe; the loader applies it to the iframe's `height` so embedded pages never
show scrollbars or dead space.

## 7. Widget Error-to-Copy Map

| Case | Copy | Action |
| --- | --- | --- |
| No wallet installed | "We can't find a Stellar wallet. Install Freighter or xBull, then retry." | [Freighter ↗] [xBull ↗] inline links → `Try again` |
| User rejected | "The payment was declined in your wallet. No funds were moved." | `Try again` (no reload needed) |
| Wrong network | "Your wallet is on the wrong network. Switch to the Stellar testnet." | `Try again` |
| Simulation/insufficient funds | "This amount isn't available in your wallet right now." | Edit amount → `Try again` |
| RPC/network failure | "The network didn't respond. This usually resolves in seconds." | `Try again` |

## 8. Creator-Facing Embed Setup Flow

Deliverable: one new modal from the creator's dashboard, reachable next to the
existing **Share** button.

### Flow

1. Dashboard (`/dashboard`) → **Share** card → new tab/section **"Embed widget"**.
2. The modal shows a **live preview** updating instantly from the controls.
3. Controls:
   - **Theme**: Light / Dark / Auto (radio pills).
   - **Asset**: XLM / USDC (only assets the creator accepts).
   - **Size**: 240 / 280 / 320 (width preview scale).
   - **Show goal**: toggle (only if `donationGoal` is set).
   - **Accent colour**: preset swatches (violet primary / brand fills).
4. **Copy code** button copies the tag snippet (§3) to the clipboard with the
   chosen params baked into the attributes. Toast confirm ("Copied to clipboard") +
   link to "see how to add it to your site" (CMS steps for Wix/WordPress/Squarespace
   in plain text).
5. Always-present "Open preview ↗" link opens the widget route in a new tab.

### Setup flow mock

```
┌──────────────────────────────────────────────┐
│  Embed widget                     [ ✕ ]        │
│  ┌────────────┐  Theme   ○Light ○Dark ●Auto   │
│  │            │  Asset   ● XLM  ○ USDC        │
│  │  LIVE      │  Width   [240] [280] [320]    │
│  │  PREVIEW   │  Show goal  [✓]  Accent [███] │
│  └────────────┘                               │
│  ┌──────────────────────────────────────────┐ │
│  │ <div data-supportme-widget=…>…</div>      │ │
│  │ <script src=…widget.js… defer></script>   │ │
│  └──────────────────────────────────────────┘ │
│  [ Copy embed code ]        [ Open preview ↗ ] │
└──────────────────────────────────────────────┘
```

## 9. Acceptance Criteria Map

| Acceptance criterion | Where covered |
| --- | --- |
| A clear design spec exists for the widget itself | §3–§7 (states, tokens, sizes, errors) |
| …and the creator-facing embed setup flow | §8 (modal flow + mock) |
| Designs account for constrained/small sizes | §5 wireframes (280px), §6 responsive rules |
| Handed off in a form frontend can implement directly | §11 implementation checklist, §3 snippet, §4 tokens |

## 10. Non-Goals (v1)

- Recurring/subscription payments inside the widget.
- Custom fonts; the widget always uses the geist sans stack.
- Food/theme chromes beyond the 6 accent swatches.
- Autoplay or auto-submit of transactions.

## 11. Implementation Checklist (frontend handoff)

- [ ] Route: `frontend/app/[username]/embed/page.tsx` (SSR/public) rendering the widget client component at `?theme`/`asset`.
- [ ] Component: `frontend/components/embed/DonationWidget.tsx` implementing §5 states + §6 responsive rules, reusing `lib/contract.js` `sendDonation` and `lib/walletErrors.js` copy.
- [ ] Loader: `frontend/public/widget.js` (or `app/widget/route`) injecting the iframe, listening for the `resize-iframe` postMessage, enforcing width clamp 240–360.
- [ ] `postMessage` resize bridge for §6 height changes.
- [ ] Dashboard embed modal: extend `ShareCard` (or sibling modal) with §8 controls + code-preview + copy.
- [ ] No backend/schema changes required for v1 widget (public profile data + donation flow already exist).