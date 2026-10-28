# 02 — Dark mode and accessibility in email

**Scope.** How mail clients treat HTML email in dark mode, and what accessibility rules apply to email
and how far clients support them. Covers the colour transformations clients really apply, which
author signals they honour, how images behave in dark mode, how to test and simulate dark mode,
WCAG 2.2 mapped to email, the legal baseline, techniques with per-client support, screen readers in
real clients, and what a linter can automate. General CSS support and token/theme design are out of
scope (other slices) except where they touch dark mode or accessibility.

**Verified:** 2026-10-27. Client data comes from the caniemail.com API (dataset `last_update_date`
2026-09-16), primary sources (W3C, Chromium source code, vendor docs, EU law) and named practitioner
sources. Client behaviour changes without notice, so every row carries a source and needs
re-checking before v1.

**Legend**

| Column | Meaning |
|---|---|
| Level | What the framework should do. **MUST** = error by default; **SHOULD** = warning by default; **MAY** = opt-in or info. |
| Checkable | **Static** = lint the built HTML/CSS. **Token** = validate the theme. **Render** = needs a headless browser. **Manual** = human or real-device test. |
| Flags | **NEW** = changed 2024–2026. **UNCERTAIN** = weak or conflicting evidence. **FOLKLORE** = widely repeated, not supported by evidence. **CONTRADICTS P1/P2** = conflicts with `email-package-1` / `email-package-2`. |

Source keys such as [S1] link to the **Sources** list at the end.

---

## 0. What changed in 2024–2026

| When | Change | Why it matters here | Source |
|---|---|---|---|
| 2024-06 → 2024-07 | Outlook.com stripped `<style>` in `<head>` for about five weeks, then restored it | Dark-mode CSS is fragile; the inline light styles must work alone | [S35] |
| 2024-10-08 | WCAG2ICT published as a W3C Group Note: "emails" are listed as examples of *documents* | Gives a basis for applying WCAG 2.2 to email | [S51] |
| 2025-03-04 | Thunderbird 136: "Messages are automatically adapted to dark mode with a quick toggle in the header" | A new forced-dark client | [S44] |
| 2025-06-28 | European Accessibility Act applies | Legal driver for e-commerce and banking emails | [S56] |
| 2025-09 | New Yahoo webmail dark mode turns off-whites such as `#fffffe` into vivid green, pink or cyan | The `#fffffe` trick against Apple Mail now backfires | [S32] |
| 2025-10-21 | WCAG 2.2 approved as ISO/IEC 40500:2025 | WCAG 2.2 is now the international standard | [S48] |
| 2025-11 → 2025-12 | Yahoo webmail broke all media queries in dark mode; fixed 2025-12-03 | Shows how volatile dark-mode handling is | [S33] |
| 2026-02 | Outlook.com dark mode adds a white hover background behind every image | Transparent logos flash white on hover | [S34] |
| 2026-03 / 2026-09 | New WCAG 3 Working Drafts; still "a few more years" away | Do not build on WCAG 3 | [S49][S50] |
| 2026-04-20 | DOJ interim final rule moves ADA Title II deadlines to 2027-04-26 and 2028-04-26 | US public-sector timeline | [S61] |
| 2026-05-21 | Email Markup Consortium (EMC) Accessibility Report 2026 | Current failure rates and client scores (§2.6) | [S66] |
| 2026-08-31 → 2026-09 | **Gmail iOS and Android honour `<meta name="color-scheme" content="light only">`** (Google accounts only); caniemail updated 2026-09-16 | First sender opt-out from Gmail's forced dark mode | [S20][S2][S19] |
| 2026-09-02 | EN 301 549 V4.1.1 (based on WCAG 2.2) published; Official Journal citation still pending | EAA's presumption of conformity moves to WCAG 2.2 once it is cited | [S58] |
| 2026-10-05 | axe-core 4.14.0: rules tagged `EN-301-549v4`; `aria-roledescription` rule deprecated | Affects the checker's rule set | [S68] |
| 2026-10-09 | goodemailcode base template last updated: now documents the Gmail `light only` pattern and still uses the `role="article"` wrapper | Current practitioner baseline | [S23] |

---

## 1. Dark mode

### 1.1 How each client treats email in dark mode (October 2026)

"Partial" = light backgrounds and dark text are changed and dark areas are left alone. "Full" = every
colour is transformed, including dark-designed emails. `pcs` = `@media (prefers-color-scheme: dark)`.

| Client | No dark CSS in the email | Honours `pcs` | Honours `color-scheme` | Sender opt-out | Notes | Sources |
|---|---|---|---|---|---|---|
| **Apple Mail macOS** | **No change** to HTML email by default; only plain-text and "personal" mail is darkened. UNCERTAIN: Email on Acid (2025) says it inverts transparent and pure-white grounds | Yes, **only after opt-in** (CSS `:root{color-scheme:light dark}` from Mail 13; the meta tag on Mail 12) | CSS yes (root only); meta yes | Not needed | Opting in turns on dark UA defaults: unstyled text turns light and the canvas turns dark (§1.2 D3). `#ffffff` inside `pcs` was ignored (2019 bug, may be stale) | [S30][S45][S25][S1][S3][S2][S31] |
| **Apple Mail iOS/iPadOS** | Same as macOS | Yes (iOS 13+), after opt-in | CSS yes from 16.1 (root only); meta marked "no", but last tested on iOS 12.4 (UNCERTAIN) | Not needed | `light-dark()` from 17.5.1 | [S1][S3][S2][S4] |
| **Gmail web (desktop and mobile web)** | No change to the message body; a light email sits inside the dark UI | No | No (meta re-tested 2026-09) | n/a | | [S24][S25][S1][S2] |
| **Gmail Android, Google account** | **Partial**: Chromium "algorithmic darkening" (§1.3) | No | **NEW** meta `light only` honoured; other values ignored | `light only` | GANGA (a non-Google account in the Gmail app): no `<style>`, no opt-out | [S20][S2][S37]–[S40] |
| **Gmail iOS, Google account** | **Full**: "luminance inversion" that also turns dark-designed emails light | No | **NEW** meta `light only` honoured | `light only` | The old blend-mode hack is now redundant (§1.2 D7) | [S20][S29][S24] |
| **Outlook classic for Windows (Word engine)** | **Full** inversion of text and backgrounds when the Office theme is Black, unless the user ticks "Never change the message background color"; images untouched; the user can toggle the background per message | No | No | None (only VML or MSO-gradient hacks) | Algorithm undocumented (§1.3) | [S43][S24][S1][S2] |
| **New Outlook for Windows, Outlook.com, OWA** | **Partial**: "contrast repair" rewrites inline colours with `!important` and stores the originals in `data-ogsc`/`data-ogac`/`data-ogsb`/`data-ogab`; the user can "Turn on the lights" | Outlook.com yes. New Outlook is assumed to match because it shares the engine, but caniemail has no separate entry (UNCERTAIN) | No | None | Selector limits (§1.2 D5); **NEW** white hover behind images | [S28][S1][S43][S34] |
| **Outlook for Mac** | Partial | Yes (16.80), plus `data-og*` | No | None | | [S1][S24] |
| **Outlook iOS** | Partial | Yes, plus `data-og*` | No | None | | [S1][S24] |
| **Outlook Android** | Partial | Yes since 2023-03, plus `data-og*` | No | None | | [S1][S24] |
| **Yahoo Mail web (new UI)** | **NEW** Darkens colours (about a 70% HSL lightness cut is reported) rather than inverting them; near-white off-whites become vivid | No (`pcs` is rewritten to `@media ()`) | No | None | Media queries broke in dark mode Nov–Dec 2025 (fixed) | [S32][S33][S1] |
| **Yahoo Mail apps** | Changes colours; reports differ between partial and full (UNCERTAIN); PNG issues on iOS 17 reported | No | No | None | | [S1][S32] |
| **AOL** | Web: no dark-mode UI (Email on Acid, 2025); apps share Yahoo's stack (UNCERTAIN) | No | No | None | | [S25][S1] |
| **Samsung Email** | Varies by One UI version (UNCERTAIN) | Yes (6.1+) | CSS yes; meta no (9.1) | Use authored dark | Partial `light-dark()` | [S1][S3][S2][S4] |
| **Thunderbird** | **NEW** (136+, March 2025): automatic dark adaptation with a per-message toggle | Listed as unsupported since 78 | CSS and meta yes (102.11) | Unknown whether `light only` disables the 136+ adaptation (UNCERTAIN) | `light-dark()` from 128 | [S44][S1][S2][S3][S4] |

Usage: Litmus reported that about 35% of tracked opens used dark mode in 2022 [S24]. No newer
primary figure was verified.

### 1.2 Author signals and dark-mode CSS

