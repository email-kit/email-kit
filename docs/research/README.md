# Research: rules, standards and best practices for the email framework

This folder holds the research phase for a new open-source email-template framework: an npm
library, an `npx` CLI, a shadcn-style component package, a token-based theme, and a preview studio.
Developers in Next.js, Vite, Hono and Kotlin Multiplatform apps will use it to design, check,
generate and send email.

> **Scope update (2026-10-27):** phase 1 is a **generator only**. It turns TSX templates into HTML,
> text and other files plus a typed TS module that backend code imports, and it never sends email.
> See [../phase-1-scope.md](../phase-1-scope.md) for what this changes. The sending-related research
> (headers, MIME, transports, runtime guards, consent records, the DNS `doctor`) stays here for a
> later phase.

**Researched:** 2026-10-27. Each file was verified against primary sources (RFCs, vendor and
regulator pages, the caniemail data API, W3C, npm registry data) and cites every claim. Email
clients and laws change without notice. **Re-verify any rule before relying on it in v1**, and
record the date you checked.

## Files

| # | File | What it answers |
|---|---|---|
| 0 | [00-reference-comparison.md](00-reference-comparison.md) | What the two reference packages do, where each is strong or weak, what the framework should take from each, and the tensions to resolve |
| 1 | [01-email-client-rendering.md](01-email-client-rendering.md) | Client landscape and engines, the document skeleton, CSS support, layout, buttons, images, fonts, size limits, Outlook (Word), preheaders, AMP, RTL, minification; ~45 check candidates |
| 2 | [02-dark-mode-and-accessibility.md](02-dark-mode-and-accessibility.md) | How each client really darkens colours, author signals, dark-mode images, WCAG 2.2 mapped to email, accessibility law, screen readers in real clients, what can be automated |
| 3 | [03-legal-and-regulatory-compliance.md](03-legal-and-regulatory-compliance.md) | Anti-spam and privacy law by jurisdiction (US, Canada, EU, UK, Australia/NZ, Asia including Sri Lanka, Latin America), children, tracking consent, the required-elements matrix, a global safe default |
| 4 | [04-deliverability-standards-and-security.md](04-deliverability-standards-and-security.md) | RFC message format and MIME, authentication (SPF/DKIM/DMARCbis/BIMI), Gmail/Yahoo/Microsoft sender rules, spam-filter signals, OTP and magic-link patterns, template security, provider API limits, default headers, a `doctor` check |
| 5 | [05-design-content-and-theming.md](05-design-content-and-theming.md) | Layout, typography, colour, images, CTAs, subject and preheader, transactional patterns, i18n, the plain-text part, W3C DTCG tokens, shadcn theming mapped to email, the component inventory |
| 6 | [06-tooling-and-ecosystem.md](06-tooling-and-ecosystem.md) | React Email 6, MJML 5, Maizzle 6 and others; pipeline libraries; cross-language (KMP) artifacts and placeholder engines; runtime targets; the shadcn registry; preview studios; CLI patterns; npm packaging and supply chain |

Each file has its own legend. All of them use **MUST / SHOULD / MAY** from the framework's point of
view, mark what a build-time check can enforce, and flag what changed in 2024–2026 and what
contradicts the reference docs. Each ends with an "Implications for the framework" section and a
dated source list.

## The findings that matter most

These are the facts that most shape the framework. The detail and sources are in the numbered
files.

### Output format and rendering
1. **Classic Outlook (the Word engine) stays a target until at least 2029.** Enterprise migration
   to new Outlook starts no earlier than March 2027, and removal no earlier than March 2028. A
   table-based hybrid layout with MSO ghost tables stays the default. (01 §1.3)
2. **Every design must work with no `<style>` block at all.** Gmail apps showing non-Google
   accounts, Gmail mobile webmail, GMX/Web.de desktop and La Poste/SFR strip it. Inline styles
   carry the design; `<style>` only enhances. (01 §1.4)
3. **Colours must be 6-digit hex.** Gmail deletes a whole `style` attribute or `<style>` block that
   contains `oklch()`, `lab()`, `color-mix()` or space-separated `rgb()`. shadcn/Tailwind v4 themes
   are OKLCH, so the build must gamut-map them to sRGB hex (not clamp them) and flatten alpha
   against the surface underneath. (01 §3.5, 05 §12.6)
4. **Gmail's style budget.** `<style>` is capped at about 16 KB in total. Uppercase `!IMPORTANT`
   drops the block. Outlook apps drop all CSS after a `}}`. The CSS serialiser must guard all
   three. (01 §3.2)
