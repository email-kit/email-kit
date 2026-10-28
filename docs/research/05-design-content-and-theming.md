# 05 — Email design, content, components and theming

**Scope.** This file covers layout and visual design, typography, colour, images, mobile, CTAs, copy and content, transactional email patterns, internationalisation, the plain-text part, design tokens and theming (W3C DTCG, Style Dictionary, shadcn/ui and Tailwind v4), and the email component inventory. Per-client CSS support and dark-mode client internals are covered by other slices. They are cited here (mostly from caniemail) only where a design decision depends on them.

**Verified:** 2026-10-27. Package versions were checked on the npm registry that day: `react-email` 6.11.3, `mjml` 5.4.1, `@maizzle/framework` 6.3.0, `jsx-email` 3.2.1, `style-dictionary` 5.7.1, `tailwindcss` 4.3.3 and `shadcn` 4.22.1. caniemail figures come from its raw data files on GitHub. Each feature has its own last-tested date, noted where it matters.

**How to read the tables**

| Column | Meaning |
|---|---|
| **Level** | What the framework should do: **MUST** / **SHOULD** / **MAY**, either as a *default* (built into components and the theme) or as a *check* (lint, theme validation or a render test). |
| **Ev.** | Strength of the evidence. **E**: measured (a study, test data or computed). **S**: a spec, standard or platform's own documentation. **C**: convention or expert consensus. **F**: folklore, with weak or contrary evidence. |
| Markers | **Δ** changed in 2024–2026. **⚠** contradicts or refines the reference docs (`email-package-1` = P1, `email-package-2` = P2). |
| **Src** | Short IDs (S1–S104) for rows in the **Sources** table at the end. |

---

## 0. At a glance

### 0.1 What changed in 2024–2026

| Date | Change | Consequence for the framework | Src |
|---|---|---|---|
| 2024-02 / 2025-05 | Gmail and Yahoo bulk-sender rules (one-click unsubscribe plus a visible unsubscribe link in the body for marketing mail). Microsoft's Outlook.com rules followed in May 2025. | Lifecycle and marketing templates need both the footer link and the RFC 8058 headers. | S73 S75 S100 |
| 2024-10 → | Apple Intelligence summaries (iOS 18.1, macOS 15.1) can replace preview text. Gmail (Gemini) and Yahoo summaries are opt-in or limited. | The preheader is less reliable. The subject and the **first visible sentence** must carry the message. | S57 |
| 2024-12 | Apple Mail categories (Primary, Transactions, Updates, Promotions) and Branded Mail (a sender logo through Apple Business Connect). | The inbox logo comes from BIMI or Branded Mail, not from the HTML. Keep transactional mail free of promotional content. | S84 |
| 2025-01/02 | Tailwind v4 uses an OKLCH palette and CSS-first `@theme`. shadcn/ui moved to Tailwind v4 and OKLCH. | Design-system colours now arrive as `oklch()` and CSS variables. The framework must resolve them, gamut-map them and write hex. | S12 S17 |
| 2025-06-28 | The European Accessibility Act applies to EU consumer e-commerce services. | Accessibility checks become a compliance concern for receipts and other e-commerce mail (whether email is in scope depends on interpretation; seek legal advice). | S96 |
| 2025 | NIST SP 800-63B-4 final. Account recovery **SHALL** trigger a notification. A new authenticator **SHALL** be notified through an independent channel. | Gives a standards basis for the security-alert templates. | S81 |
| 2025-09/10 | Outlook on the web and the new Outlook for Windows stopped rendering inline SVG images. | Confirms P1's "no SVG" rule (see ⚠4 for the corrected rationale). | S39 |
| 2025-10-28 | **DTCG Format, Color and Resolver modules 2025.10** published as a Final Community Group Report, "considered stable". | Use as the token interchange format. Model modes and brands with resolver *modifiers*. | S1–S5 |
| 2025-11 | React Email 5: Tailwind 4 and a dark-mode switcher in the preview that emulates client inversion. | Prior art for the studio. | S41 S42 |
| 2025-12 / 2026-04 | `npx shadcn create` styles (Vega, Nova, Maia, Lyra, Mira, then Luma, Sera and Rhea) and `shadcn preset` / `apply` commands. | Themes are now presets plus registry items with `cssVars.light/dark/theme`. The framework can read them. | S13–S15 |
| 2025–2026 | Style Dictionary 5.3, 5.4 and 5.7 added DTCG 2025.10 colour objects (with CSS Color 4 gamut mapping), dimension objects and duration. There is still no resolver support. | Style Dictionary works as a transform engine. Resolver handling needs Terrazzo or our own code. | S6–S9 |
| 2026-04 | React Email 6: one `react-email` package. 6.3.3 added `<Tailwind theme="…css">` (CSS-first). Its Tailwind pipeline resolves CSS variables and `calc()` and converts `oklch()` to `rgb()` by per-channel **clamping**. | Prior art. We should gamut-map rather than clamp, and write hex. | S43 |
| 2026 | Maizzle 6 (Vite, Vue, Tailwind 4) lowers `oklch()` to hex and resolves CSS variables at build time. MJML 5.x adds `gutter` on `mj-section` and turns `mj-include` off by default. | Prior art. | S45–S48 |
| 2026-09 | Gmail for Android and iOS shows a **"Copy code"** chip under the subject of verification emails. caniemail (2026-09) records Gmail rasterising linked SVG to PNG. | The OTP must be machine-findable plain text. Linked SVG is no longer a total blank in Gmail, but it is still unsafe. | S82 S34 |

### 0.2 Where findings contradict or refine the reference docs