| # | Rule | Why | Clients | Level | Checkable | Source |
|---|---|---|---|---|---|---|
| D1 | The inline light styles must be complete and correct on their own | Every dark mechanism is stylesheet-based, and `<style>` is lost in GANGA, was lost in Outlook.com in 2024, and does not apply in forwards | All | MUST | Static: run the contrast checks on an inline-only render (strip `<style>`) | [S35][S29] |
| D2 | Emit `<meta name="color-scheme" content="light dark">` **and** `:root{color-scheme:light dark}` if, and only if, the template ships a dark palette | Apple Mail applies `pcs` only after this opt-in; meta for Mail 12, CSS for Mail 13+ | Apple Mail, Thunderbird, Samsung (CSS) | MUST (when dark CSS exists) | Static: dark media query present ⇔ both declarations present | [S30][S23][S3] |
| D3 | Once `light dark` is declared, every text-bearing element needs an explicit `color`, and its container an explicit background, or both must inherit from a root that the dark CSS restyles | The opt-in switches the UA defaults to dark: unstyled text turns light, so text without a colour on an inline light card becomes light-on-light | Apple Mail, Thunderbird | MUST | Render: emulate dark with only UA defaults and run the contrast check | [S30][S3] |
| D4 | Treat `supported-color-schemes` as obsolete (macOS 10.14 only). Emitting it is harmless but not required. **CONTRADICTS P1**, whose `html.meta` check requires it | Renamed to `color-scheme`; Mail 13+ ignores it | Apple Mail 12 | MAY | Static | [S23][S30] |
| D5 | Restate the dark palette in both `@media (prefers-color-scheme: dark)` and `[data-ogsc]`/`[data-ogsb]` blocks generated from one rule list. In the Outlook block use the descendant form `[data-ogsb] .cls`, target the element that carries the inline colour, and add `!important` | Still valid in 2026: caniemail keeps the `data-og*` note for Outlook.com, Mac, iOS and Android. Outlook.com matches attribute selectors only bare or as `E[attr]`, and injects `!important` inline | Outlook.com, new Outlook, Outlook Mac/iOS/Android | SHOULD | Static: each dark rule has a twin; no `.cls[data-og*]` compound selectors | [S28][S1][S26] |
| D6 | Gmail opt-out is **opt-in per template, off by default**: `<meta name="color-scheme" content="light only">`, plus `:root{color-scheme:light dark}` in CSS if the template has authored dark styles (Apple Mail lets the CSS override the meta) | **NEW.** It stops Gmail's forced dark mode for Google accounts. EMC and goodemailcode advise against making it a default because it overrides the reader's dark preference. Litmus Gmail-app previews still showed forced dark in October 2026 while real sends worked | Gmail iOS/Android (Google accounts) | MAY | Static: the meta value is one of `light dark`, `light only`; warn when `light only` appears without the CSS twin while a dark palette exists | [S20][S21][S23][S2] |
| D7 | Do not use the `u + .body` `mix-blend-mode` hack | It only preserves white text, depends on Gmail rewriting the doctype into `<u>`, fails in GANGA and Gmail mobile web, and is superseded by D6 | Gmail iOS | SHOULD NOT | Static: flag `mix-blend-mode` under `u + .body` | [S29][S7] |
| D8 | `light-dark()` only as an enhancement, with a literal fallback declared first | Apple Mail (Safari 17.5+), Thunderbird 128+, Samsung partial; no Gmail, Outlook or Yahoo | — | MAY | Static: each `light-dark()` has a preceding literal declaration | [S4] |
| D9 | Never rely on authored dark styles in Gmail, Yahoo/AOL or classic Outlook: the light palette must survive forced dark | These clients ignore `pcs` and transform colours themselves | Gmail, Yahoo/AOL, Outlook Windows | MUST | Token: forced-dark contrast passes (§1.4) | [S1] |
| D10 | A template designed dark in light mode (a dark hero, an all-dark email) should either use D6 or be tested under Gmail iOS full inversion | Gmail iOS luminance inversion turns dark emails light | Gmail iOS | SHOULD | Token: a dark light-mode ground triggers a warning | [S20] |
| D11 | Keep dark rules flat: no nested at-rules inside `@media` | Gmail drops the whole `<style>` block (P1 rule; not re-tested here, see the CSS slice) | Gmail | MUST | Static | P1 06 |

### 1.3 How clients actually transform colours

P1 models forced dark as `255 − v` per channel. Only one client's algorithm is public: Chromium's,
which Android WebView uses. The EMC says Gmail Android uses Chromium's algorithmic darkening [S20].
That algorithm is **lightness inversion in CIELAB with hue and chroma preserved**, not per-channel
inversion.

| Client | Transformation | Evidence | Confidence |
|---|---|---|---|
| Chromium / Android WebView (Gmail Android) | For each colour chosen for inversion: `L* ← min(110 − L*, 100)`, keeping a\*/b\*. **Text** is inverted only if its YIQ brightness `(299R+587G+114B)/1000 < 150`. **Backgrounds** are inverted only if brightness `> 205`. Neutral results with channel values between 18 and 32 snap to `#121212`. An image classifier may invert small, icon-like, low-colour images (`kIcon`, `kSeparator`) unless the `AutoDarkModeSkipImages` feature is on | Chromium source [S37][S38][S39][S40] | High for the algorithm. Medium that Gmail runs the default parameters. Image inversion in Gmail is UNCERTAIN |
| Gmail iOS | "Luminance inversion" of all colours, including dark emails | EMC [S20]; math undocumented | Low on detail |
| Outlook.com / new Outlook / Outlook apps | Contrast repair: elements without at least 4.5:1 against Outlook's dark ground are recoloured; originals are kept in `data-og*`. Example: `#3ef` became `rgb(0,75,92)`. Replacement colours pass through the same filter | hteumeuleu, Parcel [S28][S26] | Medium |
| Outlook classic Windows | Hue-preserving lightness inversion. Third-party claims (`(117 − L*) × 0.82`; white → `#262626`, black → `#f6f6f6`) are unverified | Community only | Low (FOLKLORE until measured) |
| Yahoo web (new) | About a 70% lightness reduction in HSL. A near-white with a one-unit channel offset has 100% HSL saturation, so `#fffffe` becomes the vivid `#989800` | email-bugs #156 [S32] | Medium |
| Apple Mail | No transformation of HTML; dark UA defaults only after opt-in | [S30][S45] | High |
| Thunderbird 136+ | "Automatically adapted"; algorithm undocumented | [S44] | Low |

Worked numbers (computed with the Chromium formula above, without thresholds):

| Colour | L\* | `255 − v` (P1) | Chromium LAB | Note |
|---|---|---|---|---|
| `#ffffff` | 100 | `#000000` | `#121212` | P1's premise "white inverts to pure black" fails here |
| `#fafafa` | 98.3 | `#050505` | `#121212` | An off-white gives the same result as white |
| `#f5f5f5` | 96.5 | `#0a0a0a` | `#222222` | |
| `#707070` / `#808080` / `#909090` | 47 / 54 / 60 | `#8f8f8f` / `#7f7f7f` / `#6f6f6f` | `#989898` / `#878787` / `#777777` | Both models have a fixed point near L\* 50–55, so the mid-tone band really does barely move |
| `#2563eb` (blue) | 46 | `#da9c14` (orange) | `#6f90ff` (light blue) | Per-channel flips the hue; real clients keep it |
| `#dc2626` (red) | 48 | `#23d9d9` (cyan) | `#ff5547` (light red) | |
| `#16a34a` (green) | 59 | `#e95cb5` (pink) | `#008e37` (green) | |

Contrast effect: red `#dc2626` on white is 4.83:1 in light mode. After inversion, `255 − v` predicts
**12.0:1**, while Chromium gives **5.9:1**. Green `#16a34a` is 3.30:1 in light mode; `255 − v`
predicts 6.66:1 and Chromium gives 4.39:1. Per-channel inversion **overstates contrast for saturated
colours** and predicts hue flips that do not happen. Under Chromium's thresholds a brand-blue button
with a white label is left as it is, because the background brightness is 96 (≤ 205) and the label
brightness is 255 (≥ 150).

**Verdict: CONTRADICTS P1.** `255 − v` is a fair approximation for neutral greys only. Replace it
with (a) a *partial* model (Chromium: LAB inversion with the 150/205 thresholds) and (b) a *full*
model (LAB L\* inversion of everything, as an approximation for Gmail iOS and classic Outlook).

### 1.4 Colour rules: P1's rules checked against the evidence

