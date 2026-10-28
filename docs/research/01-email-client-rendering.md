# 01 — Email-client rendering and HTML/CSS compatibility

**Scope.** This file covers how email clients render HTML and CSS, as input to the framework's
output format, its component behaviour and its check engine. Topics: the client landscape and
rendering engines, the document skeleton, CSS support, layout, buttons, images, fonts, size limits,
Outlook (Word) specifics, preheaders, interactive email and AMP, emoji, RTL and minification. Dark
mode is mentioned only briefly because another slice covers it.

**Verified:** 2026-10-27. **Main data:** the caniemail.com data API (`api_version` 1.0.4,
`last_update_date` 2026-09-16, 308 features) [ce-api], Google and Microsoft vendor pages, Microsoft
365 Message Center notices, and the `hteumeuleu/email-bugs` tracker read through 2026-10-14.
Practitioner sources (Litmus, goodemailcode.com, Spam Resource, Email on Acid) fill the gaps. Many
caniemail test dates are 2019–2021. The test date is given wherever it matters, and an old result is
a lead, not proof.

**How to read the rule tables**
- **Level** is the framework requirement. **MUST** means the output is broken or unreadable in a
  major client without it. **SHOULD** means visible degradation or meaningful risk. **MAY** is an
  optional improvement.
- **Check** says whether a build-time linter can enforce the rule, and how. "Parse" means an HTML or
  CSS parser (for example parse5 and postcss) runs over the *built* output. "Manual" means the rule
  needs rendering tests (Litmus, Email on Acid or real devices).
- **Client abbreviations:** OL-Win = classic Outlook for Windows (Word engine). New OL = new
  Outlook for Windows. OWA = Outlook on the web / Outlook.com. GANGA = Gmail apps showing a
  non-Google (IMAP) account. Gm-web = Gmail desktop webmail. Gm-apps = Gmail iOS/Android with a
  Google account.
- Δ = changed in 2024–2026. ≠ = contradicts or corrects the reference docs.

---

## 0. What changed in 2024–2026 (at a glance)

| Date | Change | Impact on the framework | Source |
|---|---|---|---|
| 2024-01 | Gmail's Basic HTML view retired; users moved to the standard view | One fewer stripped-down Gmail renderer | [reg-basic] |
| 2024-06→07 | OWA briefly stripped `<style>` in `<head>` worldwide, then rolled back. Still reported on OWA's touch/mobile web view in 2025-01 | Inline styles must carry the design on their own | [eb141] |
| 2024-10 | Classic Outlook 365 (build 2408) shown displaying a linked `.svg` `<img>` | SVG support is not "Word = never" | [cei468] |
| 2024-12-31 | Windows Mail & Calendar apps (Word engine) end of support, replaced by new Outlook | Drop "Windows 10 Mail" from the test matrix | [ms-winmail] |
| 2025-06 | Outlook iOS/Android confirmed to drop all CSS after a `}}` (no space) | Minifiers must not emit `}}` | [eb147], [eb92] |
| 2025-06 | Yahoo Android no longer strips the first `<head>` (caniemail retest) | The "double `<head>`" hack is obsolete | [ce-html-style] |
| 2025-08 | Gmail mobile webmail on Android rewrites `img{max-width:100%}` to `max-width:1140px` | Fluid images also need `width:100%` | [eb152] |
| 2025-09→10 | Microsoft retired inline SVG display in OWA and new Outlook (blank space instead) | SVG ban stays; see §6 | [ms-svg] |
| 2025-10 | Yahoo/AOL drop `class` from self-closing `<img … />` and `<hr … />` | Serialise void elements without `/`, or don't target images by class | [eb157] |
| 2025-10-14 | Office/Outlook 2016 and 2019 end of support | Still installed, so still render | [ms-eos] |
| 2025-10 → 2026-05 | Outlook Lite (Android) stopped installs, then fully retired 2026-05-25 | Drop from the matrix | [ms-lite] |
| 2025-12 | Gmail confirmed to delete a whole `style` attribute or `<style>` block containing space-separated `rgb(0 0 0)` | Colour serialisation is critical (§3.5) | [eb160] |
| 2026-01 | Gmailify and POP fetching ended. Non-Google accounts in Gmail now come in by IMAP | More readers on GANGA rendering (inference) | [reg-pop], [heise-gmailify] |
| 2026-02 | La Poste and SFR deliberately comment out `<style>` in `<head>` | Inline-first is mandatory for French audiences | [eb161] |
| 2026-03 | Microsoft delayed the enterprise new-Outlook opt-out stage from April 2026 to **March 2027** | Classic Outlook stays a first-class target | [ms-mc949965], [dom-delay] |
| 2026-07 | Outlook 365 for Windows dropped `letter-spacing` (breaks spacer and button hacks) | Use `mso-font-width`/`mso-text-raise` instead | [eb164], [gec-button] |
| 2026-08 | Early Gmail clipping caused by special characters reportedly no longer reproduces | Downgrade "entity-encode everything" to SHOULD | [eb41] |
| 2026-09 | Gmail renders **linked** SVG, rasterised to PNG by its proxy | ≠ contradicts "Gmail blocks SVG" | [ce-image-svg], [cei597] |
| 2026-09 | Gmail iOS/Android honour `<meta name="color-scheme" content="light only">` (that value only) | Dark-mode slice | [ce-meta-cs] |
| 2026-10 | Classic Outlook stops painting VML shapes more than ~32,000 px from the top of the message | VML buttons vanish in long emails | [eb166] |
| 2024–2026 | Apple Intelligence summaries replace the preheader in Apple Mail's message list (on by default where available) | Preheaders matter less on Apple, still matter elsewhere | [oracle-ai], [stripo-ai] |

## 0.1 Where this contradicts or corrects the reference docs

| Reference claim | Finding | Verdict |
|---|---|---|
| Package-1: "No SVG — blocked across major clients since late 2025 after malicious payloads"; "SVG is blocked by Gmail/Outlook/Yahoo" | **Partly true.** Microsoft retired SVG display in OWA and new Outlook in Sept–Oct 2025, citing XSS/phishing [ms-svg]. But Gmail now *renders* linked SVG, rasterised to PNG (caniemail, 2026-09) [cei597]. Yahoo/AOL, Apple Mail and classic Outlook 365 render linked SVG [ce-image-svg]. Inline `<svg>` markup has never worked in Gmail, Outlook or Yahoo [ce-html-svg] | ≠ The **rule stays MUST**, but the reason should read "OWA and new Outlook show a blank, inline `<svg>` is unsupported in Gmail, Outlook and Yahoo, and Gmail rasterises" |
| Package-1: flex/grid "unsupported in Word / Outlook.com" | OWA, new Outlook, and Outlook Mac/iOS/Android **support** flex and grid [ce-flex], [ce-grid]. They fail in classic Outlook, GANGA, GMX/Web.de desktop and Orange | ≠ Keep the ban and fix the reason |
| Package-1: Gmail "discards a whole `<style>` block that contains a nested at-rule" | Gmail keeps fully declared nested `@media`. It drops the block for bare or unsupported inner at-rules (`@media{@media{…}}` without a query, `@viewport`) [eb21]. Gmail also drops whole blocks for causes package-1 doesn't list: uppercase `!IMPORTANT` [eb13], space-separated `rgb()` [eb160], modern colour functions [ce-modern-color], and anything past a cumulative ~16 KB of styles [eb90] | Keep the conservative check and **add** the other triggers |
| Package-1: Gmail clips at "~102 KB of raw HTML" | Still the working threshold in 2025–26 vendor docs. It is measured on the **HTML MIME part**, not the whole message. Spam Resource measured ~105 KB raw or quoted-printable and ~110 KB base64 (2022) [spamres-clip]. ESP-injected tracking URLs count | Correct; spell out the unit (§8) |
| Package-1: "MJML stacks columns itself, so no custom mobile media query is needed" | MJML emits a `min-width` media query to set desktop column widths. Where `<style>` is stripped (GANGA, Gmail mobile webmail, GMX/Web.de desktop, La Poste/SFR), columns stay stacked at every width | ≠ The behaviour is acceptable, but the statement is inaccurate |
| Package-2: "No fixed width over 360 px" (test: no `width: Npx` over 360) | A hybrid layout *needs* fixed widths for classic Outlook: `width="600"` ghost tables inside `<!--[if mso]>`, and `max-width:600px` | ≠ The check must exempt MSO-conditional content and `max-width` |
| Package-1: weights "400/500/600 only" | Arial, Helvetica and many system fallbacks have only 400 and 700. CSS font matching renders 500 as 400 and 600 as 700 [w3c-fonts] | Treat fallback rendering as two weights |
| Package-1: `format-detection` meta stops iOS data detectors | It is only a hint with limited support [gec-template]. The `a[x-apple-data-detectors]` CSS reset does the real work | Keep both; don't rely on the meta |
| Common folklore: "Word-engine Outlook retires in October 2026" | Only Office LTSC 2021 support ended (2026-10-13) [ms-eos]. Classic Outlook for Microsoft 365 is supported until **at least 2029** and Outlook LTSC 2024 until Oct 2029. Enterprise migration starts March 2027, and cutover (removal) is no earlier than March 2028 [dom-delay] | Classic Outlook stays a target until at least 2029 |

---

## 1. Client landscape

### 1.1 Market share (opens-based, so treat with care)

| Source / month | Apple | Gmail | Outlook (desktop) | Yahoo | Google Android | Outlook.com | Notes |
|---|---|---|---|---|---|---|---|
| Litmus, Sep 2026 (1.5 B opens) [litmus-share] | 76.56 % | 16.10 % | 3.48 % | 2.35 % | 0.94 % | 0.29 % | Thunderbird 0.13 %, Orange 0.07 %, Samsung 0.01 % |
| Litmus, Jul 2026 (secondary copy) [outsolvi] | 62.26 % | 27.03 % | 5.83 % | — | — | — | A 14-point swing in two months shows how sample-driven these figures are |

- **Apple is inflated.** Litmus counts Mail Privacy Protection (MPP) pre-fetches as Apple opens and
  says MPP affects about 55–60 % of all opens [litmus-share]. MPP opens carry no client version.
- **Gmail and Outlook are deflated.** Gmail's image cache reports one "Gmail" open with no device.
  Classic Outlook blocks images by default [ms-pictures], so many Outlook reads never register.
  B2B and enterprise audiences skew heavily to Outlook.
- **Framework stance.** Market share decides test priority, not support. Treat Apple Mail, Gmail
  (web and apps), Outlook (classic, new and OWA) and Yahoo as tier 1. Treat Samsung, Outlook mobile,
  GANGA, Thunderbird, GMX/Web.de and Orange as tier 2.

### 1.2 Clients, engines and recent changes