5. **Gmail clips the HTML part at ~102 KB.** The limit is empirical and has been stable for years.
   Measure the UTF-8 bytes of the HTML part with the largest fixture, plus an allowance for
   tracking links the provider adds. (01 §8, 04)
6. **SVG stays banned, for a corrected reason.** OWA and new Outlook stopped rendering it in late
   2025, inline `<svg>` never worked in Gmail, Outlook or Yahoo, and Gmail rasterises linked SVG.
   Ship PNG/JPEG/GIF. (01 §6)

### Dark mode and accessibility
7. **Forced dark mode is not `255 − v`.** Gmail Android uses Chromium's algorithm: CIELAB lightness
   inversion with hue preserved, applied only to light backgrounds and dark text. Outlook repairs
   contrast, Yahoo cuts HSL lightness by about 70%, and Gmail iOS inverts everything. Validate the
   theme in **four** modes: light (inline only), authored dark, forced-partial (Chromium) and
   forced-full. (02 §1.3)
8. **Gmail apps honour `<meta name="color-scheme" content="light only">`** since September 2026,
   for Google accounts only. It is the first way for a sender to opt out of Gmail's forced dark
   mode, and should be offered as a per-template setting. (02 §0)
9. **WCAG 2.2 is the baseline.** It became ISO/IEC 40500:2025, and EN 301 549 v4.1.1 is based on
   it. The European Accessibility Act has applied since June 2025; whether it covers emails is
   unresolved. In 2026, 99.88% of emails audited had serious accessibility defects, so
   accessibility checks are a real differentiator. (02 §2)
10. **Accessible markup:**
    - put `lang`/`dir` on `<html>` **and** on a wrapper `<div>`, because webmails replace `<html>`
      and `<body>`;
    - give linked images non-empty `alt`;
    - never put `aria-label` on a plain `div`/`span`;
    - keep reflow working at 320 px, not 360 px. (02, 05)

### Deliverability and security
11. **Gmail now rejects mail that breaks its rules.** Since November 2025 it returns temporary and
    permanent errors for missing authentication, a missing Message-ID or duplicate headers.
    Microsoft has required SPF, DKIM and DMARC above 5,000 messages a day since May 2025.
    **DMARCbis** is published as RFC 9989–9991 (May 2026) and replaces RFC 7489. (04 §0, §3)
12. **One-click unsubscribe (RFC 8058)** has more rules than the reference docs list:
    - both headers must be DKIM-signed;
    - there must be one HTTPS URI;
    - the POST must work without cookies or CSRF tokens;
    - there must be no redirect;
    - a GET must not unsubscribe.

    Gmail's "Manage subscriptions" view (2025) relies on it. (04 §1.6)
13. **Stopping Gmail threading.** Use a unique `References` header for each message.
    `X-Entity-Ref-ID` is folklore. (04 §1.5)
14. **One-time codes and magic links:**
    - Gmail shows a "Copy code" chip (September 2026) and iOS Mail autofills codes, so render
      codes as contiguous digits in the body;
    - keep codes out of the subject unless a template opts in, because subjects reach lock screens
      and provider logs;
    - tokens in URL fragments plus a press-to-confirm page defend against link scanners;
    - turn click tracking off for auth mail, because tracking records fragments. (04 §5, 05 §9)

### Legal and compliance (not legal advice; have counsel review)
15. **The legal axis is purpose, not the word "unsubscribe".** Every template should be
    `transactional`, `marketing` or `consent-request`. In most regimes (Canada, EU, UK, Australia,
    NZ, Korea, Sri Lanka) one promotional element makes an email marketing. Australia fined
    Lululemon A$702,900 in 2026 for promotions in service emails. The check is therefore "no
    promotional content in transactional mail", and the framework must be able to render a template
    without its promo slot for recipients who unsubscribed. (03 §13)
16. **Marketing and consent-request mail must carry:**
    - a postal address;
    - the sender's legal identity;
    - a privacy link;
    - a "why you got this" line;
    - an unsubscribe link with explicit, localised wording;
    - RFC 8058 headers.

    Unsubscribe tokens should never expire (the legal floor is 60 days under CASL). Opt-outs should
    take effect immediately, and always within 48 h. (03 §12, §15.2)
17. **Open pixels and tracked links need consent in the EU, UK and France.** EDPB Guidelines 2/2023
    cover both. The CNIL recommendation (deliberation 2026-042, grace period ended 2026-07-14) allows
    only narrow exemptions. Tracking is off by default, and a check flags 1×1 images and rewritten
    links. (03 §4.3)