| # | Rule | Verdict and why | Clients | Level | Checkable | Source |
|---|---|---|---|---|---|---|
| C1 | P1: "light page ground ≠ `#ffffff`" | **Largely refuted (CONTRADICTS P1).** Chromium maps `#ffffff` and `#fafafa` to the same `#121212`, and Outlook substitutes its own ground. What remains: Apple Mail ignored `#ffffff` inside `pcs` (2019, possibly stale). New risk: a near-white with tiny channel offsets (`#fffffe`) turns vivid in Yahoo. Use a neutral off-white (R=G=B) if you want one, never single-unit offsets | Yahoo, Apple Mail (legacy) | MAY (downgrade from error) | Token: warn on near-whites where `max − min` channel is 1–3 | [S37][S31][S32] |
| C2 | P1: "authored dark ground ≠ `#000000`; aim `#0a0a0a`–`#1a1a1a`" | **Verified as design guidance** (halation on pure black; Chromium's own `#121212` target), not as an inversion issue | Authored-dark clients | SHOULD | Token | [S37] |
| C3 | P1: "text and rules avoid `#707070`–`#909090` (every channel)" | **Partly verified.** Colours near L\* 50–55 barely move under either model. For text on white or black, though, the contrast passes already catch it: `#767676` is the lightest grey with 4.5:1 on white, and `#808080` fails in light mode. The real risks are mid-tone **backgrounds behind text**, **borders that must reach 3:1 (1.4.11)**, and **chromatic** mid-tones (`#2563eb`, L\* 46), which the grey-only definition misses. Redefine the band as **L\* ≈ 40–65 for any hue**, applied to backgrounds and 1.4.11 elements | Forced-dark clients | SHOULD | Token (compute L\*) | [S37] |
| C4 | P1: "contrast in three passes" | **Verified in principle; the model is wrong.** Use four passes: light (inline only), authored dark, forced-partial (Chromium model) and forced-full (LAB inversion). **CONTRADICTS P2**, which checks only light and authored dark, although Gmail never shows authored dark | All | MUST (light, authored dark); SHOULD (forced) | Token + Render | [S37][S20] |
| C5 | P1: "no colour as the only carrier of meaning, because inversion shifts hues" | **Rule verified (WCAG 1.4.1); the rationale is FOLKLORE.** Real algorithms preserve hue and swap lightness. Keep the rule for 1.4.1 reasons (colour blindness, monochrome) | All | MUST | Manual + Static (status components require an icon or text) | [S47][S37] |
| C6 | Button fills with YIQ brightness ≤ 205 and labels ≥ 150 survive Gmail Android unchanged | Chromium thresholds | Gmail Android | MAY (info) | Token | [S38] |
| C7 | Text over a background image needs its own solid fallback `background-color` that passes contrast | Clients invert colours, not images; Parcel reports Gmail still inverts unless the background image is at least 60×60 px | Gmail, Outlook | SHOULD | Static | [S26] |
| C8 | Do not rely on inline `linear-gradient()` as an anti-inversion trick | Gmail Android rewrites inline gradients incorrectly (open bug, 2024) | Gmail Android | SHOULD | Static | email-bugs #135 [S36b] |

### 1.5 Images in dark mode

| # | Rule | Why | Clients | Level | Checkable | Source |
|---|---|---|---|---|---|---|
| I1 | Wordmark as live text; logo images only where the brand needs them (agrees with P1/P2) | Survives images-off and dark grounds; a dark PNG wordmark vanishes on dark | All | SHOULD | Static | P1, [S74] |
| I2 | A transparent PNG with dark ink gets a 1–2 px light stroke or soft glow, or sits on a solid light "plate" (rounded rectangle) | Most clients don't invert images, so the dark ink lands on a dark ground | All forced-dark clients | SHOULD | Render: composite the image on light and on dark grounds; measure the opaque-edge contrast (≥ 3:1) | [S24][S26][S25] |
| I3 | Never a transparent PNG with **light** ink alone | Invisible in light mode | All | MUST | Render (same test) | [S24] |
| I4 | Dark-logo swap: `<picture><source srcset="dark.png" media="(prefers-color-scheme: dark)"><img src="light.png" alt="…"></picture>` and/or a class swap under `pcs` + `[data-ogsc]`. Hide the dark copy from Word with `<!--[if !mso]><!-->…<!--<![endif]-->` | `<picture>`: Apple Mail iOS yes, macOS partial (stripped "in some cases"), Samsung and Thunderbird yes; Gmail replaces it with `<u>`; Outlook and Yahoo no. Class swaps cover Outlook.com and the Outlook apps | Mixed | MAY | Static: the default `<img>` (light asset) still passes I2 on a forced-dark ground | [S5][S46][S24][S25] |
| I5 | The light/default image must work on forced-dark grounds, because it is what Gmail, Yahoo and classic Outlook show | No swap support there | Gmail, Yahoo, Outlook Windows | MUST | Render | [S5] |
| I6 | Icons (social, bullet, status) on plates or with strokes; never rely on clients inverting them | Chromium *may* invert small icon-like images; Outlook doesn't. The result is unpredictable | Gmail Android (UNCERTAIN), others | SHOULD | Render | [S40] |
| I7 | Prefer PNG or APNG to GIF for transparency | GIF has 1-bit alpha, so white halos pixelate on dark | All | SHOULD | Static (warn on transparent GIF) | [S24] |
| I8 | Photos with a white matte get padding or rounded corners, or bake in a background that matches the dark design | A hard white rectangle looks broken on dark | All | MAY | Manual | [S24] |
| I9 | Expect a white hover flash behind images in Outlook.com dark mode; no author fix | Outlook.com CSS `.WjXVs:hover{background-color:var(--neutralDark)}` | Outlook.com | — (known issue) | — | [S34] |
| I10 | SVG as an image format: caniemail (2026-09) shows Gmail rasterising SVG to PNG, and Yahoo/AOL rendering it. **CONTRADICTS P1's** "SVG blocked across major clients since late 2025" for `<img src=*.svg>`. Defer to the CSS/HTML slice | | Gmail, Yahoo, AOL | — | — | [S82] |

### 1.6 Testing and simulating dark mode

| # | Practice | Why | Level | Source |
|---|---|---|---|---|
| T1 | Real-account matrix before release: Apple Mail iOS and macOS; Gmail iOS and Android with a **Google** account and with a **non-Google** account (GANGA); Outlook.com or new Outlook; classic Outlook with the Black theme; Outlook iOS/Android; Yahoo web in dark mode; Samsung Email; Thunderbird 136+ | Behaviour differs by account type and OS version | SHOULD | [S20][S1] |
| T2 | Treat screenshot services as lagging indicators | Dyspatch found Litmus Gmail-app previews still forced dark after the `light only` fix | SHOULD | [S21] |
| T3 | **Studio mode "light / inline only"**: strip `<style>` and render | Simulates GANGA, forwards, and the 2024 Outlook.com stripping | SHOULD | [S35] |
| T4 | **Studio mode "authored dark"**: emulate `prefers-color-scheme: dark` (CDP `Emulation.setEmulatedMedia`) with `color-scheme` honoured, so UA dark defaults apply | Apple Mail model; exposes D3 failures | SHOULD | [S30] |
| T5 | **Studio mode "Gmail Android (forced partial)"**: render in Chromium launched with `--enable-features=WebContentsForceDark` (optionally with `foreground_lightness_threshold`/`background_lightness_threshold` params). This is the real Blink algorithm. Mirror the same model in JS for the static checker | Closest available reproduction of Gmail Android | SHOULD | [S41][S37][S42] |
| T6 | **Studio mode "forced full"**: LAB L\* inversion of every colour, images untouched | Approximates Gmail iOS and classic Outlook | SHOULD | [S20] |
| T7 | **Studio mode "Outlook.com"**: add `data-ogsc`/`data-ogsb` to coloured elements, apply the author's `[data-og*]` rules, then contrast-repair the rest to 4.5:1 against a dark ground | Shows whether the Outlook twin rules (D5) work | MAY | [S28] |
| T8 | **Studio mode "Yahoo web dark"**: HSL lightness −70% | Flags off-white tint blow-ups (C1) | MAY | [S32] |
| T9 | When the template has `light only`, show Gmail modes as "opted out" | Matches the 2026 behaviour | SHOULD | [S20] |
| T10 | Show the Fastmail-style runtime trick (`pcs` → `@media all`) only as an implementation idea for T4 | Fastmail does this at runtime | — | [S1] note 4 |

---

## 2. Accessibility

### 2.1 Standards status

| Item | Status (2026-10-27) | Implication | Source |
|---|---|---|---|
| WCAG 2.2 | W3C Recommendation (October 2023, errata later); ISO/IEC 40500:2025 | Target **WCAG 2.2 AA**, which is a superset of 2.1 AA and 2.0 AA | [S47][S48] |
| WCAG 2.2 and 4.1.1 Parsing | Removed in 2.2 | Don't build a "parsing" check for conformance (HTML validity is still useful for rendering) | [S47] |
| WCAG2ICT (Group Note, 2024-10-08) | Lists "emails" as examples of *documents*; "set of web pages" maps to "set of documents" | Justifies applying WCAG 2.2 to each email and to an email series (3.2.6) | [S51] |
| WCAG 3 | Working Drafts (March 2026, updated September 2026); "not expected to be a completed W3C standard for a few more years"; WCAG 2 is not deprecated. Third parties expect a Candidate Recommendation no earlier than about late 2027 (UNCERTAIN) | Don't adopt WCAG 3 or APCA contrast as gates; at most report APCA as info | [S49][S50] |

### 2.2 WCAG 2.2 success criteria mapped to email

| SC (level) | What it means in email | Framework rule | Level | Checkable |
|---|---|---|---|---|
| 1.1.1 Non-text Content (A) | Every `<img>` has `alt`. Decorative images get `alt=""`. **A linked image's alt describes the destination or action.** Text in an image is repeated in its alt. VML shapes need `alt` | Image component requires an `alt` prop with type `decorative \| informative \| functional`; functional means non-empty | MUST | Static (`image-alt`, `link-name`, Parcel `vml-alt`) |
| 1.3.1 Info and Relationships (A) | Real `h1`–`h6`, `p`, `ul`/`ol`; data tables use `th`+`scope`; layout tables use `role="presentation"`; no bold-paragraph "headings" | Heading, List and DataTable components emit semantic tags; layout primitives emit `role="presentation"` | MUST | Static (`list`, `listitem`, `th-has-data-cells`, `td-headers-attr`, Parcel `table-role`; experimental `p-as-heading`) |
| 1.3.2 Meaningful Sequence (A) | DOM order = reading order, including stacked columns and RTL column reversal | Column component documents and enforces the source order | MUST | Manual + Render (DOM order vs visual order at 320 px) |
| 1.3.3 Sensory Characteristics (A) | No "click the green button" or "see the right column" | Copy lint | SHOULD | Static (phrase list, locale-aware) |
| 1.4.1 Use of Color (A) | Body-text links are **underlined**: hover and focus cues (technique G183) are unsupported in many clients, and forced dark changes link colours. Status is never shown by colour alone | Link component underlines by default inside text; Button exempt (its shape is the cue) | MUST | Static (`link-in-text-block`; inline `text-decoration:none` on in-text links) |
| 1.4.3 Contrast (Minimum) (AA) | 4.5:1, or 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold), in **every** mode (§1.4 C4); includes button labels, footer text and styled alt text | Theme validation plus a rendered check | MUST | Token + Render (`color-contrast` run per mode) |
| 1.4.4 Resize Text (AA) | Text must stay usable at 200%: no fixed-height text boxes, no `overflow:hidden` on text, no `user-scalable=no` | Components never set `height` on text containers | MUST | Static (`meta-viewport`; scan inline styles) |
| 1.4.5 Images of Text (AA) | Headings, CTAs and wordmarks as live text | Image component warns when alt text is long (likely an image of text) | SHOULD | Static (heuristic) + Manual |
| 1.4.10 Reflow (AA) | Readable at **320 CSS px** wide without horizontal scrolling (data tables exempt): fluid `width:100%; max-width:600px`, images `max-width:100%`. **CONTRADICTS P2**, which uses 360 px; the WCAG figure is 320 | Max fixed width of 320 px for any non-table element | MUST | Render at 320 px: no element wider than the viewport |
| 1.4.11 Non-text Contrast (AA) | 3:1 for boundaries needed to identify controls (ghost buttons, outlined inputs) and for meaningful icons and charts. Decorative dividers are exempt | Theme pairs include `buttonBorder/ground` when the fill doesn't contrast | MUST | Token |
| 1.4.12 Text Spacing (AA) | Content survives line-height 1.5, paragraph spacing 2×, letter spacing 0.12×, word spacing 0.16× | No fixed heights; no inline `!important` on spacing properties | MUST | Static (`avoid-inline-spacing`) |
| 2.1.1 Keyboard (A) | Every link is reachable. Links inside VML aren't keyboard-focusable in classic Outlook | No VML buttons or links-over-VML; no `tabindex > 0` | MUST | Static (Parcel `vml-links`, axe `tabindex`) |
| 2.2.2 Pause, Stop, Hide (A) | Animation that starts automatically and lasts more than 5 s needs a pause control, which email can't provide, so keep total animation ≤ 5 s or use a finite loop that ends on a meaningful frame | Animated image component reads GIF/APNG timing | MUST | Static (decode frames, sum delays × loops) |
| 2.3.1 Three Flashes or Below Threshold (A) | No more than three flashes per second | Same decoder: luminance-delta flash analysis | MUST | Static (GIF/APNG analysis) |
| 2.4.2 Page Titled (A) | `<title>` = subject (it matters for view-in-browser; EMC finds 45% fail) | Layout sets `<title>` from the subject | SHOULD | Static (`document-title`) |
| 2.4.4 Link Purpose (In Context) (A) | Descriptive link text; no bare "click here" or "read more" without context; add context with visually hidden text (`aria-label` support is limited) | Link component lints its text (locale-aware) | SHOULD | Static (Parcel `accessible-hyperlinks`, axe `identical-links-same-purpose`) |
| 2.4.6 Headings and Labels (AA) | Headings describe their section | — | SHOULD | Manual |
| 2.4.7 Focus Visible (AA) | Never ship `outline:none` or `outline:0` on links | — | MUST | Static |
| 2.5.3 Label in Name (A) | An `aria-label` on a link must contain the visible text | — | MUST | Static |
| 2.5.8 Target Size (Minimum) (AA, new in 2.2) | Targets ≥ 24×24 CSS px or spaced so 24 px circles don't overlap; inline text links are exempt. Recommend ≥ 44 px tall for primary buttons (platform guidance, not WCAG) | Button computes padding + line-height; icon rows enforce size and gap | MUST (24) / SHOULD (44) | Static (computed box) + Render (`target-size`) |
| 3.1.1 Language of Page (A) | `lang` on `<html>` **and** on a wrapper that is a direct child of `<body>`, plus `xml:lang` on `<body>` for classic Outlook | Layout emits all three from the locale | MUST | Static (`html-has-lang`, `valid-lang`, Parcel `body-lang`) |
| 3.1.2 Language of Parts (AA) | `lang` on passages in another language (quoted names, legal text) | Text components accept `lang` | SHOULD | Static (validate values) |
| 3.2.6 Consistent Help (A, new in 2.2) | Across an email series (a "set of documents"), help links stay in the same relative order | Shared footer component | MAY | Static (snapshot of footer order) |
| 4.1.2 Name, Role, Value (A) | No `role="button"` on `<a>`; `aria-label` only on roles that allow naming. ARIA 1.2 prohibits naming `generic` elements (`div`/`span`). **CONTRADICTS P2** if its `CodeBox` puts `aria-label` on a `div`/`span` | — | MUST | Static (`aria-prohibited-attr`, Parcel `role-button`) |
| 1.4.8 Visual Presentation (AAA, advisory) | Not justified; line height ≥ 1.5; line length ≤ 80 characters | Defaults follow it | SHOULD | Static |

