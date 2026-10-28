# 06: Tooling, ecosystem, cross-platform consumption and packaging

**Scope.** This is the current state of the tools around an email-template framework: email
frameworks, pipeline libraries, cross-language (KMP) consumption, runtime targets, the shadcn
registry, preview studios, CLI patterns, npm packaging and supply chain, and testing services.
It feeds the framework's architecture and stack decisions.

**Verified:** 2026-10-27. Versions and release dates come from the npm registry
(`npm view <pkg> time --json`), run on 2026-10-27, unless marked otherwise. Feature claims come
from official docs, changelogs and repos (see [Sources](#sources)).

**Confidence markers.**
- No marker: verified against the registry or official docs on 2026-10-27.
- **(docs)**: taken from the project's own documentation; not tested by hand.
- **(unverified)**: from secondary sources or prior knowledge; re-check before you depend on it.

---

## 0. Headline changes since the reference docs were written

| # | Change (2024–2026) | Impact on the reference docs |
|---|---|---|
| 1 | **MJML 5 is stable.** 5.0.0 shipped 2026-04-16; latest is 5.4.1 (2026-09-10). Breaking changes: `htmlnano` + `cssnano` minification, stricter includes, `mj-body` generates `<body>`, `mjml-migrate` removed, Node 16/18 dropped. | `04-technologies.md` pins MJML **4.15.3**. v4 is now the previous major. Plan for v5 and expect golden-output diffs. |
| 2 | **React Email 6** (2026-04-16; latest 6.11.3, 2026-10-16) puts every component and `render` into the single `react-email` package. `@react-email/components` is retired, and the preview server is now `@react-email/ui`. | package-2 already imports from `react-email`. Any plan that names `@react-email/components` is out of date. |
| 3 | **React Email can render at build time.** `email export` writes static `.html`/`.txt`, takes a custom `--extension`, and the docs name "a backend in a language other than JavaScript" as its use case. | Contradicts the package-1 framing that React Email only "renders at send time". The docs still call export the secondary path. |
| 4 | **React Email 5** (2025-11-07) added Tailwind 4, a dark-mode switcher that emulates client colour inversion, and a Tailwind-4-only compatibility checker. **React Email 4** (2025-03-27) added the preview toolbar: a link/image linter, a SpamAssassin-based spam score, a caniemail compatibility checker and responsive resizing. | The React Email preview is now a real studio, not just a renderer. |
| 5 | **Maizzle 6** (`@maizzle/framework` 6.3.0, 2026-10-21) is "a Vite-powered framework for building HTML emails with Vue and Tailwind CSS". Templates are Vue SFCs with about 30 components (including `Outlook`, `Vml` and `Plaintext`), plus a `render()` API and a Vite plugin. | The reference doc calls Maizzle "a candidate second front-end". It is now a Vue/Vite toolchain, not a plain HTML + Tailwind 3 one. |
| 5b | **The leading shadcn-style email registry, `emailcn`, was taken down on GitHub** under a DMCA notice (2026-10-14) from Maizzle OÜ. The notice says it ported components from **Mailviews**, Maizzle's paid component library. | Component provenance and licensing are a real risk for a component kit. Build ours from scratch and record provenance. |
| 5c | **shadcn CLI v4** (Mar 2026). **GitHub registries** (Jun 2026; private repos in Aug 2026) let `npx shadcn add owner/repo/item#tag` work with no hosted JSON. | Distributing email blocks through a registry is cheaper than when the reference docs were written. |
| 6 | **Zod 4** (2025-07-09; latest 4.6.7) has native `z.toJSONSchema()`. **Standard Schema** 1.x (`@standard-schema/spec` 1.1.0, 2025-12-15) is implemented by Zod, Valibot and ArkType. | Weakens "a tiny var schema instead of zod". JSON Schema is now a cheap cross-language contract (see §3). |
| 7 | **npm trusted publishing (OIDC)** went GA in July 2025. After the September and November 2025 "Shai-Hulud" worms, npm tightened tokens and 2FA. | `09-roadmap` says `npm publish --provenance`. Trusted publishing now replaces long-lived `NPM_TOKEN`s outright. |
| 8 | **tsup is no longer the default pick.** `tsdown` (Rolldown-based) is the successor its maintainer recommends. | `09-roadmap` names tsup. |
| 9 | **Handlebars 4.7.10** (2026-10-05) is the latest. The 4.x line is in maintenance only. | `04-technologies.md` pins 4.7.8. |
| 10 | **Node 20 reached end of life** on 2026-04-30. Node 24 moved to Maintenance LTS on 2026-10-20. **Node 26 becomes Active LTS on 2026-10-28.** Node 22 is Maintenance LTS until 2027-04-30. | `09-roadmap` says "Node ≥ 20" and a CI matrix of 20 and 22. Move to `>=22.12` and test on 22, 24 and 26. |
| 11 | **`doiuse-email` is stale.** Its last release is 0.4.1 (2023-11-03). | Don't depend on it. Read caniemail data directly (see §2.7). |

---

## 1. Email framework landscape

### 1.1 Summary table

| Tool | Latest (date) | Status | Authoring | Render time | Outlook (Word) quality | Theming | i18n | Licence |
|---|---|---|---|---|---|---|---|---|
| [React Email](https://github.com/resend/react-email) (`react-email`) | 6.11.3 (2026-10-16); v6.0.0 2026-04-16 | Very active (Resend). About 2M weekly downloads per the v6 post | React/TSX components, optional `<Tailwind>` | Runtime `render()` by default; build-time `email export` exists | Good for simple layouts. Tables for `Section`/`Row`/`Column`; MSO conditionals in `Button`. No ghost-table *responsive* columns like MJML (§1.3) | Tailwind 4 config or inline style objects; no token system | None built in. Guides for next-intl, react-i18next and React Intl **(docs)** | MIT |
| [MJML](https://github.com/mjmlio/mjml) (`mjml`) | 5.4.1 (2026-09-10); v5.0.0 2026-04-16 | Active (Mailjet/Sinch) | XML-like `<mj-*>` markup | Build time (Node); `mjml-browser` for browser use | **Best in class.** Ghost tables, `<!--[if mso]>` wrappers, VML for backgrounds | `mj-attributes`, `mj-class`, `mj-style`; no token system | None | MIT |
| [Maizzle](https://github.com/maizzle/framework) (`@maizzle/framework`) | 6.3.0 (2026-10-21); v5.0.0 2024-12-16 | Active (Maizzle OÜ; one main maintainer) | v6: Vue SFC templates on Vite; about 30 "render-tested" components (Html, Section, Row, Column, Button, Img, Outlook, Vml, QrCode, Plaintext…) **(docs)**. v5: HTML + PostHTML + Tailwind 3 | Build time (`build()`); `render()` compiles a template string; also runs as a Vite plugin in Nuxt, SvelteKit, Astro and Laravel **(docs)** | Good. `Outlook` and `Vml` components | Tailwind 4 via `@import "@maizzle/tailwindcss"`; OKLCH → hex with `culori` | None built in | MIT (the paid Mailviews kit is separate) |
| [jsx-email](https://github.com/shellscape/jsx-email) | 3.2.1 (2026-05-28); v3.0.0 2026-05-08 | Active (one maintainer, shellscape; last push 2026-10-19) | JSX components (React-compatible); supports `<Suspense>`/async components | Runtime `render()` plus a CLI with a build and preview server | Similar to React Email; `Conditional` component for MSO blocks **(docs)** | Tailwind component; plugins for inline CSS, minify, pretty, URL and clean **(docs)** | None | MIT |
| [Mailing](https://github.com/sofn-xyz/mailing) | 1.2.0 (2026-07-10) | Low activity. The last commits (Jul 2026) are a version bump and a test fix | MJML via `mjml-react` in React | Runtime | MJML-backed, so good | — | — | MIT |
| [vue-email](https://github.com/vue-email/vue-email) | `vue-email` 0.8.11 (2024-04-04); `@vue-email/components` 0.0.21 (2024-11-01) | Stale (no release in about 2 years) | Vue SFC | Runtime | Like React Email | Tailwind | — | MIT |
| [svelte-email](https://github.com/carstenlebek/svelte-email) | 0.0.4 (2023-02-09) | Abandoned | Svelte | Runtime | — | — | — | MIT |
| [@faire/mjml-react](https://github.com/Faire/mjml-react) | 4.0.1 (2026-06-01) | Maintained (Faire) | React components that emit MJML, then `mjml` compile | Build or runtime (MJML is heavy: §4) | MJML-grade | MJML attributes | — | MIT |
| `mjml-react` (wix-incubator) | 2.0.8 (2022-05-20) | Abandoned. Use `@faire/mjml-react`. `react-mjml` isn't on npm | — | — | — | — | — | MIT |

### 1.2 Visual and JSON builders

| Tool | Latest (date) | Model | Output | Licence | Fit for us |
|---|---|---|---|---|---|
| [`@react-email/editor`](https://react.email/docs/editor/overview) | 1.7.14 (2026-10-16); launched with v6 (2026-04-16) | Tiptap/ProseMirror editor; `EmailNode`/`EmailMark` extensions; `composeReactEmail()` gives HTML + text **(docs)** | React Email HTML | Open source (per the v6 post; check the package licence) | Shows a JSON document → React Email → HTML path. Too much for a code-first framework |
| [EasyEmail](https://github.com/zalify/easy-email) (`easy-email-core`/`-editor`) | 4.17.1 (2026-06-10) | Drag-and-drop on MJML; JSON block tree | MJML → HTML | MIT | Proves JSON → MJML works; React 18-era UI |
| [email-builder-js](https://github.com/usewaypoint/email-builder-js) (Waypoint, `@usewaypoint/email-builder`) | 0.0.9 (2026-01-09) | JSON document → React renderer; block packages (`@usewaypoint/block-*`) | HTML | MIT | Slow-moving; 0.0.x |
| [Unlayer](https://unlayer.com) | SaaS / embeddable | Proprietary JSON design → HTML | HTML | Commercial (free tier) | Not for a code-first OSS framework |
| [Stripo](https://stripo.email) / [Beefree (BEE)](https://beefree.io) | SaaS / plugin SDKs | Proprietary JSON | HTML (and AMP for Stripo) | Commercial | Same |

### 1.3 React Email in depth (and the package-1 claims)

**Package layout today (v6):**

| Package | Version (date) | Role |
|---|---|---|
| `react-email` | 6.11.3 (2026-10-16) | Components, `render`, `pretty`, `toPlainText`, `Tailwind`, `pixelBasedPreset`, and the `email` CLI (`bin: email`). Engines `node >=20.19.0`. Dual ESM/CJS exports |
| `@react-email/ui` | 6.11.3 (2026-10-16) | The preview app (formerly `@react-email/preview-server`, renamed in 6.0.0) |
| `@react-email/render` | 2.1.1 (2026-10-16) | Still published; `react-email` depends on it |
| `@react-email/tailwind` | 2.0.7 (2026-03-31) | Tailwind v4 engine (2.0.0 moved to v4 in Nov 2025) |
| `@react-email/components` | 1.0.12 (2026-04-09) | **Retired by v6.** Remove it |
| `@react-email/editor` | 1.7.14 (2026-10-16) | Embeddable visual editor |

**Checking the package-1 alternatives table:**

| Claim in `03-architecture.md` / `04-technologies.md` | Status in Oct 2026 |
|---|---|
| "No Outlook ghost tables by default" | **Mostly still true, but misleading.** React Email's `Section`, `Row` and `Column` are real `<table>`s, and `Button` emits `<!--[if mso]>` spacers for padding. So Outlook layout is table-based, not div-based, and ghost tables are less needed. What React Email lacks is MJML's *responsive* column model (div columns that stack on mobile with ghost-table fallbacks for Outlook), VML backgrounds and bulletproof-button VML. You have to hand-write those patterns. |
| "Renders at send time (React on the hot path)" | **No longer the only option.** `email export --outDir out [--plainText] [--extension blade.php]` renders every template to static files at build time. The docs say it is "secondary", with the "significant drawback" of manual templating, and list "a backend in a language other than JavaScript" as a valid reason to use it. That is exactly the KMP case. |
| "Its Outlook output is less battle-tested" | Fair. The component docs claim testing on Gmail, Apple Mail, Outlook, Yahoo, HEY and Superhuman **(docs)**, but there is no public Outlook matrix comparable to MJML's track record. |
| Cold start (package-2: about 1.6 MB → 18 KB by deep-importing 11 components, saving about 230 ms) | v6 says its exports are more tree-shakeable (Tailwind 2.0 "granular APIs"). Re-measure: package-2's esbuild rewrite may now be unnecessary **(unverified)**. |

**Rendering details:** `render()` is async (since v5 `renderAsync` is gone). It uses
`renderToReadableStream` where available and waits for `stream.allReady` (fix 2026-04-09). There are
edge exports for Workers/Convex and a fix for `MessageChannel` errors on edge (2025-08-20).
Browser use on Safari/iOS needs a `ReadableByteStreamController` polyfill. `toPlainText()` wraps
`html-to-text`, and `data-skip-in-text="true"` drops an element from the text part **(docs)**.

**Tailwind:** v4 since React Email 5 / `@react-email/tailwind` 2.0.0. The docs note
`pixelBasedPreset` to replace `rem` with px. They also note that selectors more complex than one
class (for example `prose` and `space-*`) are not inlined, that context providers inside
`<Tailwind>` break, and that media-query classes go into a `<style>` block.
`className` is now inlined only on host elements, not on components. The `dark:` variant depends
on `prefers-color-scheme`, which many clients strip **(docs/unverified)**.

### 1.4 MJML 5

- **Dates:** 5.0.0 on 2026-04-16, after a long alpha/beta run. Then 5.1.0, 5.2.x, 5.3.0, 5.4.0 and
  5.4.1 (2026-09-10). `@types/mjml` 5.4.1 (2026-10-24) is current.
- **Breaking changes in 5.0.0** (GitHub release notes):

  | Area | Change |
  |---|---|
  | Minification | `html-minifier` replaced by **`htmlnano`**; CSS minified by **`cssnano`** (`lite` preset by default). Options go in `.mjmlconfig.js`. Output is minified more aggressively |
  | Template syntax | `{{ }}` markers are sanitised before PostCSS and restored afterwards. Markers inside CSS or `style` can raise `CssSyntaxError`. **This matters for us:** placeholders in style attributes must be tested |
  | Includes | Ignored by default; new `includePath`; only MJML, HTML and CSS includes |
  | Skeleton | `mj-body` now generates `<body>`. `class` moves to `<body>`; `background-color` moves to the inner `div` |
  | Removed | `mjml-migrate` and `noMigrateWarn` (no auto-migration of 3.x/early-4.x syntax) |
  | Node | Node 16 and 18 dropped; CI on Node 20/22/24 |
  | Browser | `mjml-browser` shrank from 1.22 MB to 1.04 MB |

- **Later releases:** 5.1 switched beautification to Biome (WASM) for speed. 5.2 went back to
  `js-beautify` for predictable output. 5.4 added `mj-section` `gutter`, an `mj-social-element`
  border, and an `mjml-hero` refactor.
- Treat MJML 4.15.x as legacy. Package-1's golden-output tests will show diffs on upgrade.
  Placeholders in CSS are the one v5 change that directly hits a precompile-with-placeholders
  design.

### 1.5 Maizzle 6

- `@maizzle/framework` 6.0.0 pre-releases began on 2025-07-10; latest is 6.3.0 (2026-10-21). The
  `next` tag still points at an old 6.0.0-rc.
- Its dependency list shows the architecture: `vite@^8`, `@vitejs/plugin-vue`, `vue-router`,
  `reka-ui` (the studio UI), `@tailwindcss/vite`/`@tailwindcss/postcss@^4.3`,
  `@maizzle/tailwindcss` (an email-safe Tailwind preset), `culori` (OKLCH → hex), `postcss-calc`,
  `postcss-merge-longhand`, `postcss-sort-media-queries`, `juice@^12`, `email-comb`, `html-crush`,
  `string-strip-html` (plain text), `nodemailer` (send-test), `uqr` (QR code, probably for
  opening the preview on a phone), `jiti`, `defu`, `oxfmt` (formatter) and `typescript@^6`.
- So Maizzle 6 solves Tailwind-4-for-email at build time: it resolves CSS variables and `calc()`,
  converts OKLCH to hex, merges longhands, inlines and then purges.
- Per the docs, transformers (Inline CSS, Purge CSS, Minify, Format, Entities) form a
  configurable pipeline. The dev server has HMR, device resizing, compatibility checks with
  jump-to-editor, dark-mode emulation, quick search and test sending **(docs)**.
- The same company sells **Mailviews**, a paid, non-open-source email component library. Its
  licence bans "Converting a Mailviews Component or Template to another framework". That is the
  basis of the Oct 2026 DMCA takedown of `emailcn` (§5.3).
- The `maizzle` CLI is 1.2.4 (2026-08-01). `@maizzle/cli` 2.0.0 (2024) is the older CLI package.

### 1.6 Other entrants and notes (2025–2026)

| Item | Notes |
|---|---|
| React Email templates (v6) | Auth and e-commerce sequences, also as Figma files |
| Resend Templates API | `email resend setup` uploads React Email templates to Resend for non-developer editing (v5) |
| `caniemail` on npm | 2.0.2 (2026-05-17), published from `shellscape/caniemail` (the jsx-email author). Packages caniemail data for programmatic checks (§2.7) |
| Mailviews (Maizzle OÜ) | Paid email component library. Its licence forbids porting components to other frameworks |
| emailcn / Ingram registry | shadcn-format email registries (§5.3) |
| AI-generated email (LLM skills) | React Email publishes a `SKILL.md` for coding agents and `llms.txt` docs. An LLM-friendly docs surface is now table stakes |

---

## 2. Pipeline libraries

### 2.1 Versions

| Purpose | Library | Latest (date) | Notes |
|---|---|---|---|
| CSS inlining | [`juice`](https://github.com/Automattic/juice) | 12.2.1 (2026-10-26); 12.0.0 2026-06-04 | JS, cheerio-based. Used by MJML and Maizzle. Mature; handles `width`/`height` attribute juicing and `data-embed` |
| CSS inlining | [`@css-inline/css-inline`](https://github.com/Stranger6667/css-inline) (+ `-wasm`) | 0.23.1 (2026-10-17) | Rust core with napi and WASM builds. Much faster than juice (the project claims multiples). Keeps `@media` in `<style>`. 0.x API |
| Unused CSS | [`email-comb`](https://codsen.com/os/email-comb) | 7.4.5 (2026-09-29) | Removes unused classes/ids from `<head>` and body. Codsen monorepo (one maintainer); ESM-only |
| Minify | [`html-crush`](https://codsen.com/os/html-crush) | 6.3.5 (2026-09-29) | Email-aware minifier (keeps line length under the RFC 5322 998-character limit) |
| Plain text | [`html-to-text`](https://github.com/html-to-text/node-html-to-text) | 10.0.1 (2026-08-19); 10.0.0 2026-04-30 | First major since 2022. React Email's `toPlainText` wraps it |
| HTML parse | [`parse5`](https://github.com/inikulin/parse5) | 8.0.1 (2026-04-19); 8.0.0 2025-07-09 | WHATWG-compliant. Slower, but exact. Gives source locations |
| HTML parse | [`htmlparser2`](https://github.com/fb55/htmlparser2) | 12.0.0 (2026-03-20) | Fast and forgiving. Two majors in March 2026 (11 then 12) |
| HTML lint | [`html-validate`](https://html-validate.org) | 11.17.0 (2026-10-20) | Rule-based offline validator with a plugin API and JSON output. Good base for a check engine |
| caniemail lint | [`doiuse-email`](https://github.com/jayeshp19/doiuse-email) | 0.4.1 (2023-11-03) | **Stale.** Last data refresh is unknown. Don't depend on it |
| Colour | [`culori`](https://culorijs.org) | 4.0.2 (2025-06-27) | Tree-shakeable (`culori/fn`). OKLCH → sRGB with gamut mapping (`toGamut`). Maizzle 6 uses it |
| Colour | [`colorjs.io`](https://colorjs.io) | 0.7.1 (2026-07-24) | Spec-accurate (by CSS Color spec editors); larger; 0.x |
| Tokens | [Style Dictionary](https://styledictionary.com) | 5.7.1 (2026-10-24); v4 2024-06-28; v5 2025-05-16 | v4 added first-class DTCG (`$value`/`$type`) support; v5 continues it **(docs)** |
| Tailwind | `tailwindcss` | 4.3.3 (2026-07-16) | v4 defaults: OKLCH palette, CSS variables, `@layer`, `rem` |

### 2.2 juice versus css-inline

| | juice 12 | @css-inline/css-inline 0.23 |
|---|---|---|
| Language | JS (cheerio, mensch/postcss) | Rust; napi binaries; WASM build |
| Speed | Baseline | Much faster per the project's benchmarks **(unverified multiple)** |
| Edge/Workers | Pure JS works, but cheerio is heavy | WASM build works on Workers; check the bundle size |
| Email specifics | Width/height attribute juicing, `!important` handling, preserves media queries, `data-embed` | Keeps `@media`; fewer email-specific attribute tricks |
| Ecosystem | Used by MJML and Maizzle | Newer; used by several Python/Rust email stacks |
| Recommendation | Default at **build time** (speed is irrelevant there) | Use if inlining ever has to run at runtime or on edge |

### 2.3 Minification risks

- Whitespace collapse can join inline elements ("Hello**World**") and break `<pre>` blocks and
  plain-text-like content.
- Removing comments strips `<!--[if mso]>` conditional comments. They must be preserved.
- Gmail clips messages over **102 KB** of HTML. Minify enough to stay under the limit, but keep
  lines at 998 characters or fewer (SMTP line limit). `html-crush` handles this.
- Attribute-quote removal and boolean-attribute collapse can break Outlook and Yahoo parsing.
- Minifying before placeholder substitution can mangle `{{ }}` tokens inside attributes. Run
  minification after the template engine has protected them, or treat them as opaque text.

### 2.4 Tailwind v4 → email problems

| Problem | Why it breaks | How React Email solves it | How Maizzle 6 solves it |
|---|---|---|---|
| OKLCH colours (v4 default palette) | Most clients (Outlook, Gmail, older Apple Mail) don't support `oklch()` | Inlined values are resolved through its Tailwind engine **(unverified whether OKLCH becomes hex)** | `culori` converts to hex at build time |
| CSS custom properties (`var(--color-…)`) | Gmail and Outlook drop them | `sanitizeDeclarations` resolves variables while inlining (v2.0.0) | PostCSS resolves `var()` and `calc()` (`postcss-calc`) |
| `rem` units | Some clients (for example older Outlook and some webmails) ignore `rem` | `pixelBasedPreset` | `@maizzle/tailwindcss` (1.5.6, 2026-08-04) email preset; px output **(unverified detail)** |
| `@layer`, `@property`, nesting | Not understood by clients | Flattened by the engine | Flattened by PostCSS |
| Complex selectors (`space-*`, `prose`, `group-*`) | Can't be inlined | Not supported (docs) | Kept in `<style>` where safe; otherwise purged |
| `dark:` variant | Needs `prefers-color-scheme` in a `<style>` block; Gmail ignores it | Kept as a media query | Same, plus Outlook `[data-ogsc]` patterns are manual |

### 2.5 Plain text

`html-to-text` 10 is the standard (React Email uses it). Maizzle uses `string-strip-html`. Package-1
hand-writes `text/<id>.txt.hbs`. A derived text part with an override is the best DX: generate by
default, and allow a hand-written override per template.

### 2.6 HTML parsing for checks

- **`parse5`**: use it when you need spec-exact trees and source locations (for error messages).
- **`htmlparser2`** + `domhandler` + `css-select`: fastest; Maizzle uses it.
- **`html-validate`**: rules engine, inline `<!-- html-validate-disable -->` directives, JSON
  output and a custom-rule API. Package-1 already proposes it. It fits a `check` command well.

### 2.7 caniemail linting

- Data: the [caniemail repo](https://github.com/hteumeuleu/caniemail) (947 stars, last push
  2026-09-16, **MIT licence** per its README) publishes `https://www.caniemail.com/api/data.json`
  (all features with per-client, per-version support, plus `nice_names`).
- `caniemail` on npm (2.0.2, 2026-05-17) is shellscape's packaging of the data, used by jsx-email's
  compatibility check. It is maintained, but has a single maintainer.
- `doiuse-email`: last release 2023-11. Effectively unmaintained.
- Mailpit also has an "HTML check" that scores client compatibility (§9).
- React Email's toolbar compatibility checker runs over the Tailwind/inline styles it knows about
  (Tailwind-4-only since v5).
- **Recommendation:** vendor a snapshot of `data.json` at build time (a pinned, dated file in the
  checks package), map CSS properties/at-rules/HTML elements found by the parser to caniemail
  feature slugs, and refresh it in a scheduled CI job. Own the mapping instead of depending on a
  stale wrapper.

### 2.8 Token tooling

- **W3C DTCG format**: the Design Tokens Format Module **2025.10** was published on 2025-10-28
  as a Final Community Group Report (stable, but not a W3C Recommendation). It adds theming and
  multi-brand support, colour in Display P3, OKLCH and other CSS Color 4 spaces, and aliases and
  inheritance. Files use `$value`, `$type` and `$description`. Figma's native variable
  import/export reportedly follows it **(unverified)**.
- **Style Dictionary v4/v5** read DTCG natively and output CSS variables, JS/TS and JSON. Style
  Dictionary is heavy for a single-purpose pipeline. For email you need: read tokens (CSS custom
  properties or DTCG JSON) → resolve aliases → convert colours to hex → emit a typed TS theme and
  a JSON theme for KMP.
- **Recommendation:** accept DTCG JSON and a CSS `:root`/`.dark` file. Use `postcss` +
  `postcss-value-parser` for CSS and `culori` for colour. Offer a Style Dictionary transform as an
  adapter, not a dependency.

---

## 3. Cross-language and KMP consumption

### 3.1 The problem

KMP apps (JVM, Android, iOS/Native) can't run React or MJML. The framework therefore has to emit
**precompiled artifacts** that need only a tiny, portable substitution engine at runtime. This is
package-1's model, and it is the only model that serves every consumer with one source.

### 3.2 Placeholder engines

| Engine | Spec | JS implementation (latest) | JVM implementation | **Pure Kotlin multiplatform?** | Logic | Escaping default |
|---|---|---|---|---|---|---|
| **Mustache** | [mustache/spec](https://github.com/mustache/spec) (formal, language-neutral, YAML test suite) | `mustache` 4.2.0 (2021, stable/frozen); `wontache` | `mustache.java` (spullara), `jmustache` (samskivert), [`mustache-k`](https://github.com/pwall567/mustache-k) (Kotlin/JVM, 3 stars) | **Yes, but tiny projects:** [`kostache`](https://github.com/nminet/kostache) (KMP, says it passes the full spec including optional modules; JVM + iOS implied; 1 star; no releases; last push 2025-12) and [`KTM`](https://github.com/L-Briand/KTM) (`net.orandja.ktm:core:2.0.0`, "pure Kotlin Multiplatform", KSP adapters; 28 stars; last push 2025-02; only JVM setup documented) | Sections (truthy/list iteration), inverted sections, partials, lambdas (optional), no `else`, no comparisons | HTML-escape `{{x}}`; raw `{{{x}}}` / `{{& x}}` |
| **Handlebars** | No formal spec; handlebars.js is the reference | `handlebars` 4.7.10 (2026-10-05) | [`handlebars.java`](https://github.com/jknack/handlebars.java) (jknack, 1.5k stars, active): JVM only | **No KMP port found** | Mustache plus `#if`/`#unless`/`#each`/`#with`/`else`, helpers, partials, `@index` | Escape `{{x}}`; raw `{{{x}}}` |
| **Liquid** | Shopify Liquid docs (de-facto spec; no test suite equivalent to Mustache's) | `liquidjs` 10.30.0 (2026-10-01) | [`Liqp`](https://github.com/bkiers/Liqp) (JVM, ANTLR-based, 179 stars) | Partly: KorTE (Korlibs/KorGE, Twig/Liquid-like, multiplatform), now inside the KorGE monorepo. Its docs domain did not resolve on 2026-10-27 **(status unverified)** | Full: `if`/`elsif`/`unless`/`case`, `for` with `limit`/`offset`, filters, assigns | **Not escaped by default**; `liquidjs` has an `outputEscape` option |
| **Jinja-likes** | Jinja2 (Python) | `nunjucks` 3.2.4 (2023, stale) | Jinjava (HubSpot), Pebble | No mainstream KMP port | Full language (macros, filters, inheritance) | Autoescape is configurable |
| **Custom subset** ("Mustache-core") | Our own spec + golden tests | Ours (about 200 lines) | Ours (same tests) | **Yes, by construction** | `{{var}}`, `{{{raw}}}`, `{{#section}}`, `{{^inverted}}`, `{{#list}}…{{/list}}`, `{{.}}`; no partials at runtime (inlined at build) | Defined by us; identical in both |

**Escaping differences that bite.** Measured on 2026-10-27 by rendering `& < > " ' / ` + "`" + ` =`
through each JS library:

| Input | Mustache spec (required) | `mustache` 4.2.0 | `handlebars` 4.7.10 | `liquidjs` 10.30 (`escape` / `outputEscape`) | `liquidjs` default |
|---|---|---|---|---|---|
| `&` `<` `>` | escaped | `&amp; &lt; &gt;` | `&amp; &lt; &gt;` | `&amp; &lt; &gt;` | **raw** |
| `"` | escaped | `&quot;` | `&quot;` | `&#34;` | raw |
| `'` | not required | `&#39;` | `&#x27;` | `&#39;` | raw |
| `/` | not required | `&#x2F;` | raw | raw | raw |
| `` ` `` | not required | `&#x60;` | `&#x60;` | raw | raw |
| `=` | not required | `&#x3D;` | `&#x3D;` | raw | raw |
| missing var | empty string | `""` | `""`; throws in `strict` mode | `""` | `""` |

Every implementation escapes differently at the byte level, so golden tests across languages
break unless both runtimes share **one escaping table**. Make "missing" an error in the framework
(schema validation before render), not something the engine decides.

**Conclusion:** byte-identical rendering across JS and Kotlin needs **one spec with a shared
conformance suite**. Mustache's spec plus our own escaping table is the most portable base. The
KMP Mustache libraries that exist (kostache, KTM) are one-person projects with few stars and no
release cadence, so don't depend on them. Use them, and the official spec suite, as references
for a small in-house `commonMain` renderer. The
runtime subset should be what the build can't precompile: variable substitution, conditionals and
loops over arrays. Partials and layout are resolved at build time, so runtimes never need them.

### 3.3 Data contracts across languages

| Tool | Version (date) | JSON Schema output | Notes |
|---|---|---|---|
| Zod 4 `z.toJSONSchema()` | zod 4.6.7 (2026-10-12) | Native. Targets draft 2020-12 (default), draft-07, draft-04 and OpenAPI 3.0. `io: "input" \| "output"`. `.meta()`/registries copy titles and descriptions; `$defs` for reused schemas. `z.fromJSONSchema()` exists but is experimental | `bigint`, `date`, `map`, `set`, `transform` and others **throw** by default (`unrepresentable: "any"` maps them to `{}`). Email var schemas must stay JSON-representable |
| Valibot | 1.5.0 (2026-09-09) + `@valibot/to-json-schema` 1.8.0 (2026-09-11) | Through the official converter package | Smallest bundle. No `~standard.jsonSchema` in core 1.5.0 (checked in the package) |
| ArkType | 2.2.9 (2026-10-20) | `.toJsonSchema()`, and implements `~standard.jsonSchema` (checked in `@ark/schema`) | Fast, TS-syntax types |
| [Standard Schema](https://standardschema.dev) | `@standard-schema/spec` 1.1.0 (2025-12-15) | Defines `StandardSchemaV1` (validate) and **`StandardJSONSchemaV1`**: `~standard.jsonSchema.input/output({ target })` with targets `draft-2020-12`, `draft-07` and `openapi-3.0` | **Zod 4.6 and ArkType 2.2 implement both interfaces natively** (checked in the published packages). One framework API can validate and emit JSON Schema without library adapters |

**Codegen to Kotlin:**

| Tool | Version | Kotlin output | Verdict |
|---|---|---|---|
| [quicktype](https://github.com/glideapps/quicktype) | 26.0.0 (2026-07-20) | `--lang kotlin --framework kotlinx` (also `jackson`, `klaxon`, `just-types`; `KotlinXRenderer` checked in `quicktype-core`) gives `@Serializable` data classes | Works for flat or nested objects, enums and arrays. Weak on `oneOf` unions **(unverified)**. Pin the version and commit the output |
| Hand-written generator | — | Exactly what we need (data class + `toTemplateContext()`) | Small: email var schemas are simple. Gives the best output |
| `json-kotlin-schema-codegen` (pwall567) | JVM tool | Kotlin data classes **(unverified kotlinx support)** | Option for Gradle users |

### 3.4 Recommended artifact format

```
dist/
├── manifest.json            # schemaVersion, framework version, templates[], hashes, sizes, locales
├── templates/<id>/
│   ├── <locale>.html        # precompiled, inlined, minified HTML with {{placeholders}}
│   ├── <locale>.txt         # plain text with the same placeholders
│   ├── <locale>.subject.txt # subject and preheader templates
│   └── schema.json          # JSON Schema (2020-12) for the template's vars
├── theme.json               # resolved hex tokens (for apps that need them)
├── index.ts / index.js      # JS bundle: artifacts as strings + typed render() (package-1 model)
└── kotlin/                  # optional: generated data classes + a resources index
```

- **`manifest.json`** lists every template's id, category, locales, required vars, the engine
  dialect version (`"placeholder": "mustache-core@1"`), content hashes, byte sizes (Gmail-clip
  budget) and the escaping profile.
- **The JS runtime** imports strings (no `fs`, so it bundles into Workers and Lambda).
- **The Kotlin runtime** is a tiny pure-Kotlin library. It reads `manifest.json` and artifacts as
  resources (Android assets, iOS bundle, or a generated Kotlin `object` holding constants, which
  avoids resource-loading differences on Native), validates input against the generated data
  class, and runs the same mustache-core renderer, tested with the shared conformance suite.

---

## 4. Runtime targets

| Target | Can it run React render? | `fs`? | Cold-start sensitivity | Notes |
|---|---|---|---|---|
| Node 22/24 | Yes | Yes | Low (servers) / high (Lambda) | `react-email` requires `>=20.19` |
| Bun 1.x | Yes | Yes | Low | Generally Node-compatible **(unverified for `@react-email/ui`)** |
| Deno 2.x | Yes, via `npm:` specifiers | Yes (permissions) | Low | — |
| Cloudflare Workers | Yes. React DOM's `renderToReadableStream` works; React Email has edge exports | **No** (no `fs` unless `nodejs_compat`, and even then no project files) | Very high. Current limits: 64 MiB uncompressed script, **1 s startup**, **10 ms CPU per request on Free** (30 s default, up to 5 min, on Paid), 128 MB memory | On Free, a React render of a large email can blow the 10 ms CPU budget **(unverified by measurement)**. MJML can't run here practically. Precompiled strings are ideal |
| Vercel Edge / Next middleware | As Workers | No | High | Vercel now steers people to the Node runtime (Fluid compute) for most server code **(unverified)** |
| Next.js 16 App Router (Node runtime) | Yes | Yes | Medium | In server actions and route handlers, a send function must be server-only (`import "server-only"`). React Email 5+ supports Next 16 / React 19.2 |
| Vite 8 SSR | Yes | Yes | Low | Bundle size matters only if deployed to edge |
| AWS Lambda (Node 22/24) | Yes | Yes (read-only, in bundle) | High; Cognito triggers have a 5 s budget | package-2 measured about 230 ms from loading the full React Email barrel. Precompiled templates avoid React entirely |
| KMP (JVM/Android/iOS) | **No** | n/a | n/a | Needs precompiled artifacts plus a Kotlin renderer |

**Constraints for a tiny runtime:**
1. No `fs` reads at runtime. Artifacts are imported as JS strings (the bundle module).
2. No React, MJML, juice or parsers on the hot path. Those are build-time dependencies only.
3. Zero or one runtime dependency. A mustache-core renderer can be in-house (about 2 KB).
4. ESM, `sideEffects: false`, per-template subpath or code-split imports, so a Worker that sends
   one email doesn't bundle 40 templates.
5. Web-standard APIs only (`fetch`, `TextEncoder`, `crypto.subtle`) in transports meant for edge.
   SMTP (`nodemailer`) is Node-only and must be a separate entry point.
6. Optional runtime validation through Standard Schema, so users bring Zod or Valibot. The core
   ships no schema library.

---

## 5. The shadcn ecosystem

### 5.1 How the registry works (shadcn CLI 4.22.1, 2026-10-18)

**Timeline (shadcn changelog):** updated registry schema + Tailwind v4 (Feb 2025) → MCP (Apr 2025)
→ Universal Registry Items and local-file support (Jul 2025) → **CLI 3.0 + MCP server** (Aug 2025)
→ Registry Index (Sep 2025) → Registry Directory (Oct 2025) → `npx shadcn create` (Dec 2025) →
**CLI v4** (Mar 2026) → Registry Include and Validate, target aliases (May 2026) → **GitHub
Registries** (Jun 2026) → Dynamic Search (Jul 2026) → private GitHub registries (Aug 2026).

| Piece | What it is |
|---|---|
| `registry.json` | Root manifest (`$schema: https://ui.shadcn.com/schema/registry.json`): `name`, `homepage`, `items[]` |
| `registry-item.json` | One item. Fields: `$schema`, `name`, `title`, `description`, `type`, `author`, `dependencies`, `devDependencies`, `registryDependencies`, `files[]` (`path`, `type`, `target`), `cssVars` (`theme`/`light`/`dark`), `css`, `envVars`, `font`, `docs`, `categories`, `meta`. `tailwind` is deprecated. Types: `registry:base`, `block`, `component`, `font`, `lib`, `hook`, `ui`, `page`, `file`, `style`, `theme`, `item`. `target` supports `~` (project root) and the `@components/`, `@ui/`, `@lib/` and `@hooks/` aliases. No per-item version field |
| `shadcn build` | Reads `registry.json` and writes `public/r/<name>.json` with file contents inlined, ready to host statically |
| `npx shadcn add <url\|@ns/name\|owner/repo/item>` | Fetches the item, installs npm deps, resolves `registryDependencies` recursively, writes files to the `components.json` alias paths, and merges `cssVars` |
| Namespaced registries (CLI 3.0, Aug 2025) | `components.json` → `"registries": { "@acme": "https://acme.com/r/{name}.json" }`, then `npx shadcn add @acme/button`. Auth headers with env vars for private registries; public Registry Index/Directory **(docs)** |
| **GitHub registries** (Jun 2026) | Put a `registry.json` at the repo root of a github.com repo. Install with `npx shadcn add owner/repo/item#ref` (branch, tag or SHA). **No build step or hosting.** Refs are not inherited by dependencies, so pin each one. Private repos use `gh` credentials or `GH_TOKEN`. GitHub Enterprise isn't supported |
| Versioning | npm deps pin with `@version`. GitHub items pin with `#tag`/SHA. URL registries have no native versioning (put the version in the path) |
| `shadcn search` / `view` / `list` | Browse registry items before installing **(docs)** |
| MCP server | `npx shadcn mcp` exposes configured registries to AI assistants: browse, search and install by prompt **(docs)** |
| `components.json` | Project config: style, `tailwind.css`, aliases (`components`, `ui`, `lib`, `hooks`), `iconLibrary`, `registries` |

The registry is framework-agnostic in practice. Items are just files plus dependencies, so an
"email" registry with `registry:component` items targeting `emails/components/…` works today.
`components.json` assumes Tailwind and alias settings, but email items can ignore the Tailwind
fields.

### 5.2 Registry versus npm package

| | shadcn registry (copy-in) | npm package |
|---|---|---|
| Customisation | Total: users own the code | Props/slots/theme only |
| Upgrades | Manual. `shadcn add --overwrite` or diff; fixes don't flow automatically | `pnpm up`; fixes (for example a new Outlook workaround) flow to everyone |
| Email-client fixes | **Risky.** Outlook hacks copied into many repos go stale | **Strong.** One fix, one release |
| Discoverability/DX | Very high; AI-assistant friendly (MCP) | Normal |
| Checks/linting | Checks must run on user-owned code anyway | Can trust known components |
| Versioning | None per item (the URL is the version, unless you add versions) | SemVer |

**Recommendation: both, layered.** Primitives with email-client hacks (Section/Row/Column, Button,
Image, Spacer, Divider, Head/Meta, dark-mode helpers) ship in an **npm package**, so fixes
propagate. Composed **blocks and templates** (receipt, sign-in code, header/footer variants) are
distributed through a **shadcn-compatible registry** and import the npm primitives. That matches
shadcn's own split: Radix primitives through npm, styled components through the registry.

### 5.3 Existing shadcn-style email registries and kits

| Project | What it is | Status (2026-10-27) | Link |
|---|---|---|---|
| **emailcn** (shadcn-labs) | The most complete shadcn-format email registry: components, blocks, themes and fonts, namespaced by target framework (`@emailcn/react-email/button`, `mjml-react/…`, `jsx-email/…`). MIT | **GitHub repo blocked (HTTP 451)** by a DMCA notice filed 2026-10-14 by Maizzle OÜ, which says it ported components from the paid Mailviews kit. The docs site returned 503 | https://github.com/shadcn-labs/emailcn · https://www.emailcn.run · [DMCA notice](https://github.com/github/dmca/blob/master/2026/10/2026-10-14-mailviews.md) |
| Ingram Technologies registry | Copy-in shadcn registry of React Email transactional templates (invitation, verification, magic link, password reset, welcome) on a shared base. Install by URL: `npx shadcn add https://ingram-technologies.github.io/registry/r/email-invitation.json`. MIT | Small (0 stars; last push 2026-08-29) | https://github.com/ingram-technologies/registry |
| React Email components gallery and templates | Copy-paste components and templates (v6 adds auth/e-commerce templates and Figma files). Not in shadcn registry format | Active | https://react.email/components · https://react.email/templates |
| shadcnexamples "Email Templates" | Aggregator listing of community email templates | Third-party listing | https://shadcnexamples.com/email-templates |
| shadcn's own stance | In 2024 shadcn floated `npx shadcn init dash-01 auth-02 email-welcome`, adding React Email templates like any block. It was a vision, not a shipped first-party email registry | — | https://x.com/shadcn/status/1833231547920789927 |

**Takeaways:** (1) the gap is real. No healthy, first-party shadcn email registry exists, and the
most complete one is legally blocked. (2) Clean-room authorship and a provenance record per
component are essential. (3) emailcn's "one registry, namespaced per rendering engine" layout is a
useful pattern if we ever target more than one renderer.

---

## 6. Preview studios

### 6.1 Feature matrix

Legend: ✅ yes · ◐ partial · ❌ no · ? not verified.

| Feature | React Email (`@react-email/ui` 6.x) | Maizzle 6 | jsx-email 3 | Mailing | Storybook | Litmus | Email on Acid | Parcel |
|---|---|---|---|---|---|---|---|---|
| Live reload | ✅ (socket.io + chokidar) | ✅ (Vite HMR) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (editor) |
| Device-width presets / resize | ✅ resize with snapping presets (Oct 2025) | ✅ device resizing (docs) | ? | ◐ | ✅ viewport add-on | ✅ real devices | ✅ | ✅ |
| Dark-mode simulation | ✅ switcher that emulates client colour inversion (v5) | ✅ dark-mode emulation (docs) | ? | ❌ | ◐ | ✅ real clients | ✅ | ✅ |
| Real client rendering | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 100+ clients | ✅ | ◐ via integrations |
| HTML source tab | ✅ | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ |
| Plain-text tab | ✅ | ? | ✅ | ✅ | ❌ | ? | ? | ✅ |
| Headers tab | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ? |
| Size meter / Gmail-clip warning | ? | ? | ? | ❌ | ❌ | ✅ | ✅ | ✅ |
| caniemail compatibility lint | ✅ toolbar (v4; Tailwind 4 only since v5) | ✅ with jump-to-editor (docs) | ✅ CLI check (`caniemail` pkg) | ❌ | ❌ | ◐ | ◐ | ✅ |
| Link checker | ✅ toolbar linter (validity, insecure http) | ? | ? | ❌ | ❌ | ✅ | ✅ | ✅ |
| Image checks (alt, size, broken) | ✅ toolbar linter (loads each image) | ? | ? | ❌ | ❌ | ✅ | ✅ | ✅ |
| Spam score | ✅ toolbar, SpamAssassin-based (v4) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ◐ |
| Send-test | ✅ via Resend (rate limited) | ✅ (nodemailer) | ? | ✅ | ❌ | ✅ (seed list) | ✅ | ✅ |
| Props/fixture editor | ◐ `PreviewProps` only, not editable in the UI | ❌ | ? | ◐ | ✅ controls | ❌ | ❌ | ❌ |
| Locale switcher | ❌ | ❌ | ❌ | ❌ | ✅ via globals | ❌ | ❌ | ❌ |
| Side-by-side light/dark | ❌ (toggle) | ? | ? | ❌ | ◐ | ✅ | ✅ | ✅ |
| Visual-regression screenshots | ❌ | ❌ | ❌ | ❌ | ✅ (Chromatic/test-runner) | ✅ (Litmus checklists) | ✅ | ❌ |
| Static export / shareable | ✅ `email build`/`start`; deploy to Vercel | ✅ build | ✅ | ◐ | ✅ static Storybook | ✅ share links | ✅ | ✅ |
| Copy insights for AI | ✅ (v6 "copy toolbar insights for AI") | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Quick search across templates | ✅ file tree | ✅ (docs) | ✅ | ✅ | ✅ | — | — | — |

Mailpit (§9) overlaps with the studio's inbox-side checks: HTML compatibility score, link check,
SpamAssassin spam check and screenshots, all through a REST API. A framework can delegate these
to Mailpit in dev and CI instead of reimplementing them.

### 6.2 Proposed feature list for our studio

**Must have (v1):**
1. Live reload on template, component, token and fixture changes; error overlay with a code frame.
2. Width presets (320/375/414/600/768/full) plus free resize.
3. Light/dark side by side, and a dark-mode simulation mode (forced inversion like Gmail app or
   Outlook.com `[data-ogsc]`) clearly labelled as an approximation.
4. Tabs: Rendered, HTML source (pretty), Plain text, Subject + preheader, Data (fixture JSON).
5. Fixture switcher (multiple fixtures per template, including hostile data) and a locale
   switcher.
6. A check panel that runs the same `check` engine as CI: caniemail, links (https, no
   placeholders left), images (alt, absolute URL, width/height), contrast, size budget with a
   Gmail-clip (102 KB) meter, and text-part presence.
7. Send-test through a configured transport, with Mailpit as the zero-config default.
8. Static export of the studio (a shareable folder for review in PRs).

**Nice to have:**
1. A props/fixture editor generated from the JSON Schema (form UI), with "save as fixture".
2. Visual-regression snapshots (Playwright, Chromium + WebKit) with a diff view.
3. Spam score using SpamAssassin in Docker (opt-in).
4. A headers preview (List-Unsubscribe, tags).
5. Litmus/Email on Acid hand-off (upload the HTML and open the test).
6. QR code to open the preview on a phone on the LAN (as Maizzle 6 appears to do with `uqr`).
7. "Copy for AI" (problems + source) and an MCP server exposing templates, checks and fixtures.

---

## 7. CLI DX patterns

| Concern | Options (version, date) | Recommendation |
|---|---|---|
| Scaffolding | `npm create <x>` (runs `create-<x>`) for new projects; `npx <x> init` for existing repos | Ship both: `create-<name>` (thin) and `<name> init`. The monorepo case (adding to an existing workspace) is the common one |
| Prompts | `@clack/prompts` 1.8.1 (2026-09-13); `prompts` 2.4.2 (React Email still uses it) | `@clack/prompts`: best UX, small, maintained. Always offer `--yes`/flags for non-interactive CI |
| Arg parsing | `commander` 15.0.0 (2026-05-29); `cac` 7.1.0 (2026-10-11); `citty` 0.2.2 (2026-04-01) | `cac` or `citty` for small and typed; `commander` if you want the most familiar choice |
| Config loading | `c12` (4.0.0-rc.3, 2026-10-22; v3 stable); `jiti` 2.7.0 (2026-05-05); `unconfig` 7.5.0 (2026-02-14) | `defineConfig()` in `<name>.config.ts`, loaded with `jiti` (or `c12` once 4.0 is stable). Node 22.18+/24 can strip TS types natively, but `jiti` covers older Nodes and TSX |
| Watch | `chokidar` 6.0.0 (2026-10-19): v4 (2024) cut deps and dropped globs; v5 (2025-11-25) is ESM-only, Node ≥20.19; v6 is a rewrite around one observation pipeline that confirms each event with `stat`/`readdir` and uses native `fs.watch({ recursive: true })` where available. Plain `fs.watch` recursive works on macOS, Windows and Linux (Node 20+) | chokidar 6 (it now wraps native recursive watching), or Vite's watcher if the studio runs on Vite |
| Errors | Code frames (`@babel/code-frame`), "error id + docs URL" pattern | Every check error has an id, file:line:col, a why and a fix, plus a docs link (package-1 already plans one docs page per check id) |
| CI output | `--format json` / `--reporter github` (annotations) | `check --json` with a stable schema; GitHub annotations reporter; non-zero exit on error |
| Doctor | `npx <x> doctor` (Expo, React Native, Next.js `info`) | Check Node version, duplicate React, package-version drift, config validity, token file, transport env vars and stale `dist` |
| Codemods | `jscodeshift`, `ast-grep`, `npx @next/codemod` | A `migrate` command with versioned codemods. Valuable once the API stabilises |

---

## 8. npm packaging and publishing

### 8.1 ESM-only versus dual

- `require(esm)` is enabled by default in **Node 22.12+** and backported to **Node 20.19+**. A CJS
  consumer can `require()` a synchronous ESM graph (no top-level await).
- So **ESM-only is now safe** for libraries targeting Node `>=20.19`/`>=22.12`. Dual packages
  add the dual-package hazard and double the testing.
- React Email still ships dual ESM/CJS (its `exports` has `import` and `require`).
- **Recommendation:** ESM-only, `"type": "module"`, `engines: { node: ">=22.12" }` (or
  `>=20.19` if a consumer is pinned, though 20 is end of life). Keep it free of top-level await so
  `require(esm)` works.

**`exports` map shape:**

```jsonc
{
  "type": "module",
  "exports": {
    ".":        { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./send":   { "types": "./dist/send.d.ts",  "default": "./dist/send.js" },
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "files": ["dist"]
}
```

`types` comes first in each condition. Expose `./package.json` for tooling. Use
`sideEffects: false` only if no module patches globals (CSS imports make it an array).

### 8.2 Builders and checks

| Tool | Latest (date) | Status | Use |
|---|---|---|---|
| [`tsdown`](https://tsdown.dev) | 0.23.2 (2026-10-23) | Active (VoidZero/Rolldown team). 0.x but widely adopted | **Default.** Fast, `.d.ts` via `rolldown-plugin-dts`/isolated declarations, `exports` generation, `publint`/`attw` integration **(docs)** |
| [`tsup`](https://github.com/egoist/tsup) | 9.0.0 (2026-10-14) | README: "not actively maintained anymore. Please consider using tsdown." v9 is maintenance only (obug, esbuild/chokidar upgrade, **drops Node <22.18**) | Avoid for new work |
| [`unbuild`](https://github.com/unjs/unbuild) | 3.6.1 (2025-08-15) | Slowing; UnJS is moving to tsdown/obuild **(unverified)** | — |
| `tsc` only | TypeScript 5.9 / 6.0 | Stable | Fine for pure-TS packages with no bundling needs |
| [`publint`](https://publint.dev) | 0.3.25 (2026-10-01) | Active | Lints `exports`, `files`, `types` |
| [`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong.github.io) | 0.18.5 (2026-07-09) | Active | Checks type resolution under node16/bundler/CJS. Use `--profile esm-only` for ESM-only packages |

### 8.3 `bin` and npx

- `"bin": { "<name>": "./dist/cli.js" }` with a `#!/usr/bin/env node` shebang. Under ESM the file
  must be `.js` in a `type: module` package or `.mjs`.
- `npx <name>` resolves a local `node_modules/.bin` first, then installs to a cache. In a
  monorepo, users should install the CLI as a devDependency so the version is pinned per repo.
- Keep the CLI in its own package (`@scope/cli`) or as a `bin` on the main package. Separate
  packages keep the runtime install small (package-1's NFR-08).

### 8.4 Supply-chain security

| Topic | State in Oct 2026 |
|---|---|
| **Trusted publishing (OIDC)** | **GA on 2025-07-31** (GitHub Actions on GitHub-hosted runners; gitlab.com shared runners). Needs **npm CLI ≥11.5.1** and **Node ≥22.14.0**. Provenance attestations are published by default, so `--provenance` is no longer needed. Follow-ups: CircleCI as an OIDC provider (2026-04-06); bulk config with `npm trust` and "script security" GA (2026-02-18, CLI ≥11.10); multiple trusted-publishing configs per package (2026-09-03); opt-in dist-tag permissions (2026-09-30) |
| Provenance | Sigstore attestations. Automatic with trusted publishing |
| **Shai-Hulud** (Sep 2025) | Self-replicating worm. Stole npm tokens from developer machines and CI through a malicious install script, then republished infected versions of the victim's packages (hundreds affected, including `@ctrl/tinycolor`) **(details from secondary sources)** |
| **Shai-Hulud 2.0** (detected 2025-11-21 to 24) | Second wave hit AsyncAPI, PostHog, Postman and Zapier packages, and leaked secrets to about 25k GitHub repos (The Register) |
| Related (Sep 2025) | Phishing of a maintainer led to malicious `chalk`/`debug` versions with a crypto-stealer (the "qix" compromise) **(unverified details)** |
| npm's response | Classic token creation disabled and **all classic tokens revoked on 2025-12-09** (announced; completion reported by secondary sources). Shorter default lifetimes for granular tokens. Trusted publishing is the recommended path |
| Lessons | (1) Minimise dependencies, especially in the runtime. (2) Never ship `install` lifecycle scripts. (3) Use trusted publishing only; no `NPM_TOKEN` secrets. (4) Require 2FA on maintainer accounts. (5) Pin and review dependency updates; pnpm's `minimumReleaseAge` delays new versions **(docs)**, and pnpm blocks dependency build scripts by default (`onlyBuiltDependencies`). (6) Publish from CI only, from protected tags |

### 8.5 Monorepo and release

| Tool | Latest (date) | Notes |
|---|---|---|
| pnpm | 12.15.0 (2026-10-21) **(major-version timeline unverified)** | Workspaces, `catalog:` protocol for shared versions, `minimumReleaseAge` |
| Turborepo | 2.11.10 (2026-10-20) | Task graph and caching |
| Changesets | `@changesets/cli` 3.0.3 (2026-09-14) | Per-package versions and changelogs. v3 is new; check the migration notes |
| Vitest | 5.0.5 (2026-10-15) | `04-technologies.md` says 3.x. Now 5.x |

### 8.6 Node LTS (Oct 2026)

| Line | Status on 2026-10-27 | Support |
|---|---|---|
Source: `nodejs/Release` `schedule.json`.

| Line | Released | Status on 2026-10-27 | End of life |
|---|---|---|---|
| Node 20 | 2023-04-18 | **End of life** | 2026-04-30 |
| Node 22 | 2024-04-24 | Maintenance LTS (since 2025-10-21) | 2027-04-30 |
| Node 24 | 2025-05-06 | **Maintenance LTS since 2026-10-20** | 2028-04-30 |
| Node 26 | 2026-05-05 | Current → **Active LTS on 2026-10-28** | 2029-04-30 |
| Node 27 | 2027-04-22 (planned) | — | 2030-04-30 |

**Recommendation:** `engines.node: ">=22.12"` (`require(esm)` without a flag; trusted publishing
needs 22.14+ in CI). CI matrix: 22, 24 and 26. Publish from 24 or 26. Lambda's Node 22 and 24
runtimes are fine; check Node 26 runtime availability before relying on it **(unverified)**.
Note that tsup 9 and Maizzle 6's toolchain already need Node ≥22.18 / TypeScript 6, so the
ecosystem floor is rising.

---

## 9. Testing tools

| Tool | What it does | API/automation | Cost | Use |
|---|---|---|---|---|
| [Litmus](https://www.litmus.com) | Real-client screenshots (100+), spam tests, link and image checks | [Instant API](https://docs.litmus.com/instant) (create a test, then fetch each preview; most return in about 10 s) and a Legacy Previews API (previews, spam, links, code analysis). **Access granted case by case** | Paid (API by arrangement) | Optional plugin; manual release gate |
| [Email on Acid](https://www.emailonacid.com), now **Mailgun Inspect** | Same class of tool | [EoA API v5](https://api.emailonacid.com/docs/v5) (Basic auth, `sandbox:sandbox` mode, results kept 90 days). Mailgun publishes a migration from `/v5/tests` to Inspect's `/v2/preview/tests`; spam testing is "coming soon" there | Paid | Optional plugin. Target the Mailgun Inspect API, not v5 |
| [Mailpit](https://github.com/axllent/mailpit) | Local SMTP sink + web UI. **HTML check** (client compatibility score), **link check** (HTML, text and images), **spam check** (needs a SpamAssassin server), **screenshots**, tags, POP3, Chaos (injected SMTP errors) **(docs)** | REST API, webhooks, Docker image `axllent/mailpit`. 10.8k stars; last push 2026-10-26 | Free (MIT) | **Default dev/CI inbox.** Replaces MailHog (abandoned) |
| [Ethereal](https://ethereal.email) | Fake SMTP from Nodemailer authors; web preview URLs | `nodemailer.createTestAccount()` | Free | Quick send-test without Docker |
| SpamAssassin in Docker | Score messages locally (`spamc`) | CLI; Mailpit can call it | Free | Opt-in `check --spam` |
| [mail-tester.com](https://www.mail-tester.com) | Deliverability score (SPF/DKIM/DMARC, content) | Manual; paid API | Freemium | Manual pre-launch check |
| Playwright | Screenshots of rendered HTML in Chromium/WebKit/Firefox; `toHaveScreenshot()` | 1.64.1 (2026-10-14) | Free | Visual regression of artifacts (browser engines approximate Apple Mail only) |
| Resend/SES sandboxes | `delivered@resend.dev`, SES mailbox simulator | Provider APIs | Free | Transport contract tests |

---

## 10. Contradictions with the reference docs, and open uncertainties

### 10.1 Where the reference docs are now wrong or out of date

| Reference doc statement | Finding |
|---|---|
| `04-technologies.md`: MJML 4.15.3 | MJML **5.4.1** is current; v5 has breaking output and include changes (§1.4) |
| `04-technologies.md`: Handlebars 4.7.8 | 4.7.10 (2026-10-05). The 4.x line is in maintenance only |
| `04-technologies.md`: React Email "renders at send time" | Still the default, but `email export` renders at build time and is documented for non-JS backends (§1.3) |
| `03-architecture.md`: React Email has "no Outlook ghost tables by default" | Technically true, but its layout primitives are tables and `Button` has MSO conditionals. What it lacks is MJML's responsive column and VML toolkit (§1.3) |
| `04-technologies.md`: zod is "an extra runtime dependency in a 5 s trigger" | Still true for a runtime that validates, but Zod 4 / Standard Schema can sit at **build** time (JSON Schema emission), and validation can be optional at runtime (§3.3) |
| `04-technologies.md` alternatives: Maizzle as "Tailwind, build-time" second front-end | Maizzle 6 is now Vue SFC + Vite + Tailwind 4, with a commercial component kit alongside (§1.5) |
| `04-technologies.md`: Vitest 3.x | Vitest 5.0.5 |
| `09-roadmap`: tsup, `--provenance`, Node ≥20, CI on 20/22 | tsdown; trusted publishing (provenance automatic); Node ≥22.12; CI on 22/24/26 (§8) |
| package-2: deep-import 11 components to cut 1.6 MB | v6 merged everything into `react-email` with more granular exports. Re-measure before keeping the esbuild rewrite |

### 10.2 Open uncertainties

1. **React Email Outlook fidelity versus MJML 5.** Nobody publishes a side-by-side matrix. Run a
   Litmus or Mailgun Inspect test of the same layout in both before choosing a primitive strategy.
2. **OKLCH handling inside React Email's Tailwind inliner.** Docs don't say whether it converts
   to hex. Test it.
3. **Workers Free 10 ms CPU** versus a React render of a real email. Measure it.
4. **KorTE** (KMP Liquid-like) status. Its docs domain did not resolve.
5. **Standard Schema in Valibot core.** Valibot 1.5 doesn't implement `~standard.jsonSchema` in
   core; check whether `@valibot/to-json-schema` exposes a standard wrapper.
6. **emailcn's legal outcome** (counter-notice or not), and whether its site stays up.
7. **pnpm 12 and Changesets 3** are recent majors. Read the migration notes before adopting.
8. **Shai-Hulud figures** come from secondary reporting. npm's own post-mortem wasn't found.

---

## Implications for the framework

### Authoring model

| Option | Pros | Cons |
|---|---|---|
| A. MJML (package-1) | Best Outlook output; build time; mature; v5 stable | XML authoring, weak types, poor component DX, no shadcn-style story |
| B. React Email at runtime (package-2) | Best DX; typed props; big ecosystem | React on the hot path; can't serve KMP; Outlook patterns hand-made |
| **C. Hybrid: JSX components compiled at build time to precompiled artifacts** | JSX/TSX DX with typed props and shadcn-style components; output is static HTML/text with mustache-core placeholders; serves JS and KMP equally; runtime is tiny | Templates need a placeholder-aware authoring model (for example `<If>`/`<Each>`/`{v.name}` proxies that emit `{{…}}`); needs our own Outlook-safe primitives (or MJML underneath) |

**Recommendation: C.** Author in TSX with our own primitives. They can render to React Email-style
tables, or to MJML markup that we then compile, if Outlook fidelity demands it; prototype both and
compare in Outlook. Render once per locale at build time with typed placeholder proxies (as React
Email's `email export` does, but with first-class placeholders). Emit the artifact set in §3.4.
Keep an escape hatch: a template may opt in to runtime React rendering for JS-only consumers.

### Placeholder engine

**Recommendation: our own "mustache-core" dialect**: Mustache syntax, a strict subset (variables,
raw, sections, inverted sections, list iteration; no runtime partials or lambdas), with a
published conformance suite and identical escaping, implemented in TS (about 2 KB) and pure
Kotlin (commonMain). Handlebars is out: no KMP port, stricter escaping that can't be matched
byte-for-byte without reimplementing it, and a maintenance-only 4.x. Liquid is a fallback if
users need filters, but escaping is off by default and the spec is looser.

### Schema library

**Recommendation:** accept any **Standard Schema** (Zod 4, Valibot, ArkType) for TS-side
validation and inference. Prefer schemas that also implement **`StandardJSONSchemaV1`** (Zod 4.6
and ArkType 2.2 do natively), so the build can call `~standard.jsonSchema.input({ target:
"draft-2020-12" })` with no adapter. Fall back to a per-library converter for Valibot. Emit
`schema.json` per template from that. Generate Kotlin data classes from that
schema with a small built-in generator (quicktype as a fallback). Document Zod 4 as the default in
templates. The runtime core takes no schema dependency.

### Theme pipeline

**Recommendation:** input is DTCG JSON or CSS custom properties (light/dark). `postcss` +
`culori` resolve aliases and convert OKLCH to hex. Validate contrast. Emit a typed TS theme, a
`theme.json`, and the email CSS (inline values + dark `<style>` + `[data-ogsc]` rules from one
list, as in package-1). If Tailwind is offered, do it at build time with a px preset and
variable/OKLCH flattening (Maizzle 6's approach), never at runtime.

### Component distribution

**Recommendation: both.** Email-safe primitives through **npm** (fixes propagate). Blocks and
templates through a **shadcn-compatible registry** (`registry.json` + `shadcn build`, a namespace
such as `@<name>`), so `npx shadcn add @<name>/receipt` works, and the MCP server makes them
discoverable to AI assistants. GitHub registries (`owner/repo/item#v1.2.0`) give versioned
installs with no hosting. Our own `<name> add` can wrap the same registry JSON for users without
`components.json`. Author every component clean-room and keep a provenance note per item: the
emailcn takedown shows the legal risk of porting existing kits.

### Preview-studio architecture

**Recommendation:** a Vite-based local app (`<name> dev`) that consumes the **same build pipeline
and check engine** as `build`/`check`, so the preview never diverges from the artifact. It renders
artifacts with fixtures through the mustache-core renderer, not live React. It is a static build
for export. Ship the must-have list in §6.2. Don't fork React Email's preview: its model is
"render React per request", which is the opposite of ours.

### CLI stack

**Recommendation:** `cac` or `citty` + `@clack/prompts` + `jiti` (or `c12` once 4.0 is stable)
for `defineConfig` + chokidar (or the Vite watcher) + `html-validate`/`parse5` for checks +
JSON/GitHub reporters + a `doctor` command. Commands: `init`, `new`, `add`, `build`, `check`,
`dev`, `export`, `send-test`, `doctor`, `migrate`.

### Packaging

**Recommendation:** ESM-only, `exports` with `types`, subpaths (`/send`, `/testing`, transports
as separate packages), `sideEffects: false`, built with **tsdown**, gated by **publint** + **attw**
in CI. Use pnpm workspaces + Turborepo + Changesets. **npm trusted publishing** from GitHub
Actions (no tokens), provenance on, no install scripts, minimal runtime dependencies (target
zero), `engines.node >=22.12`, CI on Node 22/24/26.

---

## Sources

All accessed 2026-10-27.

| URL | Title |
|---|---|
| https://www.npmjs.com (via `npm view <pkg> time --json`) | npm registry metadata for every package version and date in this document |
| https://resend.com/blog/react-email-6 | React Email 6.0 (Resend blog, 2026-04-17) |
| https://resend.com/blog/react-email-5 | React Email 5.0 (Resend blog, 2025-11-07) |
| https://react.email/docs/llms.txt | React Email docs index |
| https://react.email/docs/cli.md | React Email CLI (`email dev`, `build`, `start`, `export`, `resend setup`) |
| https://react.email/docs/utilities/render.md | React Email `render`, `pretty`, `toPlainText` |
| https://react.email/docs/components/tailwind.md | React Email Tailwind component and limitations |
| https://react.email/docs/getting-started/updating-react-email.md | Updating React Email (5 → 6, 4 → 5) |
| https://react.email/docs/changelog.md | React Email changelog |
| https://react.email/docs/roadmap.md | React Email roadmap |
| https://newreleases.io/project/npm/mjml/release/5.4.0 | MJML 5.4.0 release notes |
| https://newreleases.io/project/npm/mjml/release/5.2.0 | MJML 5.2.0 release notes |
| https://newreleases.io/project/npm/mjml/release/5.1.0 | MJML 5.1.0 release notes |
| https://github.com/mjmlio/mjml/releases/tag/v5.0.0 | MJML v5.0.0 release notes (breaking changes) |
| https://maizzle.com/docs/introduction | Maizzle docs: introduction (v6) |
| https://unpkg.com/@maizzle/framework@6.3.0/README.md | `@maizzle/framework` 6.3.0 README |
| https://newreleases.io/project/github/maizzle/framework/release/v6.0.7 | Maizzle v6.0.x release notes |
| https://resend.com/blog/react-email-4 | React Email 4.0 (toolbar: linter, spam, compatibility, responsive) |
| https://jsx.email/docs/introduction | jsx-email introduction |
| https://github.com/hteumeuleu/caniemail | caniemail repo (data, MIT) |
| https://github.com/shellscape/caniemail | `caniemail` npm package source |
| https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ | Design Tokens specification reaches first stable version |
| https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/ | Design Tokens Format Module 2025.10 |
| https://github.com/mustache/spec | Mustache spec |
| https://github.com/nminet/kostache | kostache: Kotlin Multiplatform Mustache |
| https://github.com/L-Briand/KTM | KTM: Mustache in Kotlin Multiplatform |
| https://github.com/pwall567/mustache-k | mustache-k (Kotlin/JVM) |
| https://github.com/jknack/handlebars.java | handlebars.java |
| https://github.com/bkiers/Liqp | Liqp (Liquid for the JVM) |
| https://docs.korge.org/templates/ | KorGE templates (KorTE) |
| https://zod.dev/json-schema | Zod 4: JSON Schema |
| https://standardschema.dev/ | Standard Schema (incl. Standard JSON Schema) |
| https://github.com/standard-schema/standard-schema | Standard Schema repo (`StandardJSONSchemaV1`) |
| https://github.com/glideapps/quicktype | quicktype (Kotlin `--framework kotlinx`, checked in `quicktype-core` 26.0.0) |
| https://developers.cloudflare.com/workers/platform/limits/ | Cloudflare Workers limits |
| https://ui.shadcn.com/docs/registry | shadcn registry introduction |
| https://ui.shadcn.com/docs/registry/registry-item-json | shadcn `registry-item.json` schema |
| https://ui.shadcn.com/docs/registry/github | shadcn GitHub registries |
| https://ui.shadcn.com/docs/changelog | shadcn changelog (2025–2026) |
| https://github.com/shadcn-labs/emailcn | emailcn (HTTP 451 on 2026-10-27) |
| https://github.com/github/dmca/blob/master/2026/10/2026-10-14-mailviews.md | DMCA notice: Mailviews (Maizzle OÜ) against emailcn |
| https://github.com/ingram-technologies/registry | Ingram Technologies email registry |
| https://shadcnexamples.com/email-templates | shadcn examples: email templates |
| https://x.com/shadcn/status/1833231547920789927 | shadcn on React Email templates as registry blocks (2024) |
| https://github.com/egoist/tsup | tsup README and v9.0.0 release |
| https://github.com/paulmillr/chokidar/releases | chokidar v5 and v6 release notes |
| https://raw.githubusercontent.com/nodejs/Release/main/schedule.json | Node.js release schedule |
| https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/ | npm trusted publishing with OIDC is GA |
| https://docs.npmjs.com/trusted-publishers | npm docs: trusted publishers |
| https://github.blog/changelog/2026-02-18-npm-bulk-trusted-publishing-config-and-script-security-now-generally-available/ | npm bulk trusted publishing config and script security GA |
| https://github.blog/changelog/2026-04-06-npm-trusted-publishing-now-supports-circleci/ | npm trusted publishing supports CircleCI |
| https://github.blog/changelog/2026-09-03-multiple-trusted-publishing-configurations-for-npm | Multiple trusted publishing configurations |
| https://github.blog/changelog/2026-09-30-opt-in-dist-tag-permissions-for-npm-trusted-publishing | Opt-in dist-tag permissions |
| https://www.theregister.com/2025/11/24/shai_hulud_npm_worm/ | Shai-Hulud worm returns (The Register) |
| https://www.infoworld.com/article/4095604/new-shai-hulud-worm-spreading-through-npm-github-2.html | New Shai-Hulud worm spreading (InfoWorld) |
| https://mailpit.axllent.org/docs/ | Mailpit docs |
| https://docs.litmus.com/instant | Litmus Instant API |
| https://api.emailonacid.com/docs/v5 | Email on Acid API v5 |
| https://help.mailgun.com/hc/en-us/articles/43568687796763-Email-on-Acid-to-Mailgun-Inspect-API-Migration-Plan | Email on Acid to Mailgun Inspect API migration |
| Local test, 2026-10-27 | Escaping comparison: `mustache` 4.2.0, `handlebars` 4.7.10, `liquidjs` 10.30.0 run in Node |