| # | Reference claim | Finding | Recommendation | Src |
|---|---|---|---|---|
| ⚠1 | P1: "weights 400 / 500 / 600 only; 700 synthesises faux bold" | Backwards. Outlook for Windows renders 0–599 as **normal** and 600–1000 as **bold**. Arial and Helvetica (the usual fallbacks) have only 400 and 700, and CSS font matching maps 500 to 400 and 600 to 700. Faux bold appears only when a family has **no** bold face, and every system stack font has one. | Default weights are **400 and 700**. Allow 600 only as a brand-font refinement, documented as rendering 700 in fallbacks and in Outlook. | S28 S19 |
| ⚠2 | P1: "16 px avoids iOS auto-zoom" | That rationale applies to focused form inputs in Safari. iOS Mail's own behaviour is to **enlarge text below 13px**. 16px is still the right body size (it is the most common size in real emails, and Litmus sets a 14px floor). | Keep 16px. Correct the rationale. Add a minimum-size check (≥ 14px for any text, ≥ 13px absolute). | S66 S65 S68 |
| ⚠3 | P1: "No web fonts; system stack only" | Stricter than the evidence requires. Web fonts work in Apple Mail, iOS Mail, Thunderbird and Samsung (non-Microsoft accounts). Gmail and Outlook ignore them. Outlook classic falls back to Times New Roman unless an MSO override is present. | Default to the system stack. Offer web fonts as an opt-in **MAY** that always emits the MSO override. Warn about the privacy cost (a third-party request). | S30 S99 |
| ⚠4 | P1: "SVG blocked across major clients since late 2025" | Right conclusion, imprecise rationale. Microsoft retired *inline* SVG in OWA and new Outlook in September–October 2025. Gmail never rendered SVG and since 2026-09 rasterises linked SVG. Apple Mail, Yahoo, AOL and Outlook.com render linked SVG. | Keep "no SVG" as a **MUST** check. Ship logos as 2× PNG. | S34 S35 S39 |
| ⚠5 | P2: the long pseudo-language makes every message "at least 40% longer" | W3C and IBM data: strings of 10 characters or fewer grow **200–300%**, 11–20 characters 180–200%, and over 70 characters about 130%. A flat 40% under-tests buttons, subjects and badges, which are exactly the strings that break layouts. | Scale pseudo-locale expansion by length, add brackets and accents (Android `en-XA` style), and add an RTL pseudo-locale (`ar-XB` style). | S88 S103 |
| ⚠6 | P2: `<CodeBox>` uses an `aria-label` | WAI-ARIA 1.2 says authors **MUST NOT** use `aria-label` on roles that cannot be named, which includes `generic` (plain `div` and `span`). Screen readers often ignore it there. | Put the code in a sentence, as real text ("Your code is 482917"). If spaced digits are needed for speech, give them an element with a nameable role or visually hidden text. Never use `aria-label` alone on a `div`. | S92 |
| ⚠7 | P1: "text part hand-written" versus P2: `toPlainText()` | Both have merit. Stripping rendered HTML leaves debris (P1 is right about that). Hand-writing drifts from the HTML. | Generate the text part from the **component tree**: each component has a text renderer (tables become `Label: value`, buttons become `Label: <URL>`). Allow a per-template hand-written override. Lint both. | S76–S78 |
| ⚠8 | P1 roles: light `pageGround` ≠ `#ffffff`. Mid-tone band `#707070`–`#909090` banned. | shadcn's defaults: light `--background` is `#ffffff`, light `--muted-foreground` is `oklch(0.556 0 0)` = **#737373**, and dark `--ring` is #737373. **A default shadcn theme fails P1's `tokens.midtone` check.** | Keep the checks. The role mapper must choose the page ground from a non-white token and offer a documented muted-ink adjustment (for example #6b6b6b, which still clears 4.5:1 on white). | S12 (computed) |
| ⚠9 | P1 and P2: hex is enough | shadcn's dark `--border` and `--input` use **alpha** (`oklch(1 0 0 / 10%)`). Outlook for Windows has no `rgba`. Gmail strips the **whole style attribute** when it meets space-separated `rgb()` syntax. | Flatten alpha against the surface the colour sits on (the dark border becomes #222222 on #0a0a0a) and always write 6-digit hex. | S12 S22 S23 |
| ⚠10 | P1 example: code in the subject by default | This is a trade-off, not a default. The code shows on lock screens and in notification previews. Gmail's "Copy code" chip (2026) and iOS Mail AutoFill (iOS 17) now read the code from the body. | Make code-in-subject an explicit per-template opt-in (**MAY**). Never repeat the code in the preheader (P1 is right). | S82 S83 |

---

## 1. Layout and visual design

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| Fluid container: `width:100%` with `max-width` 600px by default. Allow 480–640. Warn above 640. Outlook gets a fixed ghost-table width equal to the max-width. | 600–640 is the industry range. Some webmail truncates at 650px or more. A fluid width needs no media query. | SHOULD · default | theme: `layout.container ∈ [480,640]`, warn > 640 | C | S97 P1 P2 |
| Single column by default. Use 2–3 columns only for small repeated items (product cards, stats) and **stack** them below about 480–600px. | Mobile-first. Multi-column text hurts reading order and is fragile in Outlook. | SHOULD · default | lint: columns > 3 → warn | C | S45 |
| Horizontal gutters: 16–24px on mobile, 24–40px on desktop (P1 uses 32px). Put spacing on cell **padding**, not margins. | Outlook's Word engine handles margins unreliably. Padding is the portable spacing primitive. | SHOULD · default | theme | C | P1 |
| A 4px-based spacing scale (0, 4, 8, 12, 16, 24, 32, 40, 48, 64) with semantic aliases (`stack.sm/md/lg`, `section`, `gutter`). | One scale keeps rhythm consistent across components and matches Tailwind's `--spacing: 0.25rem` model. | SHOULD · default | theme: every spacing value comes from the scale | C | S17 |
| Modular order: preheader → header (logo or wordmark) → **h1** → lead sentence → body → one primary CTA → secondary details (table, key-values) → footer. | Users want the outcome first. NN/g: "succinct and informative", with the most important content first. | SHOULD · default (layout) | — | E | S72 P2 |
| Keep the section count low (P1: each `mj-section` costs about 2.5KB). | Section count drives HTML weight towards Gmail's roughly 102KB clip. | SHOULD | size checks (other slice) | E (P1) | P1 |
| Header: a small logo or wordmark, start-aligned or centred, no navigation in transactional mail. | Navigation adds tap targets and weight without helping the task. | SHOULD · default | — | C | S72 |
| Body text line length 50–75 characters (at 16px system sans in a 600px container with 32px gutters, that is about 70–80 characters). Use the max-width to cap it. | Baymard: 50–75 is optimal. Longer lines feel intimidating. | SHOULD · default | — | E | S67 |
| **Start-align body copy** (left in LTR, right in RTL). Centre only headings, short captions and CTAs. | In Style Campaign's sample (2015), about 75% of emails left-aligned body text, and the author's testing found centred paragraphs harder to read. | SHOULD · default | lint: centred paragraphs > 3 lines → warn | E (small n) | S66 |
| One `<h1>` (the email's title). Use `<h2>`/`<h3>` for sections without skipping levels. Don't force an h1 into a 2-line note. | Screen-reader users jump to the h1. WebAIM survey: 60% prefer a single h1 holding the document title. | MUST · check (`html.one-h1`) | P1 check | E | S61 P1 |
| Wrapper `<div role="article" aria-roledescription="email" aria-label="{subject}" lang dir>`. Layout tables get `role="presentation"`. Data tables don't. | Puts the email in the screen reader's landmarks. Webmail strips `<html>`, so `lang` and `dir` must be repeated on the wrapper. | SHOULD · default | lint | S/C | S59 |

## 2. Typography

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| Body 16px with a 24px line height (1.5). Use ≥ 14px for any text and ≥ 13px absolutely. | 16/24 is the most common pairing in real emails. Litmus: 14px minimum and line height 1.5–2× the size. iOS Mail enlarges text below 13px. Apple's own UI default is 17pt (11pt minimum). | MUST (min) · SHOULD (16) | theme: `type.*.size ≥ 14`; lint: inline sizes < 14 → warn | E/S | S65 S66 S68 S53 ⚠2 |
| Headings on a ~1.2–1.33 ratio: h1 24–32px (P1: 24/32), h2 20–24px, h3 18px, line height 1.2–1.35. | Real emails use headings about 2× the body size. Transactional mail reads better slightly smaller. | SHOULD · default | — | E/C | S66 P1 |
| Line height in **px** plus `mso-line-height-rule:exactly` on raw cells. | Word ignores unitless line heights. A px line height keeps the rhythm. | MUST · default | P1 check | S | P1 |
| **Weights 400 and 700.** Treat 500/600 as brand-font refinements that render 400/700 in fallbacks and Outlook. | caniemail: Outlook for Windows treats 0–599 as normal and ≥ 600 as bold. Yahoo accepts only multiples of 100. CSS font matching rounds missing weights. | SHOULD · default; check `type.weight ∈ {400,700}` else warn | theme | S | S28 S19 ⚠1 |
| Default sans stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Serif: `Georgia, "Times New Roman", serif`. Mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace`. Always end with a generic family. | Each client resolves its native UI font. Gmail web renders Arial (it can only use Roboto and Google Sans because they ship with its own styles). | SHOULD · default | theme: stack ends in a generic family | C/S | S30 P1 |
| Outlook fallback: an MSO-only style that forces `font-family: Arial, sans-serif` (or Segoe UI) on all elements. With web fonts, also set `mso-font-alt`. | Word falls back to Times New Roman when the first family is unknown or comes from `@font-face`. Classic Outlook stays supported until at least 2029, so Word-engine rules stay in force. | MUST · default | `html.mso-font` (P1) | S | S30 S95 P1 |
| Web fonts: opt-in only (`<link>` or `@font-face` in the head), with a metric-compatible fallback. Never for codes, numbers or legal text. | Supported in Apple Mail, iOS, Thunderbird and Samsung (non-Microsoft accounts) only. Each font adds a third-party request. | MAY | lint: web font without fallback or MSO override → error | S | S30 S99 ⚠3 |
| `letter-spacing` in **px**, 0 for body text. Use small positive tracking (0.5–1px) for all-caps eyebrows and 2–8px for OTP digits. Avoid large negative values. | Outlook renders `em` letter-spacing too small and large negative values wrongly. | SHOULD · default | theme: letter-spacing unit = px | S | S29 |
| Avoid all caps for sentences. Use sentence case for headings and buttons (P2 rule, glossary exceptions). | Readability and consistency. Sentence case is the dominant UI style-guide convention, though there are no strong controlled studies. | SHOULD · check | copy lint (see §16.3) | C | P2 |
| Respect the user's font size where possible: optionally `font-size:medium; font-size:max(16px,1rem)` on the wrapper (goodemailcode). Keep px as the base for Outlook, Yahoo and AOL, which don't support `rem`. | Lets people with larger preferred text get it. `em` and `rem` don't work in attributes or VML. | MAY · default (opt-in) | — | S | S60 S27 |
| Numbers in tables: right-align (start/end-aware) and don't rely on `font-variant-numeric`. | Gives alignment without needing support for tabular figures. | SHOULD · default | — | C | — |
| Optionally prevent single-word widows in headings with `&nbsp;` between the last two words (Maizzle ships `<NoWidows>`). | A visual polish for short headings. | MAY | — | C | S48 |

## 3. Colour and branding

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| Write every colour as **6-digit hex**: no `var()`, no `oklch()`/`lch()`, no space-separated `rgb()`, no alpha. | CSS variables: no support in Outlook, Yahoo or AOL, and Gmail supports `var()` but not declarations. `oklch()` inline in Gmail **removes all inline styles on the element**. Space-separated `rgb()` makes Gmail strip the whole style attribute or block. | MUST · check (`html.banned-css`) | P1 check, extended | S | S20 S21 S22 S23 ⚠9 |
| Contrast: ≥ 4.5:1 for normal text and links, ≥ 3:1 for large text (≥ 24px, or ≥ 18.66px bold) and for UI boundaries (button fill against canvas, unless the button has a border). Check in **light, authored dark and force-inverted light** (P1). | WCAG 1.4.3 and 1.4.11. Forced inversion is what many readers actually see. | MUST · check (`tokens.contrast`) | theme validation | S | S56 P1 |
| Colour is never the only carrier of meaning (status gets text and an icon). | WCAG 1.4.1, and inversion shifts hues. | MUST · check (component design) | — | S | S56 P1 |
| Separate **brand fill** from **brand ink**: `brand` (a surface), `onBrand` (its label) and `brandInk` (a text-safe variant on the canvas). | Brand yellows, cyans and light greens usually fail as text on white. One "primary" can't serve both jobs. | SHOULD · default | theme: `brandInk`/canvas ≥ 4.5 | E (computed) | S12 |
| Light page ground ≠ #ffffff and dark ground ≠ #000000. Keep text and rule colours out of the #707070–#909090 band (P1). | Inversion maths (P1). Material also recommends #121212-ish dark surfaces rather than black. | SHOULD · check | P1 `tokens.*` | C | P1 S71 ⚠8 |
| Gradients: decoration only. Always set a solid `background-color` fallback. Classic Outlook needs VML. | No support in Outlook for Windows, Yahoo or AOL. Gmail is buggy when the gradient is inline in `background-image` (2025-04). | MAY | lint: gradient without solid fallback → error | S | S25 |
| Shadows: decoration only. Use borders or surface changes for separation. | `box-shadow` has no support in Gmail web, Outlook for Windows or Yahoo, and only partial support in the Gmail apps. | MAY | lint: shadow carrying meaning → n/a, warn | S | S24 |
| Border radius: fine, but the design must still read with **square** corners (Outlook for Windows). Use VML `roundrect` only for the primary button. | `border-radius` is supported widely except Word. Yahoo and AOL don't support the elliptical `/` syntax. | SHOULD · default | theme: radius single value in px | S | S26 |
| No `opacity`. Flatten translucent colours at build time. | No support in Outlook for Windows. | MUST · check | `html.banned-css` | S | S23 |
| Dark palette (token level): lift surfaces (#0a0a0a–#1a1a1a canvas, a lighter card), **lighten and desaturate** brand hues (Material uses 200–50 tones), recheck every pair, and keep hierarchy by lightness rather than shadow. | Saturated colours "vibrate" on dark surfaces. Shadows are invisible on dark. | SHOULD · default | theme: dark pairs contrast | C/S | S71 S70 |

## 4. Images and logos

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| The email must work with **images off**: every essential word, number and CTA is live text. | Outlook blocks images by default, and privacy settings block them elsewhere. AI summaries ignore text inside images. | MUST · check | render test with images stripped: h1, CTA and key facts still present | S | S57 P1 |
| Every `<img>` has `alt` (empty when decorative), an explicit `width` (and `height`), `display:block`, `max-width:100%` and `height:auto`. | A missing width breaks Outlook. A missing alt is read as the file name. | MUST · check (`html.img-alt-width`) | P1 check | S | S91 P1 |
| Alt text follows the W3C decision tree: decorative → `alt=""`; text in the image → repeat the text; image inside a link → describe the destination or action; informative → a brief description. Keep it under about 125 characters by convention. | Accessibility. Alt text is also what renders when images are blocked. | MUST (present) · SHOULD (quality) | lint: alt equals the file name, or "image of…" → warn | S | S91 |
| Supply the source image at **2×** the display width, with the HTML `width` set to the display size. | Retina sharpness without layout shift. | SHOULD · default | lint: intrinsic width < 2× attribute → warn (when known) | C | S97 |
| Formats: JPEG for photos, PNG for logos and flat art, GIF for animation. Avoid WebP and AVIF. **No SVG.** | Outlook for Windows supports neither WebP nor AVIF. Gmail converts them to JPG/GIF. SVG: see ⚠4. | MUST (no SVG) · SHOULD (formats) | `html.no-svg`; lint: `.webp`/`.avif` → warn | S | S34–S38 S39 |
| Image weight: aim for ≤ 150–200KB per hero and about 1MB total. These budgets are vendor heuristics, not standards. The Gmail clip counts **HTML only**, not images. | Mobile data and load time. | SHOULD · check (warn) | asset-size lint (warn) | C | S97 |
| **The "60/40 image-to-text ratio" is folklore.** Email on Acid (2014, 64 emails, 23 filters): with ≥ 500 characters of text, image count made no difference to filtering. Very short emails were flagged with or without images. | Avoid image-only emails, but don't enforce a ratio. | SHOULD NOT enforce a ratio; MUST NOT send image-only | lint: live text < ~500 characters in lifecycle mail → info | E (old) / F | S63 |
| Animated GIF: the **first frame** must carry the message (classic Outlook shows only the first frame, and Outlook 365 plays it three times then stops). Keep animation under 5 seconds or looping briefly, with ≤ 3 flashes per second. | caniemail GIF notes, WCAG 2.2.2 and 2.3.1. | SHOULD · check (manual) | studio: first-frame preview | S | S36 S56 |
| Hero images are optional in transactional mail and never the only copy of the headline or CTA. | Images-off rule. | SHOULD | — | C | S72 |
| **Logo:** default to a **live-text wordmark** (P1 and P2). If an image logo is used, ship a 2× PNG, `alt` = brand name, 24–40px tall, and either (a) a padded light tile behind it, (b) a light outline or glow, or (c) a `dark` variant swapped by `prefers-color-scheme` (this swap works only in some clients). | A transparent dark PNG disappears on dark or inverted grounds. Images are often blocked. | SHOULD · default | theme: `assets.logo.dark` present or tile on; alt = brand | C | S70 P1 P2 |

## 5. Mobile and touch

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| Buttons and standalone tap targets ≥ **44×44 CSS px**, with ≥ 8px between adjacent targets. | Apple HIG: 44×44pt default on iOS (28×28 minimum). Google: 48×48dp with 8dp spacing. WCAG 2.5.8 (AA) sets 24×24 or enough spacing; 2.5.5 (AAA) sets 44×44. | MUST · check (button ≥ 44px tall) | render lint on computed padding plus line height | S | S52 S54 S55 S56 |
| Inline text links are exempt (WCAG 2.5.8 inline exception), but footer link rows need spacing or separators. | Stacked tiny links cause mis-taps. | SHOULD · default | — | S | S55 |
| Columns stack to full width under the breakpoint. Use hybrid/fluid structure so the layout degrades without media queries. | Some clients and account types strip `<style>`. | MUST · default | — | C | S45 |
| Include the viewport meta and `x-apple-disable-message-reformatting` (Apple then stops auto-scaling, so the email must be responsive). Set `-webkit-text-size-adjust:100%` to stop iOS enlarging text below 13px. | Predictable text size on iOS. | MUST · default | `html.meta` (P1) | S | S59 S68 P1 |
| Full-width buttons on narrow screens are optional. | They raise tap accuracy on phones. | MAY · variant | — | C | — |
| Turn off or neutralise iOS data detectors (P1), and link phone numbers and addresses yourself when they matter. | Otherwise data detectors create unstyled blue links. | SHOULD · default | P1 check | S | S59 P1 |

## 6. CTA buttons

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| **One primary action** per transactional email (P2: at most one main button). Secondary actions are text links, or at most one `secondary` variant. | NN/g: the best transactional emails minimise the work users must do. | SHOULD · check (warn > 1 primary) | P2 test | E/C | S72 P2 |
| Labels are verb-first and specific ("Reset password", "Track parcel"), 3 words or fewer by default (configurable; style guides allow 1–4), in sentence case, with no "Click here" or "Submit". | The label must make sense out of context (WCAG 2.4.4, link purpose). | SHOULD · check | copy lint | C/S | S56 P2 |
| Bulletproof link button: a padded `<a>` with `display:inline-block`, Outlook `mso-padding-alt` and the `mso-text-raise` hack (goodemailcode), or VML `roundrect` for rounded corners. The whole area must be clickable. | Image buttons vanish with images off. Padding on a `<td>` leaves only the text clickable. | MUST · default | — | S/C | S62 S26 |
| **No `role="button"`** on links. | Email can't add keyboard behaviour, so screen readers would announce a button that keyboard users can't press. | MUST · check | lint | S | S62 |
| Size: ≥ 44px tall, 16px label, ~12–16px vertical and 24–32px horizontal padding. Use weight 700 (or 600 with ⚠1 caveats). Radius comes from the theme. | Touch target, legibility and consistency. | SHOULD · default | theme: `button.size.*.minHeight ≥ 44` | S | S52 S54 |
| Label/fill ≥ 4.5:1. Fill/canvas ≥ 3:1, or give the button a border. | WCAG 1.4.3 and 1.4.11. | MUST · check | theme validation | S | S56 |
| For security-critical links (reset, magic link, verify), also show the full URL as text below the button and in the plain-text part. | Lets people copy it across devices and survives broken buttons. | SHOULD · default for auth templates | lint: auth template without visible fallback URL → warn | C | — |

## 7. Content: subject, preheader, sender

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| The subject is **specific and informative** ("Your order 4217 has shipped", not "Shipping information"). | NN/g: vague subjects and unrecognised senders are the top failures. | SHOULD · check (heuristic) | lint: generic-subject word list → warn | E | S72 |
| Front-load the key words in the first ~35–40 characters. Warn above 60 characters. Observed visible lengths: about 37 (Gmail iPhone and Android), 48 (Apple Mail iPhone), about 50 (Outlook desktop), up to about 70 (Gmail desktop). Vendor device tests only; it varies by window and settings. | Truncation. | SHOULD · check | `copy.subject.length` warn > 60 | E (vendor) / C | S98 |
| No fake `Re:` / `Fwd:`. The subject must accurately describe the content. | Google sender guidelines. | MUST · check | lint | S | S73 |
| Emoji in subjects: the open-rate evidence is mixed and contradictory. Screen readers announce emoji by name and subjects can't be ARIA-labelled. Default **off** for transactional mail (P2). | Accessibility and tone. | SHOULD · check (configurable) | `copy.no-emoji` | E (mixed) | S69 P2 |
| Preheader ≤ 90 visible characters (Litmus). It complements and never repeats the subject (P1). No boilerplate ("View in browser", "Having trouble viewing…"). | Inboxes show the subject and preheader together. NN/g calls boilerplate a wasted opportunity. | MUST (≠ subject) · SHOULD (≤ 90) | `catalog.preheader-not-subject`; length lint | S/E | S57 S72 P1 |
| Hide the preheader with `display:none`, then pad it with repeated `&#8199;&#65279;&#847;` sets so body text doesn't leak into the preview. Keep the padding out of the text part. | goodemailcode: `&#847;` alone stopped working in Yahoo/AOL (2022) and Apple Mail 16.4 (2023), and `&zwnj;` didn't help in mail.ru. | SHOULD · default | lint: padding present; text part free of padding characters | S/C | S58 |
| The **first visible sentence** works as a standalone summary. | Apple Intelligence (iOS 18.1+) summarises the body instead of showing the preheader. AI summaries ignore images. | SHOULD · check (manual, in studio) | studio: "inbox and summary" preview | S | S57 Δ |
| Sender display name: consistent, recognisable, brand first ("Acme" or "Acme Security"), no emoji, never the recipient's name or message content. One address in `From:`. | Google sender guidelines. People don't open mail from senders they don't recognise. | MUST (no deception) · SHOULD (≤ ~25 characters) | config validation | S/E | S73 S72 |
| The inbox logo or avatar comes from **BIMI or Apple Branded Mail**, not from the HTML (out of scope; document it). | Avoids false expectations in the studio's inbox mock-up. | — | — | S | S84 |

## 8. Content: body copy, personalisation, footer, tone

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| Lead with the outcome or the required action. Use short paragraphs (1–3 sentences), lists for steps and key-value rows for facts. | NN/g: success means giving the information "as quickly, easily, and completely as possible". Scannability. | SHOULD · default | lint: paragraph > ~60 words → info | E | S72 |
| Answer the user's predictable questions in the email itself (what happened, what's next, when, how much, who to contact). Don't force a sign-in to see basic facts. | NN/g: extra work (logging in, contacting support) draws complaints. | SHOULD | template checklist (§9) | E | S72 |
| Every interpolated value has a **fallback or a restructure** ("Hi Sam," becomes "Hi,"). Never leave "Hi ," or a raw `{name}`. Escape and length-limit user-supplied strings (names, org names). | Broken personalisation erodes trust. Inviter or org names are a phishing vector. | MUST · check | fixture with empty and long values; lint for unresolved tokens | C | P1 P2 |
| Plain language, sentence case, no emoji by default, and a brand glossary (P2). Decorative symbols (→, •) get `aria-hidden`. No Unicode "fancy text". | Screen readers read decorative symbols aloud ("right arrow") and skip or spell fancy text. | SHOULD · check | copy lint | S/C | S69 P2 |
| **Footer for transactional mail:** sender identity, *why you got this* (P2), a help or contact link, optional privacy link. Receipts: legal name, support address and email, privacy URL (Stripe treats these as compliance requirements). | Trust and compliance. Transactional mail is exempt from most CAN-SPAM rules, but routing and sender information must still be accurate. | MUST · check (`source.includes-layout`) | footer slots required | S | S74 S93 P2 |
| **Footer for marketing and lifecycle mail:** everything above, plus a **visible unsubscribe link** in the body, `List-Unsubscribe` with `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, a **physical postal address**, and a manage-preferences link. | Google bulk-sender rules, RFC 8058 and CAN-SPAM (postal address, honour opt-outs within 10 business days). | MUST · check (`catalog.lifecycle-unsubscribe`) | P1 check (currently ❌) | S | S73 S74 S75 |
| Transactional mail has **no** unsubscribe and no promotional blocks beyond its primary purpose. A double opt-in confirmation is transactional (P1). | CAN-SPAM's primary-purpose test. Unsubscribing from a sign-in code locks people out. | MUST · check | P1 check | S | S74 P1 |
| "View in browser": not needed for transactional mail and **forbidden** for anything that carries a code, token or personal data (a hosted copy leaks secrets). Optional for image-heavy or interactive marketing mail. | Email on Acid: often unnecessary with pre-send testing, still useful for complex mail. It must never become the preheader. | MUST NOT (auth/PII) · MAY (marketing) | lint: auth template with web-view link → error | C | S64 S72 |

## 9. Transactional email patterns

Every pattern uses one `<Layout>`: h1, lead sentence, body, at most one primary CTA, and the transactional footer.

| Pattern | Must include | Should include | Avoid | Check candidates | Src |
|---|---|---|---|---|---|
| **OTP / verification code** | The code as **real text** inside a sentence ("Your code is 482917") plus a large display; its purpose ("to sign in to Acme"); expiry in minutes; "If you didn't request this, you can ignore this email" (with the reason). | A mono stack; 28–32px; 4–8px **letter-spacing (not separate spans per digit, so copy and paste and Gmail's "Copy code" work)**; a tinted `codeSurface`; `user-select:all` (works only in some clients); the requesting device or app if known. | Images of the code; splitting digits into table cells; `aria-label` on a `div` (⚠6); repeating the code in the preheader; marketing content; a web view. | code present once as a contiguous token in HTML **and** text; no code in the preheader; expiry present; ≤ 1 CTA | S82 S83 S92 P1 P2 |
| **Code in the subject (trade-off)** | An explicit per-template opt-in. | If enabled: the code first ("482917 is your Acme code"), never in the preheader. | Enabling by default. The code then shows on lock screens and in notification previews. | config flag; lint: code-in-subject requires opt-in | S82 ⚠10 |
| **Password reset** | What was requested and when; a single-use link (and/or code) with its expiry; "If you didn't ask, ignore this — your password won't change"; no password in the email. | The full URL as fallback text; a link base that is **hard-coded or validated** (never from the Host header); the token in the URL **fragment** (P2); a confirmation email **after** the reset. | Revealing whether an account exists anywhere outside the inbox (use consistent UI responses); long-lived links. | expiry var required; URL host ∈ allow-list; HTTPS | S79 P2 |
| **Magic link** | Purpose, single use, expiry, a button plus the fallback URL, and "ignore if not you". | The landing page acts **only on an explicit press** (a GET must have no side effects, because Safe Links, Proofpoint and similar scanners pre-fetch links); a code alternative for signing in across devices. | Consuming the token on GET. | link → landing page contract test; expiry | S85 S86 P2 |
| **Receipt / invoice** | Receipt or order number; date; merchant legal name and support contact; itemised lines (description, quantity, unit price, line total); subtotal, discounts, shipping, **tax (rate and amount, inclusive or exclusive label)** and total; currency; payment method (brand and last 4). | A semantic data `<table>` with `<th scope>` (not `role=presentation`); numbers end-aligned; currency formatted with `Intl.NumberFormat`; a VAT invoice when legally required (EU Art. 226 fields: sequential number, VAT IDs, rates per line…); a link to the full receipt. | Amounts that don't reconcile; ambiguous "$"; long promotions. | **reconciliation test**: Σ lines − discounts + shipping + tax = total; one currency throughout; totals above the Gmail clip line | S93 S94 |
| **Shipping and tracking** | Order number; what shipped (partial shipments labelled); carrier; tracking number as copyable text; expected delivery date (locale and time zone); a primary CTA to track. | The ship-to address (partly masked); a help link. | Promotions in the shipping notice (NN/g participants disliked them). | date via `Intl` with an explicit time zone | S72 P2 |
| **Security alert: new sign-in** | What happened, when (date, time and **time zone**), where (approximate location, labelled approximate), device or browser or app, a masked account id; "If this was you, no action is needed"; **"If this wasn't you"** with clear steps and contact information. | A CTA to *Review activity* or *Secure account* (a session-revoke or password-reset flow); a support contact. | Asking people to "reply with your password"; vague timestamps; alarmist copy; any marketing. | `this-wasnt-me` slot required for `security.*` templates | S81 S80 |
| **Password changed / MFA or authenticator added or removed** | Event, time, device; "If you didn't do this…" with recovery steps and contact information. | — | — | NIST: notify through a channel **independent** of the change (SHALL for an added authenticator, SHOULD for invalidation); notify **all** addresses | S81 |
| **Email address changed** | Send to the **old** address: the change, the time, the new address (masked) and a link to report it. Send to the **new** address: confirmation, plus a link for the unexpected case. | Keep the old address able to revert for a window. | Sending only to the new address. | template pair required | S80 S81 |
| **Account recovery** | A notification is **always** sent (NIST SHALL), with instructions and contact information in case the recipient repudiates it. | — | — | — | S81 |
| **Welcome** | Confirm the account; one next step (a single CTA); what to expect (which emails and how often); help. | A short getting-started list. | Promotional upsell (if the email's primary purpose becomes commercial, it becomes marketing mail and needs an unsubscribe). | classify transactional vs lifecycle | S74 S72 |
| **Invitation** | Who invited (name **and** organisation, escaped and length-limited); what it is for; an accept CTA; expiry; "Not expecting this? Ignore it — no account is created." | Inviter avatar or initials. | Arbitrary user-controlled text in the subject; auto-creating accounts. | inviter fields escaped; max length | P2 |
| **Digest / notifications** | A count or summary in the subject; items grouped by type; each item deep-links; a cap plus "View all"; a **manage notifications** link; the frequency stated. | Respect channel choices and don't duplicate push notifications (NN/g). | Endless lists that push past the Gmail clip. | item cap; size test with the largest fixture | S72 P1 |
| **Double opt-in** | What list and **how often** (M3AAWG); a confirm CTA; expiry; ignore-if-not-you. | — | Marketing content before confirmation; an unsubscribe link (P1: nobody is subscribed yet). | treated as transactional | S87 P1 |

## 10. Internationalisation

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| Put `lang` and `dir` on `<html>` **and** on the wrapper div. Add `xml:lang` on the body for Outlook for Windows. | Webmail strips `<html>`. Screen readers choose the voice from `lang`. | MUST · check (`html.lang-dir`, wrapper too) | P1 check, extended | S | S59 |
| RTL: write **physical** `align` and `text-align` per direction, mirror padding, reverse column order and mirror directional icons. Don't rely on `dir` on `<table>`/`<td>` alone. | caniemail: Orange webmail removes `dir` from `<table>`/`<td>` (2024-04). Outlook for Windows mishandles `dir` on `<a>`. Gmail mobile webmail applies RTL to the whole email when it finds RTL text. | MUST · default (component level) | RTL snapshot test (`ar` or the RTL pseudo-locale) | S | S32 S33 |
| Isolate user-provided names and mixed-direction runs with `dir="auto"` or `<bdi>`. In plain text use FSI (U+2068) … PDI (U+2069). Keep codes, URLs, emails and numbers LTR inside RTL text. | Prevents garbled ordering in bidi text. | SHOULD · default | — | S | S101 |
| Design for text expansion scaled by **length** (strings of 10 characters or fewer can grow 200–300%). No fixed heights. Buttons may wrap to 2 lines. Never put words in images. | W3C and IBM expansion table; German compound words don't wrap. | MUST · check | pseudo-locale render: no clipping, button ≤ 2 lines | E | S88 ⚠5 |
| Pseudo-localisation: an accented, bracketed, length-scaled locale (`en-XA` style) plus an RTL pseudo-locale (`ar-XB` style). | Brackets reveal concatenation. Accents reveal hard-coded strings. | SHOULD · check | build every template in both | S | S103 P2 |
| CJK: append per-script font stacks (for example `"PingFang SC","Hiragino Sans","Noto Sans CJK SC","Microsoft YaHei"`). Use a slightly taller line height (about 1.6–1.8). No italics. No letter-spacing on body text. | CJK and Thai need more vertical space (Thai about 150%). `word-break: keep-all` (Korean) is buggy in email: Gmail inserts `<wbr>` every 30 characters and Outlook.com behaves like break-all. | SHOULD · default | theme: `type.stack.byScript` | S/C | S88 S31 S104 |
| Dates and times through `Intl.DateTimeFormat` with an **explicit time zone** (the recipient's, or else name the zone). Use month names rather than ambiguous numeric dates. | 03/04 is ambiguous. Expiry and sign-in times must be exact. | MUST · default | lint: hand-formatted dates | S | P2 |
| Money through `Intl.NumberFormat` with an ISO currency code (respects minor units, for example JPY has 0 decimals). Show the currency code when the symbol is ambiguous. | Receipts must be unambiguous. | MUST · default | lint | S | S93 |
| ICU MessageFormat: plural and select, named arguments, no string concatenation, translator notes. MF2 has been stable since CLDR 47 (2025). `Intl.MessageFormat` is still TC39 **Stage 1**. Use ICU MF1 (P2) now with an MF2-ready abstraction. | Grammar differs per locale. | MUST · check (P2 `no-literal-copy`) | message lint: missing plural categories per locale | S | S89 S90 P2 |
| Locale fallback: BCP 47 lookup (RFC 4647, for example `pt-BR` → `pt` → default), honouring CLDR parent locales. Never show raw keys (P2 throws on a missing key). | Predictable degradation. | MUST · check | P2 test | S | S102 P2 |
| Localise the subject, preheader, alt text and plain text too. | They are part of the message. | MUST · check | missing-key test covers all slots | S | P2 |

## 11. The plain-text part

| Guideline | Why | Level | Check | Ev. | Src |
|---|---|---|---|---|---|
| Always send `multipart/alternative` with a real `text/plain` part (P1: about 80 characters minimum). | Spam heuristics, text-only readers and watches. Some clients take the preview from the text part. | MUST · check | P1 `text.*` | S | P1 S58 |
| Wrap at ≤ 78 characters (RFC 5322 SHOULD; 998 is the hard limit). For `format=flowed`, wrap at about 72 with soft breaks (SP CRLF). **Never break URLs.** | Readable in every client. Broken URLs are dead links. | SHOULD · check | `text.wrap-78` (URLs exempt) | S | S76 S77 |
| Links as **full absolute URLs** on their own line, optionally `<https://…>` (RFC 3986 App. C). Buttons render as `Label: URL`. | Autolinking and copying. Angle brackets delimit the URL. | MUST · check | `text.urls-full` | S | S78 |
| Structure: the heading on its own line followed by `====` or `----`; blank lines between sections; `- ` or `1.` lists; tables as `Label: value` lines (monospace isn't guaranteed). | Scannable without markup. | SHOULD · default (text renderers) | — | C | — |
| No markup and no HTML entities. Interpolated values are **not** HTML-escaped in the text part (P1). | Some Android clients show entities raw. An escaped `&#x3D;` breaks links. | MUST · check | P1 `text.no-markup`, `text.no-entities` | S | P1 |
| Generate from the component tree with per-component text renderers. Allow hand-written overrides. **Never** strip rendered HTML. | Single source of truth without table debris. | SHOULD · default | parity check: every link and key fact in the HTML appears in the text | C | ⚠7 |
| Codes stay on one unbroken line. Preheader padding characters never appear in the text part. | Copying codes; clean previews in clients that read the text part. | MUST · check | lint | S | S58 |

---

## 12. Design tokens and theming

### 12.1 W3C Design Tokens Community Group (DTCG) format 2025.10

**Status:** The Format, Color and Resolver modules **2025.10** were published on **2025-10-28** as a Final Community Group Report, "considered stable". The group is **not** on the W3C Standards Track. Files use `.tokens` or `.tokens.json`, media type `application/design-tokens+json` [S1–S5].

| Feature | What the spec says | Src |
|---|---|---|
| Token | Any object with `$value`. Optional: `$type` (inherited from groups; tools MUST NOT infer it from the value), `$description`, `$extensions` (reverse-domain keys; tools MUST preserve them) and `$deprecated` (boolean or string). | S1 |
| Group | An object without `$value`. It can carry `$type`, `$description`, `$deprecated` and `$extensions`. **`$root`** gives a group its own base token. **`$extends`** deep-merges another group, with local values winning and cycles invalid. | S1 |
| Aliases | `{group.token}` refers to a whole token. JSON Pointer `$ref` (`#/color/blue/$value/components/0`) can reach a property. Chains are allowed. Cycles are errors. | S1 |
| Simple types | `color`, `dimension` (`{value, unit}`, unit `px`\|`rem`), `fontFamily` (a string or an array), `fontWeight` (1–1000 or a keyword such as `bold`), `duration` (`ms`\|`s`), `cubicBezier`, `number`. | S1 |
| Composite types | `strokeStyle`, `border` (`color`, `width`, `style`), `transition`, `shadow` (one or more layers with `color`, `offsetX`, `offsetY`, `blur`, `spread`), `gradient` (stops with `color` and `position` 0–1; linear or radial is **not** defined, issue 101), `typography` (`fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight` as a **number multiplier**, issue 102). | S1 |
| Colour value | `{colorSpace, components[], alpha?, hex?}` across 14 spaces (`srgb`, `display-p3`, `oklch`, `oklab`, `lab`, `lch`, `hsl`, `hwb`, `rec2020`…). A component may be `none`. `hex` is an optional 6-digit **fallback**. The gamut-mapping algorithm is left to tools (non-normative). | S2 |
| Modes and themes | **Resolver module.** A `.resolver.json` file defines `sets` (sources), `modifiers` (each with named `contexts`, for example `theme: {light, dark}` or `brand: {a, b}`, and an optional `default`) and an ordered `resolutionOrder` (later entries win). Input is `{theme:"dark", brand:"b"}` and output is one flattened, alias-resolved **permutation**. Brands are just another modifier. Keep modifiers orthogonal. Note: the version string is inconsistent inside the spec (`2025-10-01` vs `2025-11-01`; Terrazzo expects `2025.10`). | S3 S9 |

**Email-relevant gaps in DTCG:** `lineHeight` is a multiplier, but email needs px, so the framework must compute it. There is no token type for a font stack *with an MSO fallback*, for dark-mode *strategy*, or for image assets, so use `$extensions` (for example `com.<framework>.msoFallback`). `rem` dimensions must be converted to px at a declared root size (16px).

### 12.2 Tooling status (2026-10-27)

| Tool | Status | Use here | Src |
|---|---|---|---|
| **Style Dictionary** v5.7.1 (2026-10-24) | DTCG 2025.10 colour objects across all 14 spaces (5.3.0). Out-of-gamut colours are mapped to sRGB with `colorjs.io` `toGamut` (the CSS Color 4 method), using `hex` as a fallback when present. Dimension objects (5.4.0), duration (5.7.0), `$root` naming (5.7.0). **No resolver support** in the changelog (the gap was tracked in issue #1590 as of Nov 2025). No v6. | A transform engine for tokens → TS/JSON theme. | S6 S7 S8 |
| **Terrazzo** | DTCG-native, with 2025.10 **resolver** support (`permutations` → CSS light and dark). | Reference implementation for resolvers. | S9 |
| **Tokens Studio** (Figma) | Exports DTCG `$value`/`$type` by default, but its **sets and themes** are its own format, not the 2025.10 resolver (2.11.4, Apr 2026, adds platform sync). | An import adapter (themes → modifiers). | S10 S11 |
| **Figma Variables** | Third-party reports describe DTCG-aligned JSON export with one file per mode. Native DTCG support status is unconfirmed. | An import adapter via plugins. | (unverified) |

### 12.3 How teams structure tokens

| Tier | Contents | Email guidance | Ev. |
|---|---|---|---|
| **Primitive** (reference) | Raw ramps: `color.blue.500`, `space.4`, `radius.2`, font families | Any colour space. Never referenced by templates. | C (Material uses reference, system and component tiers) |
| **Semantic** (system) | Roles: `canvas`, `ink`, `mutedInk`, `actionFill`… **per mode** | This is where the email *roles* live (P1). Each role has light and dark values and a contrast pairing. | C/S (P1, S12) |
| **Component** | `button.primary.fill`, `otp.surface`, `callout.warning.border` | Refers to semantic tokens only. Lets brands override a component without touching roles. | C |
| **Modes and brands** | Resolver modifiers `theme` and `brand` (and later `density` or `contrast`) | Build every permutation and validate each one (contrast, gamut, inversion). | S3 |

### 12.4 shadcn/ui theming model (current)

| Aspect | Current behaviour | Src |
|---|---|---|
| Variables | `--background`/`--foreground`, `--card`/`-foreground`, `--popover`/`-foreground`, `--primary`/`-foreground`, `--secondary`/`-foreground`, `--muted`/`-foreground`, `--accent`/`-foreground`, `--destructive` (**no** `--destructive-foreground` in the current list), `--border`, `--input`, `--ring`, `--chart-1…5`, `--sidebar*` (8 tokens) and `--radius`. | S12 |
| Convention | A surface token with a `-foreground` partner for the text on it. Values sit in `:root` (light) and `.dark`. `@theme inline` maps `--color-x: var(--x)` for Tailwind v4 utilities. | S12 |
| Colour format | **OKLCH**, for example light `--primary: oklch(0.205 0 0)`. Dark `--border: oklch(1 0 0 / 10%)` and `--input: … / 15%` use **alpha**. | S12 |
| Radius | `--radius: 0.625rem` (10px). The derived scale is now **multiplicative**: sm ×0.6 (6px), md ×0.8 (8px), lg ×1 (10px), xl ×1.4 (14px), 2xl ×1.8, 3xl ×2.2, 4xl ×2.6. | S12 |
| Adding colours | Define `--warning`/`--warning-foreground` in both modes and expose them in `@theme inline`. Success, warning and info are **not** in the defaults. | S12 |
| `components.json` | `tailwind.cssVariables` (default true), `tailwind.baseColor` (neutral, stone, zinc, mauve, olive, mist, taupe), style `{radix\|base}-{vega\|nova\|maia\|lyra\|mira…}`. | S12 S15 |
| Registry themes | Registry items of type `registry:theme`, `registry:style`, `registry:base` or `registry:font` with `cssVars: {theme, light, dark}` (the `tailwind` field is deprecated). Presets are encoded as short codes (`shadcn preset`, `apply`, Apr 2026). **tweakcn** is a visual editor that exports these variables and a registry URL. | S13 S14 S16 |

Computed hex for the shadcn neutral defaults (our OKLCH → sRGB conversion): light `background` #ffffff, `foreground` #0a0a0a, `primary` #171717, `muted` #f5f5f5, `muted-foreground` #737373 (4.74:1 on white), `border` #e5e5e5, `destructive` #e7000b (4.77:1, slightly outside sRGB). Dark `background` #0a0a0a, `muted-foreground` #a1a1a1 (7.66:1), `destructive` #ff6467. Chart and Tailwind chromatic colours (for example `blue-500`, `green-500`) sit **slightly outside sRGB** (they are P3).

### 12.5 Mapping a shadcn-style system to email roles

| Email role (P1, extended) | Default source (light / dark) | Notes |
|---|---|---|
| `pageGround` | `muted` or `accent` / `sidebar` or `background` | Must not be #ffffff in light (P1). shadcn's `background` is pure white, so choose another token. |
| `canvas` (card) | `card` → `background` / `card` | — |
| `ink` | `foreground` / `foreground` | — |
| `mutedInk` | `muted-foreground` / `muted-foreground` | Light #737373 trips the mid-tone band (⚠8), so offer an auto-adjust to the nearest compliant lightness. |
| `hairline` | `border` / `border` (**flattened**) | The dark default has 10% alpha, which flattens to #222222 on #0a0a0a. |
| `actionFill` / `actionLabel` | `primary` / `primary-foreground` | Validate 4.5:1 and fill-vs-canvas 3:1. |
| `link` | `primary` / `ring` or a lightened `primary` (P2 uses `ring` in dark) | Must clear 4.5:1 on canvas *and* pageGround. Underline by default. |
| `codeSurface` | `muted` or `secondary` / `secondary` or `muted` | Ink on it ≥ 4.5:1. |
| `error` (+ `onError`) | `destructive` / `destructive`; the label is computed | shadcn has no destructive-foreground: pick white or `ink` by contrast. |
| `success`, `warning`, `info` (+ `on*`, `*Surface`) | Added tokens (shadcn docs pattern) | Required for callouts and badges. |
| `brand`, `onBrand`, `brandInk` | `primary` or `chart-1` or a brand primitive | See §3. |
| radii | `--radius` × multipliers → px | `button` = md or lg, `card` = lg or xl, `badge` = full (9999px). |

### 12.6 Translating to email-safe values

| Source construct | Email output | Why | Src |
|---|---|---|---|
| `var(--x)` and `@theme inline` | A **literal resolved per mode** at build time. Dark values go to the authored dark stylesheet (other slice). | No CSS variables in Outlook, Yahoo or AOL. Gmail supports `var()` without declarations. | S20 |
| `oklch()`, `lab()`, `display-p3` | **CSS Color 4 gamut mapping** to sRGB (chroma reduction in OKLCh, ΔEOK JND 0.02), then 6-digit hex. Use the DTCG `hex` fallback when the designer supplied one. Re-run contrast **after** mapping. | Gmail drops *all* inline styles on an element with `oklch()` inline. Naive per-channel clamping (React Email) can shift hue. Tailwind and shadcn defaults barely differ (≤ 1/255 per channel, computed), but high-chroma brand colours shift visibly (computed: `oklch(0.75 0.25 200)` clamps to #00d6eb and maps to #00c9d2). | S21 S18 S6 S43 |
| Alpha (`/ 10%`, `rgba`) | Composite over the role's actual surface, then write opaque hex. | No `rgba` or `opacity` in Outlook for Windows. Gmail strips space-separated syntax. | S22 S23 |
| `rem`, `em`, `calc()` | Convert to px at a 16px root. Optionally keep `max(16px,1rem)` on the wrapper (§2). | No `rem` in Outlook for Windows, Yahoo or AOL. | S27 S60 |
| Shadows and gradients | Drop them, or degrade to a border or solid fill (§3). | Support is patchy. | S24 S25 |
| Radius scale | Single px values. VML for the primary button only. | Square corners in Word. | S26 |
| Font tokens | A stack with a generic family plus an MSO fallback. Weights snapped to 400/700 (warn otherwise). | ⚠1, ⚠3. | S28 S30 |
| `lineHeight` multiplier | px = round(size × multiplier). | Word needs exact line heights. | P1 |

### 12.7 How existing email frameworks theme

| Framework (version) | Theming mechanism | Notes | Src |
|---|---|---|---|
| **React Email** 6.11 | `<Tailwind config={…} theme={css} utility={css}>` (CSS-first since 6.3.3), plus `pixelBasedPreset` (rem → px). | Inlines styles. Media queries and `hover:` go to the head. Resolves CSS variables and `calc()`. Converts oklch and hex to comma `rgb()` (clamping). Downlevels nested and range media queries. Strips unresolved `--tw-*`. No `prose` or `space-*`. The preview has a caniemail compatibility checker, a `--clients` filter and a dark-mode inversion emulator. | S40–S43 |
| **MJML** 5.4 | `<mj-attributes>` in the head: per-component defaults, `<mj-all>`, and `<mj-class name>` (several classes allowed). Precedence: inline > mj-class > component default > mj-all > built-in. `mj-style inline="inline"`. | Attribute-level theming. P1 generated `theme.mjml` from tokens this way. `css-class` lands on the outer element (P1 notes the dark-mode selector problem). | S45 S46 P1 |
| **Maizzle** 6.3 | Tailwind 4 CSS-first `@theme` (no `tailwind.config.js`) in a `<style>` block or the `<Tailwind>` `#config` slot. `@maizzle/tailwindcss` is the email preset. | Lightning CSS lowers modern syntax. `oklch()` → **hex**. CSS variables resolved at build time. Tailwind v4 gradients flattened. Vue SFC components. | S47 S48 |
| **jsx-email** 3.2 | Tailwind component plus props on components (`Button` takes `backgroundColor`, `borderRadius`, `width`, `height`, `textColor`). `<ColorScheme mode="light dark">`. | Props-level theming, VML-aware button. | S49 |
| **emailcn / Ingram registry** | shadcn-style copy-in registries. emailcn targets React Email, MJML React and jsx-email with brand presets. Ingram has an `EmailTheme` object (surfaces, three ink levels, accent plus `accentInk`, link, radius, two font stacks, optional `dark` overrides) with contrast rules (`accentInk`/`accent` ≥ 4.5 and `link`/surface ≥ 4.5). | Closest prior art to "shadcn-style email components with a theme object". emailcn's site was unavailable at verification time, so details are from listings. | S50 S51 |

---

## 13. Component inventory

### 13.1 Survey

| Component | React Email 6 | MJML 5 | Maizzle 6 | jsx-email 3 | Notes |
|---|---|---|---|---|---|
| Html / Head / Body | ✓ | `mjml`, `mj-head`, `mj-body` | ✓ | ✓ | — |
| Preview (preheader) | `Preview` | `mj-preview` | `Preheader` | `Preview` | — |
| Container / Section / Row / Column | ✓ | `mj-wrapper`, `mj-section`, `mj-group`, `mj-column` | ✓ | ✓ | MJML stacks columns automatically. |
| Heading / Text / Link | ✓ | `mj-text` (no headings) | ✓ | ✓ | MJML needs a promoted h1 (P1). |
| Button | `Button` (a styled `<a>` with MSO padding) | `mj-button` | `Button` (`solid`\|`outline`\|`ghost`\|`link`, `align`, MSO props) | `Button` (VML, width and height) | Maizzle has the only built-in variants. |
| Img / Hr / Spacer | `Img`, `Hr` | `mj-image`, `mj-divider`, `mj-spacer` | `Img`, `Hr`, `Spacer` | `Img`, `Hr` | — |
| Code inline / block | ✓ (themes, line numbers) | — | ✓ | `Code` | — |
| Markdown | ✓ | — | `Markdown` | ✓ | — |
| Font | ✓ | `mj-font` | ✓ | ✓ | — |
| Table | — | `mj-table` | — | — | No first-class data table anywhere. |
| Social / Navbar / Hero / Carousel / Accordion | gallery blocks (S44) | `mj-social`, `mj-navbar`, `mj-hero`, `mj-carousel`, `mj-accordion` | — | — | Marketing-oriented. |
| Outlook conditionals / VML | — | `mj-raw` | `Outlook`, `NotOutlook`, `Vml`, `OutlookBg` | `Conditional`, `Background` | — |
| Plain-text control | `render({plainText})` | — | `Plaintext`, `NotPlaintext` | — | Maizzle can mark per-node text output. |
| Other | gallery: avatars, stats, testimonials, pricing, e-commerce, articles, features, feedback | — | `QrCode`, `NoWidows`, `WithUrl`, `Raw` | `Avatar`, `AvatarGroup`, `Graph`, barcode, `ColorScheme` | — |

### 13.2 A production-grade set (props and variants)

| Component | Purpose | Key props / variants | Email-specific notes |
|---|---|---|---|
| `EmailRoot` (Html+Head+Body) | Document, meta and resets | `lang`, `dir`, `subject`, `colorScheme` (`light`\|`light dark`), `preheader` | Emits meta, MSO 96 DPI, the font override and the `role="article"` wrapper. |
| `Preheader` | Hidden preview text | `children`, `padding` (auto) | `display:none` plus the padding sequence. Excluded from the text part. |
| `Layout` | The single shell (P2) | `header`, `footer`, `width`, `audience` (`transactional`\|`lifecycle`) | Enforces the footer slots and unsubscribe rules by audience. |
| `Container` / `Section` | Width and vertical rhythm | `width`, `padding` (scale), `surface` (`canvas`\|`ground`\|`muted`\|`brand`) | Padding only, no margins. |
| `Row` / `Column` / `Grid` | Columns that stack | `columns` (1–3), `gap`, `stackAt`, `align`, `reverseOnRtl` | Hybrid/fluid structure plus ghost tables. |
| `Heading` | h1–h3 | `level`, `size` (`display`\|`h1`\|`h2`\|`h3`), `align` | Exactly one h1 per email (check). |
| `Text` | Paragraphs | `size` (`lead`\|`body`\|`sm`\|`caption`), `tone` (`default`\|`muted`\|`error`…), `align`, `weight` (400\|700) | — |
| `Link` | Inline links | `href`, `tone`, `underline` (default on) | Link colour role. HTTPS and allow-list check. |
| `Button` | The primary CTA | `variant` (`primary`\|`secondary`\|`outline`\|`ghost`\|`destructive`), `size` (`sm` 36\|`md` 44\|`lg` 52 px min height), `fullWidth` (`never`\|`mobile`\|`always`), `align`, `href`, `showUrl` | Padded `<a>` plus MSO hacks or VML roundrect. Text part becomes `Label: URL`. `sm` is allowed only for non-primary actions. |
| `Image` | Content images | `src`, `alt` (required; `""` for decorative), `width`, `height`, `radius`, `href` | 2× source check. No SVG, WebP or AVIF. |
| `Logo` / `Wordmark` | Brand mark | `variant` (`auto`\|`light`\|`dark`), `height`, `asText` | Text by default. Image variants come from `assets.logo`. |
| `Divider` | Hairline | `spacing`, `tone` | A 1px filled cell or a bordered `<p>` (P1). |
| `Spacer` | Vertical space | `size` (scale) | A table row with an explicit height and `line-height`. |
| `List` | Bulleted or numbered | `ordered`, `marker`, `gap` | Real `<ul>`/`<ol>` with Outlook-safe margins. |
| `DataTable` | Tabular data | `columns[{key, header, align, width}]`, `rows`, `caption`, `zebra`, `density` | **Not** `role=presentation`. `<th scope>`. Numbers end-aligned. Text part becomes `Label: value`. |
| `KeyValue` | Fact rows (order number, date) | `items[{label, value, copyable}]`, `layout` (`stacked`\|`inline`) | Stacks on mobile. |
| `LineItems` / `Receipt` | Itemised totals | `items[{name, qty, unitPrice, total, meta}]`, `subtotal`, `discounts[]`, `shipping`, `tax[{label, rate, amount, inclusive}]`, `total`, `currency`, `locale` | Reconciliation assertion in dev. `Intl` formatting. |
| `CodeInline` / `CodeBlock` | Code | `language`, `wrap`, `lineNumbers` | Mono stack. Block wraps long lines. |
| `OtpCode` | One-time code | `code`, `groupSize` (0\|3\|4), `size`, `expiresInMinutes`, `label` | Contiguous text with letter-spacing (no per-digit cells); a sentence form for screen readers (⚠6); one copy only. |
| `Badge` | Status label | `tone` (`neutral`\|`info`\|`success`\|`warning`\|`error`\|`brand`), `variant` (`solid`\|`soft`\|`outline`) | Text required. Colour not the only signal. |
| `Card` | Grouped content | `surface`, `padding`, `radius`, `border` | Border rather than shadow. |
| `Callout` / `Alert` | Notices | `tone`, `title`, `icon` (PNG, `aria-hidden`) | Icon decorative. The title carries the meaning. |
| `Avatar` | A person or org | `src`, `name` (initials fallback), `size`, `shape` | Initials as live text on a coloured cell. |
| `SocialLinks` | Lifecycle footers | `items[{network, href}]`, `size`, `style` (`mono`\|`brand`) | PNG icons, alt = network name, ≥ 44px targets. |
| `Header` | Top bar | `logo`, `align`, `link` | No navigation for transactional. |
| `Footer` | Required info | `sender`, `reason`, `helpUrl`, `address`, `unsubscribeUrl`, `preferencesUrl`, `legal` | Slots required by audience (check). |
| `Markdown` | Long-form copy | `source`, element overrides mapped to components | Sanitised. Headings re-levelled. |
| `Steps` / `Progress` | Order status, onboarding | `steps[{label, state}]`, `orientation` (vertical on mobile) | Text states, not colour alone. |
| `Quote` / `Testimonial` | Lifecycle | `children`, `cite`, `avatar` | Real `<blockquote>`. |
| `Conditional` | Outlook/MSO, dark, text-only | `mso`, `notMso`, `textOnly`, `htmlOnly` | Escape hatch, linted for balance. |

**DX conventions that work well:** the shadcn vocabulary (`variant`, `size`, `tone`, `asChild`-free); props typed from the theme (variants and sizes derived from tokens so the theme and the types can't drift); token names rather than raw values in props (`padding="md"`, `tone="muted"`) with a lint ban on literals (P1 `source.no-hex`, P2 `no-literal-copy`); copy-in registry distribution (`registry:block`/`registry:theme`) as well as an npm package; each component owns its **text renderer** and its **dark-mode class hooks** at the element that carries the inline style (P1).

---

## 14. Implications for the framework

### 14.1 Proposed theme / token schema (outline)

DTCG 2025.10 files plus a resolver. Email-specific data goes in `$extensions["dev.<fw>"]`. This is an outline, not code.

```text
theme/
├─ meta                 name, version, dtcg: "2025.10", baseFontSize: 16 (rem→px root)
├─ resolver.json        sets: [primitives, semantic, components]
│                       modifiers: theme {light, dark} (default light), brand {…}, [contrast {standard, high}]
├─ primitives           color.<hue>.<step> (any colorSpace, optional hex)
│                       space.0…64 · radius.base (+ multipliers) · borderWidth.hairline/strong
│                       font.family.{sans,serif,mono,display,cjk-sc,cjk-jp,cjk-kr,arabic,hebrew}
├─ semantic (per mode)
│  ├─ surface           pageGround · canvas · card · muted · codeSurface · inverse · brand
│  ├─ content           ink · mutedInk · subtleInk(caption) · inverseInk · link · onBrand · brandInk
│  ├─ line              hairline · divider · strongBorder
│  ├─ action            primary{fill,label,border} · secondary{…} · destructive{fill,label}
│  ├─ status            info|success|warning|error × {ink, surface, border, fill, onFill}
│  └─ data (optional)   chart.1…5 (from shadcn)
├─ typography
│  ├─ stacks            sans|serif|mono: {families[], generic, msoFallback, webFont?{name,href,weights}}
│  │                    byScript: {Hans, Jpan, Kore, Arab, Hebr, Thai} appended per locale
│  └─ scale             display·h1·h2·h3·lead·body·bodySm·caption·footer·button·code·otp·wordmark
│                       each {stack, sizePx, lineHeightPx (computed from multiplier), weight 400|700,
│                             letterSpacingPx, transform: none}
├─ space                scale + semantic {gutterMobile 16, gutterDesktop 32, stack.sm/md/lg, section}
├─ radius               none · sm · md · lg · xl · full(9999) + semantic {button, card, badge, code, image}
├─ borderWidth          hairline 1 · strong 2
├─ layout               container 600 (480–640) · breakpoint 480 · maxColumns 3 · contentMaxCh 75
├─ components           button.{variant}.{fill,label,border,hoverNone} · button.size.{sm,md,lg}{minHeight,padX,padY,font}
│                       link{color, underline} · card · callout.{tone} · badge.{tone}.{variant}
│                       otp{stack:mono, sizePx 28–32, letterSpacingPx 4–8, surface} · table{header, rowDivider, zebra}
│                       footer{ink, sizePx ≥ 12–13, linkGap}
├─ dark                 strategy: authored | none · per-role overrides (default: derived and validated)
│                       inversionSafety: on (P1 checks) · colorSchemeMeta: "light dark"
├─ assets               logo.{light,dark}: {src(png 2×), width, height} · logo.alt · wordmark.text
│                       logo.tile: {enabled, surface, padding} · icons: png set (social, status)
└─ output               color: "hex6" · gamut: "css-color-4" · alpha: "flatten-on-surface" · units: "px"
```

**Validation that runs on every permutation:** roles resolve; gamut-map then **contrast** (light, dark, force-inverted); mid-tone band; non-white and non-black grounds; alpha flattened; weights in {400, 700} (warn); sizes ≥ 14; stack ends in a generic family and has an MSO fallback; `button.minHeight ≥ 44`; radius parses to px; container within range; logo has alt and a dark-safe treatment.

**Importers:** shadcn CSS (`:root`/`.dark`/`@theme inline`), shadcn registry items and presets (tweakcn URLs), Tailwind v4 `@theme`, DTCG files and resolvers, and Tokens Studio sets and themes. The role mapper defaults are in §12.5 and are overridable (P1 `roles`).

### 14.2 Component inventory with priorities

| Priority | Components |
|---|---|
| **P0** (v1 transactional) | EmailRoot, Preheader, Layout, Container/Section, Row/Column, Heading, Text, Link, Button, Image, Logo/Wordmark, Divider, Spacer, List, KeyValue, DataTable, LineItems/Receipt, OtpCode, Callout, Footer, Conditional |
| **P1** | CodeInline/CodeBlock, Badge, Card, Avatar, Steps/Progress, Markdown, Header (with optional nav), SocialLinks |
| **P2** (lifecycle and marketing) | Hero, Quote/Testimonial, Stats, product cards and grid, Pricing, Gallery, QR code |

### 14.3 Copy and content check candidates

| Id | Rule | Default level | Basis |
|---|---|---|---|
| `copy.subject.length` | Visible subject ≤ 60 characters (warn); key terms in the first 40 (info) | warn | S98 (vendor) |
| `copy.subject.no-fake-reply` | No leading `Re:`/`Fwd:` | error | S73 |
| `copy.subject.case` / `copy.heading.case` / `copy.button.case` | Sentence case, glossary exceptions | warn (P2: error) | P2 |
| `copy.no-emoji` | No emoji in subject, heading or button (configurable per surface) | warn | S69 P2 |
| `copy.preheader.length` | 1–90 visible characters | warn | S57 |
| `copy.preheader.not-subject` / `.no-boilerplate` | ≠ subject; no "view in browser"/"trouble viewing" | error | P1 S72 |
| `copy.preheader.padding` | Padding sequence present; not in the text part | warn | S58 |
| `copy.button.label` | Verb-first, ≤ 3 words (configurable), not "click here"/"submit", unique per email | warn | S56 P2 |
| `copy.link.text` | No bare "here", "click here" or "read more" link text | warn | S56 |
| `copy.placeholders` | No unresolved tokens. Empty or long fallbacks render cleanly (fixture sweep). | error | P1 P2 |
| `copy.glossary` | Brand terms written exactly | error | P2 |
| `copy.code-once` | OTP appears once in the HTML, once in the text, never in the preheader | error | P1 ⚠10 |
| `copy.auth.fallback-url` | Auth templates show the URL as text | warn | §6 |
| `copy.auth.no-webview` | No "view in browser" in templates carrying codes, tokens or PII | error | §8 |
| `copy.security.this-wasnt-me` | `security.*` templates include repudiation steps and contact information | error | S81 |
| `copy.receipt.reconciles` | Lines, discounts, shipping and tax sum to the total; one currency | error | S93 |
| `a11y.alt.quality` | Alt ≠ file name; no "image of"; ≤ 125 characters (warn) | warn | S91 |
| `a11y.button.target` | Computed button height and width ≥ 44px | error | S52 S55 |
| `a11y.no-role-button` / `a11y.no-generic-aria-label` | No `role=button` on `<a>`; no `aria-label` on div/span | error | S62 S92 |
| `i18n.expansion` | Pseudo-locale (length-scaled) renders with no clipping and buttons ≤ 2 lines | error | S88 |
| `i18n.rtl` | RTL pseudo-locale snapshot: mirrored alignment and columns | warn | S32 |
| `i18n.intl-format` | Dates and money only through format helpers (no literal `$`, no hand-built dates) | error | P2 |
| `text.wrap-78` / `text.urls-full` / `text.parity` | Wrapping (URLs exempt), absolute URLs, every HTML link and key fact present in the text | warn / error / warn | S76 S78 |
| `image.no-ratio-rule` | Live text in lifecycle mail < ~500 characters → info (no 60/40 rule) | info | S63 |

### 14.4 Preview studio features

1. **Client-width frames** (320, 375, 414, 600 and desktop reading panes) with a **light / authored-dark / forced-inversion** toggle. React Email 5 ships an inversion emulator as prior art [S42].
2. An **inbox mock-up**: sender name, subject and preheader truncated at measured widths (about 37/48/70 characters), plus a "first sentence as AI summary" view [S57 S98].
3. A **locale switcher** including the length-scaled pseudo-locale and the RTL pseudo-locale, with overflow highlighting [S88 S103].
4. **Images off**, **no `<style>`** (simulating clients that strip the head) and **Outlook ghost** modes (square corners, no shadows or gradients, weights snapped to 400/700) [S24–S28].
5. A **theme inspector**: the resolved role palette per permutation with contrast ratios (light, dark, inverted), gamut-mapping deltas (source → hex) and failing pairs (P1 `email-kit tokens` as a UI).
6. **Plain-text pane** with a 78-column ruler and link list, and **HTML size** against the Gmail clip using the largest fixture (P1).
7. A **fixture editor** (React Email 6.8 added a live Props tab [S43]), a fixture sweep (empty, long, hostile values), the **checks panel** with fix hints, and a caniemail-style compatibility list filtered by target clients (React Email `--clients` [S43]).
8. **Accessibility view**: heading outline, landmark and wrapper label, alt texts, link and button labels out of context, and tap-target overlay.
9. **Send test** to a real inbox, and a copy-paste of the registry item and theme preset.

### 14.5 Open questions to settle

- Is Style Dictionary (transform engine) plus our own resolver enough, or should we adopt Terrazzo for 2025.10 resolver support? Style Dictionary has no resolver support as of 5.7.1.
- Should 500 and 600 be allowed at all in the default theme (⚠1), or only behind a `brandFont.hasSemibold` flag?
- What is the default for `max(16px, 1rem)` user-scalable text (§2): off for v1 because Outlook, Yahoo and AOL lack `rem`?
- Per-recipient time zones: does the send API pass one, or does every timestamp name its zone?

---

## 15. Sources

All sources were accessed on **2026-10-27**. "Data" means the raw caniemail feature file on GitHub, with its last-tested date.

| ID | Title | URL |
|---|---|---|
| S1 | DTCG — Design Tokens Format Module 2025.10 | https://www.designtokens.org/tr/2025.10/format/ |
| S2 | DTCG — Design Tokens Color Module 2025.10 | https://www.designtokens.org/tr/2025.10/color/ |
| S3 | DTCG — Design Tokens Resolver Module 2025.10 (Final CG Report) | https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/ |
| S4 | W3C DTCG — "Design Tokens specification reaches first stable version" (2025-10-28) | https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ |
| S5 | designtokens.org FAQ (not Standards Track) | https://www.designtokens.org/faq/ |
| S6 | Style Dictionary CHANGELOG (5.3.0 colour, 5.4.0 dimension, 5.7.0 duration) | https://github.com/style-dictionary/style-dictionary/blob/main/CHANGELOG.md |
| S7 | Style Dictionary releases (v5.7.1, 2026-10-24) | https://github.com/style-dictionary/style-dictionary/releases |
| S8 | public-design-tokens-log, Nov 2025 (Style Dictionary 2025.10 support gap, #1590) | https://lists.w3.org/Archives/Public/public-design-tokens-log/2025Nov/0006.html |
| S9 | Terrazzo — Resolvers guide | https://terrazzo.app/docs/guides/resolvers/ |
| S10 | Tokens Studio changelog 2.11.4 (2026-04-02) | https://feedback.tokens.studio/changelog/2114 |
| S11 | Penpot community — "Token export is Tokens Studio format, not DTCG 2025.10" | https://community.penpot.app/t/token-export-is-tokens-studio-format-not-dtcg-2025-10/10544 |
| S12 | shadcn/ui — Theming | https://ui.shadcn.com/docs/theming |
| S13 | shadcn/ui — registry-item.json | https://ui.shadcn.com/docs/registry/registry-item-json |
| S14 | shadcn/ui — Changelog | https://ui.shadcn.com/docs/changelog |
| S15 | shadcn/ui — "npx shadcn create" (2025-12) | https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create |
| S16 | tweakcn (GitHub) | https://github.com/jnsahaj/tweakcn |
| S17 | Tailwind CSS — Colors (v4, OKLCH, `@theme`) | https://tailwindcss.com/docs/colors |
| S18 | CSS Color Module Level 4 — Gamut mapping (CRD 2026-10-26) | https://www.w3.org/TR/css-color-4/#gamut-mapping |
| S19 | CSS Fonts Module Level 4 — font matching and missing weights | https://www.w3.org/TR/css-fonts-4/#font-matching-algorithm |
| S20 | caniemail — CSS Variables (data, tested 2020-02) | https://www.caniemail.com/features/css-variables/ |
| S21 | caniemail — lch(), oklch(), lab(), oklab() (data, 2023-01) | https://www.caniemail.com/features/css-modern-color/ |
| S22 | caniemail — rgb() (data, 2021-05) | https://www.caniemail.com/features/css-rgb/ |
| S23 | caniemail — rgba() and opacity (data) | https://www.caniemail.com/features/css-rgba/ |
| S24 | caniemail — box-shadow (data, 2023-12) | https://www.caniemail.com/features/css-box-shadow/ |
| S25 | caniemail — linear-gradient() (data, incl. Gmail 2025-04 note) | https://www.caniemail.com/features/css-linear-gradient/ |
| S26 | caniemail — border-radius (data, 2021-03) | https://www.caniemail.com/features/css-border-radius/ |
| S27 | caniemail — rem unit (data, 2020-02) | https://www.caniemail.com/features/css-unit-rem/ |
| S28 | caniemail — font-weight (data, 2022-06) | https://www.caniemail.com/features/css-font-weight/ |
| S29 | caniemail — letter-spacing (data, 2020-01) | https://www.caniemail.com/features/css-letter-spacing/ |
| S30 | caniemail — @font-face (data, 2023-12) | https://www.caniemail.com/features/css-at-font-face/ |
| S31 | caniemail — word-break (data, 2022-02) | https://www.caniemail.com/features/css-word-break/ |
| S32 | caniemail — dir attribute (data, 2021-11 / 2024-04) | https://www.caniemail.com/features/html-dir/ |
| S33 | caniemail — direction (data, 2021-10) | https://www.caniemail.com/features/css-direction/ |
| S34 | caniemail — SVG image format (data, 2026-09-16) | https://www.caniemail.com/features/image-svg/ |
| S35 | caniemail — Embedded `<svg>` (data, 2020-02) | https://www.caniemail.com/features/html-svg/ |
| S36 | caniemail — GIF (data) | https://www.caniemail.com/features/image-gif/ |
| S37 | caniemail — WebP (data) | https://www.caniemail.com/features/image-webp/ |
| S38 | caniemail — AVIF (data, 2023-01) | https://www.caniemail.com/features/image-avif/ |
| S39 | Microsoft 365 Message Center MC1130385 — Retirement of inline SVG images in Outlook | https://mc.merill.net/message/MC1130385 |
| S40 | React Email — Tailwind component | https://react.email/docs/components/tailwind |
| S41 | Resend — "React Email 5.0" (2025-11-07) | https://resend.com/blog/react-email-5 |
| S42 | React Email — Changelog | https://react.email/docs/changelog |
| S43 | react-email 6.11.3 on npm (package CHANGELOG and source inspected) | https://www.npmjs.com/package/react-email |
| S44 | React Email — Components gallery | https://react.email/components |
| S45 | MJML documentation (mj-attributes, components; MJML 5) | https://documentation.mjml.io/ |
| S46 | MJML releases (5.4.0: section gutter) | https://github.com/mjmlio/mjml/releases |
| S47 | Maizzle — Tailwind CSS (v6) | https://maizzle.com/docs/tailwindcss |
| S48 | @maizzle/framework 6.3.0 on npm (package inspected) | https://www.npmjs.com/package/@maizzle/framework |
| S49 | jsx-email (docs; v3.2.1 package inspected) | https://jsx.email/ |
| S50 | emailcn (shadcn-labs) | https://github.com/shadcn-labs/emailcn |
| S51 | Ingram Technologies — shadcn-style registry (transactional email) | https://github.com/ingram-technologies/registry |
| S52 | Apple HIG — Accessibility (44×44 pt, 28×28 minimum) | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| S53 | Apple HIG — Typography (iOS 17pt default, 11pt minimum) | https://developer.apple.com/design/human-interface-guidelines/typography |
| S54 | Google Accessibility (Android) — Touch target size (48×48dp, 8dp spacing) | https://support.google.com/accessibility/android/answer/7101858 |
| S55 | W3C — Understanding SC 2.5.8 Target Size (Minimum) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| S56 | W3C — WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |
| S57 | Litmus — The Ultimate Guide to Email Preview Text (2024-11-08) | https://www.litmus.com/blog/the-ultimate-guide-to-preview-text-support |
| S58 | goodemailcode — Preview text | https://www.goodemailcode.com/email-code/preheader |
| S59 | goodemailcode — Base template | https://www.goodemailcode.com/email-code/template |
| S60 | goodemailcode — Using rem and em units in email | https://www.goodemailcode.com/email-accessibility/rem-and-em |
| S61 | goodemailcode — Should you use an h1 in email code? | https://www.goodemailcode.com/email-accessibility/should-you-use-an-h1-in-email-code |
| S62 | goodemailcode — CTA link button | https://www.goodemailcode.com/email-code/link-button |
| S63 | Email on Acid — Does text-to-image ratio affect deliverability? (2014-10-06) | https://www.emailonacid.com/blog/article/email-development/does_text_to_image_ratio_affect_deliverability/ |
| S64 | Email on Acid — View in browser link | https://www.emailonacid.com/blog/article/email-development/view-in-browser-link/ |
| S65 | Litmus — Foundations of Email Design, lesson 3 (typography) | https://www.litmus.com/wp-content/uploads/pdf/foundations-of-email-design-lesson-3.pdf |
| S66 | Style Campaign — Typographic patterns in email (2015) | https://www.stylecampaign.com/blog/typographic-patterns-in-email/ |
| S67 | Baymard Institute — Line length readability | https://baymard.com/blog/line-length-readability |
| S68 | Campaign Monitor — iOS 11 Mail CSS support (13px minimum) | https://www.campaignmonitor.com/css/email-client/ios-11-mail |
| S69 | Litmus — Special characters, emojis, line breaks for screen readers (2020) | https://www.litmus.com/blog/special-characters-emojis-line-breaks-more-tricks-for-optimizing-your-emails-for-screen-readers |
| S70 | Litmus — Ultimate guide to dark mode for email | https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers |
| S71 | Material Design 2 — Dark theme (#121212, desaturation) | https://m2.material.io/design/color/dark-theme |
| S72 | Nielsen Norman Group — The State of Transactional Email (2018) | https://www.nngroup.com/articles/state-transactional-email/ |
| S73 | Google — Email sender guidelines | https://support.google.com/a/answer/81126 |
| S74 | FTC — CAN-SPAM Act: A Compliance Guide for Business | https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business |
| S75 | RFC 8058 — One-Click Unsubscribe | https://www.rfc-editor.org/rfc/rfc8058 |
| S76 | RFC 5322 §2.1.1 — Line length limits | https://www.rfc-editor.org/rfc/rfc5322#section-2.1.1 |
| S77 | RFC 3676 — format=flowed | https://www.rfc-editor.org/rfc/rfc3676 |
| S78 | RFC 3986 Appendix C — Delimiting a URI in context | https://www.rfc-editor.org/rfc/rfc3986#appendix-C |
| S79 | OWASP — Forgot Password Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html |
| S80 | OWASP — Authentication Cheat Sheet (email change) | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| S81 | NIST SP 800-63B-4 — Authenticator events and notifications (§4.1, 4.2, 4.5, 4.6) | https://pages.nist.gov/800-63-4/sp800-63b/events/ |
| S82 | Android Authority — Gmail "Copy code" for 2FA emails (2026-09-21) | https://www.androidauthority.com/gmail-copy-2fa-codes-inbox-3713263/ |
| S83 | Apple Developer Forums — AutoFill verification codes received in Mail | https://developer.apple.com/forums/thread/738690 |
| S84 | Knak — Apple Intelligence, Mail categories and Branded Mail | https://knak.com/blog/apple-intelligence-ios18-2/ |
| S85 | Stytch — Magic links overview (scanners consuming tokens) | https://stytch.com/docs/consumer-auth/authentication/magic-links/overview |
| S86 | Supabase discussion #41618 — tokens consumed by email scanners | https://github.com/orgs/supabase/discussions/41618 |
| S87 | M3AAWG — Sender Best Common Practices (2026-08-27) | https://www.m3aawg.org/sites/default/files/doc_files/m3aawg-sender-best-common-practices-aug-27-2026.pdf |
| S88 | W3C i18n — Text size in translation | https://www.w3.org/International/articles/article-text-size |
| S89 | Unicode blog — CLDR 47 (MessageFormat 2.0 stable) | https://blog.unicode.org/2025/02/unicode-cldr-47-beta-available-for.html |
| S90 | TC39 — Intl.MessageFormat proposal (Stage 1) | https://github.com/tc39/proposal-intl-messageformat |
| S91 | W3C WAI — An alt decision tree (2024-05-13) | https://www.w3.org/WAI/tutorials/images/decision-tree/ |
| S92 | W3C — WAI-ARIA 1.2 (roles that cannot be named) | https://www.w3.org/TR/wai-aria-1.2/#namefromprohibited |
| S93 | Stripe — Receipts and paid invoices | https://docs.stripe.com/receipts |
| S94 | Stripe — EU VAT invoice content requirements | https://stripe.com/resources/more/eu-vat-invoice-content-requirements |
| S95 | Petri — Microsoft commits to classic Outlook for Windows until 2029 | https://petri.com/microsoft-classic-outlook-for-windows-2029/ |
| S96 | Bird & Bird — Navigating the European Accessibility Act (2025) | https://www.twobirds.com/en/insights/2025/a-guide-to-navigating-the-european-accessibility-act-for-online-retailers-service-providers-and-plat |
| S97 | WooCommerce developer docs — Email HTML best practices (600–640px) | https://developer.woocommerce.com/docs/features/email/email-html-best-practices/ |
| S98 | BuzzStream — Email subject line length: what the data says | https://www.buzzstream.com/blog/email-subject-line-length/ |
| S99 | Buttondown — Can you use web fonts in email? (2026) | https://buttondown.com/blog/newsletter-custom-fonts |
| S100 | Mailgun — Microsoft sender requirements (May 2025) | https://www.mailgun.com/blog/deliverability/microsoft-sender-requirements/ |
| S101 | W3C i18n — Inline markup and bidirectional text in HTML | https://www.w3.org/International/articles/inline-bidi-markup/ |
| S102 | RFC 4647 §3.4 — Language tag lookup | https://www.rfc-editor.org/rfc/rfc4647#section-3.4 |
| S103 | Android Developers — Pseudolocales (en-XA, ar-XB) | https://developer.android.com/guide/topics/resources/pseudolocales |
| S104 | W3C i18n — Language enablement / text layout requirements (JLREQ, CLREQ, KLREQ) | https://www.w3.org/International/layout |
| P1 / P2 | Reference docs: `docs/reference-docs/email-package-1/` (05, 06, 07) and `email-package-2/` (architecture, requirements, walkthrough) | local |