| Client | Rendering engine / sanitiser | CSS posture | Notable 2024–26 status |
|---|---|---|---|
| **Classic Outlook for Windows** (2016–2024, M365) | Microsoft **Word** HTML engine (HTML 4 / CSS 1 subset) [ms-word] | Tables, `width`/`height` attributes, padding on `<td>` only, no `max-width`, `float`, `position` or `background-image`; VML for shapes | Δ 2016/19 EOS Oct 2025, 2021 EOS Oct 2026. M365 and LTSC 2024 supported to ≥2029. Lost `letter-spacing` support in 2026 [eb164]. VML 32k px limit [eb166] |
| **New Outlook for Windows** | WebView2 (Chromium) with the OWA sanitiser. HTML/CSS handling "almost identical" to OWA [emc-newol] | Like OWA. **Ignores MSO conditional comments** | Δ Consumer default since 2024; enterprise opt-out from **Mar 2027**. Inline SVG blank since 2025 [ms-svg]. Unconfirmed preview-pane layout regressions [eb148] |
| **Outlook.com / OWA** | Browser with server-side sanitiser: prefixes classes (`x_`), filters attribute selectors, adds `data-ogsc`/`data-ogsb` in dark mode | `<style>` and media queries (not nested), flex/grid, border-radius, background images. No gradients, CSS variables, `@font-face`, `calc()` or `clamp()` | Δ Head `<style>` stripping incident (2024) [eb141]. `}}` bug [eb92]. SVG blank (2025) |
| **Outlook for Mac** (new) | WebKit plus the Outlook sanitiser. caniemail 16.80 shows OWA-like limits | No CSS variables, `@font-face` or animation (all were supported in the legacy Mac app) | Legacy Mac app gone |
| **Outlook iOS / Android** | Native app WebView plus the Outlook sanitiser | Like OWA; `}}` bug [eb147] | iOS "Read more" truncation at ~5,000 px reported (2022, unverified since) [eb108]. Outlook Lite retired [ms-lite] |
| **Gmail web** | Google sanitiser in the browser. `<style>` kept in head only, classes and ids rewritten, 16 KB style cap [eb90] | Media queries (width, orientation, resolution), flex/grid, border-radius, background images. No CSS variable declarations, `@font-face`, `position`, `:checked` or `prefers-color-scheme` [g-css] | Google doc updated 2026-09-15. Δ Renders linked SVG as PNG (2026) |
| **Gmail iOS / Android (Google account)** | Same sanitiser in an app WebView | As Gmail web, minus `:hover` on iOS | Δ `color-scheme: light only` honoured (2026) |
| **GANGA** (Gmail app with IMAP account) | Gmail app with the older pipeline | **No `<style>`**: inline only. No flex/grid, background images or media queries [ce-html-style], [ce-flex] | Δ Gmailify ended Jan 2026, so more accounts land here (inference) |
| **Gmail mobile webmail** (phone browser) | Google sanitiser | **No `<style>`**, no `display:none` [ce-display-none] | Android rewrites img `max-width:100%` [eb152] |
| **Apple Mail macOS / iOS** | WebKit, minimal sanitising, MPP proxy pre-fetch | Near-browser support: media queries, `prefers-color-scheme`, CSS variables, `@font-face`, `:has()`, OKLCH, `<video>` | iOS 26 "Liquid Glass" changed app chrome. No documented engine change; one unverified iOS 26.2 scaling report [apple-forum] |
| **Yahoo Mail / AOL** | Yahoo web sanitiser (AOL runs on the Yahoo platform) | `<style>` with limited media queries (`screen`, min/max width/height). No CSS variables or gradients. Attribute selectors `[a=b]` only. Rewrites `height` to `min-height` | Δ New Yahoo Mail web broke media queries in dark mode, fixed Dec 2025 [eb159]. Drops `class` on self-closing `<img/>` [eb157] |
| **Samsung Email** (Android) | Android System WebView | Broad support (CSS variables, `:has`, `@font-face`) **except with Microsoft accounts** (media queries, fonts and gradients stripped) [ce-at-media], [ce-font-face] | — |
| **Thunderbird** | Gecko | Broad; remote content **blocked by default** [moz-remote] | caniemail 149 shows no CSS animation |
| **Proton Mail** | Web sanitiser; remote images pre-loaded through a proxy, trackers blocked by default [proton] | CSS variables, OKLCH, `:has`; no `@font-face` on web | Δ Many caniemail Proton additions in 2026 |
| **Fastmail** | Web sanitiser | Flex/grid, OKLCH; `var()` without declarations; `prefers-color-scheme` rewritten to `@media all` when it applies | — |
| **HEY** | Web | `<style>`, `@font-face`; no `prefers-color-scheme` | — |
| **GMX / Web.de** (United Internet) | Desktop webmail **strips `<style>`**; iOS/Android apps keep it | Desktop: no flex/grid, CSS variables, border-radius or `rgba()` | Preview text taken from the text/plain part [gec-preheader] |
| **Orange / SFR / La Poste** (FR) | Webmail sanitisers | Orange: no CSS variables, flex/grid, border-radius or `rgba()`; `<input>` becomes `<noinput>`. La Poste/SFR: `<style>` commented out | Δ [eb161] |
| **T-Online** (DE) | Webmail | Renders MSO conditional-comment content [eb43]; shows a stray "96" from the DPI XML unless wrapped in `<noscript>` [gec-template] | — |

### 1.3 Microsoft Outlook timeline (as of 2026-10-27)

| Date | Event | Source |
|---|---|---|
| 2024 | New Outlook for Windows declared generally available; consumer rollout | [dom-ga] |
| 2024-12-31 | Windows Mail/Calendar end; users moved to new Outlook | [ms-winmail] |
| 2025-10-14 | Outlook 2016 / 2019 end of support | [ms-eos] |
| 2026-10-13 | Outlook LTSC 2021 end of support | [ms-eos] |
| **2027-03** | **Enterprise opt-out stage**: new Outlook becomes the default for Microsoft 365 Apps for enterprise; users can switch back. Perpetual-licence and on-prem accounts are skipped (MC949965, updated 2026-02-20) | [ms-mc949965], [winlatest] |
| ≥ 2028-03 | Cutover (classic removed from M365 Apps), with ≥ 12 months' notice | [dom-delay] |
| ≥ 2029 | Classic Outlook support commitment; Outlook LTSC 2024 supported to Oct 2029 | [dom-2029], [ms-eos] |

### 1.4 Landscape rules

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Support classic Outlook (Word) by default until at least 2029, behind a target flag (`targets.outlookClassic`, default `true`) | Supported until ≥2029; enterprise default flips only in 2027; perpetual and on-prem installs are exempt from migration | OL-Win | MUST | Config: the check engine reads the target set and enables `mso.*` checks | [dom-delay], [ms-mc949965] |
| Every design must survive with **no `<style>` at all** (inline styles only) | GANGA, Gmail mobile webmail, GMX/Web.de desktop and La Poste/SFR strip it; OWA has stripped it before | Many | MUST | Render a "style-stripped" variant in tests, then run contrast and width checks on it | [ce-html-style], [eb161], [eb141] |
| Don't treat market share as audience share; let users pick test tiers | MPP and image caching distort open-based data | — | SHOULD | — | [litmus-share] |

---

## 2. Document skeleton

Reference shape. This is the target, not framework code. It is based on [gec-template] and the
rules below.

```html
<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <meta name="color-scheme" content="light dark"><!-- dark-mode slice decides the value -->
  <title>{subject}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>/* ≤ 16 KB total, lowercase !important, no `}}` */</style>
</head>
<body style="margin:0;padding:0;">
  <div role="article" aria-roledescription="email" aria-label="{subject}" lang="en" dir="ltr">
    <!-- preheader first, then a 100%-wide wrapper table carrying the page background -->
  </div>
</body>
</html>
```

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Use the HTML5 doctype `<!DOCTYPE html>` | Standards mode in WebKit/Blink clients. HTML 4 doesn't allow `display:block` on `<td>`. Classic Outlook ignores it | All except OL-Win | SHOULD | Output starts with `<!doctype html>` (case-insensitive) | [ce-doctype], [gec-template] |
| Put `lang` and `dir` on `<html>` **and** repeat them on a wrapper `<div>` | Gmail, OWA and Yahoo replace `<html>`/`<body>`, losing their attributes; screen readers pick the voice from `lang` | Gmail, OWA, Yahoo | MUST | The first element in `<body>` has `lang` and `dir` equal to `<html>`'s | [gec-template], [ce-html-body] |
| Wrapper `role="article"`, `aria-roledescription="email"` (translated), `aria-label` = subject | Gives a landmark for screen readers | Clients that keep ARIA | SHOULD | Wrapper has all three; `aria-label` is non-empty | [gec-template] |
| Declare `xmlns:o` (always) and `xmlns:v` (only if VML is used) on `<html>` | Word needs the namespaces for `o:` XML and `v:` shapes | OL-Win | MUST (if `o:`/`v:` used) | If the output contains `<o:` or `<v:`, `<html>` declares the matching namespace | [gec-template] |
| `<meta charset="utf-8">` and MIME `Content-Type: text/html; charset=utf-8` | The MIME header wins over the meta. A wrong charset garbles text and has triggered Gmail clipping [eb41] | All | MUST | Parse: the meta is present and first in `<head>`; the transport test asserts the header | [eb41] |
| `<meta name="viewport" content="width=device-width, initial-scale=1">` | Mobile layout and zoom | Mobile clients | MUST | Parse the meta | [gec-template] |
| `<meta name="x-apple-disable-message-reformatting">` | Stops Apple Mail scaling or enlarging the layout; the email must then be responsive itself | Apple Mail iOS | SHOULD | Parse the meta | [gec-template] |
| `format-detection` meta **plus** a CSS reset `a[x-apple-data-detectors]{color:inherit!important;…}` | The meta is only a hint; the reset fixes blue auto-links | Apple Mail | SHOULD | Parse both | [gec-template] |
| `<title>` equals the subject | Shown in web views and some previews; serves accessibility | Web views | SHOULD | `<title>` non-empty and equal to the catalogue subject | [gec-template] |
| `PixelsPerInch` 96 XML inside `<!--[if mso]><noscript><xml>…</xml></noscript><![endif]-->` | Word scales on high-DPI screens; `<noscript>` hides the stray "96" in T-Online | OL-Win, T-Online | MUST (if classic target) | Regex inside the MSO block; `noscript` wraps the `xml` | [gec-template], [relone-dpi] |
| Don't rely on `<body>` attributes or styles (`bgcolor`, background, padding). Paint the background on a 100%-width wrapper table or div | `<body>` becomes a `<div>` (Gmail, OWA, Yahoo) or keeps only some attributes | Gmail, OWA, Yahoo, Proton, Fastmail | MUST | `<body>` style limited to `margin:0;padding:0`; the wrapper carries the background | [ce-html-body] |
| `<style>` only in `<head>`, never in `<body>` | Gmail ignores body styles. (OWA mobile web once kept only body styles; accepted trade-off) | Gmail | MUST | Parse: no `<style>` that descends from `<body>` | [ce-html-style], [eb141] |
| No `<link rel="stylesheet">` or `@import` | Unsupported almost everywhere except Apple and classic Outlook; adds a tracking request | Most | MUST | Parse | [ce-link], [ce-import] |
| Omit `X-UA-Compatible` and `<o:AllowPNG/>` | Legacy IE/Outlook-2007 artefacts with no current effect | — | MAY | — | (practitioner consensus) |

---

## 3. CSS support