18. **Dates that matter:**
    - Sri Lanka's PDPA Parts I and III take effect on 2027-01-01. Part III includes cross-border
      transfer, which covers sending through SES or Resend.
    - Sri Lanka's s.27 (consent for promotional messages, no soft opt-in) and the penalties are not
      yet in force. A child is under 16.
    - India's DPDP core duties apply from 2027-05-13; a child is under 18.
    - COPPA's amended rule had to be met by 2026-04-22.
    - In the UK, from 2026-02-05 charities may use soft opt-in and PECR fines rise to £17.5m or 4%.
    - The EU ePrivacy Regulation is withdrawn. (03 §0.1)
19. **Ship compliance profiles as data.** `global-strict` is the default. The others are `us`, `ca`,
    `eu`, `de`, `fr`, `uk`, `au`, `nz`, `sg`, `jp`, `kr`, `in`, `cn`, `lk`, `br` and `mx`. Each
    profile sets the child age, subject prefix (Korea `(광고)`), opt-out deadline, tracking rules and
    a `verifiedOn` date. A send applies the union of the recipient's profiles and the sender's home
    profile. (03 §15.3)

### Design and theming
20. **Font weights 400 and 700, not 500/600.** Arial and Helvetica fallbacks and Outlook render
    500 as regular and 600 as bold. Body text 16 px, and nothing under 14 px. (05 §2)
21. **W3C DTCG 2025.10 is stable.** It covers the Format, Color and Resolver modules. Light/dark and
    brands are resolver modifiers. Style Dictionary 5.7 handles the colours but not resolvers;
    Terrazzo does. A default shadcn theme fails package-1's mid-tone check, because
    `muted-foreground` is `#737373`, so the role mapper needs documented adjustments. (05 §12)
22. **Plain text should come from the component tree.** Each component renders its own text form
    (tables become `Label: value`, buttons become `Label: <URL>`), a template can override it, and
    both parts are linted for parity. This settles package-1's hand-written approach against
    package-2's stripped one. (05 ⚠7, 04 `text.parity`)

### Tooling and ecosystem
23. **Kotlin Multiplatform needs precompiled artifacts.**
    - Neither React nor MJML runs in KMP.
    - The KMP Mustache libraries are tiny one-person projects.
    - `mustache`, `handlebars` and `liquidjs` each escape differently at the byte level.

    The recommendation is a small "mustache-core" placeholder dialect with one shared escaping
    table and a conformance suite, implemented in TS and pure Kotlin. (06 §3)
24. **Standard Schema with JSON Schema output exists now.** Zod 4.6 and ArkType 2.2 implement it, so
    a framework can accept any schema library and emit `schema.json` per template for Kotlin code
    generation. (06 §3.3)
25. **Current versions:**
    - MJML 5 is stable;
    - React Email 6 is one `react-email` package and can export static HTML at build time;
    - Maizzle 6 is Vue + Vite + Tailwind 4;
    - Node 20 is end-of-life and Node 26 becomes LTS on 2026-10-28;
    - npm trusted publishing (OIDC) has been GA since July 2025;
    - tsdown has replaced tsup. (06 §0)
26. **Component provenance is a legal risk.** The leading shadcn-style email registry, emailcn, was
    taken down from GitHub under a DMCA notice in October 2026. Write components from scratch and
    record where each comes from. (06 §0)

## Where the research corrects the reference docs

