# email-kit backlog

Every requirement in [prd.md](prd.md) maps to at least one task here, and every check id in PRD
Appendix A has its own task. Tasks are grouped by phase and milestone in rough build order.

**Columns:** **ID** (P0-, P1-, P2-, P4-, P3-, L- by phase) · **Task** · **Reqs** (PRD ids) ·
**Pri** (MUST/SHOULD/MAY, from the PRD) · **Dep** (tasks that must finish first) · **Done
when** (acceptance).

**Definition of done for every task:**
- the code is merged with tests (unit tests, plus type tests where types change);
- the docs are updated;
- a changeset is added if published output changes;
- CI is green on Node 22, 24 and 26 and on Linux, macOS and Windows.

**Status (2026-10-30):**
- **P0-01 done.** The monorepo foundation is in place.
- **P0-07 done (draft).** Spec in `docs/spec/mustache-core.md`, the TS reference renderer in
  `packages/dialect` (internal) and a 142-case seed suite in `conformance/mustache-core/`.
- **P0-03 and P0-11 done.** Prototype compiler in `@email-kit/core` and `@email-kit/cli`; rolldown
  recommended as the transform. Findings in `docs/spikes/`.
- **P0-10 done.** Schema reader and portability check in `@email-kit/cli`; findings in
  `docs/spikes/p0-10-schema.md` (one decision open: refinements).
- **P0-09 done.** Recommendation: no HTML inliner by default (inline styles at the IR level);
  juice with `data-embed` if stylesheets are ever authored. `docs/spikes/p0-09-css-inliner.md`.
- **P0-08 done.** ADR 0004 proposed (`docs/adr/0004-import-alias-strategy.md`), backed by real
  tsc 5.9 / 7.0, tsx and Node runs in `spikes/import-alias/`.
- **P0-05 done.** Init rules confirmed across `jsx` unset, Hono, Next.js `preserve`/`react-jsx`,
  classic and node10; core gained `typesVersions` for node10. `docs/spikes/p0-05-jsx-pragma.md`.
- **P0-06 done; P0-12 partly.** ADRs 0003 (plurals), 0004 (aliases) and 0005 (no inliner)
  accepted on 2026-10-30; 0002 and 0006 proposed; 0001 waits for P0-04. Refinements: allowed as
  TS-only checks.
- **M1.1 started (2026-10-30): `email-kit compile` works end to end.** Done or partly done:
  P1-004/005/006 (config load and validation; loaded with the rolldown loader, not jiti), P1-050/051
  (the renderer passes the suite), P1-055, P1-070 (manifest without a signature), P1-071/072/073,
  P1-074 (generated `index.ts`, checked under the strictest host settings on TS 5.9 and 7.0),
  P1-076 (`module: "mjs"` writes `index.mjs` + `index.d.mts`; a tsc-built ESM and CommonJS backend
  imports it through `#email-kit`), P1-078, P1-079, P1-085, P1-087 (with `--watch`), P1-090,
  P1-061 (the research 01 §2 skeleton; `aria-roledescription` waits for localised layout messages),
  P1-064, P1-065 (preheader element, filler, first line of the text part), P1-088 (error output:
  `file:line:col [id]`, code frames mapped through the bundle's source map, docs links into
  `docs/errors.md`, which a test keeps complete), P1-008 and P1-053 (platform values: constants
  written into the output, `{ runtime: true }` keys passed to `createEmails()`; data can't override
  or shadow them), P1-075 (`perTemplateEntries: true` writes a self-contained module per template;
  a Worker bundle that imports one has only that template), P1-089 (`--help`, `--version`,
  `NO_COLOR`, `--quiet`, `--verbose`), P1-077 (runtime validator generated from the schema model,
  on by default with `validate: false` to turn it off; `validate(data)` always available) and the
  `https` part of P1-054. PRD Q5 (validator on by default?) is answered "on" pending the
  maintainer's confirmation.
  **M1.1 remaining:** P1-063 (layout shell, waits for ADR 0001 / P0-04) and the rest of the
  milestone's SHOULDs (P1-091 incremental compile).
  Fixture project with committed output in `packages/cli/test/fixtures/project/`.