### 3.1 Inline styles vs `<style>`

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Inline every presentational declaration on the element it styles. `<style>` is only for progressive enhancement (media queries, `:hover`, dark mode, client fixes) | `<style>` is stripped in GANGA, Gmail mobile webmail, GMX/Web.de desktop and La Poste/SFR, and is fragile elsewhere | Many | MUST | Diff: rendering with `<style>` removed still passes width, contrast and visibility checks | [ce-html-style] |
| Declare head rules **before** the elements they style (keep `<style>` in `<head>`) | Classic Outlook applies `<style>` rules only if declared before use | OL-Win | MUST | Parse | [ce-html-style] |
| Override inline styles from `<style>` only with lowercase ` !important`, space before `!` | Gmail drops the block on any non-lowercase `!important`; Outlook, Orange and Yahoo need the space | Gmail, OL-Win, Orange, Yahoo | MUST | postcss: every `important` token is `!important`, preceded by whitespace | [eb13], [ce-important] |
| Never put `!important` inside inline `style=""` | Classic Outlook ignores inline `!important`; nothing needs to override inline | OL-Win | SHOULD | Parse inline styles | [ce-important] |
| Target elements with a **single** class in head CSS meant for classic Outlook | Word applies only the first class in a `class` list | OL-Win | SHOULD | MSO-scoped CSS uses single-class selectors | [eb75] |

### 3.2 Gmail's style-block rules

| Rule | Detail | Level | Check | Source |
|---|---|---|---|---|
| Keep total `<style>` content **≤ 16 KB** (cumulative across blocks) | Gmail keeps rules up to ~16,384 bytes; the block that crosses the limit is removed entirely | MUST (fail ≥ 16 KB, warn ≥ 12 KB) | Sum the UTF-8 bytes of all `<style>` text | [eb90], [ce-html-style] |
| Any parse error, bare nested at-rule (`@media{@media{…}}`), or unsupported inner at-rule (`@viewport`) **drops the whole block** | Fully declared nested `@media` survives, but don't rely on it | MUST (no at-rule nested in an at-rule) | postcss: reject nested at-rules; reject anything a strict parser flags | [eb21] |
| Uppercase or mixed-case `!IMPORTANT` drops the whole block or attribute | — | MUST | Regex `/!\s*important/i` matches only lowercase | [eb13] |
| Space-separated colour syntax (`rgb(0 0 0)`, `rgb(0 0 0 / 1)`) drops the whole block, or the whole inline `style` attribute | Also applies to `lch()`/`oklch()`/`lab()`/`oklab()`, which "remove all inline styles applied to that element" | MUST | postcss value parser: colour functions use comma syntax or are hex | [eb160], [ce-rgb], [ce-modern-color] |
| Selectors: type, class and id are supported. Classes and ids are **rewritten with a prefix**; attribute selectors work only as `[class~=x]`; `:hover` works on web and Android, not iOS; no `:checked` or `:has()` | Don't rely on attribute, sibling or pseudo selectors for Gmail | SHOULD | Lint head selectors against the Gmail allow-list (warn) | [g-css], [ce-attr-sel], [ce-hover], [ce-checked], [ce-has] |
| Media queries: types `all`/`screen`; features `min/max-width`, `min/max-device-width`, `orientation`, `min/max-resolution`. **No height queries, no `prefers-color-scheme`** | — | SHOULD | Lint media features against the allow-list | [g-css], [ce-at-media] |
| `var()` is kept but **custom-property declarations are stripped**, so CSS variables don't work | — | MUST (none emitted) | Reject `--*:` declarations and `var(` | [ce-variables] |
| GANGA and Gmail mobile webmail support **no `<style>`** | Inline only | MUST (inline-first) | — | [ce-html-style] |
| "View entire message" (after clipping) shows the email **without `<style>`** | Clipped emails lose responsive and dark rules below the fold | SHOULD (stay under the clip) | Size check | [eb56] |
| With images off, Gmail strips `!important` from styles | Overrides fail until images load | MAY (awareness) | — | [eb70] |
| Gmail web loads only Roboto and Google Sans; `@font-face` is unsupported | — | — | — | [ce-font-face] |

### 3.3 Other sanitiser traps

| Rule | Affected | Level | Check | Source |
|---|---|---|---|---|
| Never emit `}}`. Separate closing braces with a space or newline; otherwise all CSS after it is dropped | OWA, new Outlook, Outlook iOS/Android | MUST | Regex `/}\s*}/` must have whitespace: fail on `}}` | [eb92], [eb147] |
| No CSS nesting syntax (`a{ b{} }`). Yahoo removes the nested selector and applies its properties **to the parent** | Yahoo, Gmail, Outlook | MUST | postcss: rule inside rule | [ce-nesting] |
| Don't put CSS comments inside inline `style` attributes; strip comments from `<style>` | Orange deletes the whole rule or attribute; Yahoo once ignored a rule after a comment | SHOULD | Parse: no `/*` in `style=""`; minify `<style>` comments away | [ce-css-comments] |
| No invalid or garbage characters in declaration values (backticks, stray `=`) | Gmail, OWA and Office 365 drop the whole inline `style` attribute | MUST | postcss parse of each inline style must succeed with no warnings | [eb19] |
| Don't rely on `class` attributes on `<img>`/`<hr>` written self-closing (`/>`) | Yahoo/AOL drop the class | SHOULD | Serialise void elements without `/`, or flag `img[class]` | [eb157] |
| Don't depend on `height` on non-table elements (Yahoo turns it into `min-height`) | Yahoo | SHOULD | — | [ce-height] |

### 3.4 Property support matrix (latest caniemail result per client; Y = yes, P = partial, N = no)

| Feature | Apple | Gm-web | Gm-apps | GANGA / Gm mobile web | OL-Win | OWA / new OL | OL Mac | OL iOS/And | Yahoo/AOL | Samsung | Thunderbird | GMX/Web.de desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `<style>` [ce-html-style] | Y | P head only, 16 KB | P | N / N | P declare first | Y | Y | Y | Y | Y | Y | N |
| `@media` [ce-at-media] | Y | P no height | P | N | N | P no nesting | P | P | P width/height only | P not MS accts | N* | Y |
| CSS variables [ce-variables] | Y | N | N | N | N | N | N | N | N | Y | Y | N |
| `display:flex` [ce-flex] | Y | Y | Y | N / Y | N | Y | Y | Y | Y (no inline-flex) | Y | Y | N |
| `display:grid` [ce-grid] | Y | Y | Y | N / Y | N | Y | Y | Y | Y | Y | Y | N |
| `max-width` [ce-max-width] | Y | Y | Y | Y | N (2019+: tables only) | Y | Y | Y | Y | Y | Y | Y |
| `margin` [ce-margin] | Y | P no negative | P | P | P no `auto`, not on span/body | P | P | P | P | Y | Y | Y |
| `padding` [ce-padding] | Y | Y | Y | Y | P `<td>` only; row-equalised | Y | Y | Y | Y | Y | Y | Y |
| `border-radius` [ce-radius] | Y | Y | Y | Y | N (VML) | Y | Y | Y | P | Y | Y | N |
| `background-image` [ce-bg-image] | Y | Y | Y | N / Y | N (VML) | Y | Y | Y | P single value | Y | Y | P |
| `linear-gradient` [ce-gradient] | Y | Y | Y (Android inline bug) | — | N (VML) | N | N | N | N | P | Y | N |
| `box-shadow` [ce-box-shadow] | Y | N | N | P / N | N | Y | Y | Y | N | Y | Y | N |
| `@font-face` [ce-font-face] | Y | N | N | N | P remote fonts ignored, falls back to TNR | N | N | N | N | Y (not MS accts) | Y | N (apps Y) |
| `rgb()` comma / `rgba()` [ce-rgb], [ce-rgba] | Y / Y | Y / Y | Y / Y | Y / Y | P / N | Y / Y | Y / Y | Y / Y | Y / Y | Y / Y | Y / Y | P / N |
| `oklch()`/`lab()` [ce-modern-color] | Y | N (strips the whole inline style) | N | N | N | N | N | N | N | N | N | — |
| `calc()` / `clamp()` / `min()` [ce-calc], [ce-clamp] | Y | Y | P | N / Y | N | N | N | N | N | P | Y | N |
| `position` [ce-position] | P | N | N | N | N | P sticky only | P | P | P relative | P | Y | Y |
| `float` [ce-float] | Y | Y | Y | Y | N (`align` attr) | Y | Y | Y | Y | Y | Y | Y |
| Attribute selectors [ce-attr-sel] | Y | P `[class~=]` | P | N | N | P | P | P | P `[a=b]` | Y | Y | N |
| `:hover` [ce-hover] | Y | Y | N iOS / P And | N | N | P type sel. | P | N iOS / Y And | Y | Y | Y | N |
| `:checked` [ce-checked] | Y | N | N | N | N | P type sel. | P | P | Y | Y | Y | N |
| `:has()` [ce-has] | Y | N | N | N | N | N | N | N | N | Y | N | N |
| `@supports` [ce-supports] | Y | N | N | N | N | N | N | N | Y (filtered) | Y | N | N |
| `display:none` [ce-display-none] | Y | Y | Y | Y / **N** | P not inherited by nested tables, not on `<img>` | Y | Y | Y | Y | Y | Y | Y |

\* Thunderbird macOS `@media` is "N" in caniemail's test. Odd for Gecko; treat as uncertain.

### 3.5 Colour syntax (critical for shadcn/OKLCH themes)

shadcn/ui's default theme defines tokens in `oklch()` (for example `--background: oklch(1 0 0)`)
[shadcn]. No major webmail or Outlook supports OKLCH. In Gmail, a single modern-colour value
deletes **every** inline declaration on that element [ce-modern-color].

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Resolve every colour at build time to **6-digit hex** (`#rrggbb`), after gamut-mapping OKLCH to sRGB | Hex is the only syntax that is universal, VML-compatible and accepted by Word `bgcolor` attributes | All | MUST | postcss value parser and attribute scan: colour values match `^#[0-9a-f]{6}$` (allow `transparent`; warn on 3-digit) | [ce-modern-color], [ce-rgb] |
| Never emit `oklch()`, `oklab()`, `lch()`, `lab()`, `color-mix()`, `color()`, `light-dark()`, `hsl()` with spaces, or space-separated `rgb()` | Gmail strips styles or blocks; Outlook and Yahoo ignore them. No caniemail data for `color-mix()`, so treat it as unsupported | Gmail, Outlook, Yahoo, Samsung | MUST | Regex over CSS values | [ce-modern-color], [eb160], [ce-light-dark] |
| Pre-composite alpha colours against their known background; don't emit `rgba()` or `#rrggbbaa` | `rgba()` is unsupported in classic Outlook, Orange and GMX/Web.de desktop; 8-digit hex is untested | OL-Win, Orange, GMX | SHOULD | Flag `rgba(`, `hsla(` and 8-digit hex | [ce-rgba] |
| Note that Gmail rewrites hex to `rgb()` in its output; irrelevant to authors but explains DOM inspection | — | Gmail | — | — | [eb70] |