Sources for §2.2: [S47][S52][S53][S54][S55][S66][S67][S68][S36][S81].

### 2.3 Legal baseline (short; privacy and spam law are covered elsewhere)

| Jurisdiction | Instrument and status | Email relevance | Technical standard | Source |
|---|---|---|---|---|
| EU | **European Accessibility Act**, Directive (EU) 2019/882; applies since **28 June 2025**. In-scope services: e-commerce, consumer banking, e-books, electronic communications, access to audiovisual media, and elements of passenger transport. Services of microenterprises (fewer than 10 staff and ≤ €2 m turnover) are exempt. Transitional use of pre-existing products runs until 28 June 2030 | Email isn't named. It is generally treated as in scope **when it is part of an in-scope service** (order confirmations, banking notices, information about how the service works). UNCERTAIN: no Commission guidance on email, and national transpositions differ. Banking adds a plain-language requirement (no more complex than CEFR B2) | EN 301 549 **V3.2.1** (WCAG 2.1 AA) holds the presumption of conformity today. **NEW** V4.1.1 (WCAG 2.2 AA, with an EAA annex) was published 2026-09-02; citation in the Official Journal is expected late 2026 (UNCERTAIN) | [S56][S57][S58] |
| US (federal) | Section 508 (36 CFR 1194) | section508.gov: documents "including email messages" that are public-facing or agency official communications must comply | WCAG 2.0 A/AA | [S60] |
| US (state and local government) | ADA Title II rule (2024); **NEW** deadlines 2027-04-26 (population ≥ 50k) and 2028-04-26 | Covers web content and mobile apps; email isn't listed explicitly (UNCERTAIN) | WCAG 2.1 AA | [S61] |
| US (private) | ADA Title III: no technical regulation; litigation-driven | Risk through linked web content more than email itself | WCAG 2.x AA (case law) | [S61] |
| UK | Equality Act 2010, s.20 (reasonable adjustments, including information in an accessible format) and s.29 (services): an anticipatory duty. The Public Sector Bodies Accessibility Regulations 2018 cover websites and apps, not email | Service emails fall under the general duty; UK firms selling to EU consumers also face the EAA | None mandated (WCAG used in practice) | [S62] |
| Canada | Accessible Canada Act (federally regulated: banks, telecoms, transport); CAN/ASC-EN 301 549:2024 (identical to EN 301 549:2021) published May 2024, voluntary unless a regulation references it. Ontario AODA (O. Reg. 191/11): s.12 accessible formats on request; s.14 websites at WCAG 2.0 AA | Accessible formats and communications | EN 301 549 / WCAG 2.0–2.1 | [S63][S64][S65] |

**Framework stance:** conform to WCAG 2.2 AA by default. This meets or exceeds every regime above.

### 2.4 Techniques and client support