| Reference claim | Correction | File |
|---|---|---|
| P1: SVG "blocked across major clients since late 2025 after malicious payloads" | Only Microsoft (OWA and new Outlook) blanked it; Gmail rasterises linked SVG; Yahoo and Apple render it. Keep the ban, fix the reason | 01, 02, 05 |
| P1: forced dark ≈ `255 − v` per channel | LAB lightness inversion with hue kept (Chromium), contrast repair (Outlook), HSL lightness cut (Yahoo) | 02 |
| P1: light ground ≠ `#ffffff` (it "inverts to #000") | `#fff` and `#fafafa` both become `#121212`; near-whites like `#fffffe` turn vivid in Yahoo. Downgrade to MAY | 02 |
| P1: mid-tone band `#707070`–`#909090` per grey channel | Redefine as L\* ≈ 40–65 for any hue, for grounds behind text and meaningful borders | 02 |
| P1: weights 400/500/600, "700 synthesises faux bold" | Backwards: use 400/700 | 01, 05 |
| P1: `supported-color-schemes` meta required | Obsolete | 02 |
| P1: `lang`/`dir` on `<html>` only; alt "empty is fine" | Repeat on a wrapper div; linked images need non-empty alt | 01, 02 |
| P1: flex/grid "unsupported in Outlook.com" | Outlook.com supports them; the ban stands because of classic Outlook and others | 01 |
| P1: Gmail drops `<style>` with any nested at-rule | Only bare or unsupported nested at-rules; but also uppercase `!IMPORTANT`, space-separated `rgb()`, modern colour functions and a 16 KB cap | 01 |
| P1: "MJML needs no custom media query" | MJML emits one; where `<style>` is stripped columns stay stacked | 01 |
| P1: a code may go in the subject | Contested; default off, opt-in per template | 04, 05 |
| P1: SEC-07 (`https:` URLs) is a SHOULD | Make it a MUST, with a host allow-list | 04 |
| P1: SES simulator as the phantom address | SES-only and billed; other providers need their own strategy | 04 |
| P1: `X-Template` header on every message | Exposes internal names; tags already carry the id. Off by default | 04 |
| P1 FR-25: postal address optional, omitted when empty (P2's footer has none) | Mandatory in marketing mail under CAN-SPAM, CASL, Japan and Mexico; required slot for `marketing` and `consent-request` | 03 |
| P1: a transactional email *cannot* carry an unsubscribe link; the check fails on the word "unsubscribe" | No law forbids one, and CASL requires an unsubscribe mechanism even on consent-exempt messages. The real check is "no promotional content in transactional" | 03 |
| P1: a double-opt-in confirmation is transactional | Under CASL a consent request is itself a commercial message; add a `consent-request` purpose (sender ID, address, remove link, no promo, no tracking) | 03 |
| P1: unsubscribe justified by the Gmail/Yahoo bulk rules | It is a legal duty at any volume; the provider rules add one-click and the 48 h target | 03 |
| P1/P2: no mention of open or click tracking | Needs consent in the EU, UK and France; off by default | 03 |
| P2: "emails go only to adults", yet 16–17-year-olds receive `own-purchases` | Inconsistent; the child age differs by law (LK < 16, IN < 18, COPPA < 13, GDPR 13–16). Make it per-jurisdiction | 03 |
| P2: "Remove me" as the unsubscribe label | Japan, Singapore, Korea and Sri Lanka expect an explicit opt-out statement; localise it | 03 |
| P1: MJML 4.15.3, Handlebars 4.7.8, Vitest 3, tsup, Node ≥ 20 | MJML 5.4.1, Handlebars 4.7.10 (maintenance only), Vitest 5, tsdown, Node ≥ 22.12 | 06 |
| P1: React Email only "renders at send time" and has "no ghost tables" | `email export` renders at build time; its layout primitives are tables, but it lacks MJML's responsive column and VML toolkit | 06 |
| P2: no fixed width over 360 px | Exempt MSO ghost tables and `max-width`; WCAG reflow uses 320 px | 01, 02 |
| P2: contrast checked in light and dark only | Gmail never shows authored dark; add forced-dark passes | 02 |
| P2: `CodeBox` uses `aria-label` on a div | Prohibited by ARIA 1.2; put the code in real text | 02, 05 |
| P2: long test language is a flat +40% | Short strings grow 200–300%; scale expansion by length and add an RTL pseudo-locale | 05 |
| P2: fragment tokens stop mail scanners | Not alone: scanners that run JavaScript and click tracking can read fragments; the press-to-act page is the real defence | 04 |
| P2: Resend idempotency key for every retry | Keys expire after 24 h; long waits can send twice | 04 |
| P2: deep-importing 11 React Email components | React Email 6 changed packaging; re-measure | 06 |

## Where the research files differ, and what to do

| Topic | Positions | Resolution for the design phase |
|---|---|---|
| Rounded Outlook buttons | 01 offers an opt-in `vml` prop (with a ~32,000 px warning); 02 lists the button with no VML | Padded `<a>` by default (square in Word); VML strictly opt-in |
| Width check | 01: no fixed width > 360 px outside MSO blocks; 02: 320 px (WCAG 1.4.10) | 320 px outside MSO blocks and `max-width`, data tables exempt |
| `aria-roledescription="email"` on the wrapper | 01: SHOULD, translated; 02: only if the catalogue supplies a translation (axe-core 4.14 deprecated its rule) | Emit `role="article"` + `aria-label` always; `aria-roledescription` only when localised |
| Contrast modes | 05's theme outline lists light, dark, force-inverted; 02 defines four modes with real algorithms | Use 02's four modes |
| Gmail and SVG | 04 says Gmail "has long not rendered SVG"; 01/02/05 cite caniemail 2026-09 (rasterised to PNG) | 01's reading is the newer data; the rule is the same either way |
| Message type field | 04's `OutboundMessage.category` is `transactional \| marketing`; 03 defines `purpose` = `transactional \| marketing \| consent-request` | Use 03's three-value `purpose` throughout; streams map from it by configuration |
| Runtime send guards | 04 §10.4 (header, URL, secret, tracking, size, idempotency…) and 03 §15.6 (consent, suppression scope, age, tracking, subject prefix, config) overlap | Merge into one ordered guard list in the design |

## Direction that emerged (to settle in the design phase)

The research points to one architecture. Nothing is decided yet. Each point refers back to a
tension in `00-reference-comparison.md` §5.

| Tension | Direction the research supports | Files |
|---|---|---|
| T1 Authoring vs artifacts | Author in TSX with the framework's own email-safe primitives; render once per locale at **build time** to precompiled HTML + text with placeholders (`<If>`/`<Each>` and typed variable proxies emit placeholder blocks). Optional runtime React rendering for JS-only consumers. Prototype primitives as React-Email-style tables vs MJML underneath, and compare in Outlook | 06 |
| T2 Placeholder engine | A "mustache-core" subset (variables, raw, sections, inverted sections, lists; partials resolved at build time), one escaping table, a shared conformance suite, TS + pure Kotlin | 06 |
| T3 i18n | One artifact per template × locale; ICU messages resolved at build time; runtime values formatted by the caller or a shared helper set | 05, 06 |
| T4 Schema | Accept any Standard Schema (Zod 4 default); emit JSON Schema 2020-12 per template; generate Kotlin data classes; runtime core has no schema dependency | 06 |
| T5 Plain text | Derived from the component tree, with a per-template override, linted for parity | 04, 05 |
| T7 Components | Primitives on npm; blocks and templates also in a shadcn-compatible registry; clean-room with provenance | 05, 06 |
| T8 Outlook | Keep classic Outlook as a default target (`targets.outlookClassic: true`) until at least 2029 | 01 |
| T9 Categories | Two axes: the legal `purpose` (`transactional` / `marketing` / `consent-request`) and the product's own `category` (who may receive it, as in P2). Required footer slots per purpose; a promo slot forces `marketing`; jurisdiction profiles applied at send time | 03 |
| T10 Sending | **Decided: not in phase 1** (see `../phase-1-scope.md`). Later: an optional send package with transport capabilities, default headers, runtime guards (header, URL, secret, category, tracking, suppression, idempotency, size) and a `doctor` DNS check | 04 |
| T11 Theme input | DTCG 2025.10 JSON **and** shadcn/Tailwind CSS variables → semantic roles → validated hex; emit typed TS theme, `theme.json` and email CSS (inline + dark `<style>` + `[data-ogsc]` from one list) | 05, 06 |
| Studio | A Vite app on the same build and check pipeline (never a separate renderer). Features: client widths, four dark modes, images-off and no-`<style>` views, locale and pseudo-locale switcher, inbox mock-up, theme inspector, text pane, size meter, checks and accessibility panels, fixture editor, send-test | 02, 05, 06 |
| Packaging | ESM-only, tsdown, publint + attw, pnpm + Turborepo + Changesets, npm trusted publishing, Node ≥ 22.12, near-zero runtime dependencies | 06 |

## Open uncertainties to verify before v1

- Gmail's 102 KB clip is not documented by Google.
- Behaviour of classic Outlook, Gmail iOS, Samsung and Thunderbird in dark mode is undocumented.
- Many caniemail tests date from 2019–2021.
- React Email's Outlook fidelity versus MJML 5 has never been compared side by side; test both.
- Whether React Email's Tailwind inliner converts OKLCH to hex.
- Whether URL rewriters (Safe Links, Proofpoint, Mimecast) keep fragments, and which custom headers
  providers DKIM-sign.
- What triggers Apple's and Gmail's one-time-code detection.
- Whether the European Accessibility Act covers emails.
- When Sri Lanka's PDPA s.27 (direct marketing) and its penalties take effect; no Gazette yet.
- The EU Digital Omnibus outcome for pixel and cookie rules (trilogue pending); Korean decree details
  (`(광고)` placement, opt-out wording); whether the UK's DUAA statistics exception covers email
  pixels (treat as consent-required).
- The legal outcome of the emailcn takedown.