### 3.6 Other CSS rules

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Layout must not depend on flex, grid, `float`, `position`, `calc()`, `clamp()`, `:has()` or `@supports` | Classic Outlook, GANGA, GMX/Web.de desktop and Orange lack them | See matrix | MUST | Lint inline and head CSS (package-1 `html.banned-css`, extended) | [ce-flex], [ce-position] |
| Spacing with `padding` on `<td>`, not `margin` (no negative margins, no `margin:auto` centring) | Margins are partial in Word, Gmail, OWA and Yahoo; Word bleeds background into margin | OL-Win, Gmail, OWA, Yahoo | SHOULD | Flag negative margins and `margin…auto` outside MSO-safe patterns | [ce-margin], [ce-padding] |
| Rounded corners are progressive enhancement: designs must read with square corners | No `border-radius` in classic Outlook, GMX/Web.de or Orange | Same | SHOULD | Manual | [ce-radius] |
| Gradients and background images always need a solid `background-color` (and `bgcolor`) fallback | Not supported in classic Outlook, OWA (gradients) or Yahoo (gradients) | Same | MUST | Every element with a `background-image` value also has a `background-color` | [ce-gradient], [ce-bg-image] |
| Use `mso-*` properties only for Word fixes; other clients ignore them. Common ones: `mso-line-height-rule`, `mso-padding-alt`, `mso-hide:all`, `mso-table-lspace/rspace`, `mso-font-alt`, `mso-text-raise`, `mso-font-width` | — | OL-Win | MAY | — | [better-mso], [gec-button] |
| Hide content from Word with `mso-hide:all` as well as `display:none` | Word doesn't inherit `display:none` into nested tables or apply it to `<img>` | OL-Win | SHOULD | Elements with `display:none` (not MSO-conditional) also carry `mso-hide:all` | [ce-display-none] |
| Only `px` units in Outlook-critical declarations; no `rem` or `vw` | Classic Outlook ignores `rem` and `vw`; OWA embeds the email in the page, so `vw` is the page width | OL-Win, OWA, Yahoo | SHOULD | Lint units | [ce-rem], [ce-vw] |

---