| # | Technique / rule | Why | Client support | Level | Checkable | Source |
|---|---|---|---|---|---|---|
| A1 | Real `h1`–`h6` with inline `color`, `margin` and `font-size` | Headings are the main navigation method for screen-reader users. Supported in all major clients; LaPoste restyles headings, so inline styles protect them | All | MUST | Static | [S14][S71] |
| A2 | Exactly one `h1`, carrying the email's title; no skipped levels. For very short, SMS-like emails, missing `h1` is a warning, not an error | EMC rates a missing `h1` "Mild"; goodemailcode says use one "but don't force it". Proton adds an `h1` for the subject, LaPoste and 163 add one for their logo | — | SHOULD (one), MUST (≤ 1) | Static (`heading-order`, `empty-heading`, Parcel `h1-tag`) | [S71][S66][S67] |
| A3 | `p`, `ul`/`ol` for prose and lists; avoid `ol reversed` and `li value` | Lists are supported everywhere; `reversed` and `value` are not | All | SHOULD | Static | [S14] |
| A4 | No HTML5 sectioning elements (`article`, `section`, `nav`, `header`, `footer`, `main`, `aside`); use `div role="…"` instead. Never add banner, contentinfo, main or complementary landmarks | Gmail turns the tags into `<u>`; Outlook.com and Yahoo/AOL strip them. The webmail page already has its own landmarks | Gmail, Outlook.com, Yahoo, AOL | MUST | Static (Parcel `article-article`, `main-main`, `banner-header`, etc.) | [S14][S70][S67] |
| A5 | `role="presentation"` (or `none`) on **every** layout table, including nested and MSO ghost tables; no `th`, `caption`, `summary` or `scope` inside them | Otherwise screen readers announce rows and columns. 83.8% of emails fail (EMC 2026). Yahoo/AOL keep `role` only on `<table>`, which is enough | All except Windows Mail | MUST | Static (Parcel `table-role`, `presentation-role-conflict`) | [S11][S66][S78] |
| A6 | Prefer single-column layout structures; avoid multi-row × multi-column layout grids | **NVDA with classic Outlook cannot see `role="presentation"`**: Word's UIA can't tell data tables from layout tables, so NVDA treats only 1-row or 1-column tables in the message view as layout and announces the rest | Classic Outlook + NVDA | SHOULD | Static (count layout tables with ≥ 2 rows and ≥ 2 columns) | [S69] |
| A7 | `lang` and `dir` on `<html>` **and** on the wrapper div that is a direct child of `<body>`; `xml:lang` on `<body>`. Fall back to `lang="und" dir="auto"` only when the locale is unknown. **CONTRADICTS P1** (`<html>` only). P2's `<html>` + `<body>` is weaker than the wrapper, because Gmail, Outlook.com and Yahoo replace `<body>` with a `<div>` | Webmail drops `<html>`. EMC 2026: 97.4% fail on body `dir`, 95.7% on body `lang` | Yahoo strips `lang` on `td`; Gmail mobile web makes the whole email RTL if it contains RTL text; classic Outlook `dir` is buggy on `<a>` | MUST | Static (Parcel `body-lang`, `body-dir`; validate BCP 47 tags) | [S12][S13][S17][S23][S66] |
| A8 | Wrapper `<div role="article" aria-label="{subject}" lang dir>` | goodemailcode (2026-10-09) still recommends it: it puts the email in the landmarks menu with a name | `role` and `aria-label` are stripped by Yahoo/AOL (and Thunderbird for `aria-label`); kept by Apple, Gmail, Outlook and Samsung | SHOULD | Static | [S23][S70][S8][S11] |
| A9 | `aria-roledescription="email"` only if it is **translated** into the email's language; otherwise omit it | goodemailcode: "If you are unable to translate this… leave it off". CONTESTED: roledescription overrides the native role announcement, and axe 4.14 deprecated its rule | Same as A8 | MAY | Static (the value must come from the message catalogue) | [S23][S68] |
| A10 | `aria-label` only on links, images or landmarks, and never on `div`/`span` without a role. Prefer visible or visually hidden text | ARIA 1.2 prohibits naming `generic` elements; Yahoo/AOL, Thunderbird and Windows Mail drop `aria-label` | Apple, Gmail, Outlook all versions, Samsung: yes | MUST | Static (`aria-prohibited-attr`) | [S8][S81] |
| A11 | Never use `aria-labelledby` or `aria-describedby` | Gmail and Outlook.com prefix `id` values but not the references, so the reference breaks; classic Outlook removes `id` | Gmail, Outlook.com, Outlook Windows | MUST NOT | Static | [S10] |
| A12 | `aria-hidden="true"` only on decorative duplicates (for example, a spacer glyph), never to hide meaningful text | Yahoo/AOL, Thunderbird and Windows Mail ignore it, so hidden content gets read there | Apple, Gmail, Outlook: yes | SHOULD | Static (`aria-hidden-focus`) | [S9] |
| A13 | Hide content with `display:none` (+ `mso-hide:all`), not the `hidden` attribute | `hidden` is unsupported in Gmail, Outlook and Yahoo | Most | MUST | Static | [S83] |
| A14 | Visually hidden text uses goodemailcode's two-span pattern (`max-height/width`, `overflow:hidden`, `font-size:1px`, transparent colour, `mso-font-width:0%`) | Works across clients, including GANGA, where `overflow:hidden` is unsupported | All | SHOULD (component) | — | [S73] |
| A15 | Alt-text content rules: logo alt = brand name (not "logo"); no "image of"; text in an image = the exact text; decorative = `alt=""`; linked = destination or action; never omit `alt` (readers may announce the file name or URL). **CONTRADICTS P1**'s "empty is fine" for linked images | Linked images without alt are the main cause of "links must have discernible text" (71% of emails) | All | MUST (presence, linked-non-empty); SHOULD (content) | Static + Manual | [S66][S74][S78] |
| A16 | Styled alt text (font and colour on `<img>`) must also pass contrast on the forced-dark ground | Images are blocked by default in classic Outlook, and alt text is then shown on the client's ground | Outlook Windows, images-off | SHOULD | Token | [S78] |
| A17 | Links: underlined in body text; never `role="button"` on `<a>`; buttons are padded `<a>` elements (goodemailcode link-button pattern), not VML | 1.4.1. Parcel rates `role="button"` on links Critical. VML links fail the keyboard. Windows Mail ignores `text-decoration:none`, so set the underline colour to match the fill | All | MUST | Static | [S76][S67][S36] |
| A18 | Font size: body ≥ 16 px; secondary ≥ 14 px; warn below 14 and error below 12. Respect user settings with `font-size:medium; font-size:max(16px,1rem)` on the wrapper (agrees with P1's 16 px) | Default sizes range from 12 px (Apple Mail macOS) to 17 px; EMC flagged 10 px footers | All | SHOULD (16/14), MUST (≥ 12) | Static | [S72][S23][S66] |
| A19 | Line height ≥ 1.5 for body text and ≥ 1.2 for headings; when using `mso-line-height-rule:exactly`, the line height must still be ≥ 1.2 × font size | WCAG 1.4.8 (AAA) and 1.4.12. `exactly` clips glyphs if set too small | All, Outlook Windows | SHOULD | Static | [S54][S16b] |
| A20 | Left-align (right-align in RTL) any text block longer than about 2 lines; never `text-align:justify`. Emit `left`/`right` rather than `start`/`end` | Ragged-centre text hurts readers with dyslexia; 1.4.8 forbids justified text. Outlook Windows doesn't support `start`/`end` | All | SHOULD (centre), MUST (justify) | Static (length heuristic on centred `p`) | [S78][S80] |
| A21 | Touch targets: CTA height ≥ 44 px (≥ 24 px is the hard floor); icon links ≥ 24 px with gaps ≥ 8 px | WCAG 2.5.8 | Mobile | MUST (24) / SHOULD (44) | Static | [S53] |
| A22 | Animated images: ≤ 3 flashes per second; total runtime ≤ 5 s or a finite loop; the first **and** last frame carry the message; offer a static source via `<picture><source media="(prefers-reduced-motion: no-preference)">` with the static image as the `<img>` | Classic Outlook shows the first frame (Microsoft 365 plays 3 loops and then shows a play button); `prefers-reduced-motion` works in Apple Mail, the Outlook apps/web and Samsung, but not in Gmail or Yahoo | All | MUST (flash, 5 s), SHOULD (picture swap) | Static (frame analysis) | [S16][S15][S46] |
| A23 | Data tables: no `role="presentation"`; `<th scope="col\|row">`; a `<caption>` or a heading immediately before; one header level; no nesting. Make them ≥ 2×2 so NVDA in classic Outlook keeps treating them as tables | Header association; NVDA heuristic (A6) | All | MUST | Static (`th-has-data-cells`, `scope-attr-valid`, `empty-table-header`, experimental `td-has-header`) | [S68][S69] |
| A24 | `<title>` equals the subject | 2.4.2; EMC: 45% missing | Browser view, some clients | SHOULD | Static | [S66] |
| A25 | Preheader inside `<div style="display:none">`, with filler characters (`&#8199;&#65279;&#847;`) inside that hidden div only | `display:none` removes it from the accessibility tree, so screen readers skip it. Some Android clients take the preview from `text/plain` | All | SHOULD | Static | [S77] |
| A26 | No `<p>&nbsp;</p>` spacers inside labelled regions; use padding or margin | In Outlook web, a `&nbsp;`-only element inside a region breaks VoiceOver navigation (WebKit bug 283499); `&zwj;` tested fine | Outlook web + VoiceOver | SHOULD | Static | [S35b] |
| A27 | Plain-text part as an accessibility aid: complete, in the same order as the HTML, URLs on their own lines, headings as their own lines with blank lines around them, no long decorative runs (`=====`, `-----`) | Text-only and plain-text-view users (for example Thunderbird's "Plain Text" view) and some Android previews read it; screen readers may read character runs aloud depending on punctuation settings (UNCERTAIN) | All | SHOULD | Static (P1's `text.*` checks plus a decorative-run check) | [S77] P1 |
| A28 | RTL: `dir="rtl"` and `lang` on `<html>` and the wrapper; mirror alignment and padding; to reverse column order visually, use `dir` on the outer table while the DOM order stays logical; isolate LTR runs (codes, URLs, amounts) in `<span dir="ltr">`; move the button's zero-width space (`&#8203;`) to the left padding | Gmail mobile web auto-RTL bug; Outlook `dir` bug on `<a>` (put `dir` on the parent); `<bdi>` support untested (UNCERTAIN) | Gmail mobile web, Outlook Windows | MUST (dir/lang), SHOULD (rest) | Static (logical-property lint; `dir` matches the locale) | [S13][S76] |
| A29 | Viewport meta must not disable zoom (`user-scalable=no`, `maximum-scale` < 2) | axe rates this Critical; EMC found it in government emails | Mobile | MUST | Static (`meta-viewport`) | [S68][S66] |
| A30 | Emoji are never the only content of a heading, link or button, and appear at most occasionally in headings | Read out by name; adds noise | All | SHOULD | Static | Manual |

### 2.5 Screen readers in real clients

Public, recent, client-specific test data is scarce. This is the main evidence gap.

| Pairing | What is known | Confidence | Source |
|---|---|---|---|
| VoiceOver + Apple Mail (macOS, iOS) | WebKit rendering; headings, lists, links, `role`, `aria-label` and `aria-hidden` survive. Best accessibility-feature support of any client (EMC: 34/37 on macOS, 31/37 on iOS). WebKit has its own layout-table heuristics, but `role="presentation"` is the deterministic signal | Medium | [S66][S11][S8] |
| VoiceOver + Outlook web (Safari) | Outlook web wraps the message in `role="application"` › `role="document"`. A `&nbsp;`-only element inside a region breaks navigation | Medium (bug report) | [S35b] |
| NVDA + classic Outlook (Windows) | Browse mode turns on automatically for HTML messages. Through UIA, Word's document control can't distinguish data from layout tables; NVDA (PRs #12820/#12857, 2021) treats 1-row or 1-column tables in the message view as layout tables and announces the others. `role="presentation"` is not exposed. Links inside VML aren't keyboard-reachable | High (NVDA source) | [S69][S36] |
| JAWS + classic Outlook | Same Word document control; JAWS has its own layout-table handling; no current public data | Low (UNCERTAIN) | — |
| TalkBack + Gmail Android | Android WebView renders whatever survives Gmail's sanitiser: headings, lists, links, `role`, `aria-label`, `aria-hidden`; sectioning elements become `<u>`; `aria-labelledby` breaks. Gmail scores 15/37 on EMC's client benchmark | Medium on markup; Low on spoken output (UNCERTAIN) | [S14][S10][S66] |
| NVDA/JAWS + Gmail web, Outlook.com (browser) | The email's markup is injected into the client's page, so the email's headings join the page outline and the client supplies its own landmarks. One `h1` naming the email is still preferred (WebAIM survey cited by goodemailcode: 60% prefer a single `h1` with the document title) | Medium | [S71][S70] |
| Test protocol | Run at least: VoiceOver + Apple Mail iOS; VoiceOver + Safari on Outlook.com; NVDA + classic Outlook; NVDA + Chrome on Gmail web; TalkBack + the Gmail app. Litmus offers an NVDA audio preview | — | [S78] |

### 2.6 What can be automated

**EMC Accessibility Report 2026** [S66]: data collected May 2025–May 2026. 376,348 emails analysed;
**99.88%** had Serious or Critical issues; 8 emails (0.002%, from 3 senders) passed. Top issues: body
content without `dir` 97.41%; without `lang` 95.66%; layout tables without `role` 83.78%; no `h1`
74.23%; links without discernible text 71.23%; `<html>` without `lang` 62.16%; insufficient contrast
58.48%; images without alt 47.88%; no `<title>` 45.21%; non-descriptive link text 15.83%. Client
scores on the 37 accessibility features: Apple Mail macOS 34, Apple Mail iOS 31, Samsung 31,
Outlook Android 25, Outlook macOS and iOS 22, Outlook.com 20, Gmail web 17, Gmail apps 15,
Yahoo web 16, classic Outlook 11. The EMC tests with Parcel's checker and calls for "real-time
linting" in frameworks.

**Parcel accessibility checker** [S67]: Deque axe rules plus email-specific custom rules: `body-lang`,
`body-dir`, `table-role`, `role-button`, `accessible-hyperlinks`, `article-article`, `region-section`,
`navigation-nav`, `banner-header`, `contentinfo-footer`, `main-main`, `complementary-aside`, `h1-tag`
(exactly one), `vml-alt`, `vml-links`, `vml-headings`.

**axe-core 4.14.0** (2026-10-05) [S68], run against the built HTML in a headless browser:

| Use | Rules |
|---|---|
| Enable (WCAG A/AA) | `image-alt`, `role-img-alt`, `area-alt`, `link-name`, `link-in-text-block`, `html-has-lang`, `html-lang-valid`, `valid-lang`, `document-title`, `color-contrast` (run once per mode, §1.6), `list`, `listitem`, `definition-list`, `dlitem`, `th-has-data-cells`, `td-headers-attr`, `aria-*` validity rules, `aria-prohibited-attr`, `aria-hidden-focus`, `presentation-role-conflict`, `meta-viewport`, `avoid-inline-spacing`, `blink`, `marquee`, `nested-interactive`, `frame-title` |
| Enable (outside the WCAG A/AA tag set) | WCAG 2.2 `target-size` (axe disables WCAG 2.2 rules by default); best-practice `empty-heading`, `heading-order`, `empty-table-header`, `scope-attr-valid`, `image-redundant-alt`, `identical-links-same-purpose` (these run by default unless the run is limited to WCAG tags); experimental `p-as-heading`, `td-has-header`, `table-fake-caption` (off by default) |
| Disable (wrong for email) | `region`, `landmark-one-main`, `bypass`, `landmark-*` uniqueness checks (the client page supplies landmarks); replace `page-has-heading-one` with a custom exactly-one-`h1` rule |
| Limits | `color-contrast` doesn't know forced dark, can't see `<style>` that clients drop, and marks text over images "needs review". Hence the framework's own token-level and multi-mode checks |

---

## Implications for the framework

### Defaults (layout skeleton)

- `<!doctype html>`; `<html lang dir>`; `<body xml:lang>`; a wrapper `<div role="article" aria-label="{subject}" lang dir style="font-size:medium;font-size:max(16px,1rem)">`. Emit `aria-roledescription` only if the message catalogue supplies a translated value. `<title>` = subject. (A7–A9, A18, A24)
- `color-scheme` signals are derived from the template: `light dark` meta + `:root{color-scheme:light dark}` when a dark palette exists, otherwise neither. Gmail opt-out is a per-template `darkMode: "auto" | "light-only"` setting that emits the `light only` meta while keeping the CSS `light dark` (D2, D6). Drop `supported-color-schemes` from the required list (D4).
- Dark CSS is emitted twice from one rule list: `@media (prefers-color-scheme: dark)` and `[data-ogsb] .cls`/`[data-ogsc] .cls`, flat, with `!important`, aimed at the element carrying the inline colour (D5, D11).
- Every layout table has `role="presentation"`; single-column structure is the default; nothing is hidden with `hidden`, only with `display:none` + `mso-hide:all` (A5, A6, A13).
- No `user-scalable=no`; no `outline:none`; no `text-align:justify`; no `aria-labelledby`/`describedby` (A29, 2.4.7, A20, A11).

### Theme and contrast validation

- Evaluate every text/ground pair in **four** modes: (1) light, inline only; (2) authored dark; (3) forced-partial: Chromium LAB L\* inversion with the 150/205 thresholds and the `#121212` snap; (4) forced-full: LAB L\* inversion of everything. Thresholds: 4.5:1 text, 3:1 large text and non-text (1.4.11). Modes 1–2 are MUST; 3–4 are SHOULD, skipped for Gmail-only paths when the template uses `light only`. **Replaces P1's `255 − v`** (§1.3).
- Mid-tone rule: L\* ≈ 40–65 for **any hue**, applied to grounds behind text and to borders that carry meaning (replaces P1's per-channel grey band) (C3).
- Off-white rule: downgrade P1's "no `#ffffff`" to MAY; add a warning for near-whites with 1–3 units of channel offset (Yahoo tinting) (C1).
- Keep "authored dark ground not `#000000`" as SHOULD (design reason) (C2).
- Validate `actionFill` YIQ brightness (≤ 205 survives Gmail Android) as information (C6), and styled alt-text colour against forced-dark grounds (A16).

### Component behaviours

| Component | Behaviour |
|---|---|
| Heading | Real `h*` with inline colour, margin and size; level enforced by context; one `h1` per email |
| Text / Paragraph | `p` with inline colour (D3); line-height ≥ 1.5; left/right alignment from `dir`; no justify; `lang` prop for language of parts |
| Link | Underlined in running text; lints link text; never `role="button"`; `aria-label`, if given, contains the visible text |
| Button | Padded `<a>` (goodemailcode pattern, RTL-aware ZWSP); computed height ≥ 44 px (error < 24); border token when the fill/ground contrast < 3:1; no VML |
| Image | Required `alt` + `kind` (`decorative`/`informative`/`functional`); functional means non-empty; `width` + `max-width:100%`; warns on long alt (image of text) and on transparent GIF |
| Logo | Live-text wordmark by default. Image logos need `onDark` handling: a stroke/plate asset, or a `dark` asset swapped via `<picture>` + class swap, with the default asset validated on forced-dark grounds (I2–I5) |
| Icon / social row | Plates or strokes; ≥ 24 px targets with ≥ 8 px gaps |
| DataTable | No presentation role; `th scope`; caption or preceding heading; ≥ 2×2; stacks to "label: value" at narrow widths when wider than 320 px |
| Layout (Section, Columns) | `role="presentation"` on every table including MSO ghosts; source order = reading order; prefer single column |
| AnimatedImage | Build-time GIF/APNG analysis (flashes, ≤ 5 s, finite loop); requires a static fallback; optional `<picture>` reduced-motion swap |
| Code (OTP) | Letter-spacing rather than literal spaces (copying stays intact); no `aria-label` on a `div`/`span` (fixes P2's `CodeBox`). If a spoken digit-by-digit version is needed, add visually hidden text and accept double reading in clients that ignore `aria-hidden` |
| Preheader | `display:none` div with filler inside |
| Divider / Spacer | Padding-based; no `&nbsp;`-only paragraphs inside labelled regions; decorative dividers are exempt from 1.4.11 |
| Footer | Shared component keeping help links in a consistent order across a series (3.2.6) |

### Preview-studio features

- Mode switcher: Light · Light (inline only) · Authored dark (Apple model) · Gmail Android (real Chromium `--enable-features=WebContentsForceDark`) · Forced full (LAB) · Outlook.com (`data-og*` + contrast repair) · Yahoo dark (HSL −70%). Show a "Gmail: opted out" badge when `light only` is set (T3–T9).
- Side-by-side contrast heat-map per mode, listing failing pairs.
- Viewports at 320 px (Reflow), 360 px and 600 px; 200% text zoom; text-spacing override bookmarklet (1.4.12).
- Images-off view with styled alt text on light and dark grounds.
- Accessibility panel: axe-core results (rule set as in §2.6) and framework checks; heading-outline and landmark overlays (as Parcel does); a reading-order view; links list (text + URL); simulated screen-reader transcript (linearised accessibility tree), labelled as approximate.
- Plain-text part shown alongside the HTML, with a diff of content coverage.
- Motion inspector for animated images (frame timeline, flash warnings).
- Real-device checklist export (T1) and a screen-reader test protocol (§2.5).

### Check candidates

| Id | Rule | Level | How |
|---|---|---|---|
| `dark.inline-complete` | Inline styles alone pass contrast | error | Strip `<style>`, compute contrast (D1) |
| `dark.scheme-declared` | Dark CSS present ⇔ meta `light dark`/`light only` + `:root{color-scheme}` | error | Static (D2, D6) |
| `dark.explicit-colours` | Text elements have explicit colour on an explicit ground when `light dark` is declared | error | Render under UA dark defaults (D3) |
| `dark.ogsc-twin` | Every `pcs` rule has a `[data-og*]` descendant twin; no `.x[data-og*]` | warn | Static (D5) |
| `dark.light-only-css-twin` | `light only` meta with a dark palette also has CSS `light dark` | warn | Static (D6) |
| `dark.no-blend-hack` | No `u + .body` blend-mode hack | warn | Static (D7) |
| `dark.light-dark-fallback` | `light-dark()` has a preceding literal | error | Static (D8) |
| `tokens.contrast` (revised) | Pairs pass in light, authored dark, forced-partial and forced-full | error/warn | Token (C4) |
| `tokens.midtone` (revised) | L\* 40–65 grounds behind text or meaningful borders | warn | Token (C3) |
| `tokens.offwhite-tint` | Near-white with a 1–3 channel offset | warn | Token (C1) |
| `img.dark-safe` | Transparent images keep ≥ 3:1 edge contrast on light and dark grounds | warn | Render (I2, I3, I5) |
| `img.alt` (revised) | `alt` present; non-empty when the image is linked or functional; VML has `alt` | error | Static (A15) |
| `img.motion` | ≤ 3 flashes/s; ≤ 5 s or a finite loop | error | Decode GIF/APNG (A22) |
| `a11y.lang-dir` (revised) | `lang`/`dir` on `<html>` and the body wrapper; `xml:lang` on `<body>`; valid BCP 47; `dir` matches the locale | error | Static (A7) |
| `a11y.one-h1` / `a11y.heading-order` | ≤ 1 `h1` (warn if 0); no skipped levels; non-empty | error/warn | Static (A2) |
| `a11y.layout-table-role` | Layout tables have `role="presentation"`/`none`; no `th`/`caption` inside | error | Static (A5) |
| `a11y.layout-grid` | Layout tables with ≥ 2 rows and ≥ 2 columns | warn | Static (A6) |
| `a11y.data-table` | Data tables have `th scope`, a caption or heading, are ≥ 2×2, and have no presentation role | error | Static (A23) |
| `a11y.no-sectioning` | No `article`/`section`/`nav`/`header`/`footer`/`main`/`aside`; no banner/main/contentinfo/complementary roles | error | Static (A4) |
| `a11y.aria-safe` | No `aria-labelledby`/`describedby`; no `aria-label` on generic elements; no `role="button"` on `<a>`; `aria-roledescription` only if localised | error | Static (A9–A11, A17) |
| `a11y.link-text` | No empty links; no generic link text (locale lists); underline in running text | error/warn | Static (A15, A17, 1.4.1) |
| `a11y.target-size` | Buttons ≥ 24 px (warn < 44); icon targets ≥ 24 px or spaced | error/warn | Static computed box + axe `target-size` (A21) |
| `a11y.font-size` | ≥ 12 px always; warn < 14 px; body ≥ 16 px | error/warn | Static (A18) |
| `a11y.line-height` | Body ≥ 1.5; `mso-line-height-rule:exactly` with ≥ 1.2× | warn | Static (A19) |
| `a11y.alignment` | No justify; centred paragraphs longer than about 2 lines | error/warn | Static (A20) |
| `a11y.reflow` | No fixed width > 320 px outside data tables; nothing overflows at 320 px | error | Static + Render (1.4.10) |
| `a11y.text-spacing` | No fixed heights or `overflow:hidden` on text; no inline `!important` spacing | error | Static (1.4.12) |
| `a11y.viewport` | No zoom blocking | error | Static (A29) |
| `a11y.focus` | No `outline:none` on links | error | Static (2.4.7) |
| `a11y.hidden` | No `hidden` attribute; hidden content uses `display:none` + `mso-hide:all`; preheader hidden that way | error | Static (A13, A25) |
| `a11y.nbsp-spacer` | No `&nbsp;`-only block elements | warn | Static (A26) |
| `a11y.title` | `<title>` present and equal to the subject | warn | Static (A24) |
| `a11y.axe` | axe-core 4.14 with the §2.6 rule set, once per preview mode | error/warn | Render |
| `text.no-decorative-runs` | Plain-text part has no long runs of `=`, `-`, `*` | warn | Static (A27) |

### Where this contradicts the reference docs

| Reference claim | Finding |
|---|---|
| P1: forced dark ≈ `255 − v` per channel | Chromium (Gmail Android) uses CIELAB L\* inversion with hue preserved and brightness thresholds; Outlook does contrast repair; Yahoo cuts HSL lightness. `255 − v` flips hues and overstates contrast for saturated colours (§1.3) |
| P1: light ground ≠ `#ffffff` because it inverts to `#000000` | In Chromium `#ffffff` and `#fafafa` both become `#121212`; `#fffffe`-style off-whites now break in Yahoo (C1) |
| P1: mid-tone band defined per channel for greys | Redefine as L\* 40–65 for any hue; for text it is redundant with the contrast passes (C3) |
| P1: "no colour as the only carrier of meaning, because inversion shifts hues" | Hue is preserved; keep the rule for WCAG 1.4.1 (C5) |
| P1: the `color-scheme` meta "tells Apple Mail … so it does not invert it" | Apple Mail doesn't invert HTML email by default; the declaration *enables* dark rendering, including dark UA defaults (§1.1, D3) |
| P1: Gmail forces "partial inversion" on all platforms | Android partial, iOS full (it also lightens dark emails), web none; since September 2026 Gmail apps honour `light only` |
| P1: `supported-color-schemes` required | Obsolete since macOS 10.15 (D4) |
| P1: `lang`/`dir` on `<html>` only | Also needed on the body wrapper, plus `xml:lang` on `<body>` (A7) |
| P1: every `<img>` alt, "empty is fine" | Not for linked or functional images (A15) |
| P1: SVG blocked across major clients since late 2025 | caniemail 2026-09: Gmail rasterises SVG images to PNG; Yahoo/AOL render them (I10; for the CSS/HTML slice) |
| P2: AA contrast in light and dark only | Gmail never shows authored dark; add forced-dark passes (C4) |
| P2: no fixed width over 360 px | WCAG 1.4.10 uses 320 CSS px |
| P2: `lang` on `<html>` and `<body>` | `<body>` is replaced by a `div` in several webmails; use the wrapper div (A7) |
| P2: `CodeBox` uses `aria-label` | Prohibited on generic `div`/`span` (ARIA 1.2) and dropped by Yahoo/AOL/Thunderbird (A10) |

---

## Sources

All accessed 2026-10-27 unless noted. Dates in brackets are the source's own publication or update
date where stated.

| Key | Title | URL |
|---|---|---|
| S1 | caniemail: `@media (prefers-color-scheme)` [last test 2023-03-08] | https://www.caniemail.com/features/css-at-media-prefers-color-scheme/ |
| S2 | caniemail: color-scheme meta tag [last test 2026-09-16] | https://www.caniemail.com/features/html-meta-color-scheme/ |
| S3 | caniemail: color-scheme CSS property [2023-09-18] | https://www.caniemail.com/features/css-color-scheme/ |
| S4 | caniemail: `light-dark()` [2024-08-14] | https://www.caniemail.com/features/css-function-light-dark/ |
| S5 | caniemail: `<picture>` [2024-04-15] | https://www.caniemail.com/features/html-picture/ |
| S6 | caniemail: srcset and sizes [2019-05-29] | https://www.caniemail.com/features/html-srcset/ |
| S7 | caniemail: mix-blend-mode [2020-12-12] | https://www.caniemail.com/features/css-mix-blend-mode/ |
| S8 | caniemail: aria-label [2019-02-28; Outlook.com 2024-01] | https://www.caniemail.com/features/html-aria-label/ |
| S9 | caniemail: aria-hidden | https://www.caniemail.com/features/html-aria-hidden/ |
| S10 | caniemail: aria-labelledby [2022-04-08] and aria-describedby | https://www.caniemail.com/features/html-aria-labelledby/ |
| S11 | caniemail: role attribute | https://www.caniemail.com/features/html-role/ |
| S12 | caniemail: lang attribute | https://www.caniemail.com/features/html-lang/ |
| S13 | caniemail: dir attribute | https://www.caniemail.com/features/html-dir/ |
| S14 | caniemail: h1–h6, HTML5 semantics, lists | https://www.caniemail.com/features/html-h1-h6/ · https://www.caniemail.com/features/html-semantics/ · https://www.caniemail.com/features/html-lists/ |
| S15 | caniemail: `@media (prefers-reduced-motion)` | https://www.caniemail.com/features/css-at-media-prefers-reduced-motion/ |
| S16 | caniemail: GIF image format | https://www.caniemail.com/features/image-gif/ |
| S16b | caniemail: line-height | https://www.caniemail.com/features/css-line-height/ |
| S17 | caniemail: `<body>` element | https://www.caniemail.com/features/html-body/ |
| S19 | caniemail API data (`last_update_date` 2026-09-16) and commit "update meta color scheme support in gmail" (2026-09-16) | https://www.caniemail.com/api/data.json · https://github.com/hteumeuleu/caniemail/commits/main/_features/html-meta-color-scheme.md |
| S20 | Email Markup Consortium: "Gmail app dark mode update" [2026-09-21] | https://emailmarkup.org/en/blog/2026/gmail-app-dark-mode-update/ |
| S21 | Dyspatch: "Gmail Now Respects Your Color-Scheme" [2026-10-08] | https://www.dyspatch.io/blog/gmail-now-respects-your-color-scheme-how-to-stop-forced-dark-mode-in-the-gmail-app/ |
| S22 | Google Issue Tracker 201441498 (sign-in required; not read directly, cited by S2 and S20) | https://issuetracker.google.com/issues/201441498 |
| S23 | goodemailcode: Base Template [2026-10-09] | https://www.goodemailcode.com/email-code/template |
| S24 | Litmus: Ultimate Guide to Dark Mode [2025-02-27] | https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers |
| S25 | Email on Acid: Dark mode for email [2025-10-02] | https://www.emailonacid.com/blog/article/email-development/dark-mode-for-email/ |
| S26 | Parcel: Guide to color scheme in email | https://parcel.io/guides/color-scheme-in-email |
| S27 | Parcel docs: Dark mode preview | https://parcel.io/docs/preview/dark-mode |
| S28 | Rémi Parmentier: Emails, React and Outlook.com dark mode [2021] | https://www.hteumeuleu.com/2021/emails-react-outlook-com-dark-mode/ |
| S29 | Rémi Parmentier: Fixing Gmail's dark mode issues with CSS blend modes [2021] | https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/ |
| S30 | email-bugs #104: Apple Mail requires the color-scheme meta or CSS for dark mode [2021, open] | https://github.com/hteumeuleu/email-bugs/issues/104 |
| S31 | email-bugs #65: Apple Mail ignores `#ffffff` in the prefers-color-scheme query [2019, open] | https://github.com/hteumeuleu/email-bugs/issues/65 |
| S32 | email-bugs #156: Yahoo Mail strongly alters `#fffffe` in dark mode [2025-09-18] | https://github.com/hteumeuleu/email-bugs/issues/156 |
| S33 | email-bugs #159: Yahoo webmail breaks media queries in dark mode [2025-11-18; fixed 2025-12-03] | https://github.com/hteumeuleu/email-bugs/issues/159 |
| S34 | email-bugs #162: Outlook.com dark mode white background behind images on hover [2026-02-06] | https://github.com/hteumeuleu/email-bugs/issues/162 |
| S35 | email-bugs #141: Outlook.com removes `<style>` in `<head>` [2024-06-25; closed 2024-07-31] | https://github.com/hteumeuleu/email-bugs/issues/141 |
| S35b | email-bugs #142: `&nbsp;`-only element breaks VoiceOver in Outlook web [2024-11-21] | https://github.com/hteumeuleu/email-bugs/issues/142 |
| S36 | email-bugs #77: Links not keyboard-accessible inside VML | https://github.com/hteumeuleu/email-bugs/issues/77 |
| S36b | email-bugs #135: Gmail Android rewrites inline gradients incorrectly [2024-02-13] | https://github.com/hteumeuleu/email-bugs/issues/135 |
| S37 | Chromium source: `dark_mode_color_filter.cc` (LAB inversion, gray snap) | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_color_filter.cc |
| S38 | Chromium source: `dark_mode_settings_builder.cc` (thresholds 150/205) | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_settings_builder.cc |
| S39 | Chromium source: `dark_mode_color_classifier.cc` (YIQ brightness) | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_color_classifier.cc |
| S40 | Chromium source: `dark_mode_filter.cc` and `dark_mode_image_classifier.cc` | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_filter.cc |
| S41 | Chromium source: `features.cc` (`WebContentsForceDark`) | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/common/features.cc |
| S42 | Android Developers: Darken web content in WebView | https://developer.android.com/guide/webapps/dark-theme |
| S43 | Microsoft Support: Dark Mode in Outlook | https://support.microsoft.com/en-us/office/dark-mode-in-outlook-3e2446e0-9a7b-4189-9af9-57fb94d02ae3 |
| S44 | Thunderbird 136.0 release notes [2025-03-04] | https://www.thunderbird.net/en-US/thunderbird/136.0/releasenotes/ |
| S45 | Litmus: Email Designers' Next Challenge: Apple's Dark Mode [2018/2019] | https://www.litmus.com/blog/email-designers-next-challenge-apple-dark-mode |
| S46 | goodemailcode: Picture [2021-06-30] | https://www.goodemailcode.com/email-enhancements/picture |
| S47 | W3C: Web Content Accessibility Guidelines (WCAG) 2.2 | https://www.w3.org/TR/WCAG22/ |
| S48 | W3C WAI: WCAG 2.2 approved as ISO/IEC 40500:2025 [2025-10-21] | https://www.w3.org/WAI/news/2025-10-21/wcag22-iso |
| S49 | W3C WAI: WCAG 3 Introduction [updated 2026-09-25] | https://www.w3.org/WAI/WCAG3 |
| S50 | W3C WAI: For Review: WCAG 3 Working Draft, March 2026 [2026-03-03] | https://www.w3.org/WAI/news/2026-03-03/wcag3 |
| S51 | W3C: Guidance on Applying WCAG 2 to Non-Web ICT (WCAG2ICT) [Group Note 2024-10-08] | https://www.w3.org/TR/wcag2ict-22/ |
| S52 | W3C: Technique G183 (link contrast 3:1 plus a cue) | https://www.w3.org/WAI/WCAG22/Techniques/general/G183 |
| S53 | W3C: Understanding SC 2.5.8 Target Size (Minimum) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| S54 | W3C: Understanding SC 1.4.12 Text Spacing | https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html |
| S55 | W3C: Understanding SC 1.4.10 Reflow | https://www.w3.org/WAI/WCAG22/Understanding/reflow.html |
| S56 | EUR-Lex: Directive (EU) 2019/882 (European Accessibility Act) (cited from the official text; EUR-Lex blocked automated fetching) | https://eur-lex.europa.eu/eli/dir/2019/882/oj |
| S57 | European Commission: European Accessibility Act | https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en |
| S58 | Davis Wright Tremaine: New technical standard for EAA compliance released (EN 301 549 V4.1.1) [2026-09-18] | https://www.dwt.com/insights/2026/09/european-accessibility-act-ict-standards-update |
| S60 | Section508.gov: Email messages (authoring and test checklist) | https://www.section508.gov/create/email-messages/ · https://www.section508.gov/test/checklist/email-messages |
| S61 | Plante Moran: DOJ extends ADA Title II web accessibility compliance deadlines [2026-04] | https://plantemoran.com/explore-our-thinking/insight/2026/04/doj-extends-ada-title-ii-web-accessibility-compliance-deadlines |
| S62 | legislation.gov.uk: Equality Act 2010, sections 20 and 29 | https://www.legislation.gov.uk/ukpga/2010/15/section/20 · https://www.legislation.gov.uk/ukpga/2010/15/section/29 |
| S63 | Accessibility Standards Canada: adopts EN 301 549 as CAN/ASC-EN 301 549:2024 | https://accessible.canada.ca/news/accessibility-standards-canada-adopts-globally-recognized-accessibility-standard-ict-products |
| S64 | Justice Laws: Accessible Canada Act (S.C. 2019, c. 10) | https://laws-lois.justice.gc.ca/eng/acts/A-0.6/ |
| S65 | Ontario: O. Reg. 191/11 Integrated Accessibility Standards (AODA) | https://www.ontario.ca/laws/regulation/110191 |
| S66 | Email Markup Consortium: Accessibility Report 2026 [last modified 2026-05-21] | https://emailmarkup.org/en/reports/accessibility/2026/ |
| S67 | Parcel docs: Accessibility Checker (rules and custom rules) | https://parcel.io/docs/dev-tools/accessibility-checker |
| S68 | Deque axe-core: rule descriptions (v4.14.0, released 2026-10-05) | https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md |
| S69 | NV Access NVDA PRs #12820 and #12857: layout tables in the Outlook message viewer [2021-09] | https://github.com/nvaccess/nvda/pull/12820 · https://github.com/nvaccess/nvda/pull/12857 |
| S70 | goodemailcode: ARIA landmarks in email [2022-02-07] | https://www.goodemailcode.com/email-accessibility/aria-landmarks-in-html-email |
| S71 | goodemailcode: Should you use an `<h1>` in email code? [2022-08-02] | https://www.goodemailcode.com/email-accessibility/should-you-use-an-h1-in-email-code |
| S72 | goodemailcode: Using rem and em units in email [2022-05-10] | https://www.goodemailcode.com/email-accessibility/rem-and-em |
| S73 | goodemailcode: Visually hidden text [2023-03-07] | https://www.goodemailcode.com/email-accessibility/visually-hidden-text |
| S74 | goodemailcode: Text in images [2024-11-05] | https://www.goodemailcode.com/email-accessibility/text-in-images |
| S75 | goodemailcode: Table layouts [2023-08-01] | https://www.goodemailcode.com/email-accessibility/table-layouts |
| S76 | goodemailcode: CTA link (button) [2023-04-20] | https://www.goodemailcode.com/email-code/link-button |
| S77 | goodemailcode: Preview text [2023-03-09] | https://www.goodemailcode.com/email-code/preheader |
| S78 | Litmus: Email Marketer's Guide to Coding for Accessibility [2025-05-07] | https://www.litmus.com/blog/7-simple-tricks-to-make-your-email-code-more-accessible |
| S79 | PowerMapper: Layout table with role=presentation (screen-reader compatibility) | https://www.powermapper.com/tests/screen-readers/tables/table-role-presentation-layout-table/ |
| S80 | caniemail: text-align [2025-11-14] | https://www.caniemail.com/features/css-text-align/ |
| S81 | W3C: WAI-ARIA 1.2, `generic` role (naming prohibited) | https://www.w3.org/TR/wai-aria-1.2/#generic |
| S82 | caniemail: SVG image format [2026-09-16] | https://www.caniemail.com/features/image-svg/ |
| S83 | caniemail: hidden attribute [2024-01-26] | https://www.caniemail.com/features/html-hidden/ |

[S1]: https://www.caniemail.com/features/css-at-media-prefers-color-scheme/
[S2]: https://www.caniemail.com/features/html-meta-color-scheme/
[S3]: https://www.caniemail.com/features/css-color-scheme/
[S4]: https://www.caniemail.com/features/css-function-light-dark/
[S5]: https://www.caniemail.com/features/html-picture/
[S6]: https://www.caniemail.com/features/html-srcset/
[S7]: https://www.caniemail.com/features/css-mix-blend-mode/
[S8]: https://www.caniemail.com/features/html-aria-label/
[S9]: https://www.caniemail.com/features/html-aria-hidden/
[S10]: https://www.caniemail.com/features/html-aria-labelledby/
[S11]: https://www.caniemail.com/features/html-role/
[S12]: https://www.caniemail.com/features/html-lang/
[S13]: https://www.caniemail.com/features/html-dir/
[S14]: https://www.caniemail.com/features/html-h1-h6/
[S15]: https://www.caniemail.com/features/css-at-media-prefers-reduced-motion/
[S16]: https://www.caniemail.com/features/image-gif/
[S16b]: https://www.caniemail.com/features/css-line-height/
[S17]: https://www.caniemail.com/features/html-body/
[S19]: https://github.com/hteumeuleu/caniemail/commits/main/_features/html-meta-color-scheme.md
[S20]: https://emailmarkup.org/en/blog/2026/gmail-app-dark-mode-update/
[S21]: https://www.dyspatch.io/blog/gmail-now-respects-your-color-scheme-how-to-stop-forced-dark-mode-in-the-gmail-app/
[S23]: https://www.goodemailcode.com/email-code/template
[S24]: https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers
[S25]: https://www.emailonacid.com/blog/article/email-development/dark-mode-for-email/
[S26]: https://parcel.io/guides/color-scheme-in-email
[S27]: https://parcel.io/docs/preview/dark-mode
[S28]: https://www.hteumeuleu.com/2021/emails-react-outlook-com-dark-mode/
[S29]: https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/
[S30]: https://github.com/hteumeuleu/email-bugs/issues/104
[S31]: https://github.com/hteumeuleu/email-bugs/issues/65
[S32]: https://github.com/hteumeuleu/email-bugs/issues/156
[S33]: https://github.com/hteumeuleu/email-bugs/issues/159
[S34]: https://github.com/hteumeuleu/email-bugs/issues/162
[S35]: https://github.com/hteumeuleu/email-bugs/issues/141
[S35b]: https://github.com/hteumeuleu/email-bugs/issues/142
[S36]: https://github.com/hteumeuleu/email-bugs/issues/77
[S36b]: https://github.com/hteumeuleu/email-bugs/issues/135
[S37]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_color_filter.cc
[S38]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_settings_builder.cc
[S39]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_color_classifier.cc
[S40]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/dark_mode_filter.cc
[S41]: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/common/features.cc
[S42]: https://developer.android.com/guide/webapps/dark-theme
[S43]: https://support.microsoft.com/en-us/office/dark-mode-in-outlook-3e2446e0-9a7b-4189-9af9-57fb94d02ae3
[S44]: https://www.thunderbird.net/en-US/thunderbird/136.0/releasenotes/
[S45]: https://www.litmus.com/blog/email-designers-next-challenge-apple-dark-mode
[S46]: https://www.goodemailcode.com/email-enhancements/picture
[S47]: https://www.w3.org/TR/WCAG22/
[S48]: https://www.w3.org/WAI/news/2025-10-21/wcag22-iso
[S49]: https://www.w3.org/WAI/WCAG3
[S50]: https://www.w3.org/WAI/news/2026-03-03/wcag3
[S51]: https://www.w3.org/TR/wcag2ict-22/
[S52]: https://www.w3.org/WAI/WCAG22/Techniques/general/G183
[S53]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[S54]: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
[S55]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
[S56]: https://eur-lex.europa.eu/eli/dir/2019/882/oj
[S57]: https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en
[S58]: https://www.dwt.com/insights/2026/09/european-accessibility-act-ict-standards-update
[S60]: https://www.section508.gov/test/checklist/email-messages
[S61]: https://plantemoran.com/explore-our-thinking/insight/2026/04/doj-extends-ada-title-ii-web-accessibility-compliance-deadlines
[S62]: https://www.legislation.gov.uk/ukpga/2010/15/section/20
[S63]: https://accessible.canada.ca/news/accessibility-standards-canada-adopts-globally-recognized-accessibility-standard-ict-products
[S64]: https://laws-lois.justice.gc.ca/eng/acts/A-0.6/
[S65]: https://www.ontario.ca/laws/regulation/110191
[S66]: https://emailmarkup.org/en/reports/accessibility/2026/
[S67]: https://parcel.io/docs/dev-tools/accessibility-checker
[S68]: https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
[S69]: https://github.com/nvaccess/nvda/pull/12857
[S70]: https://www.goodemailcode.com/email-accessibility/aria-landmarks-in-html-email
[S71]: https://www.goodemailcode.com/email-accessibility/should-you-use-an-h1-in-email-code
[S72]: https://www.goodemailcode.com/email-accessibility/rem-and-em
[S73]: https://www.goodemailcode.com/email-accessibility/visually-hidden-text
[S74]: https://www.goodemailcode.com/email-accessibility/text-in-images
[S75]: https://www.goodemailcode.com/email-accessibility/table-layouts
[S76]: https://www.goodemailcode.com/email-code/link-button
[S77]: https://www.goodemailcode.com/email-code/preheader
[S78]: https://www.litmus.com/blog/7-simple-tricks-to-make-your-email-code-more-accessible
[S79]: https://www.powermapper.com/tests/screen-readers/tables/table-role-presentation-layout-table/
[S80]: https://www.caniemail.com/features/css-text-align/
[S81]: https://www.w3.org/TR/wai-aria-1.2/#generic
[S82]: https://www.caniemail.com/features/image-svg/
[S83]: https://www.caniemail.com/features/html-hidden/