- **M1.2 started: the colour core** (`packages/cli/src/theme/`). P1-103 (CSS Color 4 gamut mapping,
  8-bit alpha flattening over the real surface, hex; the research 05 reference values are tests),
  P1-102 in part (shadcn CSS: `:root`/`.dark`, `@layer base`, `var()` chains, bare HSL),
  P1-104 (the THM-04 roles with the §12.5 shadcn mapping and status defaults), P1-111 (muted ink
  moved to the nearest passing lightness: shadcn's #737373 is 4.35:1 on its own page ground),
  and the colour checks of P1-110. Then: P1-100 (`theme` config, checked names with suggestions),
  P1-102 (DTCG token files per mode, inline variables, and resolver files: sets, modifiers,
  `resolutionOrder`, `$ref` to pointers, files and file pointers, extending, inline entries, the
  spec's required errors; the modifier with `light`/`dark` contexts gives the modes and
  `theme.input` picks the rest; every other permutation is checked too, for P1-110),
  P1-105/106 and the button/OTP part of P1-107, P1-108 (`dark: authored | none`), the rest of the
  P1-110 checks (font stacks, weights, sizes, button height, container, radius), P1-112
  (`theme.emit` → `theme.json`) and P1-114 (`email-kit tokens`). The built-in default theme is shadcn
  neutral adjusted for email, with no findings.
- **First components** (in progress): templates see the theme through `useTheme()`, and colours are
  `role("ink")`. The JSX runtime writes the light value inline and tags the element with a role
  class (`ek-c--ink`). From those classes the document writes the dark CSS: one rule list as
  `@media (prefers-color-scheme: dark)` plus `[data-ogsc]`/`[data-ogsb]` twins, only for the roles
  used, with the colour-scheme signals only when there are rules (P1-113, partial: no `light only`
  opt-in and no `dark.*` checks yet). `Conditional` (P1-141, `mso.conditional-pairs` not written
  yet), `Text`, `Heading`, `Link`, `Button` (no VML, `showUrl` or text form yet), `Divider`,
  `Spacer` and `Section` exist (P1-124/126–129/132/133, partial). `EmailRoot`, `Layout` and
  `Row/Column` wait on ADR 0001; the lint banning literal values (P1-120) is still to do.
- Then `List`/`ListItem` (P1-134; Outlook margins unverified until P0-04), `KeyValue` (P1-135,
  inline and stacked, `copyable`; text part `Label: value`), `OtpCode` (P1-138, the code once and
  contiguous in each part) and `Callout` (P1-139; icons wait for `Image`). Components space
  themselves with cell padding, never margins (research 01 §10), and the document wrapper paints
  the canvas and ink inline so unstyled text has a ground the dark CSS restyles (research 02 D1,
  D3). The text part numbers `<ol>` items known at compile time. The `dark.*`, `copy.code-once`
  and `auth.code-format` checks need the check engine (M1.4, P1-140/165); the output is built to
  pass them and tests pin that.
- Then `Image` (P1-130: `kind` decides the alt rules, integer dimensions, fluid option, styled
  alt; literal `src` must be an `https:` PNG, JPEG or GIF; no WebP/AVIF opt-in yet), `DataTable`
  (P1-136: caption, `th scope`, ≥ 2 columns, end alignment on the physical side for the locale's
  direction, `Label: value` text form; **no stacking below 320 px yet**, it needs component head
  CSS) and `LineItems` (P1-137: a `DataTable` preset with a `<tfoot>` summary; `optionalRow()` for
  optional amounts). **Open:** `copy.receipt.reconciles` needs numeric amounts beside the
  formatted strings UI-18 asks for; to settle with the check engine. Components read the
  direction with `useDirection()`. The text part uses an image's alt text.
- **Phase 0 remaining:** P0-04 (needs real email clients), accepting ADRs 0002 and 0006, and
  P0-02 (publishing needs the maintainer's accounts).
- **P0-02 prepared.** The placeholder packages and the release workflow are ready. Publishing and
  creating the repos need the maintainer's accounts: see `docs/setup/reserve-names.md`.
- All other tasks are `todo`.

---

## Phase 0: Foundations and spikes

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P0-01 | Set up the repo: pnpm workspaces, Turborepo, Changesets, tsdown, Vitest, Biome/ESLint, `.editorconfig` (LF), GitHub Actions skeleton, CODEOWNERS | SPK-09 | MUST | — | `pnpm build test lint` passes in CI on the 3 operating systems |
| P0-02 | Reserve names: placeholder `create-email-kit` and `@email-kit/{cli,core,components}`; GitHub repos `email-kit/email-kit` and `email-kit/registry`; configure npm trusted publishing | SPK-10 | MUST | P0-01 | All names owned; a dry-run publish works through OIDC |
| P0-03 | Prototype the JSX → IR → placeholder compiler (scalar, `<Each>`, `<If>`, attribute placeholder, one i18n string) | SPK-01 | MUST | P0-01 | The prototype emits HTML and text with mustache-core placeholders that render correctly with sample data |
| P0-04 | Outlook fidelity spike: own table primitives versus MJML-underneath for one layout; test in classic Outlook 100/125%, new Outlook, Gmail and Apple Mail | SPK-02 | MUST | P0-03 | Screenshots compared; ADR picks the primitive strategy |
| P0-05 | JSX pragma spike in host setups (`jsx` unset plus one line, `react-jsx` + `hono/jsx`, Next.js `preserve`, `tsc --noEmit`) | SPK-03 | MUST | P0-03 | A matrix of results recorded; the init rules confirmed or changed |
| P0-06 | Runtime plurals ADR (caller category, spec'd CLDR function, or caller phrase) | SPK-04 | MUST | — | ADR merged, with the chosen API sketch |
| P0-07 | Draft the mustache-core spec v1, the escaping table, the TS reference renderer and the seed conformance suite | SPK-05 | MUST | — | Spec doc and ≥ 50 conformance cases pass on the reference renderer |
| P0-08 | Alias strategy ADR for `tsc`-built and Node type-stripping projects (`#email-kit` source/compiled mapping, `tsc-alias`, relative) | SPK-06 | MUST | — | ADR with tested `package.json` `imports` examples |
| P0-09 | CSS inliner benchmark (`juice` versus `@css-inline/css-inline`): correctness on MSO/VML, speed, size | SPK-07 | MUST | — | ADR picks one |
| P0-10 | Standard Schema → JSON Schema spike across Zod 4, ArkType and Valibot; prototype a portable-subset validator | SPK-08 | MUST | — | All three emit draft 2020-12; non-portable constructs detected |
| P0-11 | JSX transform choice (esbuild, oxc or swc), independent of the host tsconfig | SPK-11 | MUST | P0-03 | ADR; transform compiles templates with the pragma |
| P0-12 | Write and merge the phase-0 ADRs: primitives, dialect, plurals, alias, inliner, cli/core package split | SPK-12 | MUST | P0-04…P0-11 | 6 ADRs merged under `docs/adr/` |

---

## Phase 1: Compiler MVP → v1.0

### M1.1 Core compile path (v0.1)

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-001 | Create the package skeletons `@email-kit/cli` (bin `email-kit`), `@email-kit/core` and `@email-kit/components`, ESM-only with `exports`/`types` | PKG-01, PKG-03 | MUST | P0-12 | `publint` and `attw --profile esm-only` pass; `npx email-kit --help` runs |
| P1-002 | Gate the build with tsdown + publint + attw in CI | PKG-04 | MUST | P1-001 | CI fails on a broken `exports`/types |
| P1-003 | Wire Changesets versioning and changelogs for all packages | PKG-07 | MUST | P1-001 | A test changeset produces versions and a changelog |
| P1-004 | `defineConfig()` types and a jiti config loader with `--config` | CFG-01 | MUST | P1-001 | Typed config loads from a TS file in a temp project |
| P1-005 | Config paths: templates, messages, components, out (default `compiled`), fixtures | CFG-02 | MUST | P1-004 | Defaults and overrides resolved; relative to the config file |
| P1-006 | Config validation with path-specific readable errors | CFG-10 | MUST | P1-004 | Invalid configs produce one clear error each (tests) |
| P1-007 | Output options config: `ts` / `js+dts`, per-template entries, validator toggle | CFG-08 | MUST | P1-004 | The options reach the emitter (tests) |
| P1-008 | Platform values config (typed; compile-time constants and runtime-context keys) and the injection order (after data) | CFG-07 | MUST | P1-004 | Data can't override platform values (tests) |
| P1-009 | Category model: project-defined category union in the config, typed in `defineEmail` | CFG-12 | MUST | P1-004 | An unknown category is a type error |
| P1-010 | `defineEmail()` API, generic over the schema | AUTH-01 | MUST | P1-001 | Type tests in P1-271 compile |
| P1-011 | Id grammar and uniqueness validation | AUTH-02 | MUST | P1-010 | A bad or duplicate id fails with a clear error |
| P1-012 | `purpose` (required), `category`, `requestedByRecipient`, `expiresAfterMs` and metadata emission | AUTH-03 | MUST | P1-010 | Fields appear typed in the manifest and the module |
| P1-013 | Standard Schema input; `secret` and `url` field markers (schema metadata) | AUTH-04 | MUST | P1-010, P0-10 | Zod 4 and ArkType schemas accepted; markers readable by the compiler |
| P1-014 | Subject and preheader functions compiled to placeholder templates | AUTH-05 | MUST | P1-030 | The subject template renders with fixture data |
| P1-015 | Fixtures: named cases, validation, auto-generated long, empty and hostile variants | AUTH-06 | MUST | P1-013 | Variants generated per schema; an invalid fixture fails the compile |
| P1-016 | Typed `data` proxy (scalars → placeholders; nested paths; arrays only in `Each`; optional/boolean only in `If`) | AUTH-07 | MUST | P1-030 | Type tests reject misuse |
| P1-017 | `<Each>`, `<If>`, `<Else>`, `<Unless>` control-flow components → sections and inverted sections | AUTH-08 | MUST | P1-030 | Output matches golden mustache-core |
| P1-018 | `<Raw>` escape hatch with an allow-list and a required reason; data always escaped | AUTH-10 | MUST | P1-030 | `<Raw>` without an allow-list entry fails |
| P1-019 | Type-level purpose rules: `marketing` needs an unsubscribe slot; `consent-request` needs a remove link and has no promo slots | AUTH-11 | MUST | P1-010 | Type tests prove the rules |
| P1-020 | Link helpers: site-URL based, tokens in the fragment; only `url` fields in `href`/`src` | AUTH-12 | MUST | P1-013 | Helper output tests; type error for a non-url field in `href` |
| P1-021 | User components support (`components/` folder, typed, primitives + roles) | AUTH-13 | MUST | P1-030 | An example custom component compiles and renders |
| P1-022 | Per-template overrides: hand-written text, dark strategy, layout variant | AUTH-14 | MUST | P1-040 | Each override changes the output as specified |
| P1-023 | Code-in-subject opt-in per secret field; never in the preheader | AUTH-15 | MUST | P1-013 | Without opt-in, a compile error; preheader always rejected |
| P1-024 | Send-layer metadata: `listUnsubscribe` field, threading hint, reply-to strategy | AUTH-16 | SHOULD | P1-012 | Present in the manifest and the module |
| P1-030 | Own JSX runtime (`@jsxImportSource @email-kit/core`) producing the IR | JSX-01 | MUST | P0-11 | Elements, fragments and components produce the IR |
| P1-031 | Pragma host-compatibility test suite (setups from SPK-03) | JSX-02 | MUST | P1-030, P0-05 | Automated fixtures pass in CI |
| P1-032 | CLI-owned TSX transform, independent of the host tsconfig | JSX-03 | MUST | P0-11 | Compile works in a project with no `jsx` setting |
| P1-033 | IR node types: element, text, placeholder, section, inverted, MSO conditional, html-only/text-only | JSX-04 | MUST | P1-030 | IR serialisation tests |
| P1-034 | Component contract: HTML renderer, text renderer, dark hooks at the colour-bearing element | JSX-05 | MUST | P1-033 | Contract enforced by types; an example component passes |
| P1-035 | Compile-time evaluation of everything not data-dependent | JSX-06 | MUST | P1-033 | Static branches don't appear in the output |
| P1-036 | Errors for unsupported data use (arithmetic, string methods, data-dependent styles, placeholder tag names) | JSX-07 | MUST | P1-016 | Each case gives a clear error with a code frame |
| P1-037 | Attribute placeholders with the correct escaping context; `url` fields only in `href`/`src` | JSX-08 | MUST | P1-033 | Escaping tests in attributes |
| P1-040 | Publish the mustache-core spec v1 (from P0-07) | DLG-01 | MUST | P0-07 | `docs/spec/mustache-core.md` merged |
| P1-041 | Escaping table spec and implementation | DLG-02 | MUST | P1-040 | Conformance cases for every escaped character |
| P1-042 | Missing-value behaviour (validate before render; renderer error, never a silent blank) | DLG-03 | MUST | P1-040 | Tests for missing values |
| P1-043 | Full conformance suite JSON including hostile values | DLG-04 | MUST | P1-040 | ≥ 200 cases, versioned |
| P1-044 | Verify compiled templates work with stock Mustache and Handlebars | DLG-05 | SHOULD | P1-043 | The suite runs against both engines; differences documented |
| P1-045 | Dialect version recorded in the manifest | DLG-06 | MUST | P1-070 | The manifest has `dialect: "mustache-core@1"` |
| P1-050 | TS renderer (about 2 KB, zero dependencies, web APIs only) | RUN-01 | MUST | P1-041 | Builds for Node, Bun, Deno and Workers |
| P1-051 | Renderer passes 100% of the conformance suite | RUN-02 | MUST | P1-043, P1-050 | CI job green |
| P1-052 | Renderer performance budgets (60-item receipt < 5 ms warm; cold import < 50 ms) | RUN-03 | MUST | P1-050 | Bench recorded under budget |
| P1-053 | Runtime context (`createEmails({ siteUrl, … })`), typed, merged after data | RUN-04 | MUST | P1-008, P1-050 | Data can't override context values (tests) |
| P1-054 | Render-time `url` validation when the validator is enabled | RUN-05 | MUST | P1-050, P1-073 | `javascript:` and disallowed hosts rejected |
| P1-055 | CR/LF never in the rendered subject | RUN-06 | MUST | P1-050 | Tests with injected newlines |
| P1-060 | Render template × locale from the IR to HTML | BLD-01 | MUST | P1-033 | A golden HTML snapshot exists for the example |
| P1-061 | Document skeleton (doctype, `html` attributes, meta set, title, DPI XML in MSO + `noscript`, head style, bare body, wrapper with `role`/`aria-label`/`lang`/`dir`) | BLD-02 | MUST | P1-060 | Skeleton matches research 01 §2 (snapshot + checks) |
| P1-062 | CSS pipeline: hex values, inline styles written from the IR (ADR 0005), enhancement-only `<style>`, safe serialiser, ≤ 16 KB | BLD-03 | MUST | P1-060, P0-09 | `css.*` checks pass on the output |
| P1-063 | Hybrid table layout shell with MSO ghost tables (classic target) | BLD-04 | MUST | P1-060, P0-04 | `layout.*` checks pass; Outlook screenshots match the spike |
| P1-064 | MSO font override, data-detector reset, `format-detection` | BLD-06 | MUST | P1-061 | Present in the output |
| P1-065 | Preheader element + filler; preheader text as the first line of the text part | BLD-07 | MUST | P1-061, P1-080 | `preheader.*` checks pass |
| P1-066 | Deterministic output (LF, stable ordering, no timestamps) | BLD-08 | MUST | P1-060 | Two compiles are byte-identical on 3 operating systems |
| P1-067 | Safe minification; MSO blocks preserved; lines ≤ 998 octets | BLD-09 | MUST | P1-062 | `minify.preserve-mso` and `size.line-length` pass |
| P1-068 | Void elements serialised without `/` | BLD-10 | MUST | P1-060 | Serialiser test |
| P1-069 | Absolute HTTPS image URLs from `assetsBaseUrl`; required width/height | BLD-11 | MUST | P1-060 | Relative `src` resolved; missing dimensions fail the compile |
| P1-070 | `manifest.json` (schemaVersion, version, dialect, escaping profile, signature, per-template meta, sizes, hashes) | OUT-03 | MUST | P1-060 | Schema-validated manifest emitted |
| P1-071 | Output layout `<root>/email-kit/compiled/` with `<id>/<locale>.html/.txt` and `schema.json` | OUT-01 | MUST | P1-060 | The layout matches the PRD |
| P1-072 | Do-not-edit headers; delete only owned files | OUT-02 | MUST | P1-071 | Unowned files survive recompiles |
| P1-073 | `schema.json` per template (JSON Schema 2020-12) | OUT-04 | MUST | P1-013 | Emitted for the examples; validates the fixtures |
| P1-074 | Generated self-contained `index.ts` (types from schema, unions, `emails` object, raw strings, `meta`, inlined renderer) | OUT-05 | MUST | P1-050, P1-073 | Imported in a TS project with zero dependencies; type tests pass |
| P1-075 | Per-template entry points for tree-shaking | OUT-06 | SHOULD | P1-074 | A Worker bundle that imports one template has only that template |
| P1-076 | `.mjs` + `.d.mts` emission (ADR 0004 default for `tsc` hosts) | OUT-07 | MUST | P1-074 | A `tsc`-built ESM and CommonJS project imports it through `#email-kit` |
| P1-077 | Optional dependency-free runtime validator from JSON Schema | OUT-08 | SHOULD | P1-073 | Invalid data rejected with field paths |
| P1-078 | Locale fallback at render time (BCP 47 lookup) | OUT-09 | MUST | P1-074 | `pt-BR` → `pt` → default (tests) |
| P1-079 | `render()` returns `{ subject, preheader, html, text, meta }` | OUT-10 | MUST | P1-074 | Return type and values tested |
| P1-080 | Plain-text renderer from the component tree | TXT-01 | MUST | P1-034 | Example text output matches the golden file |
| P1-081 | Hand-written text override support, linted | TXT-02 | MUST | P1-080 | An override replaces the generated text; `text.*` checks run on it |
| P1-082 | Text formatting rules (78-column wrap with URLs exempt, heading underlines, lists, `Label: value`, `Label: <URL>`, no entities, codes unbroken) | TXT-03 | MUST | P1-080 | `text.*` checks pass on the examples |
| P1-083 | Unescaped values in the text part | TXT-04 | MUST | P1-080 | A query-string URL survives verbatim |
| P1-084 | Bidi isolation (FSI/PDI) for user values in the text part | TXT-05 | SHOULD | P1-080 | RTL fixture test |
| P1-085 | Deterministic identifier derivation with reserved-word escaping and collision detection | OUT-11 | MUST | P1-074 | `output.identifiers` passes; collision error test |
| P1-086 | Stable-diff output formatting | OUT-12 | MUST | P1-074 | Snapshot diffs are minimal on one-line template edits |
| P1-087 | `email-kit compile [--watch]` command (summary output; owns only its files) | CLI-01, CLI-03, BLD-12 | MUST | P1-071 | A temp project compiles; watch recompiles on change |
| P1-088 | Error formatting: id, `file:line:col`, why, fix, docs URL, code frames | CLI-06 | MUST | P1-087 | Snapshot tests of error output |
| P1-089 | `--help`, `--version`, `NO_COLOR`, `--quiet`/`--verbose` | CLI-07 | MUST | P1-087 | CLI tests |
| P1-090 | Argument parsing (`cac`/`citty`) and prompts (`@clack/prompts`) | CLI-08 | SHOULD | P1-001 | Used by every command |
| P1-091 | Incremental compile (affected templates and locales only) | BLD-13 | SHOULD | P1-087 | Editing one template recompiles one template |
| P1-092 | Style-stripped variant rendering for checks and the studio | BLD-14 | MUST | P1-062 | Variant available through the API |
| P1-093 | RTL support: physical alignment, mirrored padding, column reversal, LTR islands | BLD-15 | MUST | P1-063 | RTL snapshot test (`ar` pseudo-locale) |

### M1.2 Theme and components (v0.2)

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-100 | Theme config surface (source, role overrides, type scale, spacing, radius, layout, dark strategy) | CFG-04 | MUST | P1-004 | Typed config validated |
| P1-101 | Targets config (`outlookClassic`, tiers, default dark strategy) | CFG-05 | MUST | P1-004 | Options reach the compiler and checks |
| P1-102 | Theme inputs: DTCG 2025.10 + resolver modifiers, shadcn CSS (`:root`/`.dark`/`@theme inline`), TS object | THM-01 | MUST | P1-100 | All three produce the same internal model (tests) |
| P1-103 | Colour conversion: CSS Color 4 gamut mapping → 6-digit hex; DTCG `hex` fallback; alpha flattening on the surface | THM-03 | MUST | P1-102 | Reference conversions match (for example the shadcn neutral defaults from research 05 §12.4) |
| P1-104 | Semantic roles model with documented defaults and shadcn mapping | THM-04 | MUST | P1-102 | Default shadcn theme maps to every role |
| P1-105 | Typography model (scale steps; px size and line height; 400/700; px letter-spacing; stacks with generic + MSO fallback; per-script) | THM-05 | MUST | P1-102 | Typed theme; `tokens.font-stack` passes |
| P1-106 | Spacing, radius (shadcn multipliers → px), border widths, layout tokens | THM-06 | MUST | P1-102 | Values resolved to px |
| P1-107 | Component tokens (buttons, link, card, callouts, badges, OTP, table, footer) | THM-07 | MUST | P1-104 | Components read only component and semantic tokens |
| P1-108 | Dark strategy (`authored`/`none`), derived and validated dark overrides, `light-only` per template | THM-08 | MUST | P1-104 | Dark palette generated; checks run per mode |
| P1-109 | Theme assets (logo light/dark 2× PNG, alt, wordmark, tile, icons) | THM-09 | SHOULD | P1-102 | Used by `Logo` |
| P1-110 | Validation on every resolved permutation (runs the `tokens.*` checks) | THM-10 | MUST | P1-140 | Every permutation validated on compile |
| P1-111 | `mutedInk` auto-adjust to the nearest passing lightness, with an explanation | THM-11 | SHOULD | P1-104 | A default shadcn theme passes after adjustment; the message explains it |
| P1-112 | Emit `theme.json` and a typed theme (optional) | THM-12 | SHOULD | P1-104 | Files emitted when enabled |
| P1-113 | Dark CSS generation from one rule list (`prefers-color-scheme` + `[data-ogsc]`/`[data-ogsb]` twins at colour-bearing elements; colour-scheme meta per strategy; `light only` opt-in) | BLD-05 | MUST | P1-108, P1-061 | `dark.*` checks pass |
| P1-114 | `email-kit tokens` command (palette per mode or permutation with contrast ratios) | CLI-09 | SHOULD | P1-110 | Prints the table; exit 1 on errors |
| P1-120 | Component package conventions (shadcn vocabulary; props typed from the theme; token names only) | UI-01 | MUST | P1-034, P1-107 | Lint rule bans literal values in components |
| P1-121 | `EmailRoot` | UI-02 | MUST | P1-120, P1-061 | Emits the skeleton; tests |
| P1-122 | `Preheader` | UI-03 | MUST | P1-120 | `preheader.*` checks pass |
| P1-123 | `Layout` (single shell; footer slots per purpose) | UI-04 | MUST | P1-120, P1-019 | A missing slot is a type and check error |
| P1-124 | `Container` / `Section` | UI-05 | MUST | P1-120 | Padding-only spacing; snapshot |
| P1-125 | `Row` / `Column` (1–3 columns, stacking, RTL reversal, ghost tables) | UI-06 | MUST | P1-120, P1-063 | Stacks without `<style>`; Outlook snapshot |
| P1-126 | `Heading` | UI-07 | MUST | P1-120 | One h1 enforced by a check |
| P1-127 | `Text` | UI-08 | MUST | P1-120 | px line height + MSO rule present |
| P1-128 | `Link` | UI-09 | MUST | P1-120, P1-020 | Underlined; url-only `href` |
| P1-129 | `Button` (variants, sizes, full width, MSO padding, optional VML with a warning, `showUrl`, text form) | UI-10 | MUST | P1-120 | `button.*` checks pass; Outlook snapshot |
| P1-130 | `Image` (`alt` + `kind`, dimensions, fluid, format gate) | UI-11 | MUST | P1-120 | `img.*` checks pass |
| P1-131 | `Logo` / `Wordmark` (text default; image variants with dark handling) | UI-12 | MUST | P1-120, P1-109 | `tokens.logo-dark` passes |
| P1-132 | `Divider` | UI-13 | MUST | P1-120 | 1 px filled cell |
| P1-133 | `Spacer` | UI-14 | MUST | P1-120 | Explicit height and line height |
| P1-134 | `List` | UI-15 | MUST | P1-120 | Real `ul`/`ol`; Outlook-safe margins |
| P1-135 | `KeyValue` | UI-16 | MUST | P1-120 | Stacks on mobile; text form `Label: value` |
| P1-136 | `DataTable` | UI-17 | MUST | P1-120 | `a11y.data-table` passes; stacks below 320 px |
| P1-137 | `LineItems` / `Receipt` (with a dev reconciliation assertion) | UI-18 | MUST | P1-135 | `copy.receipt-reconciles` passes on the fixture |
| P1-138 | `OtpCode` (contiguous text in a sentence; letter-spacing; one copy) | UI-19 | MUST | P1-120 | `auth.code-format` passes |
| P1-139 | `Callout` | UI-20 | MUST | P1-120 | `a11y.colour-only` passes |
| P1-144 | `Footer` (slots per purpose; explicit unsubscribe wording) | UI-21 | MUST | P1-123 | `legal.*` slot checks pass |
| P1-141 | `Conditional` (`mso`, `notMso`, `textOnly`, `htmlOnly`) | UI-22 | MUST | P1-033 | `mso.conditional-pairs` passes |
| P1-142 | `Header` | UI-23 | SHOULD | P1-131 | No navigation in transactional mail |
| P1-143 | Component provenance record (clean-room note per component) | PKG-08 | MUST | P1-120 | `PROVENANCE.md` lists every component |

### M1.3 i18n (v0.3)

**Status (first slice):** **P1-156** plurals per ADR 0003, and `select`: messages are parsed as
ICU MessageFormat 1 (arguments, `plural` with categories and `=N`, `select`, `#`, apostrophe
quoting; `number`/`date` and plural offsets refused with advice). CLDR 47 plural rules from
`cldr-core` are compiled into one function per locale, cross-checked against `Intl.PluralRules`
for every locale, embedded in the generated module and recorded in the manifest (`cldr`). A
plural over a field compiles to `_ek.plural.<field>.<category>` sections (exact matches first);
a select over an enum field to `_ek.select.<field>.<key>` sections. The generated `render()`
prepares those keys on every object, inheriting parents' entries so lists see outer fields
(spec §15). Compile errors: a missing or impossible category (ADR 0003: every category the
locale uses is required), `other` missing, a plural over a non-number, a select over a free
string or with a case that isn't a value. Literal numbers and strings resolve at compile time.
Not yet: conformance cases for `(locale, n) → category` (the test cross-checks Intl instead),
`selectordinal`, and the i18n.* checks as check-engine findings.

**P1-159** typed `t()`: compile writes `messages.d.ts`, augmenting core's `MessageRegistry`
with each template's keys and parameters from the default locale (a plural takes a number, a
select a string, a plain argument any message value). `defineEmail` infers the id as a literal
and types `t` from it; a template not compiled yet keeps an untyped `t`. Verified on TS 5.9 and
7 through the bundled declarations, by type tests, and in the Next.js example.

**P1-154** locale fallback, and the fallback part of **P1-150**: `render({ locale })` resolves by
RFC 4647 lookup over CLDR 47 parents (`es-AR` → `es-419`, `pt-AO` → `pt-PT`, `en-AU` → `en-001`),
inserting the script a region implies (`zh-TW` → `zh-Hant-TW`, so it never lands on Simplified
`zh`) and stopping at an unusual script (`sr-Latn` ↛ `sr`). `locales.fallback` (`{ pt: "pt-BR" }`)
overrides CLDR's parents; targets must be compiled locales. The module embeds only its languages'
CLDR data (spec §16). Messages don't inherit: every compiled locale still has every key (I18N-03).

**P1-155** pseudo-locales, and the toggle part of **P1-150**: `en-XA` (accented, bracketed, padded
by length: ×3 up to 10 characters down to ×1.3 over 70, research 05 ⚠5) and `ar-XB` (right-to-left
override, compiled `dir="rtl"`), generated from the default locale's messages by transforming only
literal ICU text; plurals gain the pseudo-locale's categories from `other`. `email-kit check`
builds both in memory: the template checks run on them and report only what the real locales
don't (`i18n.expansion` for a template that doesn't compile there). `locales.pseudo` ships them.
Not yet: `i18n.expansion-render` (clipping, button lines; phase 2) and the other `i18n.*` checks.

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-150 | Locale config (default, list, fallback chain, pseudo-locale toggles) | CFG-03 | MUST | P1-004 | Typed and validated |
| P1-151 | Messages loader: `messages/<locale>/<template>.json` + `layout` namespace; ICU MF1 behind an MF2-ready abstraction | I18N-01 | MUST | P1-150 | Messages resolved for the example templates |
| P1-152 | Compile-time resolution; one artifact per template × locale | I18N-02 | MUST | P1-151, P1-060 | `<id>/<locale>.*` emitted for every locale |
| P1-153 | Missing key in any locale or slot = compile error | I18N-03 | MUST | P1-152 | Error lists the locale, key and slot |
| P1-154 | Locale fallback chain (RFC 4647, CLDR parents) | I18N-04 | MUST | P1-150 | Lookup tests |
| P1-155 | Pseudo-locales: length-scaled accented bracketed (`en-XA`) and RTL (`ar-XB`) | I18N-05 | MUST | P1-152 | Generated in checks and the studio; not shipped by default |
| P1-156 | Runtime plurals implementation per the ADR, with plural-category validation | I18N-06 | MUST | P0-06, P1-152 | Plural fixtures render correctly in `en`, `si` and `ar` |
| P1-157 | `format` hints in schemas for caller-formatted values; docs recipes | I18N-07 | MUST | P1-013 | Hints in `schema.json`; recipes page |
| P1-158 | CJK and Thai font stacks per script; line-height adjustment | I18N-08 | SHOULD | P1-105 | `ja` example renders with the script stack |
| P1-159 | Typed `t()` keys and ICU parameters from the default locale (generated declarations) | AUTH-09 | MUST | P1-151 | Type tests reject a wrong key or a missing parameter |

### M1.4 Check engine and catalogue (v0.4)

**Status (first slice):** `email-kit check [--json] [--reporter human|json|github]` compiles in
memory (nothing written) and runs the engine (P1-140) over every template × locale and the theme.
Findings have the CHK-04 shape (P1-162) with `file:line:col` in the compiled file and a docs
link; per-id `checks` config with a required reason and did-you-mean ids (P1-160); human, JSON
(version 1) and GitHub reporters (P1-161); exit 1 on errors only (P1-169). The parser
(P1-165) is htmlparser2 with offsets plus postcss, and parses the HTML inside `[if mso]`
comments. `docs/checks.md` is generated from the catalogue and kept current by a test (P1-168).
MSO checks run only for a classic Outlook target (part of P1-163). Implemented so far: the 17
`tokens.*` ids, `html.doctype`, `html.lang-dir`, `html.title`, `html.xmlns`,
`html.no-forms-embeds`, `html.no-body-style`, `html.data-detectors`, `html.mso-font`,
`html.dpi-noscript`, `css.no-double-brace`, `css.important-lowercase`, `css.no-nesting`,
`css.no-modern-colour`, `css.no-custom-props`, `css.style-size`, `img.alt`, `img.dimensions`,
`img.https`, `img.format`, `img.fluid-width`, `dark.scheme-declared`, `dark.ogsc-twin`,
`dark.light-only-css-twin`, `dark.no-blend-hack`, `a11y.layout-table-role`, `a11y.data-table`.
Each passes on the fixture's real output and fires alone when its rule is broken. Not yet: the
fixture sweep (P1-164; data-driven values are skipped), custom checks (P1-166), the rest of the
catalogue.

**Second slice:** source checks over the project's own files that templates bundle (templates and
user components; packages aren't scanned), parsed with rolldown's oxc parser (`rolldown/parseAst`,
no new dependency): `source.no-literal-colour` (hex, colour functions and CSS named colours in
style objects and colour attributes), `source.no-font-family`, `source.no-font-size` (0 and 1px
allowed for spacer cells) and `source.fixture-exists`. Style objects are found through JSX
`style`, spreads, conditionals and same-file constants, so data such as a fixture's colour name
isn't flagged. email-kit's own components pass them, which closes **P1-120**'s lint.

**Third slice:** **P1-015** fixtures are validated against the schema on compile
(`invalid-fixture`, every issue with its path), and empty, long and hostile variants are
generated from the schema's model starting from the first fixture, within its constraints
(min/max length, enums, max items, nullable, optional; patterns keep the fixture's value; a
variant the schema still rejects is dropped). **P1-164** the fixture sweep renders every template
× locale with each fixture and variant through the dialect runtime the generated module uses
(`@email-kit/dialect/module`); checks declare `on: template | render | both`, render findings name
the fixture, and duplicates collapse to the template finding with its line. New render checks:
`size.gmail` (largest render + 5 KB vs the 102 KB clip) and `copy.placeholder-fallbacks`. The
data-dependent `img.alt`, `img.https`, `img.format` and `html.no-forms-embeds` also run on renders.
The fixture project's schema now requires non-empty `customerName` and `orderNumber`: the sweep
found "Thanks, !" in its empty variant.

**Fourth slice:** **P1-166** team checks: `defineCheck({ id, level, rule, fix, docs?, on?, run })`
in `customChecks`, over a plain-data context (`CheckEmail` with `elements(name?)`), validated
(own family, unique, required fields), configurable through `checks`, shown in every reporter, and
`check-failed` when one throws. `examples/playground` (three templates, en/de, a shadcn theme,
a team check and a browser preview) is the project for trying everything by hand.

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-140 | Check engine core (context over output, sources, theme, messages and fixtures), shared by the CLI, the studio and CI | CHK-01 | MUST | P1-074 | The API runs registered checks |
| P1-160 | Check ids, levels and per-id config with a required reason | CHK-02, CFG-06 | MUST | P1-140 | Config `off` without a reason fails |
| P1-161 | Reporters: human, JSON (versioned schema), GitHub annotations | CHK-03 | MUST | P1-140 | Snapshot tests per reporter |
| P1-162 | Finding shape (id, level, subject, location, message, fix, docs URL) | CHK-04 | MUST | P1-140 | Enforced by types |
| P1-163 | Target-aware checks (classic Outlook toggles; tiers adjust levels) | CHK-05 | MUST | P1-101, P1-140 | `outlookClassic: false` disables the `mso.*` checks |
| P1-164 | Fixture sweep (every fixture and generated variant; largest fixture for size) | CHK-06 | MUST | P1-015, P1-140 | Checks report the fixture name |
| P1-165 | Parser infrastructure: parse5/htmlparser2 + postcss + MSO-aware tokenizer | CHK-07 | MUST | P1-140 | Shared AST available to checks |
| P1-166 | Custom checks API (`{ id, level, run(ctx) }`) | CHK-08 | SHOULD | P1-140 | An example team check runs from the config |
| P1-167 | caniemail compatibility lint with a vendored, dated snapshot, filtered by targets | CHK-09 | SHOULD | P1-165 | Flags unsupported CSS in user components |
| P1-168 | Docs page generator per check id (rule, why, fix, sources) | CHK-10 | MUST | P1-160 | A page exists for every registered id |
| P1-169 | `email-kit check [--json] [--reporter github]` command with exit codes | CLI-04 | MUST | P1-161 | Exits 1 on error and 0 with warnings only (tests) |
| P1-170 | Compliance defaults: `global-strict` profile data, footer slot values, opt-out wording key | CFG-11, LEG-08 | SHOULD | P1-004 | Template-level legal checks read the profile |
| P1-172 | Implement the phase-1 check catalogue (tasks P1-C01… below) | CHK-11 | MUST | P1-165 | Every phase-1 id in Appendix A implemented |

**Phase-1 check tasks.** For every check below, done means:
- implemented with its default level;
- a positive and a negative fixture (TST-04);
- a docs page;
- appears in every reporter.

All depend on P1-165.

| ID | Check | Lvl | | ID | Check | Lvl |
|---|---|---|---|---|---|---|
| P1-C01 | `tokens.resolvable` | E | | P1-C02 | `tokens.gamut` | I |
| P1-C03 | `tokens.alpha-flattened` | E | | P1-C04 | `tokens.contrast` | E/W |
| P1-C05 | `tokens.link-contrast` | E | | P1-C06 | `tokens.action-contrast` | E |
| P1-C07 | `tokens.brand-ink` | E | | P1-C08 | `tokens.midtone` | W |
| P1-C09 | `tokens.offwhite-tint` | W | | P1-C10 | `tokens.dark-ground` | W |
| P1-C11 | `tokens.light-ground` | I | | P1-C12 | `tokens.radius` | E |
| P1-C13 | `tokens.font-stack` | E | | P1-C14 | `tokens.weights` | W |
| P1-C15 | `tokens.min-size` | E/W | | P1-C16 | `tokens.letter-spacing` | W |
| P1-C17 | `tokens.button-height` | E | | P1-C18 | `tokens.container` | W |
| P1-C19 | `tokens.logo-dark` | W | | P1-C20 | `tokens.gmail-fill` | I |
| P1-C21 | `source.id-grammar` | E | | P1-C22 | `source.no-literal-colour` | E |
| P1-C23 | `source.no-font-family` | E | | P1-C24 | `source.no-font-size` | E |
| P1-C25 | `source.no-literal-copy` | E | | P1-C26 | `source.raw-allowlisted` | E |
| P1-C27 | `source.layout` | E | | P1-C28 | `source.fixture-exists` | E |
| P1-C29 | `source.fixture-valid` | E | | P1-C30 | `source.schema-portable` | E |
| P1-C31 | `source.fields-used` | W | | P1-C32 | `html.doctype` | E |
| P1-C33 | `html.lang-dir` | E | | P1-C34 | `html.wrapper-aria` | W |
| P1-C35 | `html.meta` | E | | P1-C36 | `html.title` | W |
| P1-C37 | `html.xmlns` | E | | P1-C38 | `html.dpi-noscript` | E |
| P1-C39 | `html.body-bare` | W | | P1-C40 | `html.no-body-style` | E |
| P1-C41 | `html.no-external` | E | | P1-C42 | `html.no-forms-embeds` | E |
| P1-C43 | `html.no-svg` | E | | P1-C44 | `html.no-comments` | E |
| P1-C45 | `html.no-unresolved` | E | | P1-C46 | `html.hidden-text` | W |
| P1-C47 | `html.mso-font` | E | | P1-C48 | `html.data-detectors` | W |
| P1-C49 | `css.style-size` | E | | P1-C50 | `css.important-lowercase` | E |
| P1-C51 | `css.no-double-brace` | E | | P1-C52 | `css.no-nesting` | E |
| P1-C53 | `css.colour-hex` | E | | P1-C54 | `css.no-modern-colour` | E |
| P1-C55 | `css.no-alpha` | W | | P1-C56 | `css.no-custom-props` | E |
| P1-C57 | `css.banned-layout` | E | | P1-C58 | `css.media-allowlist` | W |
| P1-C59 | `css.inline-parse` | E | | P1-C60 | `css.gradient-fallback` | E |
| P1-C61 | `css.units` | W | | P1-C62 | `css.hide-mso` | W |
| P1-C63 | `css.line-height-px` | E | | P1-C64 | `layout.ghost-table` | E |
| P1-C65 | `layout.max-fixed-width` | E | | P1-C66 | `layout.table-attrs` | E |
| P1-C67 | `layout.no-dir-padding` | W | | P1-C68 | `layout.columns` | W |
| P1-C69 | `img.alt` | E | | P1-C70 | `img.alt-quality` | W |
| P1-C71 | `img.dimensions` | E | | P1-C72 | `img.format` | E |
| P1-C73 | `img.https` | E | | P1-C74 | `img.fluid-width` | W |
| P1-C75 | `img.no-picture-srcset` | W | | P1-C76 | `img.void-class` | W |
| P1-C77 | `mso.conditional-pairs` | E | | P1-C78 | `mso.version-target` | W |
| P1-C79 | `mso.vml-safe` | E | | P1-C80 | `minify.preserve-mso` | E |
| P1-C81 | `button.real-link` | E | | P1-C82 | `button.no-letter-spacing-hack` | E |
| P1-C83 | `button.max-primary` | W | | P1-C84 | `button.target-size` | E/W |
| P1-C85 | `font.fallback-tail` | E | | P1-C86 | `font.webfont-optin` | E |
| P1-C87 | `dark.scheme-declared` | E | | P1-C88 | `dark.explicit-colours` | E |
| P1-C89 | `dark.ogsc-twin` | W | | P1-C90 | `dark.targets-inline` | E |
| P1-C91 | `dark.light-only-css-twin` | W | | P1-C92 | `dark.no-blend-hack` | W |
| P1-C93 | `dark.light-dark-fallback` | E | | P1-C94 | `a11y.one-h1` | E |
| P1-C95 | `a11y.heading-order` | W | | P1-C96 | `a11y.layout-grid` | W |
| P1-C97 | `a11y.data-table` | E | | P1-C98 | `a11y.no-sectioning` | E |
| P1-C99 | `a11y.aria-safe` | E | | P1-C100 | `a11y.link-text` | E/W |
| P1-C101 | `a11y.font-size` | E/W | | P1-C102 | `a11y.line-height` | W |
| P1-C103 | `a11y.alignment` | E/W | | P1-C104 | `a11y.text-spacing` | E |
| P1-C105 | `a11y.viewport` | E | | P1-C106 | `a11y.focus` | E |
| P1-C107 | `a11y.hidden` | E | | P1-C108 | `a11y.nbsp-spacer` | W |
| P1-C109 | `a11y.colour-only` | E | | P1-C110 | `a11y.sensory-language` | W |
| P1-C111 | `text.present` | E | | P1-C112 | `text.no-markup` | E |
| P1-C113 | `text.no-entities` | E | | P1-C114 | `text.wrap-78` | W |
| P1-C115 | `text.urls-full` | E | | P1-C116 | `text.links-match` | E |
| P1-C117 | `text.parity` | W | | P1-C118 | `text.preheader-first` | W |
| P1-C119 | `text.no-preheader-padding` | E | | P1-C120 | `text.no-decorative-runs` | W |
| P1-C121 | `text.code-unbroken` | E | | P1-C122 | `size.gmail` | E |
| P1-C123 | `size.line-length` | E | | P1-C124 | `size.unsubscribe-above-clip` | E |
| P1-C125 | `preheader.first` | E | | P1-C126 | `preheader.not-subject` | E |
| P1-C127 | `preheader.length` | W | | P1-C128 | `preheader.padding` | W |
| P1-C129 | `preheader.no-boilerplate` | E | | P1-C130 | `subject.length` | W |
| P1-C131 | `subject.no-fake-reply` | E | | P1-C132 | `subject.no-secret` | E |
| P1-C133 | `subject.generic` | W | | P1-C134 | `copy.case` | W |
| P1-C135 | `copy.no-emoji` | W | | P1-C136 | `copy.button-label` | W |
| P1-C137 | `copy.glossary` | E | | P1-C138 | `copy.paragraph-length` | I |
| P1-C139 | `copy.placeholder-fallbacks` | E | | P1-C140 | `copy.receipt-reconciles` | E |
| P1-C141 | `copy.security-repudiation` | E | | P1-C142 | `copy.auth-fallback-url` | W |
| P1-C143 | `link.hosts` | E | | P1-C144 | `link.dangerous-schemes` | E |
| P1-C145 | `link.text-matches-href` | E | | P1-C146 | `link.no-shorteners` | E |
| P1-C147 | `link.url-fields` | E | | P1-C148 | `auth.token-in-fragment` | E |
| P1-C149 | `auth.code-format` | E | | P1-C150 | `auth.expiry-stated` | W |
| P1-C151 | `auth.no-webview` | E | | P1-C152 | `legal.purpose-declared` | E |
| P1-C153 | `legal.marketing-unsubscribe` | E | | P1-C154 | `legal.postal-address` | E |
| P1-C155 | `legal.sender-identity` | E | | P1-C156 | `legal.privacy-link` | E |
| P1-C157 | `legal.reason` | E | | P1-C158 | `legal.transactional-no-promo` | E |
| P1-C159 | `legal.consent-request-clean` | E | | P1-C160 | `legal.no-tracking` | E |
| P1-C161 | `legal.opt-out-copy` | W | | P1-C162 | `legal.no-pii-in-urls` | W |
| P1-C163 | `i18n.missing-keys` | E | | P1-C164 | `i18n.unused-keys` | W |
| P1-C165 | `i18n.plural-categories` | E | | P1-C166 | `i18n.fallback` | E |
| P1-C167 | `i18n.intl-format` | E | | P1-C168 | `i18n.rtl-explicit` | E |
| P1-C169 | `i18n.expansion` | E | | P1-C170 | `output.drift` | E |
| P1-C171 | `output.manifest` | E | | P1-C172 | `output.module-matches` | E |
| P1-C173 | `output.no-orphans` | E | | P1-C174 | `output.gitignored` | W |
| P1-C175 | `output.identifiers` | E | | | | |

**Security and compliance tasks behind the checks**

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-180 | Escaping everywhere: HTML text and attributes escaped, text part raw, `<Raw>` gate | SEC-01 | MUST | P1-041, P1-018 | Hostile fixture renders inert (TST-10) |
| P1-181 | URL policy (HTTPS, host allow-list, no userinfo/IP/control characters/shorteners/dangerous schemes) at compile time and render time | SEC-02 | MUST | P1-020, P1-054 | `link.*` checks and runtime tests pass |
| P1-182 | Secret-field policy (preheader, query, metadata, logs; subject opt-in) | SEC-03 | MUST | P1-023 | `subject.no-secret` passes; secrets absent from the manifest |
| P1-183 | Auth link helpers (fragment tokens) and docs on landing pages that act on a press and turning tracking off | SEC-04 | MUST | P1-020 | Helper tests; docs page |
| P1-184 | No external requests or tracking pixels by default | SEC-05 | MUST | P1-061 | `html.no-external`, `legal.no-tracking` pass |
| P1-185 | No authoring comments in the output | SEC-06 | MUST | P1-067 | `html.no-comments` passes |
| P1-186 | Data-minimisation guidance and masking recipes; no PII in URLs | SEC-07 | SHOULD | — | Docs page; `legal.no-pii-in-urls` |
| P1-187 | No web-view link in auth/PII templates | SEC-08 | MUST | — | `auth.no-webview` passes |
| P1-188 | Purpose model end to end: footer slots per purpose through types, `Layout`/`Footer` and checks | LEG-01 | MUST | P1-019, P1-123, P1-144 | Matrix tests per purpose |
| P1-189 | Marketing requirements (unsubscribe link in HTML and text with explicit localised wording, preferences, address, identity, privacy, `requiresListUnsubscribe` metadata) | LEG-02 | MUST | P1-188 | A marketing fixture passes; missing parts fail |
| P1-190 | Consent-request requirements (identity, address, remove link, no promo, no tracking) | LEG-03 | MUST | P1-188 | Fixture tests |
| P1-191 | Transactional: no promo components; optional preferences link via profile | LEG-04 | MUST | P1-188 | `legal.transactional-no-promo` passes |
| P1-192 | Reason line in every template | LEG-06 | MUST | P1-123 | `legal.reason` passes |
| P1-193 | Tracking constructs blocked unless tracking is explicitly enabled | LEG-07 | MUST | P1-184 | `legal.no-tracking` passes |
| P1-194 | Compliance guide (with a not-legal-advice notice) and profile `verifiedOn` dates | LEG-10 | MUST | P1-170 | Docs page published |

### M1.5 CLI, `init` and host integration (v0.5)

**Status:** `examples/nextjs` (Next.js 16.4.2) is the reference integration: one template,
`email-kit compile && next build`, a route handler importing `@/email-kit/compiled`, and tests
that call the handlers directly; it runs in the repo pipeline. Verified first in a fresh
`create-next-app` outside the repo, linked by path (`link:`; `file:` fails on the repo-only
`catalog:` / `workspace:*` versions until packages are packed). Friction for `init` to remove:
the per-template `@jsxImportSource` pragma (Next type-checks every `.tsx` as React) and wiring
compile into the scripts.

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-200 | `create-email-kit` starter and `email-kit init` on the nearest `package.json` project | INIT-01 | MUST | P1-087 | Both entry points run `init` |
| P1-201 | Detect the package manager, tsconfig and code root (ordered rules); `--dir` override | INIT-02 | MUST | P1-200 | Detection tests for each layout |
| P1-202 | Create the config and `<code root>/email-kit/` (`index.ts`, welcome template, messages, fixture) | INIT-03 | MUST | P1-201 | Files created; first compile passes |
| P1-203 | Consent-gated changes (devDependency install, scripts, tsconfig `jsx` only if missing, exact `@/email-kit` path only if needed, `.gitattributes` exact path, lint/format ignores) | INIT-04 | MUST | P1-202 | Each change is shown, confirmed and applied (tests) |
| P1-204 | Safety rules: no nested projects or workspace edits; no overwrite without `--force`; summary + confirm | INIT-05 | MUST | P1-202 | Tests prove nothing is created outside the listed files |
| P1-205 | Name-conflict resolution with ownership detection and fallbacks | INIT-06 | MUST | P1-202 | Conflict scenarios tested |
| P1-206 | Offer shadcn theme import when variables or `components.json` are found | INIT-07 | SHOULD | P1-102, P1-202 | Detected theme used in the generated config |
| P1-207 | Alias strategy per the ADR (`@/email-kit` versus `#email-kit` / `tsc-alias` / relative) | INIT-08, CFG-09 | MUST | P0-08, P1-202 | Runtime import works in each host type (TST-08) |
| P1-208 | Offer an `exports` entry inside a workspace package others import | INIT-09 | SHOULD | P1-202 | Monorepo fixture test |
| P1-209 | Non-interactive flags (`--yes`, `--dir`, `--config`, `--force`, `--no-install`) | INIT-10 | MUST | P1-200 | A CI run with no prompts |
| P1-210 | Run the first compile and print the next steps (import line, studio, docs) | INIT-11 | MUST | P1-202 | Output snapshot |
| P1-211 | `email-kit new <id>` (grammar validation, scaffold for every locale, refuse existing, print import) | CLI-02 | MUST | P1-152 | Tests for new, invalid and duplicate ids |
| P1-212 | `email-kit dev` command shell (starts the studio with watch) | CLI-05 | MUST | P1-220 | Command launches the studio |

### M1.6 Studio (v0.6)

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-220 | Vite studio app rendering compiled artifacts with fixtures through the TS runtime | STU-01 | MUST | P1-074 | Studio shows the example templates |
| P1-221 | Template list and search; fixture switcher; locale switcher with pseudo-locales | STU-02 | MUST | P1-220, P1-155 | All switchers work |
| P1-222 | Width presets and free resize | STU-03 | MUST | P1-220 | 320/375/414/600/768/full |
| P1-223 | Light and authored dark side by side | STU-04 | MUST | P1-220, P1-113 | Both panes labelled |
| P1-224 | Tabs: Rendered, HTML source, Plain text (ruler + links), Subject/preheader inbox row, Data, Meta | STU-05 | MUST | P1-220 | Each tab shows correct content |
| P1-225 | HTML size meter against the Gmail clip; `<style>` size meter | STU-06 | MUST | P1-220 | Matches `size.gmail` and `css.style-size` values |
| P1-226 | Check panel (same engine) with jump-to-source | STU-07 | MUST | P1-220, P1-140 | Findings identical to the CLI |
| P1-227 | Live reload on any input change; error overlay with a code frame | STU-08 | MUST | P1-220 | Editing a template updates the studio in under 1 s |
| P1-228 | `.eml` download (`multipart/alternative`) | STU-09 | MUST | P1-220 | The file opens correctly in Apple Mail and Thunderbird |
| P1-229 | Images-off and style-stripped views | STU-10 | SHOULD | P1-092 | Views toggle |
| P1-230 | Basic theme inspector (roles per mode with contrast ratios) | STU-11 | SHOULD | P1-110 | Matches the `email-kit tokens` output |
| P1-231 | Studio UI accessibility (keyboard, AA contrast) | NFR-14 | SHOULD | P1-220 | axe on the studio shows no serious issues |

### M1.7 Hardening, docs and v1.0

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P1-240 | Prove zero runtime dependencies (the generated module imports nothing; email-kit installed as a devDependency only) | PKG-02 | MUST | P1-074 | CI test builds a production bundle with devDependencies pruned |
| P1-241 | Trusted publishing release workflow on protected tags; provenance; 2FA policy documented | PKG-05 | MUST | P0-02 | A v0.x release published through OIDC |
| P1-242 | Supply-chain hardening (no lifecycle scripts, dependency review, `minimumReleaseAge`, build-script allow-list, audit) | PKG-06 | MUST | P0-01 | CI enforces each rule |
| P1-243 | Versioning policy in CONTRIBUTING (output change ≥ minor; check-outcome change names the id) | PKG-09 | MUST | — | Policy documented; changeset lint |
| P1-244 | Support policy documented | PKG-10 | SHOULD | — | README section |
| P1-245 | CI matrix Node 22/24/26 × Linux, macOS, Windows | PKG-11 | MUST | P0-01 | Matrix green |
| P1-246 | MIT licence and copyleft licence scan | PKG-08 | MUST | P0-01 | License check in CI |
| P1-250 | Runtime portability tests: Node 22+, Bun, Deno, Workers, Lambda, Next.js server | NFR-01 | MUST | P1-074 | All targets import and render (TST-08) |
| P1-251 | Renderer size budget ≤ 3 KB min+gzip | NFR-02 | SHOULD | P1-050 | size-limit check in CI |
| P1-252 | Performance verification (render and import) | NFR-03 | MUST | P1-052 | Bench under budget |
| P1-253 | Compile + check of 50 templates × 2 locales < 10 s | NFR-04 | MUST | P1-172 | Bench recorded |
| P1-254 | Cross-OS byte-identical output | NFR-05 | MUST | P1-066 | Hash comparison across the CI matrix |
| P1-255 | WCAG 2.2 AA verification of components and starters (light and authored dark; forced modes best effort) | NFR-06 | MUST | P1-172 | `tokens.contrast` + manual audit recorded |
| P1-256 | Tier-1 client matrix verification of components and starters | NFR-07, TST-09 | MUST | P1-260 | Screenshots or recorded results for every tier-1 client |
| P1-257 | Inline-only (no `<style>`) design verification | NFR-08 | MUST | P1-092 | Style-stripped renders pass contrast and width checks |
| P1-258 | Size budgets: default layout + paragraph < 20,000 characters; 60-item receipt < 90 KB | NFR-09, NFR-10 | MUST | P1-137 | Measured in CI |
| P1-259 | No telemetry and no network during compile/check (test with network blocked) | NFR-11 | MUST | P1-172 | CI job with network blocked passes |
| P1-260 | Starter templates via `new --from` (OTP, magic link, reset, password changed, email changed old/new, new sign-in, recovery, welcome, invitation, receipt, shipping, digest, double opt-in, notification) | UI-32 | SHOULD | P1-143, P1-152 | Every starter passes `check` with 0 errors |
| P1-261 | Windows path-handling audit and tests | NFR-12 | MUST | P1-087 | Windows CI green, including `init` |
| P1-262 | Coverage ≥ 90% lines (core, compiler, runtime, checks) | NFR-13 | SHOULD | — | Coverage gate in CI |
| P1-263 | Contract adherence review (R1–R9) | NFR-15 | MUST | P1-074 | Checklist signed off; artifacts contain no code |
| P1-264 | Security policy, private reporting, CI audit | SEC-09 | MUST | P0-01 | `SECURITY.md`; GitHub private reporting on |
| P1-270 | Unit test suites across packages | TST-01 | MUST | — | Suites exist for every package |
| P1-271 | Type tests (authoring + generated module: ids, fields, locales, keys, purpose rules) | TST-02 | MUST | P1-074, P1-159 | Positive and negative type test for every public type path |
| P1-272 | Golden snapshots of the examples; changeset required on snapshot change | TST-03 | MUST | P1-280 | CI enforces it |
| P1-273 | Check fixtures (positive and negative per id) harness | TST-04 | MUST | P1-172 | Every id has both fixtures |
| P1-274 | CLI integration tests (`init` variants, conflicts, `new`, `compile`, `check`, `dev` smoke) | TST-05 | MUST | P1-212 | Suite green on 3 operating systems |
| P1-275 | Conformance suite in CI | TST-06 | MUST | P1-051 | Required check |
| P1-276 | Nightly benchmarks with a 20% regression gate | TST-07 | SHOULD | P1-252 | Nightly workflow |
| P1-277 | Host compatibility tests (Next.js build, Hono on Miniflare/Wrangler, Bun, Node `tsc`) | TST-08 | MUST | P1-207 | All hosts green |
| P1-278 | Hostile fixture set | TST-10 | MUST | P1-015 | Used by the conformance suite and checks |
| P1-280 | Example projects in the repo (Hono; Next.js with and without `src/`; Node `tsc` with `#email-kit`; monorepo shared package), built and checked in CI | DOC-02 | MUST | P1-210 | All examples green |
| P1-281 | Docs site: getting started, concepts, authoring, components, theming, i18n, checks, CLI, host guides, provider recipes, transactional recipes, compliance guide, FAQ, API reference | DOC-01 | MUST | P1-168 | Site deployed; getting started timed under 5 minutes |
| P1-282 | Contract specs (mustache-core, escaping, manifest schema, JSON Schema subset, identifier rules) | DOC-03 | MUST | P1-040, P1-070 | Specs published under `docs/spec/` |
| P1-283 | Repo docs: changelog, contributing, code of conduct, provenance, security | DOC-04 | MUST | — | Files present |
| P1-290 | v1.0 release: all phase-1 MUSTs done, metrics met, release notes | All phase 1 | MUST | everything above | v1.0.0 published through OIDC |

---

## Phase 2: DX and quality (v1.x)

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P2-01 | `email-kit doctor` (project health) | CLI-10 | SHOULD | v1.0 | Reports each item with a fix |
| P2-02 | `email-kit migrate` with versioned codemods | CLI-11 | MAY | v1.0 | Codemod framework plus a sample migration |
| P2-03 | `email-kit add <item>` from the registry | CLI-12, REG-03 | SHOULD | P2-20 | Installs a block into `components/` |
| P2-04 | `email-kit export` (static studio build) | CLI-13, STU-18 | SHOULD | v1.0 | Static folder opens offline |
| P2-05 | Id registry `ids.lock` with `--retire` | CLI-14 | SHOULD | v1.0 | Removing an id without `--retire` fails |
| P2-06 | Opt-in web fonts with MSO fallback and a privacy warning | BLD-16 | MAY | v1.0 | `font.webfont-optin` satisfied by the generated markup |
| P2-07 | Asset pipeline (optimisation, 2×/weight checks, upload hook) | BLD-17 | MAY | v1.0 | Hook API; checks use the asset metadata |
| P2-08 | Multi-brand compile per brand modifier | BLD-18 | SHOULD | v1.0 | Output per brand; validated per permutation |
| P2-09 | Translator workflow (export and import JSON/XLIFF, unused-key report, notes) | I18N-09 | SHOULD | v1.0 | Round-trip test |
| P2-10 | More theme inputs (shadcn registry themes and presets, tweakcn, Tailwind v4 `@theme`, Tokens Studio) | THM-02 | SHOULD | v1.0 | Each input maps to roles (tests) |
| P2-11 | `CodeInline` / `CodeBlock` | UI-24 | SHOULD | v1.0 | Component tests + checks |
| P2-12 | `Badge` | UI-25 | SHOULD | v1.0 | Component tests + checks |
| P2-13 | `Card` | UI-26 | SHOULD | v1.0 | Component tests + checks |
| P2-14 | `Avatar` | UI-27 | SHOULD | v1.0 | Component tests + checks |
| P2-15 | `Steps` / `Progress` | UI-28 | SHOULD | v1.0 | Component tests + checks |
| P2-16 | `Markdown` | UI-29 | SHOULD | v1.0 | Sanitisation tests |
| P2-17 | `SocialLinks` | UI-30 | SHOULD | v1.0 | Component tests + checks |
| P2-18 | Lifecycle set (`Hero`, `Quote`/`Testimonial`, `Stats`, product cards/grid, `Pricing`, `Gallery`, `QrCode`) | UI-31 | MAY | v1.0 | Each component tested |
| P2-19 | Component docs and gallery in the studio | UI-33 | SHOULD | v1.0 | Every component documented with variants |
| P2-20 | shadcn-compatible GitHub registry (`email-kit/registry`) for blocks, templates and themes | REG-01 | SHOULD | v1.0 | `npx shadcn add email-kit/registry/receipt#v1` works |
| P2-21 | Registry items import npm primitives; provenance per item | REG-02 | SHOULD | P2-20 | Lint on registry items |
| P2-22 | Animated image rules: first frame carries the message; static fallback | UI-34 | SHOULD | v1.0 | `img.motion` and docs |
| P2-23 | Render-based check infrastructure (Playwright) | CHK-12 | MUST | v1.0 | Headless render API used by checks |
| P2-24 | Implement the phase-2 check catalogue (P2-C01… below) | CHK-13 | MUST | P2-23 | Every phase-2 id implemented |
| P2-25 | Opt-in spam score (SpamAssassin via Docker or Mailpit) with a threshold | CHK-14 | SHOULD | v1.0 | `check --spam` reports the score |
| P2-26 | Forced-dark simulations in the studio (Gmail Android Chromium, forced-full LAB, Outlook.com, Yahoo) + opted-out badge | STU-12 | MUST | P2-23 | Each mode selectable; labelled as an approximation |
| P2-27 | Accessibility panel (axe, outline, landmarks, reading order, links, alts, tap targets, transcript) | STU-13 | MUST | P2-23 | Panel populated for every template |
| P2-28 | Inbox mock-up with per-client truncation and an AI summary view | STU-14 | SHOULD | v1.0 | Truncation widths configurable |
| P2-29 | Fixture editor from the JSON Schema; save as fixture | STU-15 | SHOULD | v1.0 | The saved fixture validates |
| P2-30 | Visual-regression snapshots (Chromium + WebKit) with a diff view | STU-16 | SHOULD | P2-23 | Diff shown in the studio and CI |
| P2-31 | Dev send-test (Mailpit zero-config, Ethereal, SMTP) | STU-17 | SHOULD | v1.0 | The email arrives in Mailpit |
| P2-32 | Spam-score panel | STU-19 | MAY | P2-25 | Score shown per template |
| P2-33 | Outlook ghost mode | STU-20 | SHOULD | v1.0 | Square corners, no shadows, weights snapped |
| P2-34 | Motion inspector + first-frame preview | STU-21 | MAY | P2-22 | Frame timeline shown |
| P2-35 | LAN QR code preview | STU-22 | MAY | v1.0 | QR opens the preview on a phone |
| P2-36 | "Copy for AI" + MCP server (templates, checks, fixtures) | STU-23 | MAY | v1.0 | The MCP server lists templates and runs checks |
| P2-37 | Litmus / Mailgun Inspect hand-off | STU-24 | MAY | v1.0 | A test is created through the API with a user key |
| P2-38 | Full theme inspector (permutations, gamut deltas, contrast heat-map) | STU-25 | SHOULD | v1.0 | Heat-map shows failing pairs |
| P2-39 | Real-device checklist export + screen-reader protocol | STU-26 | MAY | v1.0 | Exported checklist |
| P2-40 | Promo-slot variants (render without the promo slot) | LEG-05 | SHOULD | v1.0 | The variant is emitted and typed |
| P2-41 | Minor-audience flag (no marketing; minimal data) | LEG-09 | SHOULD | v1.0 | `legal.minor-audience` passes |
| P2-42 | `@email-kit/testing` render matchers | TST-11 | SHOULD | v1.0 | Matchers published with docs |
| P2-43 | Migration guides (React Email, MJML, P1/P2-style setups) | DOC-05 | SHOULD | v1.0 | Guides published |

**Phase-2 check tasks.** Same definition of done as phase 1. All depend on P2-23 or P2-07.

| ID | Check | Lvl | | ID | Check | Lvl |
|---|---|---|---|---|---|---|
| P2-C01 | `source.ids-locked` | E | | P2-C02 | `img.retina` | W |
| P2-C03 | `img.weight` | W | | P2-C04 | `img.motion` | E |
| P2-C05 | `img.dark-safe` | W | | P2-C06 | `dark.inline-complete` | E |
| P2-C07 | `dark.forced-render` | W | | P2-C08 | `a11y.axe` | E/W |
| P2-C09 | `a11y.reflow` | E | | P2-C10 | `a11y.target-size` | E/W |
| P2-C11 | `a11y.images-off` | E | | P2-C12 | `i18n.expansion-render` | E |
| P2-C13 | `legal.minor-audience` | E | | P2-C14 | `spam.spamassassin` | E |

---

## Phase 3: Other backend languages

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P3-01 | Target and emitter plugin API (`targets: [...]`) | LNG-01 | MUST | v1.x | The TS emitter is refactored onto the API |
| P3-02 | Packaging ADR per language (vendored versus published) | LNG-05 | MUST | P3-01 | ADR merged |
| P3-03 | Python emitter + runtime (100% conformance) | LNG-02 | MUST | P3-02 | Conformance green; FastAPI example |
| P3-04 | Go emitter + runtime (100% conformance) | LNG-03 | MUST | P3-02 | Conformance green; `net/http` example |
| P3-05 | Kotlin/KMP emitter + `commonMain` runtime | LNG-04 | SHOULD | P3-02 | Conformance green on JVM and Native |
| P3-06 | Per-language docs and examples | LNG-06 | MUST | P3-03, P3-04 | Docs published |
| P3-07 | Cross-language conformance CI | LNG-07 | MUST | P3-03, P3-04 | Required check runs every runtime |
| P3-08 | Cross-language formatter spec (only if demand justifies it) | LNG-08 | MAY | P3-07 | Spec + conformance cases |

---

## Phase 4 (last): Sending layer (`@email-kit/send`)

| ID | Task | Reqs | Pri | Dep | Done when |
|---|---|---|---|---|---|
| P4-01 | `@email-kit/send` core: `createMailer`, typed `send()`, failure policy, safe logging, typed errors | SND-01 | MUST | v1.x | Typed send over the generated module; logging test (no PII) |
| P4-02 | Transport interface and capabilities | SND-02 | MUST | P4-01 | Interface published |
| P4-03 | SES v2 transport | SND-02 | MUST | P4-02 | Contract suite green |
| P4-04 | Resend transport | SND-02 | MUST | P4-02 | Contract suite green |
| P4-05 | Postmark transport | SND-02 | MUST | P4-02 | Contract suite green |
| P4-06 | SendGrid transport | SND-02 | SHOULD | P4-02 | Contract suite green |
| P4-07 | SMTP transport (Node-only entry) | SND-02 | MUST | P4-08 | Contract suite green against Mailpit |
| P4-08 | MIME builder (alternative/related, QP/base64, line limits) | SND-03 | MUST | P4-01 | `mime.structure` passes; snapshot |
| P4-09 | Default headers (From, To, Reply-To, RFC 2047 Subject, Date, Message-ID, Auto-Submitted, X-Auto-Response-Suppress, References isolation, List-Unsubscribe(+Post), List-Id, Feedback-ID; banned headers) | SND-04 | MUST | P4-08 | `headers.defaults` passes |
| P4-10 | Ordered runtime guards (header, address, display-name, URL, secret, purpose, consent, suppression, age, tracking, subject prefix, quiet hours, config, date, size, idempotency, phantom, logging) | SND-05 | MUST | P4-01 | A test per guard |
| P4-11 | Compliance profiles as data (global-strict, us, ca, ca-qc, eu, de, fr, uk, au, nz, sg, jp, kr, in, cn, lk, br, mx) with verifiedOn/effectiveFrom/sources; union logic | SND-06 | MUST | P4-10 | Profile tests; counsel review recorded |
| P4-12 | Consent-record and suppression hooks (HMAC keys, scopes, reasons) | SND-07 | MUST | P4-10 | Hook interfaces with an in-memory reference implementation |
| P4-13 | Idempotency passthrough and dedupe (Resend 24 h caveat) | SND-08 | MUST | P4-04 | Retry beyond 24 h doesn't duplicate (test) |
| P4-14 | Phantom sends per transport capability, with latency parity | SND-09 | SHOULD | P4-02 | Phantom path tested per transport |
| P4-15 | Error classification (retryable, permanent-recipient, permanent-sender, too-big, idempotency-conflict; Gmail codes) | SND-10 | MUST | P4-02 | Classification table tests |
| P4-16 | Webhook normaliser (delivered, bounced, complained) per provider | SND-11 | SHOULD | P4-03…P4-06 | Normalised event types |
| P4-17 | Tracking gate (consent-based pixels and click rewriting; provider tracking assertion) | SND-12 | MUST | P4-12 | Tracking stripped without consent |
| P4-18 | One-click unsubscribe endpoint helpers + test utilities | SND-13 | MUST | P4-09 | POST works with no redirect or cookies; GET does nothing |
| P4-19 | `doctor` DNS and endpoint check (SPF, DKIM, DMARC RFC 9989, alignment, MX, PTR, domain age, MTA-STS/TLS-RPT, DANE, BIMI, link hosts, one-click, probe) | SND-14 | SHOULD | P4-18 | Report against a test domain |
| P4-20 | `email-kit send-test` through the configured transport | SND-15 | MUST | P4-02 | A real send to Mailpit and to a sandbox |
| P4-21 | Cognito `CustomMessage` adapter (placeholders, 20k budget, never throws) | SND-16 | SHOULD | P4-01 | Adapter tests (per P1 T-COG) |
| P4-22 | Supabase, Auth0 and Clerk adapters | SND-16 | MAY | P4-21 | Adapter tests |
| P4-23 | Memory transport in `@email-kit/testing` | SND-17 | MUST | P4-02 | Records messages for tests |
| P4-24 | Studio headers tab | STU-27 | SHOULD | P4-09 | Headers shown per template |
| P4-25 | Implement the phase-4 check catalogue (P4-C01… below) | CHK-15 | MUST | P4-09 | Every phase-4 id implemented |

| ID | Check | Lvl | | ID | Check | Lvl |
|---|---|---|---|---|---|---|
| P4-C01 | `mime.structure` | E | | P4-C02 | `headers.defaults` | E |
| P4-C03 | `display-name.rules` | E | | P4-C04 | `catalog.stream` | E |
| P4-C05 | `legal.subject-prefix` | E | | P4-C06 | `legal.unsubscribe-lifetime` | E |
| P4-C07 | `legal.profile-freshness` | W | | P4-C08 | `size.provider-budget` | E |

---

## Later

| ID | Task | Reqs | Pri |
|---|---|---|---|
| L-01 | AMP for Email part | FUT-01 | MAY |
| L-02 | MJML / React Email importer | FUT-02 | MAY |
| L-03 | MJML as an alternative output engine | FUT-03 | MAY |
| L-04 | Paid inbox-rendering integration | FUT-04 | MAY |