## 4. Layout techniques

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Structural layout uses `<table role="presentation" border="0" cellpadding="0" cellspacing="0">` (or `<div>`s wrapped in MSO ghost tables) | Word renders tables reliably; `role` stops screen readers announcing grid cells; zero attributes remove default spacing | OL-Win, AT | MUST | Every `<table>` has `role="presentation"` unless it is a data table; `cellpadding`/`cellspacing`/`border` are present | [ms-word], [ce-role], [ce-cellpadding] |
| **Hybrid ("spongy") container**: a fluid element with `width:100%; max-width:600px`, centred, plus `<!--[if mso]><table width="600" align="center">…<![endif]-->` around it | Classic Outlook ignores `max-width` and would stretch to the pane; everyone else is fluid without media queries | OL-Win | MUST (classic target) | Each `max-width` container is wrapped by an MSO ghost table of the same px width | [litmus-hybrid], [ce-max-width] |
| Multi-column: `display:inline-block` columns with `width:100%; max-width:Npx`, parent `font-size:0` (kill whitespace gaps), ghost-table cells for Word | Columns sit side by side where they fit and stack where they don't, with no media queries (works without `<style>`) | All | SHOULD | Columns' max-widths sum to at most the container; the parent has `font-size:0` | [litmus-hybrid] |
| Media queries are enhancement only (for example tightening padding or swapping stack order). Design so the layout without them is acceptable | Media queries are missing in classic Outlook, GANGA and Gmail mobile webmail | Many | MUST | Style-stripped render test | [ce-at-media] |
| 600 px stays the default container width (configurable, about 480–700). The mobile layout is single-column, not a narrower fixed width | It is a convention, not a standard, but it is the ESP default and fits OWA and Outlook reading panes | — | SHOULD | Config validation | (practitioner consensus) |
| Fixed px widths only on ghost tables (inside MSO conditionals), on `width` attributes of images, and as `max-width`. Never set a fixed `width` above ~360 px outside MSO blocks | Prevents horizontal scroll at 320–360 px viewports | Mobile | MUST | Parse: no `width:Npx` > 360 or `width="N"` > 360 outside `<!--[if mso]>`, except `<img>` that also has `max-width:100%`/`width:100%` (≠ package-2's check needs these exemptions) | (package-2 FR-008, refined) |
| `<div>`-based layouts are viable **only** with MSO ghost-table fallbacks while classic Outlook is a target | Word gives `<div>` no width or padding [ms-word] | OL-Win | MUST | If the classic target is on, every width-bearing `<div>` is inside a ghost table | [ms-word] |
| When targeting classic Outlook, add `align="left"` to the parent table of a floated (`align`) table that sits next to text in a cell with a background colour | Word crops the adjacent text | OL-Win | SHOULD | Manual or pattern lint | [eb158] |
| Reverse column order on mobile only with the `dir="rtl"` table trick plus `dir="ltr"` on the cells | Standard practitioner technique; interacts with the Word 1px-line bug (§9) | — | MAY | — | [eb97] |

---

## 5. Buttons

| Technique | Pros | Cons | Verdict |
|---|---|---|---|
| **Padded `<a>`** (`display:inline-block; padding:…; mso-padding-alt:0`, plus Word-only `<i>`/`&emsp;` spacers with `mso-font-width` and `mso-text-raise`) [gec-button] | The whole box is clickable in modern clients; one element; scales with font size; no VML | Square corners in Word; height is estimated in Word; no reliable two-line wrap in Word; whitespace in the markup changes Word padding | **Default** |
| Padding on the `<td>` with a plain `<a>` inside ("cell button") | Simple and robust | In Word only the text is clickable | Acceptable fallback |
| Border-based `<a>` (thick border in the button colour) | Clickable area in Word | Border colour changes in dark mode; awkward sizing | Avoid |
| **VML `v:roundrect`** in `<!--[if mso]>` plus an HTML `<a>` in `<!--[if !mso]><!-->` (buttons.cm style) | Rounded corners and a full clickable area in Word | Duplicate content and link (drift risk); not keyboard-accessible in Word [eb77]; **not drawn below ~32,000 px** in classic Outlook (2026) [eb166]; `letter-spacing` tricks dead [eb164] | Opt-in only |

| Rule | Level | Check | Source |
|---|---|---|---|
| A button is a real `<a href>` with text (no image-only buttons, no `role="button"`) | MUST | `a` has non-empty text and an `href` | [gec-button] |
| Background colour on the `<a>` (and the `<td>`) with the label colour inline; `text-decoration:none` | MUST | Parse | [gec-button] |
| `mso-padding-alt:0` on the padded `<a>` (Word otherwise adds or ignores padding) | SHOULD | Parse when the classic target is on | [gec-button], [better-mso] |
| No `letter-spacing`-based spacing hacks for Word (removed in Outlook 365, 2026) | MUST | Flag `letter-spacing` combined with `mso-font-width` or on `&#8202;`/`&emsp;` spacers | [eb164] |
| If VML is used, the VML `href` equals the HTML `href` and the VML button sits above 30,000 px of estimated document height | MUST (if VML) | Compare hrefs inside the MSO block and its `!mso` twin; estimate height (warn) | [eb166] |
| Underline colour matches the background for clients that force underlines | MAY | — | [gec-button] |

---

## 6. Images

### 6.1 Format support

| Format | Apple | Gmail (web/apps) | OL-Win | OWA / new OL | OL Mac / mobile | Yahoo/AOL | Samsung | GMX/Web.de | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PNG, JPEG [ce-png] | Y | Y | Y | Y | Y | Y | Y | Y | Universal |
| GIF (animated) [ce-gif] | Y | Y | P (2007–13 first frame; M365 plays 3× then pauses) | Y | Y | Y | Y | Y | Put the message in the first frame |
| WebP [ce-webp] | Y (14+) | P converted to JPEG, no animation | **N** | Y (browser-dependent) | Y | Y | Y | Y | Tested 2021. Converting to JPEG likely loses transparency (inference) |
| AVIF [ce-avif] | Y | P converted to JPEG / GIF | **N** | Y (browser) | Y | Y (browser) | Y | **N** | Tested 2023 |
| APNG [ce-apng] | Y | N web / Y iOS | N | Y | Y / N And | Y | Y | Y | — |
| **SVG via `<img src>`** [ce-image-svg] | Y | Δ **P rasterised to PNG** (2026-09) | Y in M365 build 2408 (images still blocked by default) | Δ **N, blank since Sept 2025** [ms-svg] | Y (pre-2025 data) | Y | Y | Y | Mail.ru N |
| **Inline `<svg>`** [ce-html-svg] | Y (macOS needs a body background) | N | N | N | N | N | Y | N | Tested 2020 |
| `data:` URI (base64) [ce-base64] | Y | **N** | P (no GIF) | Y | Y | Y | Y | P (PNG only) | HEY, La Poste, SFR web N |
| CID (attached, `cid:`) | Generally Y | Unreliable; may also show as attachment | Y, may also list as attachment | Mixed | Mixed | Unreliable | — | — | Old practitioner tests only; no current matrix [cm-embedded] |

### 6.2 Image rules

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Only PNG, JPEG or GIF by default. WebP/AVIF only behind an explicit opt-in that keeps a PNG/JPEG for classic Outlook | Classic Outlook can't show WebP/AVIF | OL-Win | MUST | `src` extension or content type is in the allow-list | [ce-webp], [ce-avif] |
| No SVG (file, `data:` or inline `<svg>`); BIMI is out of scope | OWA and new Outlook show a blank; inline SVG fails in Gmail, Outlook and Yahoo; Gmail rasterises | OWA, new OL, Gmail, Yahoo | MUST | Parse: no `<svg>`, no `.svg`, no `image/svg+xml` | [ms-svg], [ce-html-svg], [cei597] |
| No `data:` image URIs | Gmail shows nothing; size counts toward the clip | Gmail, HEY | MUST | Parse: `src` not `data:` | [ce-base64] |
| CID embedding only as an explicit transport option, never the default | Inconsistent in webmail; duplicated as attachments; doesn't bypass image blocking | Gmail, Yahoo, OWA | SHOULD | — | [cm-embedded] |
| Absolute `https://` URLs on a stable host; no auth-gated or short-lived signed URLs | Gmail's proxy fetches and caches images; Proton and MPP pre-fetch | Gmail, Apple, Proton | MUST | URL scheme is `https:` | [g-images], [proton] |
| Every `<img>` has integer `width` **and** `height` attributes (CSS px, no unit) | Word ignores CSS `width` on `<img>`; prevents layout shift with images blocked | OL-Win, all | MUST | Parse: `width`/`height` match `^\d+$` | [ce-width], [ce-html-width] |
| Retina: serve about 2× pixel dimensions with `width` at the display size; keep the intrinsic width ≥ the display width / 65 | Sharp on HiDPI. Word can't stretch an image beyond 65× its intrinsic width | All / OL-Win | SHOULD | Fetch or record intrinsic size at build time (warn) | [eb163] |
| Fluid images: `width="600"` attribute plus `style="display:block;width:100%;max-width:600px;height:auto"` | `max-width:100%` alone is rewritten on Gmail Android mobile web; `display:block` removes the baseline gap in standards mode | Gmail Android web, all | SHOULD | Parse | [eb152], [gec-template] |
| `alt` on every `<img>`: meaningful text, or `alt=""` for decoration. Style alt text via inline `font`/`color` on the `<img>` | Classic Outlook (and Thunderbird) block images by default; alt is what's seen | OL-Win, TB | MUST (alt present) / SHOULD (styled) | Parse | [ms-pictures], [moz-remote] |
| Content and CTAs readable with images off: no text-in-image as the only carrier; live-text wordmark | Image blocking defaults; Apple Intelligence summaries ignore image text and alt | OL-Win, TB, Apple | MUST | Manual plus a text-to-image ratio heuristic (warn) | [ms-pictures], [oracle-ai] |
| No `<picture>` / `srcset` | Supported only in Apple, Samsung and Thunderbird; Gmail replaces the tags with `<u>` | Most | SHOULD | Parse | [ce-picture], [ce-srcset] |
| Background images: CSS `background-image` with quoted URL plus `bgcolor`/`background-color`, and VML `v:rect`/`v:fill` for Word if needed | Word needs VML; Yahoo needs quoted URLs | OL-Win, Yahoo | SHOULD | If `background-image` is present, a colour fallback is present | [ce-bg-image], [eb79] |
| `border="0"` and `outline:none; text-decoration:none` on linked images | Removes legacy blue borders | Old clients | MAY | — | — |

---

## 7. Fonts

| Rule | Why | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Default to system stacks ending in a universally installed family, e.g. `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | `system-ui` and `-apple-system` work in most modern clients but not in classic Outlook, which needs a known family | OL-Win | MUST | The last two families include `Arial`/`Helvetica`/`Georgia`/`Times New Roman` plus a generic | [ce-system-ui] |
| Web fonts (`@font-face`) are opt-in progressive enhancement. They work in Apple Mail, Samsung (non-Microsoft accounts), Thunderbird and the GMX/Web.de iOS apps. Gmail, Outlook (all) and Yahoo ignore them | A policy question (tracking request) as well as a capability one | — | MAY | If `@font-face` is present, require the opt-in flag and a fallback stack | [ce-font-face] |
| With web fonts, add `mso-font-alt` (on the `@font-face` rule or the element) or an MSO-only `font-family` override | Word ignores the stack for `@font-face` fonts and falls back to **Times New Roman** | OL-Win | MUST (if web fonts) | Parse | [ce-font-face] |
| Keep an MSO-only `<style>` that forces the fallback family (as package-1 does) | Defensive against Word's Times New Roman fallback | OL-Win | SHOULD | Present when the classic target is on | [ce-font-face] |
| Design the type scale assuming fallbacks have only 400 and 700 | Arial/Helvetica have no 500/600; CSS matching maps 500 to 400 and 600 to 700 | OL-Win, Windows, Android | SHOULD | Warn when two adjacent roles differ only by 500 vs 600 | [w3c-fonts] |
| Use single quotes for multi-word families inside inline `style` attributes | Double quotes end the attribute (or become `&quot;`) | All | MUST | Parse | — |
| `line-height` in px with `mso-line-height-rule:exactly` on text cells (not on button parents) | Word mishandles unitless or em line-height | OL-Win | SHOULD | Parse | [ce-line-height], [gec-button] |
| Gmail web can render Roboto and Google Sans without `@font-face` (it ships them) | Explains "works in Gmail" reports | Gm-web | — | — | [ce-font-face] |

---

## 8. Size limits and clipping

| Rule | Detail | Affected | Level | Check | Source |
|---|---|---|---|---|---|
| Keep the **HTML part ≤ 102 KB** (fail), warn ≥ 90 KB, measured as **UTF-8 bytes of the decoded HTML part as sent**, after variable substitution and after ESP rewriting (click-tracking URLs, open pixels) | Gmail clips with "[Message clipped] View entire message". The limit applies to the HTML part only (not headers, text part or images). Raw ≈ quoted-printable (~105 KB); base64 is more lenient (~110 KB) [spamres-clip]. Not documented by Google; re-confirmed by 2025–26 vendor pages | Gmail (all) | MUST | `Buffer.byteLength(html,'utf8')` for each template × largest fixture, plus a configurable ESP overhead allowance | [spamres-clip], [eb41] |
| Put the footer and legal or unsubscribe content where clipping can't hide it (short emails), or keep the whole email well under budget | Clipped content hides the footer; the "View entire message" view drops `<style>` [eb56]; an open pixel at the end may not load | Gmail | SHOULD | Size check | [eb56] |
| Strip HTML comments containing non-ASCII and keep the charset correct | Historic early clipping on accented characters in comments or `©`. Reportedly fixed 2026-08 (single report) | Gmail | SHOULD | Parse comments | [eb41], [eb113] |
| `<style>` ≤ 16 KB | §3.2 | Gmail | MUST | — | [eb90] |
| Long emails: assume Outlook iOS may truncate around 5,000 px height behind "Read more" | Reported 2022; current status unknown | Outlook iOS | MAY | Height estimate (warn) | [eb108] |
| Classic Outlook: no VML below ~32,000 px | 2026 bug | OL-Win | MUST (if VML) | — | [eb166] |
| Gmail trims repeated content in threads ("Show trimmed content"). Identical blocks across successive emails with the same subject may collapse | Matters for repeated OTP or receipt layouts; behaviour undocumented | Gmail | MAY | — | [labnol-trim] |
| No byte-based clipping is documented for Apple Mail, Yahoo or OWA | Uncertain; no authoritative source found | — | — | — | — |

---

## 9. Outlook (Word engine) specifics

| Rule | Why | Level | Check | Source |
|---|---|---|---|---|
| Conditional-comment syntax: hide from others `<!--[if mso]>…<![endif]-->`; show to all but Word `<!--[if !mso]><!-->…<!--<![endif]-->` | Only Word evaluates these. New Outlook, OWA and all other clients treat them as plain comments | MUST | Balanced-pair parser (not just counts): each opener matches a closer of the same form, with no nesting | [nsw-cond], [better-mso] |
| Version targeting: `mso 12` = 2007, `14` = 2010, `15` = 2013, **`16` = 2016/2019/2021/2024/M365**; operators `gt`, `gte`, `lt`, `lte`, `!`, `&`, `\|` | Every supported Word-engine Outlook is version 16, so finer targeting than `[if mso]` is obsolete | SHOULD (use plain `mso`) | Warn on version-specific conditionals | [better-mso], [nsw-cond] |
| Never rely on MSO conditionals being hidden everywhere: T-Online renders their content, and Airmail interprets them | Hide DPI XML in `<noscript>`; keep ghost tables harmless when shown | SHOULD | — | [eb43], [eb138], [gec-template] |
| DPI: `PixelsPerInch` 96 (see §2). Set sizes in `width`/`height` **attributes** for tables, cells and images; keep CSS px for type | Word converts CSS px to pt and scales pt at 120 DPI, but keeps attribute px. Fixes 100 % scaling; 125 % scaling still has residual issues | MUST | Tables, cells and images that set width carry it as an attribute | [relone-dpi], [ce-html-width] |
| `mso-line-height-rule:exactly` plus px `line-height` on text containers | Otherwise Word ignores or alters line-height | SHOULD | Parse | [ce-line-height] |
| 1px lines and gaps: use even px heights; `border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt`; `font-size:0; line-height:0` on image-only cells; one table per problematic row | px→pt rounding at odd values shows the body background | SHOULD | Lint: tables carry the MSO spacing resets | [eb99] |
| Don't combine `dir` and `padding` on the same table or cell (use an outer padding table) | Word draws a 1px line | SHOULD | Lint | [eb97] |
| Padding only on `<td>`; vertical padding is equalised across a row (the largest wins) | Word's CSS model | MUST | Lint: padding on `div`/`p`/`a` is flagged unless the `a` uses the button pattern | [ce-padding] |
| `width` CSS is ignored on `div`, `p`, `span` and `img`; no `max-width` (except tables in 2019+); no `background-image`; no `border-radius`; no `float` (use `align`) | Word = CSS 1 subset | MUST | Covered by `css.*` checks | [ms-word], [ce-width] |
| VML needs `xmlns:v`, sits inside `<!--[if mso]>`, its colours are hex, and its link duplicates the HTML link | — | MUST (if VML) | Parse | [ce-radius], [ce-bg-image] |
| Animated GIFs: assume the first frame only | 2007–2013 show the first frame; M365 pauses after 3 loops | SHOULD | — | [ce-gif] |
| External images are **blocked by default** (user and policy setting) | Outlook default | MUST (images-off readable) | — | [ms-pictures] |
| Only the first class in a `class` attribute is honoured by head CSS | — | SHOULD | — | [eb75] |

---

## 10. Other topics

### 10.1 Preheader

| Rule | Why | Level | Check | Source |
|---|---|---|---|---|
| The preheader is the **first element in `<body>`'s wrapper**: `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;" aria-hidden="true">` | Clients take preview text from the first text in the source | MUST | Parse: the first text-bearing node is the preheader | [litmus-preview], [gec-preheader] |
| After a short preheader, pad with a repeated filler. goodemailcode (current): `&#8199;&#65279;&#847;`; Litmus (2023): `&#847; &zwnj; &nbsp; &#8199; &shy;`. `&#847;` alone stopped working in Yahoo/AOL (late 2022) and Apple Mail 16.4 (2023) | Stops body copy leaking into the preview | SHOULD | The filler is a configured constant; ~100–200 repetitions; counted in the size budget | [gec-preheader], [litmus-preview] |
| The text/plain part starts with the preheader text | GMX, Web.de, Mail.com, 1&1 and K-9 take the preview from the text part. Never put filler entities in the text part | SHOULD | Text part's first line = preheader; no entities (package-1 `text.no-entities`) | [gec-preheader] |
| Don't rely on the preheader being shown on Apple devices | Apple Intelligence summaries replace it in the list (default on); Gmail's Gemini summaries appear only after opening | — | — | [oracle-ai], [stripo-ai] |
| Avoid relying on punctuation at the end of a preheader | Gmail has removed punctuation in previews | MAY | — | [eb103] |

### 10.2 Interactive email and AMP

| Feature | Works in | Fails in | Level for the framework | Source |
|---|---|---|---|---|
| CSS animation / `@keyframes` | Apple, Samsung, HEY, Fastmail, Yahoo (keyframes) | Gmail, Outlook (all, incl. Mac 16.80), Thunderbird 149 | MAY (decorative only, must be static-safe) | [ce-animation], [ce-keyframes] |
| `:checked` hacks (tabs, carousels) | Apple, Yahoo, Samsung, Thunderbird; OWA partial | Gmail (all), classic Outlook, Proton | Out of scope for v1 | [ce-checked] |
| `<video>` | Apple macOS; iOS with `controls`; Samsung partial; Thunderbird | Gmail (tags become `<u>`), Outlook (CSP), Yahoo (stripped) | Out of scope; use a linked poster image | [ce-video] |
| `<form>` | Apple, Gmail web/Android, Yahoo, Samsung | Classic Outlook, OWA (no submit), Proton, Fastmail, GMX | Out of scope (phishing filters, inconsistent) | [ce-form] |
| **AMP for Email** | Gmail (registration with Google required; doc updated 2026-09-03), Yahoo, Mail.ru | Apple, Outlook (OWA preview ended), Proton, Fastmail | Out of scope. Never required; a separate MIME part if ever added | [g-amp], [eoa-amp] |

### 10.3 Emoji, entities, encoding

| Rule | Why | Level | Check | Source |
|---|---|---|---|---|
| UTF-8 everywhere; emoji as literal UTF-8 or numeric references, never as images | Universal in modern clients | SHOULD | — | — |
| Expect Gmail web to swap some characters (emoji, historically ©/®/™) for "goomoji" images; size them with text | Gmail image replacement | MAY | — | [eoa-goomoji] |
| Classic Outlook may show monochrome emoji | Single unverified report | — | — | [adobe-emoji] |
| Prefer numeric character references over HTML5-only named entities in HTML; no entities in the text part | Conservative (Word is an HTML 4 parser) | SHOULD | Parse named entities against the HTML 4 list (warn) | [ms-word] |

### 10.4 RTL

| Rule | Why | Level | Check | Source |
|---|---|---|---|---|
| Set `dir="rtl"` and `lang` on the wrapper **and** explicitly on content tables/cells; set `text-align:right` explicitly | `<html>` attributes are lost; GMX/Web.de ignore `dir`; Orange strips `dir` from `table`/`td` | MUST (RTL locales) | Parse: in RTL locales every text cell has `dir` or `align`/`text-align` | [ce-dir], [ce-direction] |
| Avoid `dir` on links in classic Outlook; test mixed LTR runs (2007 reversed word order) | Word bugs | SHOULD | Manual | [ce-dir] |
| Don't combine `dir` and padding on one cell (1px line) | §9 | SHOULD | Lint | [eb97] |
| Gmail mobile webmail applies RTL to the whole email if any RTL text appears | Mixed-language emails need explicit `dir="ltr"` on LTR blocks | SHOULD | — | [ce-dir] |
| Buttons with mixed direction: put the zero-width spacer on both sides | goodemailcode button note | MAY | — | [gec-button] |

### 10.5 Minification and serialisation risks

| Rule | Why | Level | Check | Source |
|---|---|---|---|---|
| Never strip, merge or reformat MSO conditional comments or the `<!--[if !mso]><!-->` pattern | Breaks Word output or exposes Word-only content | MUST | Byte-compare the conditional blocks before and after minify | [nsw-cond] |
| No `}}` in CSS | OWA and Outlook apps drop the rest of the CSS | MUST | Regex | [eb92] |
| Body lines ≤ 998 octets, either wrapped by the build or guaranteed by quoted-printable/base64 transfer encoding in the transport | RFC 5322 §2.1.1 (MUST); MTAs may break long lines mid-tag | MUST | Max line length in the artifact, or a transport test asserting QP/base64 | [rfc5322] |
| Inside inline-block runs and padded buttons, whitespace is significant (gaps in all clients; extra padding in Word) | Minify those regions deliberately, or zero `font-size` on the parent | SHOULD | — | [gec-button] |
| Don't drop "redundant" attributes (`width`, `height`, `align`, `valign`, `bgcolor`, `border`, `cellpadding`, `cellspacing`, `role`) | They are the Word layout | MUST | Attribute-preservation test | [ms-word] |
| Serialise void elements without the trailing `/` (`<img …>`, not `<img … />`), or ban `class` on void elements | Yahoo/AOL drop `class` on self-closing tags | SHOULD | Serialiser setting or regex | [eb157] |
| Strip non-MSO comments | Ships authoring notes; non-ASCII comments have triggered clipping | SHOULD | Parse | [eb41] |

### 10.6 Dark mode (brief; see the dark-mode slice)

Apple Mail, Outlook (OWA and apps, with added `data-ogsc`/`data-ogsb`), Samsung and Orange honour
`prefers-color-scheme`; Gmail and Yahoo don't [ce-pcs]. Δ Gmail iOS/Android now honour only
`color-scheme: light only` (2026-09) [ce-meta-cs]. Yahoo's new webmail broke all media queries in
dark mode until Dec 2025 [eb159]. Outlook.com adds white backgrounds behind images on hover in dark
mode [eb162]. The inline light palette must stand on its own (MUST).

---

## 11. Uncertain, contested or folklore

| Topic | Status |
|---|---|
| Gmail clip "102 KB" | **Empirical, not documented by Google.** Measured on the HTML part; ±3–8 KB depending on encoding. Keep 102 KB as the fail line, with headroom |
| "Word engine retires Oct 2026" | **Folklore.** Only Outlook LTSC 2021 support ended. Classic Outlook ≥ 2029 (§1.3) |
| Microsoft "inline SVG" scope | Microsoft didn't define "inline". A pre-rollout test treated an externally hosted `<img src=…svg>` as "inline" [topedia-svg]. No post-rollout public test found. Treat **all** SVG in the body as blank in OWA and new Outlook. Outlook mobile status unclear (one blog says still displayed) [lettermint-svg] |
| Gmail SVG | Rendered as PNG per caniemail (2026-09). Still banned in the framework (Microsoft, inconsistency) |
| GANGA after Gmailify ended | Inference that more users now get GANGA rendering; no measurement |
| caniemail staleness | Many core tests (WebP 2021, flex 2021, CSS variables 2020, inline SVG 2020) are old. Re-test before v1 for: WebP/AVIF in Gmail, flex in Yahoo, `:has` in OWA |
| New Outlook preview-pane layout bugs | Reported (#148), not reproduced by others; possibly security-gateway rewriting |
| iOS 26.x Mail rendering | No documented engine change; one unverified scaling-regression report |
| Thunderbird `@media` = N in caniemail | Implausible for Gecko; likely a test artefact |
| "16 px avoids iOS auto-zoom" (package-1) | Auto-zoom is a Safari form-input behaviour. iOS Mail historically enlarges text **below ~13 px** unless reformatting is disabled. 16 px is still a sound readability default |
| Classic Outlook monochrome emoji | Single unverified forum answer |
| HTML5-only named entities in Word | Conservative advice, not tested here |

---

## 12. Implications for the framework

### 12.1 Defaults

1. **Targets:** `outlookClassic: true` (review in 2028 after cutover notices). Tier-1 render tests:
   Apple Mail iOS/macOS, Gmail web + Android + iOS, GANGA, classic Outlook M365 (100 % and 125 %
   scaling), new Outlook / OWA, Yahoo web.
2. **Skeleton:** exactly as in §2 (HTML5 doctype; `lang`/`dir` on `<html>` and the wrapper; the
   meta set; DPI XML in `<noscript>`; one `<style>` in head; nothing on `<body>` but margin and
   padding zero).
3. **CSS pipeline:** tokens (OKLCH) → sRGB gamut-map → **6-digit hex** → inline every declaration
   (juice-style) → keep only enhancement rules in `<style>` → serialise with spaces between `}`,
   lowercase ` !important`, no comments, no nesting, no custom properties, ≤ 16 KB.
4. **Layout:** a table-based hybrid shell (100 % wrapper table → `max-width:600px` container
   with an MSO ghost table → rows of `role="presentation"` tables). Columns are inline-block plus
   ghost cells. Media queries only tune. No flex or grid, even though OWA supports them.
5. **Images:** PNG/JPEG/GIF only; `https`; integer `width`+`height`; `display:block`; fluid images
   get `width:100%;max-width:Npx;height:auto`; alt is required; no SVG, `data:`, `<picture>` or
   `srcset`.
6. **Fonts:** system stack with an Arial/Helvetica tail; an MSO font override; web fonts opt-in
   with `mso-font-alt`.
7. **Size budgets:** HTML part fail 102 KB / warn 90 KB (UTF-8 bytes, largest fixture, plus an ESP
   allowance, default 5 KB); `<style>` fail 16 KB / warn 12 KB; lines ≤ 998 octets unless the
   transport guarantees QP.

### 12.2 Component behaviours

| Component | Behaviour |
|---|---|
| `Html`/`Layout` | Emits the §2 skeleton; derives `lang`/`dir` from the locale and applies them twice; title and aria-label from the catalogue subject; emits `xmlns:v` only if a VML component is used |
| `Preheader` | First child of the wrapper; hidden with `display:none;max-height:0;overflow:hidden;mso-hide:all`; adds the filler to a configured length; mirrors the text into the text part's first line |
| `Container` | `width:100%;max-width:{width}px;margin:0 auto` plus a ghost table `width="{width}" align="center"` |
| `Columns`/`Column` | Inline-block, `font-size:0` parent, ghost-table cells; widths as attributes in MSO; optional `stackOrder="reverse"` via the `dir` trick (no padding on the `dir` cell) |
| `Button` | Padded `<a>` (goodemailcode pattern: `mso-padding-alt:0`, `mso-font-width` spacers, `mso-text-raise`), square in Word. Optional `vml` prop for rounded Word buttons, with a 30k px height warning |
| `Image` | Requires `width`, `height` and `alt`; `display:block`; `fluid` prop adds `width:100%;max-width`; rejects SVG/WebP/AVIF unless opted in |
| `Divider` | A 1px-high cell with `bgcolor` and `font-size:0;line-height:0` (avoids Word border quirks and 1px gaps) |
| `Spacer` | A `<td height="N" style="height:Npx;font-size:0;line-height:Npx;mso-line-height-rule:exactly">&nbsp;</td>`; even N preferred; never `letter-spacing` |
| `Text`/`Heading` | px `font-size`/`line-height` plus `mso-line-height-rule:exactly`; margins reset inline (`margin:0`), spacing via cell padding |
| `BackgroundImage` (opt-in) | CSS background with a quoted URL plus `bgcolor`, and a VML `v:rect`/`v:fill` fallback |

### 12.3 Check candidates (new or changed versus package-1 `07-checks.md`)

| Id | Rule | Level | How |
|---|---|---|---|
| `html.lang-dir-wrapper` | The wrapper repeats `<html>`'s `lang`/`dir` | error | Parse the first element child of `body` |
| `html.wrapper-aria` | Wrapper has `role="article"`, `aria-roledescription` and `aria-label` | warn | Parse |
| `html.dpi-noscript` | The PixelsPerInch XML is inside an MSO conditional and `<noscript>` | error (classic) | Regex within MSO blocks |
| `html.xmlns` | `<o:`/`<v:` used ⇒ the matching `xmlns` is on `<html>` | error | Parse |
| `html.body-bare` | `<body>` carries no presentational attributes beyond margin/padding 0 | warn | Parse |
| `css.style-size` | Total `<style>` bytes < 16,384 (warn ≥ 12 KB) | error | Byte count |
| `css.important-lowercase` | `!important` is lowercase with whitespace before it; none inline | error | postcss tokens |
| `css.no-double-brace` | No `}}` | error | Regex on serialised CSS |
| `css.no-nesting` | No nested style rules; no at-rule inside an at-rule | error | postcss AST |
| `css.colour-hex` | Every colour value (CSS and `bgcolor`/`color`/VML attributes) is `#rrggbb` or `transparent` | error | postcss-value-parser plus attribute scan |
| `css.no-modern-colour` | No `oklch(`, `oklab(`, `lch(`, `lab(`, `color-mix(`, `color(`, `light-dark(` or `hsl(`, and no space-separated `rgb(` | error | Regex (belt and braces for `css.colour-hex`) |
| `css.no-alpha` | No `rgba(`, `hsla(` or 8-digit hex | warn | Regex |
| `css.no-custom-props` | No `--x:` declarations and no `var(` | error | postcss |
| `css.banned-layout` | No flex/grid/float/position/calc/clamp/min/max/`:has`/`@supports` (package-1 `html.banned-css`, extended) | error | postcss |
| `css.media-allowlist` | Media features only width/orientation/resolution/`prefers-color-scheme`; no height queries | warn | postcss |
| `css.inline-parse` | Every inline `style` parses cleanly (no comments, no stray characters) | error | postcss per attribute |
| `css.gradient-fallback` | `background-image` ⇒ a `background-color` on the same element | error | Parse |
| `css.units` | No `rem`/`vw`/`vh` in inline styles | warn | Regex |
| `css.hide-mso` | `display:none` outside MSO blocks ⇒ `mso-hide:all` too | warn | Parse |
| `layout.ghost-table` | Each `max-width` container sits inside an MSO ghost table of the same px width | error (classic) | Parse with MSO-aware tokenising |
| `layout.max-fixed-width` | No fixed width > 360 px outside MSO blocks (images with fluid styles exempt) | error | Parse (replaces package-2's 360 px test) |
| `layout.table-attrs` | Layout tables have `role="presentation" cellpadding="0" cellspacing="0" border="0"` | error | Parse |
| `layout.no-dir-padding` | No element with both `dir` and `padding` | warn | Parse |
| `img.dimensions` | `width` and `height` are integer attributes on every `<img>` | error | Parse |
| `img.format` | `src` is PNG/JPEG/GIF (opt-in WebP/AVIF); never SVG or `data:` | error | Parse; HEAD request in CI (optional) |
| `img.https` | Absolute `https:` URLs | error | Parse |
| `img.fluid-width` | `max-width:100%` on an img ⇒ also `width:100%` | warn | Parse |
| `img.no-picture-srcset` | No `<picture>` or `srcset` | warn | Parse |
| `img.void-class` | No `class` on self-closing void elements | warn | Regex on the serialised output |
| `mso.conditional-pairs` | Conditional comments correctly paired by form (not just counted); no nesting | error | Tokeniser |
| `mso.version-target` | Only `[if mso]` / `[if !mso]` (no version numbers) | warn | Regex |
| `mso.vml-safe` | VML ⇒ `xmlns:v`, hex colours, href equals the HTML twin | error | Parse |
| `button.real-link` | Buttons are `<a href>` with text, a background colour and `mso-padding-alt` | error | Component output test |
| `button.no-letter-spacing-hack` | No `letter-spacing` spacer pattern | error | Regex |
| `font.fallback-tail` | Every `font-family` ends with a core family plus a generic; single quotes in inline styles | error | postcss |
| `font.webfont-optin` | `@font-face` only with opt-in, `mso-font-alt` and a fallback | error | postcss |
| `size.gmail` (changed) | UTF-8 bytes of the HTML part with the largest fixture + ESP allowance < 102 KB (warn 90 KB) | error | Byte count |
| `size.line-length` | No line > 998 octets, unless the transport declares QP/base64 | error | Line scan / transport contract |
| `preheader.first` | The first text node in the wrapper is the hidden preheader | error | Parse |
| `preheader.text-part` | The text part starts with the preheader | warn | Compare |
| `rtl.explicit-dir` | In RTL locales, text cells carry `dir` and an explicit alignment | error (RTL) | Parse |
| `minify.preserve-mso` | MSO blocks are byte-identical before and after minification | error | Diff |

Manual and render tests that no linter replaces: classic Outlook at 125 % scaling, GANGA
(style-stripped), Gmail clipped view, images-off views (Outlook, Thunderbird), dark modes, RTL.

---

## Sources

All accessed 2026-10-27.

| Key | Title | URL |
|---|---|---|
| ce-api | Can I email — data API (v1.0.4, updated 2026-09-16) | https://www.caniemail.com/api/data.json |
| ce-* | Can I email feature pages (slug after `ce-`, e.g. `ce-image-svg` → `/features/image-svg/`) | https://www.caniemail.com/features/ |
| cei597 | caniemail issue #597 "GMail supports SVG" (closed 2026-09-16) | https://github.com/hteumeuleu/caniemail/issues/597 |
| cei468 | caniemail issue #468 "Outlook on platform Windows supports svg-image" | https://github.com/hteumeuleu/caniemail/issues/468 |
| eb* | hteumeuleu/email-bugs issues (number after `eb`) | https://github.com/hteumeuleu/email-bugs/issues |
| g-css | Google — CSS support (Gmail), updated 2026-09-15 | https://developers.google.com/workspace/gmail/design/css |
| g-amp | Google — AMP for Gmail, updated 2026-09-03 | https://developers.google.com/workspace/gmail/ampemail |
| g-images | Google Gmail Help — Choose whether to show images | https://support.google.com/mail/answer/145919 |
| ms-svg | MC1130385 "Retirement of inline SVG images in Microsoft Outlook" (mirror) | https://mc.merill.net/message/MC1130385 |
| ms-mc949965 | MC949965 "Toggle to new Outlook" (updated 2026-02-20, mirror) | https://mc.merill.net/message/MC949965 |
| ms-eos | MC1176302 "Support for Office 2016 and Office 2019 has ended – Office LTSC 2021 is next" | https://mc.merill.net/message/MC1176302 |
| ms-lite | MC1276508 "Complete retirement of the Outlook Lite app" | https://mc.merill.net/message/MC1276508 |
| ms-winmail | Microsoft Support — Windows Mail, Calendar and People become Outlook | https://support.microsoft.com/en-us/office/windows-mail-calendar-and-people-become-outlook-773ecb94-5b16-4155-96e1-bc9afdc08e31 |
| ms-word | Microsoft — Word 2007 HTML and CSS Rendering Capabilities in Outlook 2007 | https://learn.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa338201(v=office.12) |
| ms-pictures | Microsoft Support — Block or unblock automatic picture downloads in classic Outlook | https://support.microsoft.com/en-us/outlook/block-or-unblock-automatic-picture-downloads-in-classic-outlook-email-messages |
| dom-delay | Directions on Microsoft — Microsoft delays by a year its new Outlook rollout (2026-03-11) | https://www.directionsonmicrosoft.com/microsoft-delays-by-a-year-its-new-outlook-rollout/ |
| dom-2029 | Directions on Microsoft — Microsoft to support classic Outlook for Windows until at least 2029 | https://www.directionsonmicrosoft.com/blog/microsoft-to-support-classic-outlook-for-windows-for-some-until-at-least-2029/ |
| dom-ga | Directions on Microsoft — Microsoft says the new Outlook for Windows is ready for GA (2024-07) | https://www.directionsonmicrosoft.com/microsoft-says-the-new-outlook-for-windows-is-ready-for-ga-is-it/ |
| winlatest | Windows Latest — Microsoft still wants to force New Outlook on everyone by 2027 (2026-07-26) | https://windowslatest.com/2026/07/26/microsoft-still-wants-to-force-new-outlook-on-everyone-by-2027-even-as-users-call-it-painful-and-prefer-outlook-classic |
| emc-newol | Email Markup Consortium — The new Outlook for Windows (2023) | https://dev.to/emailmarkup/the-new-outlook-for-windows-54k7 |
| litmus-share | Litmus — Email Client Market Share (Sep 2026) | https://www.litmus.com/email-client-market-share |
| outsolvi | Outsolvi — Email Client Market Share 2026 (Litmus July 2026, secondary) | https://outsolvi.com/tools/email-client-market-share |
| litmus-preview | Litmus — The Preview Text Hack You May Want to Use in Every Email (updated 2023-06) | https://www.litmus.com/blog/the-little-known-preview-text-hack-you-may-want-to-use-in-every-email |
| litmus-hybrid | Litmus — Understanding Responsive and Hybrid Email Design | https://www.litmus.com/blog/understanding-responsive-and-hybrid-email-design/ |
| gec-template | goodemailcode.com (Mark Robbins) — Email template | https://www.goodemailcode.com/email-code/template |
| gec-button | goodemailcode.com — Link button | https://www.goodemailcode.com/email-code/link-button |
| gec-preheader | goodemailcode.com — Preheader | https://www.goodemailcode.com/email-code/preheader |
| spamres-clip | Spam Resource — What is Gmail clipping and what to do about it (2022-01-12) | https://www.spamresource.com/2022/01/what-is-gmail-clipping-and-what-to-do.html |
| spamres-svg | Spam Resource — Microsoft is pulling support for inline SVG (2025-12-06) | https://www.spamresource.com/2025/12/microsoft-is-pulling-support-for-inline.html |
| topedia-svg | Topedia — Microsoft is retiring support for inline SVG images in Outlook (2025-08) | https://blog.topedia.com/2025/08/microsoft-is-retiring-support-for-inline-svg-images-in-outlook/ |
| lettermint-svg | Lettermint — Outlook blocks SVG images in emails (2025-12-08) | https://lettermint.co/knowledge-base/deliverability/outlook-blocks-svg-images-in-emails |
| reg-pop | The Register — Gmail preparing to drop POP3 mail fetching (2026-01-05) | https://www.theregister.com/2026/01/05/gmail_dropping_pop3/ |
| heise-gmailify | heise — Gmail: Google cancels "Gmailify" and POP support | https://heise.de/-10709020 |
| reg-basic | The Register — Gmail Basic HTML view discontinued (2023-09-25) | https://www.theregister.com/2023/09/25/gmail_basic_html_discontinued/ |
| moz-remote | Mozilla Support — Remote Content in Messages | https://support.mozilla.org/en-US/kb/remote-content-in-messages |
| proton | Proton — Enhanced tracking protection | https://proton.me/support/email-tracker-protection |
| apple-forum | Apple Developer Forums — iOS 26.2 RC2 Bug with HTML-Mail | https://developer.apple.com/forums/thread/810052 |
| oracle-ai | Oracle Marketing Cloud — AI summaries for email: design impacts on marketers | https://blogs.oracle.com/marketingcloud/post/ai-summaries-for-email-design-impacts-on-marketers |
| stripo-ai | Stripo — AI summaries in email clients: what Gmail and Apple Mail changes mean | https://stripo.email/blog/ai-summaries-in-email-clients-what-gmail-and-apple-mail-changes-mean-for-marketers/ |
| shadcn | shadcn/ui — Theming | https://ui.shadcn.com/docs/theming |
| w3c-fonts | W3C — CSS Fonts Module Level 4, font matching algorithm | https://www.w3.org/TR/css-fonts-4/#font-matching-algorithm |
| rfc5322 | RFC 5322 §2.1.1 Line Length Limits | https://www.rfc-editor.org/rfc/rfc5322#section-2.1.1 |
| relone-dpi | Relationship One — Conquering the Outlook HiDPI scaling beast | https://relationshipone.com/blog/conquering-outlook-hidpi-scaling-beast |
| nsw-cond | NSW Government Email Design System — Outlook conditional CSS | https://email.designsystem.nsw.gov.au/development/outlook-conditional-css |
| better-mso | better.email — MSO attributes in Outlook emails | https://learn.better.email/blog/mso-attributes-in-outlook-emails |
| cm-embedded | Campaign Monitor — Embedded image support in HTML email | https://www.campaignmonitor.com/blog/post/3927/embedded-images-in-html-email |
| eoa-goomoji | Email on Acid — Gmail iOS replacing copyright symbols with blue emoji | https://www.emailonacid.com/blog/article/email-development/gmail-ios-replacing-copyright-symbols-with-blue-emoji-and-how-to-fix-it |
| eoa-amp | Email on Acid — Outlook and AMP for Email | https://www.emailonacid.com/blog/article/industry-news/outlook-turning-off-amp-for-email/ |
| adobe-emoji | Adobe Experience League — Emojis in email subject line: Outlook rendering | https://experienceleaguecommunities.adobe.com/t5/journey-optimizer-questions/emojis-in-email-subject-line-outlook-rendering/m-p/777967 |
| labnol-trim | Labnol — Show trimmed content in Gmail email messages | https://labnol.org/code/19938-show-trimmed-content-gmail |

<!-- Reference-style link targets for the keys used in the tables above. -->
[ce-api]: https://www.caniemail.com/api/data.json
[ce-image-svg]: https://www.caniemail.com/features/image-svg/
[ce-html-svg]: https://www.caniemail.com/features/html-svg/
[ce-webp]: https://www.caniemail.com/features/image-webp/
[ce-avif]: https://www.caniemail.com/features/image-avif/
[ce-gif]: https://www.caniemail.com/features/image-gif/
[ce-png]: https://www.caniemail.com/features/image-png/
[ce-apng]: https://www.caniemail.com/features/image-apng/
[ce-base64]: https://www.caniemail.com/features/image-base64/
[ce-html-style]: https://www.caniemail.com/features/html-style/
[ce-at-media]: https://www.caniemail.com/features/css-at-media/
[ce-variables]: https://www.caniemail.com/features/css-variables/
[ce-flex]: https://www.caniemail.com/features/css-display-flex/
[ce-grid]: https://www.caniemail.com/features/css-display-grid/
[ce-modern-color]: https://www.caniemail.com/features/css-modern-color/
[ce-rgb]: https://www.caniemail.com/features/css-rgb/
[ce-rgba]: https://www.caniemail.com/features/css-rgba/
[ce-light-dark]: https://www.caniemail.com/features/css-function-light-dark/
[ce-font-face]: https://www.caniemail.com/features/css-at-font-face/
[ce-attr-sel]: https://www.caniemail.com/features/css-selector-attribute/
[ce-hover]: https://www.caniemail.com/features/css-pseudo-class-hover/
[ce-checked]: https://www.caniemail.com/features/css-pseudo-class-checked/
[ce-has]: https://www.caniemail.com/features/css-pseudo-class-has/
[ce-supports]: https://www.caniemail.com/features/css-at-supports/
[ce-nesting]: https://www.caniemail.com/features/css-nesting/
[ce-important]: https://www.caniemail.com/features/css-important/
[ce-max-width]: https://www.caniemail.com/features/css-max-width/
[ce-margin]: https://www.caniemail.com/features/css-margin/
[ce-padding]: https://www.caniemail.com/features/css-padding/
[ce-radius]: https://www.caniemail.com/features/css-border-radius/
[ce-bg-image]: https://www.caniemail.com/features/css-background-image/
[ce-gradient]: https://www.caniemail.com/features/css-linear-gradient/
[ce-box-shadow]: https://www.caniemail.com/features/css-box-shadow/
[ce-calc]: https://www.caniemail.com/features/css-unit-calc/
[ce-clamp]: https://www.caniemail.com/features/css-function-clamp/
[ce-position]: https://www.caniemail.com/features/css-position/
[ce-float]: https://www.caniemail.com/features/css-float/
[ce-display-none]: https://www.caniemail.com/features/css-display-none/
[ce-css-comments]: https://www.caniemail.com/features/css-comments/
[ce-height]: https://www.caniemail.com/features/css-height/
[ce-width]: https://www.caniemail.com/features/css-width/
[ce-html-width]: https://www.caniemail.com/features/html-width/
[ce-rem]: https://www.caniemail.com/features/css-unit-rem/
[ce-vw]: https://www.caniemail.com/features/css-unit-vw/
[ce-line-height]: https://www.caniemail.com/features/css-line-height/
[ce-system-ui]: https://www.caniemail.com/features/css-sytem-ui/
[ce-doctype]: https://www.caniemail.com/features/html-doctype/
[ce-html-body]: https://www.caniemail.com/features/html-body/
[ce-link]: https://www.caniemail.com/features/html-link/
[ce-import]: https://www.caniemail.com/features/css-at-import/
[ce-role]: https://www.caniemail.com/features/html-role/
[ce-cellpadding]: https://www.caniemail.com/features/html-cellpadding/
[ce-picture]: https://www.caniemail.com/features/html-picture/
[ce-srcset]: https://www.caniemail.com/features/html-srcset/
[ce-dir]: https://www.caniemail.com/features/html-dir/
[ce-direction]: https://www.caniemail.com/features/css-direction/
[ce-animation]: https://www.caniemail.com/features/css-animation/
[ce-keyframes]: https://www.caniemail.com/features/css-at-keyframes/
[ce-video]: https://www.caniemail.com/features/html-video/
[ce-form]: https://www.caniemail.com/features/html-form/
[ce-pcs]: https://www.caniemail.com/features/css-at-media-prefers-color-scheme/
[ce-meta-cs]: https://www.caniemail.com/features/html-meta-color-scheme/
[cei597]: https://github.com/hteumeuleu/caniemail/issues/597
[cei468]: https://github.com/hteumeuleu/caniemail/issues/468
[eb13]: https://github.com/hteumeuleu/email-bugs/issues/13
[eb19]: https://github.com/hteumeuleu/email-bugs/issues/19
[eb21]: https://github.com/hteumeuleu/email-bugs/issues/21
[eb41]: https://github.com/hteumeuleu/email-bugs/issues/41
[eb43]: https://github.com/hteumeuleu/email-bugs/issues/43
[eb56]: https://github.com/hteumeuleu/email-bugs/issues/56
[eb70]: https://github.com/hteumeuleu/email-bugs/issues/70
[eb75]: https://github.com/hteumeuleu/email-bugs/issues/75
[eb77]: https://github.com/hteumeuleu/email-bugs/issues/77
[eb79]: https://github.com/hteumeuleu/email-bugs/issues/79
[eb90]: https://github.com/hteumeuleu/email-bugs/issues/90
[eb92]: https://github.com/hteumeuleu/email-bugs/issues/92
[eb97]: https://github.com/hteumeuleu/email-bugs/issues/97
[eb99]: https://github.com/hteumeuleu/email-bugs/issues/99
[eb103]: https://github.com/hteumeuleu/email-bugs/issues/103
[eb108]: https://github.com/hteumeuleu/email-bugs/issues/108
[eb113]: https://github.com/hteumeuleu/email-bugs/issues/113
[eb138]: https://github.com/hteumeuleu/email-bugs/issues/138
[eb141]: https://github.com/hteumeuleu/email-bugs/issues/141
[eb147]: https://github.com/hteumeuleu/email-bugs/issues/147
[eb148]: https://github.com/hteumeuleu/email-bugs/issues/148
[eb152]: https://github.com/hteumeuleu/email-bugs/issues/152
[eb157]: https://github.com/hteumeuleu/email-bugs/issues/157
[eb158]: https://github.com/hteumeuleu/email-bugs/issues/158
[eb159]: https://github.com/hteumeuleu/email-bugs/issues/159
[eb160]: https://github.com/hteumeuleu/email-bugs/issues/160
[eb161]: https://github.com/hteumeuleu/email-bugs/issues/161
[eb162]: https://github.com/hteumeuleu/email-bugs/issues/162
[eb163]: https://github.com/hteumeuleu/email-bugs/issues/163
[eb164]: https://github.com/hteumeuleu/email-bugs/issues/164
[eb166]: https://github.com/hteumeuleu/email-bugs/issues/166
[g-css]: https://developers.google.com/workspace/gmail/design/css
[g-amp]: https://developers.google.com/workspace/gmail/ampemail
[g-images]: https://support.google.com/mail/answer/145919
[ms-svg]: https://mc.merill.net/message/MC1130385
[ms-mc949965]: https://mc.merill.net/message/MC949965
[ms-eos]: https://mc.merill.net/message/MC1176302
[ms-lite]: https://mc.merill.net/message/MC1276508
[ms-winmail]: https://support.microsoft.com/en-us/office/windows-mail-calendar-and-people-become-outlook-773ecb94-5b16-4155-96e1-bc9afdc08e31
[ms-word]: https://learn.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa338201(v=office.12)
[ms-pictures]: https://support.microsoft.com/en-us/outlook/block-or-unblock-automatic-picture-downloads-in-classic-outlook-email-messages
[dom-delay]: https://www.directionsonmicrosoft.com/microsoft-delays-by-a-year-its-new-outlook-rollout/
[dom-2029]: https://www.directionsonmicrosoft.com/blog/microsoft-to-support-classic-outlook-for-windows-for-some-until-at-least-2029/
[dom-ga]: https://www.directionsonmicrosoft.com/microsoft-says-the-new-outlook-for-windows-is-ready-for-ga-is-it/
[winlatest]: https://windowslatest.com/2026/07/26/microsoft-still-wants-to-force-new-outlook-on-everyone-by-2027-even-as-users-call-it-painful-and-prefer-outlook-classic
[emc-newol]: https://dev.to/emailmarkup/the-new-outlook-for-windows-54k7
[litmus-share]: https://www.litmus.com/email-client-market-share
[outsolvi]: https://outsolvi.com/tools/email-client-market-share
[litmus-preview]: https://www.litmus.com/blog/the-little-known-preview-text-hack-you-may-want-to-use-in-every-email
[litmus-hybrid]: https://www.litmus.com/blog/understanding-responsive-and-hybrid-email-design/
[gec-template]: https://www.goodemailcode.com/email-code/template
[gec-button]: https://www.goodemailcode.com/email-code/link-button
[gec-preheader]: https://www.goodemailcode.com/email-code/preheader
[spamres-clip]: https://www.spamresource.com/2022/01/what-is-gmail-clipping-and-what-to-do.html
[topedia-svg]: https://blog.topedia.com/2025/08/microsoft-is-retiring-support-for-inline-svg-images-in-outlook/
[lettermint-svg]: https://lettermint.co/knowledge-base/deliverability/outlook-blocks-svg-images-in-emails
[reg-pop]: https://www.theregister.com/2026/01/05/gmail_dropping_pop3/
[heise-gmailify]: https://heise.de/-10709020
[reg-basic]: https://www.theregister.com/2023/09/25/gmail_basic_html_discontinued/
[moz-remote]: https://support.mozilla.org/en-US/kb/remote-content-in-messages
[proton]: https://proton.me/support/email-tracker-protection
[apple-forum]: https://developer.apple.com/forums/thread/810052
[oracle-ai]: https://blogs.oracle.com/marketingcloud/post/ai-summaries-for-email-design-impacts-on-marketers
[stripo-ai]: https://stripo.email/blog/ai-summaries-in-email-clients-what-gmail-and-apple-mail-changes-mean-for-marketers/
[shadcn]: https://ui.shadcn.com/docs/theming
[w3c-fonts]: https://www.w3.org/TR/css-fonts-4/#font-matching-algorithm
[rfc5322]: https://www.rfc-editor.org/rfc/rfc5322#section-2.1.1
[relone-dpi]: https://relationshipone.com/blog/conquering-outlook-hidpi-scaling-beast
[nsw-cond]: https://email.designsystem.nsw.gov.au/development/outlook-conditional-css
[better-mso]: https://learn.better.email/blog/mso-attributes-in-outlook-emails
[cm-embedded]: https://www.campaignmonitor.com/blog/post/3927/embedded-images-in-html-email
[eoa-goomoji]: https://www.emailonacid.com/blog/article/email-development/gmail-ios-replacing-copyright-symbols-with-blue-emoji-and-how-to-fix-it
[eoa-amp]: https://www.emailonacid.com/blog/article/industry-news/outlook-turning-off-amp-for-email/
[adobe-emoji]: https://experienceleaguecommunities.adobe.com/t5/journey-optimizer-questions/emojis-in-email-subject-line-outlook-rendering/m-p/777967
[labnol-trim]: https://labnol.org/code/19938-show-trimmed-content-gmail
