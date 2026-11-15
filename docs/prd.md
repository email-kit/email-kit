# email-kit: Product Requirements Document

| | |
|---|---|
| **Product** | email-kit: a type-safe email template compiler, with components, theming, checks and a preview studio |
| **Status** | Draft v1, 2026-10-27 |
| **Packages** | `@email-kit/cli`, `@email-kit/core`, `@email-kit/components`, `create-email-kit` ([npm org](https://www.npmjs.com/org/email-kit) · [GitHub org](https://github.com/email-kit)) |
| **Inputs** | [phase-1-scope.md](phase-1-scope.md) · [architecture-direction.md](architecture-direction.md) · [research/](research/README.md) (01–06) · reference packages P1 (`reference-docs/email-package-1`) and P2 (`reference-docs/email-package-2`) |
| **Backlog** | [backlog.md](backlog.md): every requirement below has at least one task there |

**How to read the tables**
- **Pri** (priority): **MUST** is required to finish its phase, **SHOULD** is expected but can slip
  by one milestone, **MAY** is optional.
- **Phase**: 0 foundations · 1 compiler MVP up to v1.0 · 2 DX and quality · 3 other languages ·
  4 sending layer (last) · L later or unplanned.
- **Source**: D# = a decision in phase-1-scope · R# = a rule in architecture-direction · 01–06 =
  research files · P1/P2 = reference packages.

---

## 1. Summary

email-kit turns email templates written in **TSX** into **precompiled, language-neutral
artifacts**: HTML and plain text with placeholders, subject and preheader, metadata and a JSON
Schema. It also generates a **small, fully typed TypeScript module** that backend code
imports and renders with one call. It works the way `drizzle-kit generate` does for SQL: you
author in a friendly typed format, run `email-kit compile`, commit the output, and import it.

Every email it produces follows the standards and rules gathered in the research:
- it renders in Outlook (Word engine), Gmail, Apple Mail, Yahoo and the rest;
- it survives dark mode;
- it meets WCAG 2.2 AA;
- it stays under Gmail's clip limit;
- it carries the footer elements the law requires.

A **check engine** proves all of this on every compile. A **preview studio** shows it.

Phase 1 targets TypeScript backends (Node, Next.js, Hono, Bun, Workers, Lambda) and **does not
send email**. Python, Go and Kotlin backends (phase 3) and, last, sending (phase 4) come later, on the
same language-neutral contract.

## 2. Problem

Teams sending email from code usually end up with one of these:

| Approach | What goes wrong |
|---|---|
| HTML strings in code | Breaks in Outlook and Gmail; nobody notices until a customer does |
| Templates in the provider's dashboard | Wording drifts from the code that sends it; no types, review or tests |
| React Email or MJML alone | Solves layout only. No typed catalogue, checks, text-part discipline, i18n guard or drift detection. React Email renders at send time (JS only, cold-start cost); MJML has weak authoring DX |

The failures are silent:
- an undeclared variable renders as a blank;
- flexbox collapses in Outlook;
- a 110 KB receipt is clipped by Gmail and the totals disappear;
- forced dark mode makes grey text unreadable;
- an `oklch()` colour makes Gmail drop every style on the element;
- a marketing email ships without a postal address.

**email-kit's premise:** each of these becomes a compile error, a failed check or a failed type
check before deploy.

## 3. Goals and non-goals

### Goals

| ID | Goal |
|---|---|
| G1 | **Best-in-class DX.** Typed TSX templates, shadcn-style components, a token theme, a live studio, and a working first email in under 5 minutes |
| G2 | **Type-safe end to end.** Wrong template ids, data fields, locales or message keys don't compile, either in templates or in backend code |
| G3 | **Works in real inboxes.** Correct in tier-1 clients, in light, dark and forced-dark modes, and with images or `<style>` stripped |
| G4 | **Accessible and compliant by default.** WCAG 2.2 AA; the legally required footer elements per purpose; no tracking by default |
| G5 | **Tiny, portable runtime.** The generated module's one dependency is `@email-kit/runtime`, which has none, no `fs`, and runs on every JS server runtime, including the edge (ADR 0007) |
| G6 | **Language-neutral contract.** Adding Python, Go or Kotlin later means a new emitter and runtime, with no compiler changes |
| G7 | **Wrong is loud.** Every rule from the research is a stable, configurable, documented check id |
| G8 | **Drop-in for any backend repo.** Ordinary devDependencies plus the small runtime dependency; `init` adds a config file and a folder; no nested projects |

### Non-goals

| ID | Non-goal |
|---|---|
| NG1 | Sending email in phases 1–2 (the last phase, 4, adds an optional send package) |
| NG2 | Marketing campaign management: lists, scheduling, A/B tests, send-time optimisation |
| NG3 | A drag-and-drop visual editor |
| NG4 | Hosting or delivering email (we are not an ESP) |
| NG5 | Rendering in real inboxes as a service (we encode known rules and integrate with Litmus or Mailgun Inspect at most) |
| NG6 | Use from frontends. Output is for server code |

## 4. Users and stories

| Persona | Needs |
|---|---|
| **Backend/full-stack developer** (Next.js, Hono, Node) | Write and change emails quickly, type-safe, without learning Outlook hacks; import and send with their existing provider |
| **Design-system owner** | Emails that match the product theme (shadcn tokens) without hand-copying colours |
| **Tech lead / reviewer** | Reviewable diffs of what ships, checks in CI, no surprises in inboxes |
| **Localisation owner** | All copy in message files, missing translations caught at build time, RTL and long languages handled |
| **Compliance / security owner** | Required footer elements, no tracking or secret leaks, an evidence trail |
| **Future: Python/Go backend developer** | The same emails, rendered byte-identically from their language |

| ID | Story |
|---|---|
| US-01 | As a developer, I run `npm create email-kit` in my backend repo and get a working example email compiled in under 5 minutes |
| US-02 | As a developer, I write a template in TSX with typed data and components, and see it live in the studio |
| US-03 | As a developer, I run `email-kit compile` and import `{ emails }` from `@/email-kit`. `emails.orderConfirmation.render(data)` is fully typed and returns subject, preheader, HTML and text |
| US-04 | As a reviewer, I see the compiled HTML diff in the PR, and CI fails if the compiled output is stale or any check fails |
| US-05 | As a design-system owner, I point email-kit at our shadcn CSS variables, and the emails use our colours, converted and validated for email |
| US-06 | As a localisation owner, I add a `si` folder of messages; a missing key fails the compile, and the studio shows every locale, including pseudo-locales |
| US-07 | As a compliance owner, a marketing template can't compile without an unsubscribe link and a postal address |
| US-08 | As a developer on Cloudflare Workers, importing one template doesn't bundle all of them |
| US-09 | As a developer in a monorepo, two backends share one set of emails from an existing shared package |
| US-10 | (Phase 4) As a developer, I send with `mailer.send("order-confirmation", data, { to })` through SES or Resend, with the correct headers and guards |
| US-11 | (Phase 3) As a Python developer, I render the same compiled emails with typed dataclasses |

## 5. Product principles

1. **Compile early, render cheaply.** Everything expensive happens in `compile`; send time is
   string substitution (R1).
2. **The contract is the product.** Artifacts are plain data, with no code (R1–R9).
3. **One source per fact.** Templates, messages and theme are each defined once; the output that
   was reviewed is the output that ships (drift check).
4. **Checks are part of the product,** not a side tool.
5. **Safe defaults, explicit opt-outs.** Every relaxation needs a reason in config.
6. **Respect the host project.** Don't touch what we don't own (D8).

## 6. Phases

| Phase | Name | Outcome | Exit criteria |
|---|---|---|---|
| **0** | Foundations | Risky decisions settled with prototypes; repo ready | SPK-01 to SPK-12 done; ADRs written for authoring primitives, plurals, alias strategy, inliner and dialect |
| **1** | Compiler MVP → **v1.0** | Everything in this PRD marked phase 1 | All phase-1 MUSTs done; metrics in §9 met; examples green in CI; tier-1 client matrix verified |
| **2** | DX and quality | Render-based checks, full studio, more components, registry, doctor, migrate, multi-brand | Phase-2 MUSTs done; v1.x releases |
| **3** | Other languages | Python and Go (then Kotlin) emitters and runtimes passing the conformance suite | Each language passes 100% of the conformance suite; docs and examples |
| **4** | Sending layer (last) | `@email-kit/send` with transports, headers, guards, compliance profiles, doctor DNS, provider adapters | Phase-4 MUSTs done; contract suites green per transport |
| **L** | Later | AMP, other real-client integrations, other ideas | — |

**Phase 1 milestones**

| Milestone | Scope | Release |
|---|---|---|
| M1.1 Core compile path | core package, JSX runtime, IR, dialect and runtime, generated module, minimal components, config, `compile` | v0.1 |
| M1.2 Theme and components | theme pipeline, roles, validation, P0 components | v0.2 |
| M1.3 i18n | messages, typed keys, per-locale output, fallback, pseudo-locales, plurals | v0.3 |
| M1.4 Checks | engine plus the phase-1 catalogue (Appendix A) | v0.4 |
| M1.5 CLI and host integration | `init`, `new`, aliases, host compatibility | v0.5 |
| M1.6 Studio (phase 1) | the studio's phase-1 features | v0.6 |
| M1.7 Hardening and v1.0 | docs, examples, real-client verification, performance, security review, release | v1.0 |

---

## 7. Requirements

### 7.1 Foundations and spikes (phase 0)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| SPK-01 | Prototype a JSX → IR → placeholder compiler: one template with a scalar, `<Each>`, `<If>`, an attribute placeholder and an i18n string compiles to HTML and text with mustache-core placeholders | MUST | 0 | T1, R1 |
| SPK-02 | Compare Outlook fidelity: own table primitives versus MJML-underneath, for one layout (columns, button, divider), in classic Outlook 100/125%, new Outlook, Gmail and Apple Mail. Record the decision | MUST | 0 | 06 §10.2, 01 |
| SPK-03 | Verify the per-file `@jsxImportSource @email-kit/core` pragma in host setups: `jsx` unset (with one line added), `react-jsx` + `hono/jsx`, Next.js `preserve`, and `tsc --noEmit` in CI | MUST | 0 | phase-1-scope (JSX) |
| SPK-04 | Decide the runtime plurals strategy (caller category, spec'd CLDR category function, or caller-formatted phrase); write an ADR | MUST | 0 | architecture-direction (open questions) |
| SPK-05 | Draft the mustache-core spec v1, the escaping table, the TS reference runtime and a seed conformance suite | MUST | 0 | R2, R3, R8 |
| SPK-06 | Decide the alias strategy for `tsc`-built and Node type-stripping projects (`#email-kit` mapping for source and compiled paths, `tsc-alias`, or relative) | MUST | 0 | phase-1-scope (aliases) |
| SPK-07 | Benchmark CSS inliners (`juice` versus `@css-inline/css-inline`) for output correctness and speed; choose one | MUST | 0 | 06 §2.2 |
| SPK-08 | Validate Standard Schema → JSON Schema emission across Zod 4, ArkType and Valibot, and confirm the portable subset (R4) can be enforced | MUST | 0 | 06 §3.3 |
| SPK-09 | Repo setup: pnpm workspaces, Turborepo, Changesets, tsdown, Vitest, Biome or ESLint, GitHub Actions, CODEOWNERS | MUST | 0 | 06 §8 |
| SPK-10 | Reserve names: publish placeholder `create-email-kit` and `@email-kit/*`; create GitHub repos; enable npm trusted publishing | MUST | 0 | D10 |
| SPK-11 | Choose the JSX transform for compiling templates (esbuild, oxc or swc) with no host tsconfig dependency | MUST | 0 | phase-1-scope (JSX) |
| SPK-12 | Write ADRs: authoring primitives, dialect, plurals, alias strategy, inliner, packaging split (cli/core) | MUST | 0 | — |

### 7.2 Packaging, distribution and release (PKG)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| PKG-01 | Publish `@email-kit/cli` (bin `email-kit`), `@email-kit/core`, `@email-kit/components` and the unscoped `create-email-kit` | MUST | 1 | D10 |
| PKG-02 | Users install the toolchain (`cli`, `core`, `components`) as **devDependencies**. The generated output depends on one package, **`@email-kit/runtime`**, installed as a dependency: zero dependencies of its own, size-budgeted per entry point (ADR 0007) | MUST | 1 | D8, R1 |
| PKG-03 | ESM-only; `exports` map with `types` first; subpath exports; `sideEffects: false`; no top-level await; `engines.node >=22.12` | MUST | 1 | 06 §8.1 |
| PKG-04 | Build with tsdown; gate CI on `publint` and `@arethetypeswrong/cli` (esm-only profile) | MUST | 1 | 06 §8.2 |
| PKG-05 | Publish only through npm trusted publishing (OIDC) from GitHub Actions on protected tags, with provenance; no long-lived tokens; 2FA on all maintainer accounts | MUST | 1 | 06 §8.4 |
| PKG-06 | No install lifecycle scripts; minimal dependencies (runtime target: zero); dependency review; pnpm `minimumReleaseAge`; build scripts allow-listed | MUST | 1 | 06 §8.4 |
| PKG-07 | Monorepo with pnpm + Turborepo; versions and changelogs with Changesets; SemVer | MUST | 1 | 06 §8.5 |
| PKG-08 | MIT licence; no copyleft dependencies; components written clean-room with a provenance record per component | MUST | 1 | 06 §0 (emailcn DMCA) |
| PKG-09 | Versioning policy: a change to generated HTML is at least minor, with a changelog line; a change in which checks fail is minor and names the check id | MUST | 1 | P1 NFR-12 |
| PKG-10 | Support policy: the latest major, plus security fixes for the previous major for 6 months | SHOULD | 1 | P1 09 |
| PKG-11 | CI matrix: Node 22, 24 and 26 on Ubuntu, macOS and Windows | MUST | 1 | 06 §8.6 |

### 7.3 Project setup: `init` (INIT)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| INIT-01 | `npm create email-kit` and `npx @email-kit/cli init` run `init` on the nearest folder with a `package.json` (any backend repo, single or monorepo) | MUST | 1 | D8 |
| INIT-02 | Detect the package manager (lockfile), `tsconfig.json`, and the **code root** in this order: `rootDir`/single `include` → `@/*` alias target → framework layout (Next.js `src/app` vs `app`) → a `src/` folder with code → project root. Show the result; `--dir` overrides | MUST | 1 | phase-1-scope |
| INIT-03 | Create `email-kit.config.ts` at the root and `<code root>/email-kit/` with `index.ts` (`export * from "./compiled"`), `templates/welcome.tsx`, `messages/en/welcome.json` and a fixture | MUST | 1 | phase-1-scope |
| INIT-04 | With consent only: add the devDependency (detected package manager) and the scripts `email-kit:compile`, `email-kit:check`, `email-kit:dev`; add `"jsx": "react-jsx"` only if `jsx` is missing; add the exact `@/email-kit` path only if `@/*` doesn't cover it; add the exact-path `linguist-generated` line to `.gitattributes`; add the output to lint and format ignore files | MUST | 1 | phase-1-scope |
| INIT-05 | Never create a nested `package.json` or `tsconfig.json`, a workspace package, or workspace edits; never overwrite without `--force`; show a summary of every change and confirm | MUST | 1 | D8 |
| INIT-06 | Name conflicts: detect ownership (config reference or manifest signature); if it is ours, report "already initialised"; otherwise propose free names (`src/email-templates/` → `src/emails/` → custom; scripts `emails:*` → `ek:*`); a foreign `email-kit.config.ts` stops `init`; never write into a folder that isn't ours | MUST | 1 | phase-1-scope |
| INIT-07 | Offer to import the theme when shadcn CSS variables or `components.json` are found | SHOULD | 1 | phase-1-scope, 05 §12.4 |
| INIT-08 | Alias strategy: where tsconfig aliases work at runtime (Next.js, Bun, tsx, esbuild, tsup, Wrangler), use `@/email-kit`. Where they don't (plain `tsc` + `node`, Node type stripping), offer `#email-kit` subpath imports, `tsc-alias`, or relative imports, per the SPK-06 ADR | MUST | 1 | phase-1-scope |
| INIT-09 | Inside a workspace package that others import, offer to add an `exports` entry (`"./emails": "./src/email-kit/index.ts"`) | SHOULD | 1 | phase-1-scope (example D) |
| INIT-10 | Non-interactive flags: `--yes`, `--dir`, `--config`, `--force`, `--no-install` | MUST | 1 | phase-1-scope |
| INIT-11 | Run the first `compile`, then print the import line, the studio command and the docs link | MUST | 1 | phase-1-scope |

### 7.4 Configuration (CFG)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| CFG-01 | `defineConfig()` typed config in `email-kit.config.ts`, loaded with jiti; `--config <path>` override | MUST | 1 | 06 §7 |
| CFG-02 | Configurable paths: templates, messages, components, output (default `compiled`), fixtures | MUST | 1 | phase-1-scope |
| CFG-03 | Locales: default, list, fallback chain, pseudo-locale toggles | MUST | 1 | 05 §10 |
| CFG-04 | Theme source (DTCG + resolver, shadcn CSS, TS object), role-map overrides, type scale, spacing, radius, layout, dark strategy | MUST | 1 | 05 §14.1, P1 05 |
| CFG-05 | Targets: `outlookClassic` (default `true`), client tiers, default dark strategy (`auto` / `light-only`) | MUST | 1 | 01 §1.4, 02 |
| CFG-06 | Checks: per-id `off` / `warn` / `error` with a **required reason**, plus options such as budgets and thresholds | MUST | 1 | P1 FR-64 |
| CFG-07 | Platform values: sender legal name and brand, postal address, privacy URL, help URL, support email, product name, site URL, allowed link hosts. Typed; injected at compile time or provided at runtime through a typed context (RUN-04); never overridable by template data | MUST | 1 | P1 FR-22, 03 §15.2 |
| CFG-08 | Output options: module format `ts` (default) or `js` + `.d.ts`, per-template entry points, runtime validator on or off | MUST | 1 | 06 §4, architecture-direction |
| CFG-09 | Record the import alias chosen at `init` (`@/email-kit`, `#email-kit` or relative) and use it in printed examples, `new` and the studio | MUST | 1 | phase-1-scope |
| CFG-10 | Validate the config with readable, path-specific errors | MUST | 1 | P1 T-CLI-08 |
| CFG-11 | Compliance defaults used by template-level legal checks: the `global-strict` profile, footer slot values and the opt-out wording key | SHOULD | 1 | 03 §12 |
| CFG-12 | Category model: the project defines its own `category` values (who may receive an email), separate from the legal `purpose` | MUST | 1 | 03 §15.1, P2 |

### 7.5 CLI (CLI)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| CLI-01 | The `email-kit` command (in `@email-kit/cli`) has `init`, `new`, `compile` (alias `generate`), `check`, `dev` and `tokens` | MUST | 1 | D9 |
| CLI-02 | `new <id>` validates the id grammar, then scaffolds the template, messages in every locale and a fixture. It refuses an existing id and prints the import example | MUST | 1 | P1 FR-111 |
| CLI-03 | `compile [--watch]` writes the output folder deterministically, only touches files it owns, and prints a summary (templates × locales, sizes, warnings) | MUST | 1 | D9 |
| CLI-04 | `check [--json] [--reporter github]` exits 1 on any error and 0 with only warnings. The JSON has a stable, versioned schema | MUST | 1 | P1 FR-60/65 |
| CLI-05 | `dev` starts the studio with watch and live reload | MUST | 1 | D5 |
| CLI-06 | Every error carries an id, `file:line:col`, why, how to fix, and a docs URL, with code frames | MUST | 1 | 06 §7 |
| CLI-07 | `--help`, `--version`, `NO_COLOR`, `--quiet` / `--verbose` | MUST | 1 | — |
| CLI-08 | Arguments parsed with `cac` or `citty`; prompts with `@clack/prompts` | SHOULD | 1 | 06 §7 |
| CLI-09 | `tokens` prints the resolved role palette per mode or permutation, with every contrast ratio and pass/fail | SHOULD | 1 | P1 E7 |
| CLI-10 | `doctor` (project) checks the Node version, config validity, theme source, stale output, a gitignored output folder, tsconfig `jsx` and alias, and duplicate dependencies | SHOULD | 2 | 06 §7 |
| CLI-11 | `migrate` runs versioned codemods between majors | MAY | 2 | 06 §7 |
| CLI-12 | `add <item>` installs registry blocks, templates and themes (wrapping the registry JSON for projects without `components.json`) | SHOULD | 2 | 06 §5 |
| CLI-13 | `export` produces a static build of the studio for sharing (PR review) | SHOULD | 2 | 06 §6.2 |
| CLI-14 | Id registry (`email-kit/ids.lock`): removing or renaming a shipped id needs `--retire <id>` | SHOULD | 2 | P1 C14 |

### 7.6 Template authoring API (AUTH)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| AUTH-01 | `defineEmail({ id, purpose, category?, schema, subject, preheader, fixtures, component, … })`, generic over its schema and fully typed | MUST | 1 | P2 defineTemplate, P1 catalogue |
| AUTH-02 | Ids match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` and are unique; the docs say never rename a shipped id | MUST | 1 | P1 FR-06, P2 |
| AUTH-03 | `purpose`: `transactional` \| `marketing` \| `consent-request` (required). Optional `category` (project-defined), `requestedByRecipient` and `expiresAfterMs`. All are emitted as metadata | MUST | 1 | 03 §15.1, P2 |
| AUTH-04 | `schema`: any Standard Schema (Zod 4 is the documented default). It must stay within the portable JSON Schema subset (R4). Fields can be marked `secret` (codes, tokens) and `url` (HTTPS plus allow-list). Refinements are allowed but run only in the TS validator | MUST | 1 | R4, 04 §10.4 |
| AUTH-05 | `subject` and `preheader` are functions of `(data, t)` compiled to placeholder templates. The preheader must differ from the subject | MUST | 1 | P1 FR-07, 05 §7 |
| AUTH-06 | `fixtures`: at least one named fixture, validated against the schema. Multiple cases are supported. Long, empty and hostile variants are generated automatically | MUST | 1 | P1 FR-74, 05 §8 |
| AUTH-07 | Typed `data` proxy: scalars become placeholders; arrays are allowed only in `<Each>`; optional or boolean fields only in `<If>`; nested paths are supported; misuse is a type error | MUST | 1 | architecture-direction |
| AUTH-08 | Control-flow components `<Each>`, `<If>`, `<Else>` and `<Unless>` map to sections and inverted sections | MUST | 1 | R2 |
| AUTH-09 | Typed `t()`: message keys and ICU parameters are typed from the default locale's messages (generated declarations); there is a shared layout namespace | MUST | 1 | P2, architecture-direction |
| AUTH-10 | Data values are always escaped. The raw HTML escape hatch (`<Raw>`) needs an explicit allow-list entry with a reason | MUST | 1 | P1 SEC-01 |
| AUTH-11 | Type-level purpose rules: `marketing` requires the unsubscribe slot; `consent-request` requires the remove link and forbids promo slots | MUST | 1 | 03 §15.2 |
| AUTH-12 | Link helpers build URLs from the configured site URL, put tokens in the URL fragment, and only accept typed `url` fields in `href`/`src` | MUST | 1 | P2 links, 04 §5.2 |
| AUTH-13 | Users can write their own typed components (in `components/`) from primitives and theme roles | MUST | 1 | P1 FR-36 |
| AUTH-14 | Per-template overrides: a hand-written plain-text part, a dark strategy (`auto` / `light-only`), and a layout variant | MUST | 1 | 05 ⚠7, 02 D6 |
| AUTH-15 | Putting a code in the subject is an explicit opt-in per secret field. A code is never allowed in the preheader | MUST | 1 | 04 §8 #2, 05 ⚠10 |
| AUTH-16 | Metadata for a later send layer: the `listUnsubscribe` URL field, a threading hint (`isolate` / `thread`), and the reply-to strategy | SHOULD | 1 | 04 §10 |

### 7.7 JSX runtime and compilation (JSX)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| JSX-01 | email-kit's own JSX runtime (`@jsxImportSource @email-kit/core`, no React) produces an intermediate tree (IR) | MUST | 1 | architecture-direction |
| JSX-02 | The per-file pragma type-checks in host setups (`jsx` unset plus one line, `react-jsx` + `hono/jsx`, Next.js `preserve`), with automated tests | MUST | 1 | SPK-03 |
| JSX-03 | The CLI compiles templates with its own transform, independent of the host tsconfig | MUST | 1 | SPK-11 |
| JSX-04 | The IR has nodes for elements, text, placeholders, sections, inverted sections, MSO conditionals, and HTML-only / text-only branches | MUST | 1 | 05 §13.2 |
| JSX-05 | Each component defines an HTML renderer, a text renderer and dark-mode hooks (at the element carrying the inline colour) | MUST | 1 | 05 §13.2, P1 |
| JSX-06 | Everything not data-dependent is evaluated at compile time (config, locale, theme, static conditionals) | MUST | 1 | R1 |
| JSX-07 | Clear compile errors for unsupported data use: arithmetic or string methods on placeholders, data-dependent styles, placeholders in tag names | MUST | 1 | — |
| JSX-08 | Placeholders in attributes (`href`, `src`, `alt`, `title`) use the right escaping context; only `url` fields are allowed in `href`/`src` | MUST | 1 | 04 §6.1 |

### 7.8 Placeholder dialect and conformance (DLG)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| DLG-01 | Publish the mustache-core spec v1: `{{x}}`, `{{{x}}}`, sections, inverted sections, lists, `{{.}}`; no runtime partials, lambdas, helpers or filters | MUST | 1 | R2 |
| DLG-02 | Escaping table: the HTML part escapes `& < > " '` (identical in text and attribute contexts); text and subject are not escaped | MUST | 1 | R3, 06 §3.2 |
| DLG-03 | Missing or invalid values: validation happens before render; renderer behaviour on a missing value is defined (an error), never silent blanks | MUST | 1 | 06 §3.2 |
| DLG-04 | A conformance suite as JSON (template + data → exact bytes), including hostile values (markup, quotes, `{{`, `}}`, emoji, RTL, 10 KB strings) | MUST | 1 | R8, P1 hostile fixture |
| DLG-05 | Compiled templates are valid for stock Mustache and Handlebars engines (verified), for backends that prefer their own engine | SHOULD | 1 | phase-1-scope |
| DLG-06 | The dialect is versioned (`mustache-core@1`) and recorded in the manifest | MUST | 1 | R7 |

### 7.9 Compiler pipeline and HTML output (BLD)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| BLD-01 | Render every template × locale from the IR to HTML | MUST | 1 | D7 |
| BLD-02 | Document skeleton as in research 01 §2:<br>• HTML5 doctype<br>• `<html lang dir>`, plus `xmlns:o`/`xmlns:v` only when used<br>• meta charset first, viewport, `x-apple-disable-message-reformatting`, `format-detection`, and the colour-scheme signals for the dark strategy<br>• `<title>` equal to the subject<br>• the DPI XML inside MSO conditionals and `<noscript>` (classic target)<br>• one `<style>`, in the head<br>• a bare `<body>` with `xml:lang`<br>• a wrapper `div` with `role="article"`, `aria-label` set to the subject, and `lang`/`dir` (`aria-roledescription` only when localised) | MUST | 1 | 01 §2, 02 |
| BLD-03 | CSS pipeline:<br>• theme values become 6-digit hex;<br>• every declaration is written inline by the compiler, with no HTML inliner (ADR 0005);<br>• only enhancement rules stay in `<style>`;<br>• the serialiser puts a space between `}` characters, writes ` !important` in lowercase, and emits no comments, nesting or custom properties;<br>• styles total at most 16 KB | MUST | 1 | 01 §3, §12.1 |
| BLD-04 | Hybrid table layout shell: a 100% wrapper table, a container with `max-width` and an MSO ghost table, `role="presentation"` tables, inline-block columns with ghost cells, and media queries only to tune | MUST | 1 | 01 §4, §12.1 |
| BLD-05 | Dark CSS generated from one rule list: `@media (prefers-color-scheme: dark)` and `[data-ogsc]`/`[data-ogsb]` twins, aimed at the element carrying the inline colour. Colour-scheme meta per strategy; `light only` opt-in for Gmail apps | MUST | 1 | 02 D2–D11, P1 FR-43/44 |
| BLD-06 | An MSO font override, the Apple data-detector reset and the `format-detection` meta | MUST | 1 | P1, 01 §2 |
| BLD-07 | The preheader is the first element (hidden with `display:none;max-height:0;overflow:hidden;mso-hide:all`), padded with the configured filler, and its text is the first line of the text part | MUST | 1 | 01 §10.1 |
| BLD-08 | Deterministic, byte-identical output across runs and operating systems (LF line endings, stable ordering) | MUST | 1 | P1 FR-51 |
| BLD-09 | Safe minification only (whitespace collapse); MSO blocks stay byte-identical; no line over 998 octets | MUST | 1 | 01 §10.5, 04 §1.1 |
| BLD-10 | Void elements are serialised without `/` (Yahoo drops `class` on self-closing `img`/`hr`) | MUST | 1 | 01 §0 |
| BLD-11 | Image URLs are resolved to absolute HTTPS from `assetsBaseUrl`; `width`/`height` are required on images | MUST | 1 | 01 §6 |
| BLD-12 | `--watch` recompiles on changes to templates, components, messages, theme, fixtures or config | MUST | 1 | P1 FR-56 |
| BLD-13 | Incremental compile (only affected templates and locales) | SHOULD | 1 | NFR-04 |
| BLD-14 | A style-stripped variant (no `<style>`) is rendered for checks and the studio | MUST | 1 | 01 §1.4 |
| BLD-15 | RTL: dir-aware physical alignment, mirrored padding, column reversal, LTR islands for codes, URLs and numbers | MUST | 1 | 05 §10, 01 §10.4 |
| BLD-16 | Opt-in web fonts with an MSO fallback, `mso-font-alt`, and a privacy warning | MAY | 2 | 05 ⚠3 |
| BLD-17 | Asset pipeline: optimise images, check 2× sizing and weight, optional upload hook | MAY | 2 | 05 §4 |
| BLD-18 | Multi-brand compile: one output per brand modifier | SHOULD | 2 | 05 §12.1, P1 FR-46 |

### 7.10 Plain-text part (TXT)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| TXT-01 | The text part is derived from the component tree through per-component text renderers, never by stripping HTML | MUST | 1 | 05 ⚠7 |
| TXT-02 | A hand-written override per template (same placeholders) is allowed, and linted like generated text | MUST | 1 | P1 |
| TXT-03 | Formatting:<br>• wrap at 78 columns (URLs exempt);<br>• headings underlined, `-` and `1.` lists, tables as `Label: value`, buttons as `Label: <URL>`;<br>• full absolute URLs, no entities;<br>• the preheader as the first line, codes on one line | MUST | 1 | 05 §11, 04 |
| TXT-04 | Values in the text part are not escaped | MUST | 1 | P1 FR-82 |
| TXT-05 | User-supplied values are bidi-isolated (FSI…PDI) in the text part | SHOULD | 1 | 05 §10 |

### 7.11 Output artifacts and generated module (OUT)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| OUT-01 | Output layout `<code root>/email-kit/_generated/` (ADR 0007; sources are `<id>/template.tsx` + `<id>/messages.<locale>.json`):<br>• `index.ts` and `messages.d.ts`;<br>• with `contract: true` (opt-in): `manifest.json`, `<id>/<locale>.html`, `<id>/<locale>.txt` and `<id>/schema.json`;<br>• subject and preheader per locale in the module (and the manifest) | MUST | 1 | D6, OUT |
| OUT-02 | Every generated file starts with a do-not-edit header. The compiler owns the output folder and removes what it didn't write, except names starting with `.`; it refuses a non-empty folder it didn't write (ADR 0007) | MUST | 1 | phase-1-scope |
| OUT-03 | `manifest.json` (with `contract: true`) holds `schemaVersion`, the email-kit version, the dialect, the escaping profile and a signature. Per template it holds the id, purpose, category, flags, locales, byte and character sizes, and hashes | MUST | 1 | R7, P1 FR-54 |
| OUT-04 | `schema.json` (JSON Schema 2020-12) per template, from `~standard.jsonSchema` or a converter | MUST | 1 | R4 |
| OUT-05 | `index.ts` imports only `@email-kit/runtime`, and only the entry points its templates use; the templates are parsed at compile time (ADR 0007). It holds types emitted from the schemas, the `TemplateId` and `Locale` unions, the `emails` object (per template: `render()`, `validate()`, `meta`) | MUST | 1 | architecture-direction |
| OUT-06 | Per-template entry points, so a Worker that sends one email bundles one template | SHOULD | 1 | 06 §4 |
| OUT-07 | `.mjs` + `.d.mts` emission: required for `tsc`-built hosts (the ADR 0004 default), optional elsewhere | MUST | 1 | P1 Q4, ADR 0004 |
| OUT-08 | An optional, dependency-free runtime validator generated from the JSON Schema | SHOULD | 1 | architecture-direction |
| OUT-09 | Locale fallback at render time (BCP 47 lookup) | MUST | 1 | 05 §10 |
| OUT-10 | `render()` returns `{ subject, preheader, html, text, meta }` | MUST | 1 | P1 FR-80, P2 |
| OUT-11 | Identifiers derived deterministically (R6), with reserved-word escaping and collision detection | MUST | 1 | R6 |
| OUT-12 | Output with stable diffs (sorted keys, stable formatting) | MUST | 1 | P1 |

### 7.12 Runtime renderer (RUN)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| RUN-01 | A TS mustache-core renderer, published as `@email-kit/runtime` (core about 1.5 KB, everything about 3 KB, min+gzip): zero dependencies, web-standard APIs only; runs in Node 22+, Bun, Deno, Workers, Lambda and Next.js server code | MUST | 1 | 06 §4 |
| RUN-02 | Passes 100% of the conformance suite | MUST | 1 | R8 |
| RUN-03 | A warm render of a 60-line-item receipt takes under 5 ms; a cold import of one template takes under 50 ms | MUST | 1 | P1 NFR-02/03 |
| RUN-04 | Runtime context: typed platform values that vary by environment (such as the site URL) are passed once (`createEmails({ siteUrl })` or an equivalent) and merged after data, so data can't override them | MUST | 1 | P1 FR-22, P2 siteUrl |
| RUN-05 | Escaping exactly as specified. With the validator on, `url` fields are checked (scheme and host) at render time | MUST | 1 | DLG-02, SEC-02 |
| RUN-06 | The subject output never contains CR or LF (rejected or normalised) | MUST | 1 | 04 §6.2 |

### 7.13 Internationalisation (I18N)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| I18N-01 | Messages in `messages/<locale>/<template>.json` plus a shared `layout` namespace, in ICU MessageFormat 1 behind an MF2-ready abstraction | MUST | 1 | P2, 05 §10 |
| I18N-02 | Messages are resolved at compile time, with one artifact per template × locale | MUST | 1 | D7 |
| I18N-03 | A missing key in any locale or slot (body, subject, preheader, alt, text) is a compile error | MUST | 1 | P2 FR-009 |
| I18N-04 | Locale fallback chain (RFC 4647 lookup, CLDR parents) | MUST | 1 | 05 §10 |
| I18N-05 | Generated pseudo-locales: length-scaled, accented and bracketed (`en-XA` style), and RTL (`ar-XB` style). Used by checks and the studio; never shipped unless configured | MUST | 1 | 05 ⚠5 |
| I18N-06 | Runtime plurals per ADR 0003: generated CLDR category functions in each runtime's data-preparation step, with each locale's plural categories validated | MUST | 1 | SPK-04 |
| I18N-07 | Values that depend on runtime data, such as dates and money, arrive as caller-formatted strings with `format` hints in the schema. The docs show the formatting recipes | MUST | 1 | R5 |
| I18N-08 | CJK and Thai font stacks per script, with adjusted line heights | SHOULD | 1 | 05 §10 |
| I18N-09 | Translator workflow: export and import messages (JSON or XLIFF), report unused keys, translator notes | SHOULD | 2 | 05 §10 |

### 7.14 Theme and tokens (THM)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| THM-01 | Inputs: DTCG 2025.10 files with resolver modifiers (theme and brand), shadcn CSS (`:root` / `.dark` / `@theme inline`), and a typed TS object | MUST | 1 | 05 §12 |
| THM-02 | More inputs: shadcn registry themes and presets (tweakcn), Tailwind v4 `@theme`, Tokens Studio sets and themes | SHOULD | 2 | 05 §14.1 |
| THM-03 | Colour conversion: CSS Color 4 gamut mapping (OKLCH, P3 → sRGB), 6-digit hex output, DTCG `hex` fallback honoured, alpha flattened against the actual surface | MUST | 1 | 05 §12.6 |
| THM-04 | Semantic roles with documented defaults and overrides:<br>• surfaces: `pageGround`, `canvas`, `card`, `muted`, `codeSurface`, `inverse`;<br>• content: `ink`, `mutedInk`, `subtleInk`, `inverseInk`, `link`;<br>• lines: `hairline`, `divider`, `strongBorder`;<br>• actions: primary, secondary and destructive `{fill, label, border}`;<br>• status: info, success, warning and error × `{ink, surface, border, fill, onFill}`;<br>• brand: `brand`, `onBrand`, `brandInk` | MUST | 1 | 05 §12.5, §14.1 |
| THM-05 | Typography:<br>• scale steps `display`, `h1`–`h3`, `lead`, `body`, `bodySm`, `caption`, `footer`, `button`, `code`, `otp`, `wordmark`;<br>• for each: px size, px line height, weight 400\|700, px letter-spacing;<br>• `sans`, `serif` and `mono` stacks, each ending in a generic family with an MSO fallback; per-script additions | MUST | 1 | 05 §2, §14.1 |
| THM-06 | Spacing scale (4 px base) with semantic aliases; radius scale in px (shadcn multipliers); border widths; layout (container 600, range 480–640, breakpoint 480, up to 3 columns, about 75 characters of content) | MUST | 1 | 05 §1, §14.1 |
| THM-07 | Component tokens:<br>• button variants and sizes (minimum height ≥ 44);<br>• link, card, callout tones, badge tones;<br>• OTP code: stack, size, letter-spacing, surface;<br>• table: header, row divider, zebra;<br>• footer | MUST | 1 | 05 §14.1 |
| THM-08 | Dark strategy `authored` \| `none`; dark overrides derived and validated per role; `light-only` per template | MUST | 1 | 05 §14.1, 02 |
| THM-09 | Assets: light and dark logo (2× PNG), alt text, wordmark text, logo tile, icon set | SHOULD | 1 | 05 §4 |
| THM-10 | Validation runs on every resolved permutation (the `tokens.*` checks) | MUST | 1 | 05 §14.1 |
| THM-11 | Auto-adjust `mutedInk` to the nearest lightness that passes the mid-tone and contrast rules, with an explanation (a default shadcn theme fails them as is) | SHOULD | 1 | 05 ⚠8 |
| THM-12 | Emit a resolved `theme.json` and a typed theme for app use (optional output) | SHOULD | 1 | 06 §3.4 |

### 7.15 Components (UI)

Package `@email-kit/components`. Every component has: typed props derived from the theme (`variant`,
`size`, `tone`), token names rather than raw values, an email-safe HTML renderer, a text renderer,
dark-mode hooks, RTL behaviour, and the accessibility behaviour from research 02 and 05 §13.2.

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| UI-01 | Component package conventions as above (shadcn vocabulary; props typed from the theme) | MUST | 1 | 05 §13.2 |
| UI-02 | `EmailRoot`: document, meta, resets, wrapper; `lang`, `dir`, subject and colour-scheme props | MUST | 1 | 05 §13.2 |
| UI-03 | `Preheader`: hidden preview text with auto padding, excluded from the text part apart from its first line | MUST | 1 | 01 §10.1 |
| UI-04 | `Layout`: the single shell (header, h1, body, at most one primary CTA, footer), enforcing the footer slots per `purpose` | MUST | 1 | P2 Layout, 03 §15.2 |
| UI-05 | `Container` / `Section`: width, padding from the scale, surface; padding only, never margins | MUST | 1 | 05 §13.2 |
| UI-06 | `Row` / `Column`: 1–3 columns, gap, stacking breakpoint, alignment, reversed on RTL; hybrid structure plus ghost tables | MUST | 1 | 01 §12.2 |
| UI-07 | `Heading`: levels h1–h3, sizes; one h1 per email | MUST | 1 | 02 |
| UI-08 | `Text`: size (`lead`, `body`, `sm`, `caption`), tone, start-aligned by default, weight 400\|700, px line height + `mso-line-height-rule` | MUST | 1 | 05 §2 |
| UI-09 | `Link`: underlined in running text, tone, `url` fields only, `aria-label` must contain the visible text | MUST | 1 | 02, 05 |
| UI-10 | `Button`: variants (primary, secondary, outline, ghost, destructive); sizes 36/44/52 px minimum height (`sm` only for non-primary); full width (never, mobile, always); padded `<a>` with `mso-padding-alt` and `mso-text-raise`; optional VML (with a ~32,000 px warning); `showUrl`; text form `Label: URL`; never `role="button"` | MUST | 1 | 01 §5, 02, 05 §6 |
| UI-11 | `Image`: required `alt` and `kind` (decorative, informative, functional); `width`/`height`; `display:block`; fluid option; no SVG, WebP or AVIF unless opted in | MUST | 1 | 01 §6, 02 |
| UI-12 | `Logo` / `Wordmark`: live-text wordmark by default; image variants (2× PNG) with dark handling (tile, stroke, or swap) | MUST | 1 | 05 §4, 02 §1.5 |
| UI-13 | `Divider`: a 1 px filled cell (no Word border quirks) | MUST | 1 | 01 §12.2 |
| UI-14 | `Spacer`: a cell with explicit height and line height; never `letter-spacing` | MUST | 1 | 01 §12.2 |
| UI-15 | `List`: real `ul`/`ol` with Outlook-safe margins | MUST | 1 | 05 §13.2 |
| UI-16 | `KeyValue`: fact rows, stacked or inline, stacking on mobile, `copyable` values | MUST | 1 | 05 §13.2 |
| UI-17 | `DataTable`: no presentation role; `th scope`; a caption or a heading before it; numbers end-aligned; stacks to `label: value` below 320 px; text form `Label: value` | MUST | 1 | 02, 05 |
| UI-18 | `LineItems` / `Receipt`: items, subtotal, discounts, shipping, tax (rate, amount, inclusive flag), total, currency; a reconciliation assertion in dev; caller-formatted money strings | MUST | 1 | 05 §9 |
| UI-19 | `OtpCode`: the code as contiguous text in a sentence plus a large display; letter-spacing rather than separate spans per digit; one copy only; no `aria-label` on a `div` | MUST | 1 | 02, 04 §5.1, 05 §9 |
| UI-20 | `Callout`: tones, a title carrying the meaning, a decorative icon (PNG, `aria-hidden`) | MUST | 1 | 05 §13.2 |
| UI-21 | `Footer`: slots for sender, reason, help URL, postal address, privacy URL, unsubscribe URL with explicit wording, preferences URL, legal text; required slots per `purpose` | MUST | 1 | 03 §15.2 |
| UI-22 | `Conditional`: `mso`, `notMso`, `textOnly` and `htmlOnly` branches (escape hatch, linted for balance) | MUST | 1 | 05 §13.2 |
| UI-23 | `Header`: logo, alignment, link; no navigation in transactional mail | SHOULD | 1 | 05 §1 |
| UI-24 | `CodeInline` / `CodeBlock`: mono stack, wrapping | SHOULD | 2 | 05 §14.2 |
| UI-25 | `Badge`: tones and variants; text always present | SHOULD | 2 | 05 §14.2 |
| UI-26 | `Card`: surface, padding, radius, border instead of shadow | SHOULD | 2 | 05 §14.2 |
| UI-27 | `Avatar`: image with an initials fallback as live text | SHOULD | 2 | 05 §14.2 |
| UI-28 | `Steps` / `Progress`: text states, not colour alone | SHOULD | 2 | 05 §14.2 |
| UI-29 | `Markdown`: sanitised, re-levelled headings, elements mapped to components | SHOULD | 2 | 05 §14.2 |
| UI-30 | `SocialLinks`: PNG icons, alt set to the network name, targets ≥ 44 px | SHOULD | 2 | 05 §14.2 |
| UI-31 | Lifecycle and marketing set: `Hero`, `Quote`/`Testimonial`, `Stats`, product cards and grid, `Pricing`, `Gallery`, `QrCode` | MAY | 2 | 05 §14.2 |
| UI-32 | Starter templates (via `new --from`): OTP / sign-in code, magic link, password reset, password changed, email changed (old and new address), new sign-in alert, account recovery, welcome, invitation, receipt, shipping, digest, double opt-in (consent-request), generic notification | SHOULD | 1 | 05 §9 |
| UI-33 | Component documentation and gallery in the studio (props, variants, a11y notes) | SHOULD | 2 | — |
| UI-34 | Animated images: a first-frame-carries-message rule and a static fallback | SHOULD | 2 | 02, 05 §4 |

### 7.16 Registry distribution (REG)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| REG-01 | A shadcn-compatible registry (`registry.json`, GitHub registry at `email-kit/registry`) for blocks, templates and themes, installable with `npx shadcn add email-kit/registry/<item>#<tag>` | SHOULD | 2 | 06 §5 |
| REG-02 | Registry items import primitives from `@email-kit/components`; provenance noted per item | SHOULD | 2 | 06 §5.2 |
| REG-03 | `email-kit add` wraps the registry for projects without `components.json` (see CLI-12) | SHOULD | 2 | 06 §5 |

### 7.17 Check engine (CHK)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| CHK-01 | One check engine over compiled output, sources, theme, messages and fixtures, shared by the CLI, the studio and CI | MUST | 1 | P1, 06 |
| CHK-02 | Stable check ids; levels `error` / `warn` / `info`; per-id config with a required reason | MUST | 1 | P1 FR-64 |
| CHK-03 | Reporters: human (grouped by template), JSON (stable schema), GitHub annotations | MUST | 1 | P1 FR-65, 06 §7 |
| CHK-04 | Each finding carries: id, level, subject (template, locale, `file:line`), message, fix, docs URL | MUST | 1 | P1 FR-61 |
| CHK-05 | Target-aware: `outlookClassic` enables the `mso.*`/`layout.ghost-table` checks; tiers adjust levels | MUST | 1 | 01 §1.4 |
| CHK-06 | Fixture sweep: render-dependent checks run with every fixture plus the generated variants; size checks use the largest | MUST | 1 | P1 C5 |
| CHK-07 | Parser-based checks (parse5/htmlparser2 + postcss) with an MSO-aware tokenizer; no regex-only HTML checks | MUST | 1 | P1 C9 |
| CHK-08 | A custom checks API (`{ id, level, run(ctx) }`) for team rules | SHOULD | 1 | P1 03 |
| CHK-09 | caniemail-based compatibility lint, filtered by target clients, using a vendored, dated snapshot of the caniemail data (no network) | SHOULD | 1 | 06 §2.7 |
| CHK-10 | One docs page per check id (rule, why, fix, sources) | MUST | 1 | P1 E9 |
| CHK-11 | Implement the phase-1 checks in Appendix A | MUST | 1 | Appendix A |
| CHK-12 | Render-based checks with a headless browser (Playwright): forced-dark modes, axe-core, images-off, reflow at 320 px, computed target sizes | MUST | 2 | 02 §2.6 |
| CHK-13 | Implement the phase-2 checks in Appendix A | MUST | 2 | Appendix A |
| CHK-14 | Opt-in spam score through SpamAssassin (Docker or Mailpit), with a threshold | SHOULD | 2 | 04, 06 §9 |
| CHK-15 | Implement the phase-4 (send-layer) checks in Appendix A | MUST | 4 | Appendix A |

### 7.18 Preview studio (STU)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| STU-01 | `email-kit dev` runs a Vite app that renders **compiled artifacts** with fixtures through the TS runtime, never a separate renderer | MUST | 1 | D5, 06 |
| STU-02 | Template list with search; fixture switcher; locale switcher including the pseudo-locales | MUST | 1 | 06 §6.2 |
| STU-03 | Width presets (320, 375, 414, 600, 768, full) plus free resize | MUST | 1 | 06 §6.2 |
| STU-04 | Light and authored-dark side by side, clearly labelled | MUST | 1 | 06 §6.2 |
| STU-05 | Tabs: Rendered, HTML source (pretty), Plain text (78-column ruler and link list), Subject + preheader inbox row, Data (fixture JSON), Meta (manifest entry) | MUST | 1 | 06 §6.2, 05 §14.4 |
| STU-06 | HTML size meter against Gmail's clip; `<style>` size meter | MUST | 1 | 05 §14.4 |
| STU-07 | A check panel (same engine) with jump-to-source | MUST | 1 | 06 §6.2 |
| STU-08 | Live reload on any input change; an error overlay with a code frame | MUST | 1 | 06 §6.2 |
| STU-09 | Download a `.eml` (`multipart/alternative`) to open in real mail apps | MUST | 1 | phase-1-scope |
| STU-10 | Images-off view and style-stripped view | SHOULD | 1 | 01, 05 §14.4 |
| STU-11 | A basic theme inspector: role palette per mode with contrast ratios | SHOULD | 1 | 05 §14.4 |
| STU-12 | Forced-dark simulations: Gmail Android (real Chromium forced dark), forced-full (LAB), Outlook.com (`data-og*` + contrast repair), Yahoo dark (HSL −70%); a "Gmail opted out" badge for `light only` | MUST | 2 | 02 implications |
| STU-13 | Accessibility panel: axe results, heading outline, landmark and wrapper label, reading order, links list, alt texts, tap-target overlay, approximate screen-reader transcript | MUST | 2 | 02, 05 §14.4 |
| STU-14 | Inbox mock-up with truncation per client (about 37/48/70 characters) and a "first sentence as AI summary" view | SHOULD | 2 | 05 §14.4 |
| STU-15 | Fixture editor generated from the JSON Schema, with "save as fixture" | SHOULD | 2 | 06 §6.2 |
| STU-16 | Visual-regression snapshots (Playwright Chromium + WebKit) with a diff view | SHOULD | 2 | 06 §6.2 |
| STU-17 | Send-test to Mailpit (zero-config), Ethereal or SMTP (dev only) | SHOULD | 2 | 06 §6.2 |
| STU-18 | Static export for PR review (see CLI-13) | SHOULD | 2 | 06 §6.2 |
| STU-19 | Spam-score panel (see CHK-14) | MAY | 2 | 06 §6.2 |
| STU-20 | Outlook ghost mode: square corners, no shadows or gradients, weights snapped to 400/700 | SHOULD | 2 | 05 §14.4 |
| STU-21 | Motion inspector for animated images, with a first-frame preview | MAY | 2 | 02 |
| STU-22 | QR code to open the preview on a phone on the LAN | MAY | 2 | 06 §6.2 |
| STU-23 | "Copy for AI" (problems + source) and an MCP server exposing templates, checks and fixtures | MAY | 2 | 06 §6.2 |
| STU-24 | Litmus / Mailgun Inspect hand-off (upload and open a test) | MAY | 2 | 06 §9 |
| STU-25 | Full theme inspector: every permutation, gamut-mapping deltas, contrast heat-map of failing pairs | SHOULD | 2 | 05 §14.4, 02 |
| STU-26 | Real-device checklist export and a screen-reader test protocol | MAY | 2 | 02 |
| STU-27 | Headers tab (List-Unsubscribe, tags, threading) once the send layer exists | SHOULD | 4 | 06 §6.1 |

### 7.19 Security (SEC)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| SEC-01 | Every data value is HTML-escaped in the HTML part (text and attribute contexts); the text part is unescaped; no raw data output without an allow-listed `<Raw>` | MUST | 1 | P1 SEC-01, 04 §6.1 |
| SEC-02 | URLs:<br>• HTTPS only (configurable) and a host allow-list;<br>• no userinfo, IP hosts, control characters or shorteners;<br>• never `javascript:`, `data:`, `vbscript:` or `file:`.<br>Enforced at compile time for literals, and at render time when the validator is on | MUST | 1 | 04 §8 #3 |
| SEC-03 | `secret` fields never appear in the preheader, query strings, metadata or logs; in the subject only with an opt-in | MUST | 1 | 04 §10.4 |
| SEC-04 | Auth link helpers put tokens in the fragment. The docs require landing pages that act only on a button press (GET has no side effects), and turning click tracking off for auth mail | MUST | 1 | 04 §5.2 |
| SEC-05 | No external requests from the email by default (fonts, stylesheets) and no tracking pixels | MUST | 1 | P1 SEC-06, 03 §4.3 |
| SEC-06 | No authoring comments or long HTML comments in the output | MUST | 1 | P1 SEC-05 |
| SEC-07 | Data minimisation: never passwords, full card or bank numbers, government IDs or full dates of birth; masking guidance; no email addresses or tokens in query strings | SHOULD | 1 | 03 §14, 04 §6.4 |
| SEC-08 | No "view in browser" link in templates carrying codes, tokens or personal data | MUST | 1 | 05 §8 |
| SEC-09 | Security policy (`SECURITY.md`), private vulnerability reporting, dependency audit in CI | MUST | 1 | — |

### 7.20 Template-level compliance (LEG)

Not legal advice. Profiles are reviewed by counsel before they ship (03).

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| LEG-01 | Every template declares a `purpose`. Footer slots per purpose follow research 03 §15.2 and are enforced by types (AUTH-11), `Layout` and `Footer`, and checks | MUST | 1 | 03 §15.2 |
| LEG-02 | `marketing`: a visible unsubscribe link in HTML **and** text with explicit, localised wording, a preferences link (SHOULD), postal address, sender identity, privacy link, and metadata `requiresListUnsubscribe: true` | MUST | 1 | 03 §12, §15.2 |
| LEG-03 | `consent-request`: sender identity, postal address, a remove or "not you?" link, no promotional content, no tracking | MUST | 1 | 03 §13 |
| LEG-04 | `transactional`: no promotional components (a promo slot forces `marketing`); an optional preferences link where a profile requires it (CA) | MUST | 1 | 03 R2, §13 |
| LEG-05 | Promo-slot variants: the same template can be rendered without its promo slot (for unsubscribed recipients) | SHOULD | 2 | 03 §13 |
| LEG-06 | A reason line ("why you got this") in every template | MUST | 1 | P2, 03 |
| LEG-07 | No tracking constructs in templates (pixels, recipient-specific image URLs, rewritten links) unless tracking is explicitly enabled; gating happens at send time in phase 4 | MUST | 1 | 03 R6 |
| LEG-08 | Template-level checks use the `global-strict` profile in phase 1; per-jurisdiction profiles arrive with the send layer (SND-06) | MUST | 1 | 03 §12 |
| LEG-09 | Minor audiences: templates flagged for minors can't be `marketing` and carry only minimal data (display name) | SHOULD | 2 | 03 §9, P2 NOT-005 |
| LEG-10 | The docs include a compliance guide (with a not-legal-advice notice) and profile `verifiedOn` dates | MUST | 1 | 03 |

### 7.21 Non-functional (NFR)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| NFR-01 | The generated module depends only on `@email-kit/runtime`, which has no dependencies; neither uses `fs`. Both use web-standard APIs and work in Node 22+, Bun, Deno, Cloudflare Workers, AWS Lambda and Next.js server code | MUST | 1 | 06 §4 |
| NFR-02 | The renderer is ≤ 3 KB min+gzip | SHOULD | 1 | 06 §4 |
| NFR-03 | Render and import performance as in RUN-03 | MUST | 1 | P1 NFR-02/03 |
| NFR-04 | Compile + check of 50 templates × 2 locales takes under 10 s on a laptop | MUST | 1 | P1 NFR-11 |
| NFR-05 | Byte-identical output on Linux, macOS and Windows | MUST | 1 | P1 FR-51 |
| NFR-06 | Default components and starters meet WCAG 2.2 AA in light and authored dark (MUST) and in forced modes (SHOULD) | MUST | 1 | 02 |
| NFR-07 | Default components and starters render correctly in the tier-1 matrix: Apple Mail iOS and macOS; Gmail web, Android and iOS; GANGA; classic Outlook at 100% and 125%; new Outlook/OWA; Yahoo. Verified before v1.0 | MUST | 1 | 01 §12.1 |
| NFR-08 | Every default design works with no `<style>` at all | MUST | 1 | 01 §1.4 |
| NFR-09 | Default layout + one paragraph < 20,000 characters of HTML | SHOULD | 1 | P1 NFR-04 |
| NFR-10 | A 60-item receipt < 90 KB of HTML | MUST | 1 | P1 NFR-05 |
| NFR-11 | No telemetry; no network during `compile` or `check` (opt-in features excepted) | MUST | 1 | P1 NFR-07 |
| NFR-12 | Windows-safe path handling throughout | MUST | 1 | P1 09 |
| NFR-13 | Test coverage ≥ 90% of lines in core, compiler, runtime and checks | SHOULD | 1 | P1 NFR-13 |
| NFR-14 | The studio UI is keyboard-accessible with AA contrast | SHOULD | 1 | — |
| NFR-15 | The output contract follows R1–R9 (no code in artifacts; portable schema; versioned manifest) | MUST | 1 | architecture-direction |

### 7.22 Documentation and examples (DOC)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| DOC-01 | A docs site:<br>• getting started (under 5 minutes) and concepts;<br>• authoring, components and theming references;<br>• i18n, the checks reference and the CLI reference;<br>• using the output in Next.js, Hono, Express, Workers and Lambda;<br>• "send with your provider" recipes (Resend, SES, Nodemailer, in the user's own code);<br>• transactional recipes, a compliance guide, an FAQ, and the API reference (TypeDoc) | MUST | 1 | P1 09 |
| DOC-02 | Examples in the repo, built and checked in CI: Hono, Next.js with and without `src/`, a Node `tsc` project (`#email-kit`), a monorepo shared package | MUST | 1 | phase-1-scope |
| DOC-03 | Contract specs for future language authors: mustache-core, the escaping table, the manifest schema, the JSON Schema subset, identifier rules | MUST | 1 | architecture-direction |
| DOC-04 | Repo docs: changelog, contributing guide, code of conduct, provenance record, security policy | MUST | 1 | — |
| DOC-05 | Migration guides: from React Email, from MJML, and from P1/P2-style setups | SHOULD | 2 | P1 09 |

### 7.23 Testing of email-kit itself (TST)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| TST-01 | Unit tests (Vitest) for core, compiler, theme, i18n, runtime and checks | MUST | 1 | P1 08 |
| TST-02 | Type tests (`expectTypeOf`, `@ts-expect-error`) for authoring and the generated module: wrong ids, fields, locales, keys, purpose rules | MUST | 1 | P1 T-CAT-04 |
| TST-03 | Golden output snapshots of the example projects; a snapshot change needs a changeset | MUST | 1 | P1 08 |
| TST-04 | A positive and a negative fixture for every check id | MUST | 1 | P1 T-CHK |
| TST-05 | CLI integration tests in temp dirs: `init` (polyrepo, Next.js with and without `src/`, monorepo package, `tsc` project), conflicts, `new`, `compile`, `check`, `dev` smoke test | MUST | 1 | P1 T-CLI |
| TST-06 | The conformance suite runs in CI | MUST | 1 | R8 |
| TST-07 | Nightly benchmarks against the performance budgets; fail on a > 20% regression | SHOULD | 1 | P1 08 |
| TST-08 | Host compatibility tests: the generated module in a Next.js build, Hono on Workers (Miniflare/Wrangler), Bun, and a Node `tsc` build | MUST | 1 | NFR-01 |
| TST-09 | Real-client verification of starters and components before every minor release (Litmus, Mailgun Inspect or a manual matrix) | MUST | 1 | NFR-07 |
| TST-10 | Hostile fixture set: markup, quotes, `{{`, `}}`, emoji, RTL text, 10 KB strings | MUST | 1 | P1 08 |
| TST-11 | `@email-kit/testing` render matchers (`toHaveBothParts`, `toBeUnderBytes`, `toEscapeMarkup`, `toContainInBothParts`) | SHOULD | 2 | P1 05 §9 |

### 7.24 Other languages (LNG), phase 3

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| LNG-01 | A target and emitter plugin API in the compiler (`targets: ["ts", "python", "go"]`) | MUST | 3 | architecture-direction |
| LNG-02 | Python emitter (dataclasses or TypedDict, optional pydantic) and runtime passing 100% of the conformance suite | MUST | 3 | R8 |
| LNG-03 | Go emitter (structs with json tags) and runtime passing 100% of the conformance suite | MUST | 3 | R8 |
| LNG-04 | Kotlin/KMP emitter (kotlinx.serialization data classes) and a `commonMain` runtime | SHOULD | 3 | 06 §3 |
| LNG-05 | A packaging decision per language (vendored runtime or published package: PyPI, Go module, Maven) | MUST | 3 | architecture-direction |
| LNG-06 | Per-language docs and examples (FastAPI/Django, Go `net/http`, Ktor) | MUST | 3 | — |
| LNG-07 | Cross-language CI runs the conformance suite in every runtime on every change | MUST | 3 | R8 |
| LNG-08 | A spec'd formatter set for dates and money across languages, if demand justifies it | MAY | 3 | R5 |

### 7.25 Sending layer (SND), phase 4 (last)

| ID | Requirement | Pri | Phase | Source |
|---|---|---|---|---|
| SND-01 | `@email-kit/send`: `createMailer`, typed `send(templateId, data, opts)`, failure policy per template (`throw` / `swallow`), safe structured logging, typed errors | MUST | 4 | P1 05, 04 §6.6 |
| SND-02 | A transport interface with capabilities (04 §10.3). Transports: SES v2, Resend, Postmark, SendGrid, SMTP (Node-only entry), memory, Mailpit | MUST | 4 | 04 §10.3 |
| SND-03 | MIME builder: `multipart/alternative` with text first; `multipart/related` for CID images; QP/base64; lines ≤ 998 (encoded ≤ 76) | MUST | 4 | 04 §10.2 |
| SND-04 | Default headers as in research 04 §10.1:<br>• From, To and Reply-To; the Subject encoded per RFC 2047;<br>• Date, Message-ID, `Auto-Submitted`, `X-Auto-Response-Suppress`;<br>• `References` isolation, `List-Unsubscribe` + `-Post`, `List-Id`, `Feedback-ID`;<br>• never `X-Priority`, `Importance` or `Precedence` | MUST | 4 | 04 §10.1 |
| SND-05 | One ordered list of runtime guards merging research 03 §15.6 and 04 §10.4:<br>• header, address, display-name, URL and secret;<br>• purpose, consent, suppression and age;<br>• tracking, subject prefix, quiet hours, config, date and size;<br>• idempotency, phantom and logging | MUST | 4 | 03, 04 |
| SND-06 | Compliance profiles as data, each with `verifiedOn`, `effectiveFrom` and sources: `global-strict`, `us`, `ca`, `ca-qc`, `eu`, `de`, `fr`, `uk`, `au`, `nz`, `sg`, `jp`, `kr`, `in`, `cn`, `lk`, `br`, `mx`. A send applies the union of the recipient's profiles and the sender's home profile | MUST | 4 | 03 §15.3 |
| SND-07 | Storage-agnostic hooks for consent records and suppression (HMAC keys, scopes, reasons) | MUST | 4 | 03 §15.4 |
| SND-08 | Idempotency key passthrough and dedupe, including Resend's 24-hour caveat | MUST | 4 | 04 §8 #10 |
| SND-09 | Phantom sends per transport capability, with the same latency profile | SHOULD | 4 | 04 §8 #4 |
| SND-10 | Error classification: retryable, permanent-recipient, permanent-sender, too-big, idempotency-conflict (including Gmail codes) | MUST | 4 | 04 §3.2 |
| SND-11 | Webhook normaliser for delivery, bounce and complaint events per provider | SHOULD | 4 | P2 |
| SND-12 | Tracking gate: pixels and click rewriting only with per-recipient consent; assert that provider-level tracking is off otherwise | MUST | 4 | 03 §15.6 |
| SND-13 | One-click unsubscribe endpoint helpers: POST, no redirect, no cookies or CSRF, GET does nothing; plus test utilities | MUST | 4 | 04 §1.6 |
| SND-14 | `doctor` DNS and endpoint check:<br>• SPF, DKIM, DMARC (RFC 9989), alignment;<br>• MX, PTR, domain age;<br>• MTA-STS/TLS-RPT, DANE, BIMI;<br>• link hosts, the one-click endpoint, and a probe via send-test | SHOULD | 4 | 04 §10.6 |
| SND-15 | `email-kit send-test <id> --to <addr> [--fixture] [--locale]` through the configured transport | MUST | 4 | P1 FR-113 |
| SND-16 | Identity-provider adapters: Cognito `CustomMessage` first (provider placeholders, a 20,000-character budget, never throws); then Supabase, Auth0, Clerk | SHOULD | 4 | P1 FR-100–104 |
| SND-17 | A memory transport in `@email-kit/testing` | MUST | 4 | P1 |

### 7.26 Later (FUT)

| ID | Idea | Pri | Phase |
|---|---|---|---|
| FUT-01 | AMP for Email as a third MIME part | MAY | L |
| FUT-02 | Import and migration from MJML or React Email templates | MAY | L |
| FUT-03 | Multiple rendering back-ends (MJML as an alternative output engine) | MAY | L |
| FUT-04 | An inbox-rendering integration as a paid add-on (Litmus or Mailgun Inspect API) | MAY | L |

---

## 8. Appendix A: check catalogue

Default levels: **E** error · **W** warn · **I** info. **Ph** = phase. Each check ships with a
positive and a negative fixture and a docs page (TST-04, CHK-10).

### A.1 Theme and tokens (`tokens.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `tokens.resolvable` | Every role resolves in every mode and permutation | E | 1 | P1 |
| `tokens.gamut` | Out-of-gamut colours are mapped; report the source → hex delta | I | 1 | 05 §12.6 |
| `tokens.alpha-flattened` | No alpha remains after flattening against the surface | E | 1 | 05 ⚠9 |
| `tokens.contrast` | Text pairs ≥ 4.5 (large text and non-text ≥ 3) in light and authored dark (E), and in forced-partial and forced-full modes (W) | E/W | 1 | 02 C4 |
| `tokens.link-contrast` | Link ≥ 4.5 against the canvas and the page ground in each mode | E | 1 | P2, 05 |
| `tokens.action-contrast` | Action label/fill ≥ 4.5; fill/canvas ≥ 3, or a border is set | E | 1 | 05 §6 |
| `tokens.brand-ink` | `brandInk`/canvas ≥ 4.5 | E | 1 | 05 §3 |
| `tokens.midtone` | Grounds behind text and meaningful borders aren't in L\* 40–65 (any hue) | W | 1 | 02 C3 |
| `tokens.offwhite-tint` | No near-white with a 1–3 unit channel offset | W | 1 | 02 C1 |
| `tokens.dark-ground` | The authored dark ground isn't `#000000` (target `#0a0a0a`–`#1a1a1a`) | W | 1 | 02 C2 |
| `tokens.light-ground` | The light ground isn't `#ffffff` | I | 1 | 02 C1 (downgraded) |
| `tokens.radius` | Radius values parse to single px values | E | 1 | P1 |
| `tokens.font-stack` | Every stack ends in a generic family and has an MSO fallback | E | 1 | 05 §2 |
| `tokens.weights` | Weights ∈ {400, 700} | W | 1 | 05 ⚠1 |
| `tokens.min-size` | Type sizes ≥ 14 px (W), never < 13 px (E) | E/W | 1 | 05 §2 |
| `tokens.letter-spacing` | Letter-spacing in px | W | 1 | 05 §2 |
| `tokens.button-height` | Button minimum height ≥ 44 px (`sm` only for non-primary) | E | 1 | 05 §6 |
| `tokens.container` | Container width within 480–640 | W | 1 | 05 §1 |
| `tokens.logo-dark` | An image logo has a dark variant or a tile; alt is the brand name | W | 1 | 05 §4 |
| `tokens.gmail-fill` | Action fill YIQ ≤ 205 (survives Gmail Android unchanged) | I | 1 | 02 C6 |

### A.2 Sources and catalogue (`source.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `source.id-grammar` | Ids match the grammar and are unique | E | 1 | P1 |
| `source.no-literal-colour` | No literal colours in templates or user components; use roles | E | 1 | P1 source.no-hex |
| `source.no-font-family` | No `font-family` in templates | E | 1 | P1 |
| `source.no-font-size` | No literal `font-size` in templates; use the type scale | E | 1 | P1 |
| `source.no-literal-copy` | All visible text comes from messages (configurable) | E | 1 | P2 ESLint |
| `source.raw-allowlisted` | Every `<Raw>` has an allow-list entry with a reason | E | 1 | P1 SEC-01 |
| `source.layout` | Every template renders through `Layout` | E | 1 | P1 |
| `source.fixture-exists` | Every template has ≥ 1 fixture | E | 1 | P1 |
| `source.fixture-valid` | Every fixture validates against the schema | E | 1 | P1 C4 |
| `source.schema-portable` | The schema stays within the portable JSON Schema subset (R4) | E | 1 | R4 |
| `source.fields-used` | Every schema field is used | W | 1 | P1 |
| `source.ids-locked` | Shipped ids aren't removed or renamed without `--retire` | E | 2 | P1 C14 |

### A.3 Document (`html.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `html.doctype` | Starts with `<!doctype html>` | E | 1 | P1 |
| `html.lang-dir` | `lang`/`dir` on `<html>` and the wrapper; `xml:lang` on the body; valid BCP 47; `dir` matches the locale | E | 1 | 01, 02 A7 |
| `html.wrapper-aria` | The wrapper has `role="article"` and `aria-label`; `aria-roledescription` only when localised | W | 1 | 01, 02 |
| `html.meta` | Charset first, viewport, `x-apple-disable-message-reformatting`, `format-detection` | E | 1 | P1, 01 §2 |
| `html.title` | `<title>` is present and equals the subject | W | 1 | 02 A24 |
| `html.xmlns` | `o:`/`v:` used ⇒ the matching `xmlns` is declared | E | 1 | 01 |
| `html.dpi-noscript` | PixelsPerInch XML inside MSO conditionals and `<noscript>` (classic target) | E | 1 | 01 |
| `html.body-bare` | `<body>` has no presentational attributes or styles beyond margin and padding 0 | W | 1 | 01 |
| `html.no-body-style` | No `<style>` inside `<body>` | E | 1 | P1 |
| `html.no-external` | No external stylesheets, `@import` or web fonts unless opted in | E | 1 | P1 SEC-06 |
| `html.no-forms-embeds` | No `form`, `input`, `script`, `iframe`, `object`, `embed`, `video` or `svg` | E | 1 | 04 §10.5, 01 §6 |
| `html.no-svg` | No SVG references and no inline `<svg>` | E | 1 | 01 §6 |
| `html.no-comments` | No non-MSO comments longer than 120 characters (or none) | E | 1 | P1 SEC-05 |
| `html.no-unresolved` | No leftover internal markers; every placeholder is declared in the schema and parses as mustache-core | E | 1 | P1, R2 |
| `html.hidden-text` | Hidden styling only on the single preheader element | W | 1 | 04 §10.5 |
| `html.mso-font` | The MSO font override is present | E | 1 | P1 |
| `html.data-detectors` | The Apple data-detector reset is present | W | 1 | P1 |

### A.4 CSS (`css.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `css.style-size` | Total `<style>` < 16,384 bytes (W at 12 KB) | E | 1 | 01 §3.2 |
| `css.important-lowercase` | `!important` lowercase with a space before it; none inline | E | 1 | 01 |
| `css.no-double-brace` | No `}}` in CSS | E | 1 | 01 |
| `css.no-nesting` | No nested rules; no at-rule inside an at-rule | E | 1 | 01 |
| `css.colour-hex` | Every colour (CSS and attributes) is `#rrggbb` or `transparent` | E | 1 | 01 §3.5 |
| `css.no-modern-colour` | No `oklch(`, `oklab(`, `lch(`, `lab(`, `color-mix(`, `color(`, `light-dark(` or `hsl(`; no space-separated `rgb(` | E | 1 | 01 §3.5 |
| `css.no-alpha` | No `rgba(`, `hsla(`, 8-digit hex or `opacity` | W | 1 | 01, 05 §3 |
| `css.no-custom-props` | No `--x:` declarations or `var(` | E | 1 | P1, 01 |
| `css.banned-layout` | No flex, grid, float, position, `calc`, `clamp`, `min`/`max`, `:has` or `@supports` | E | 1 | P1, 01 |
| `css.media-allowlist` | Media features limited to width, orientation, resolution and `prefers-color-scheme` | W | 1 | 01 |
| `css.inline-parse` | Every inline `style` parses cleanly | E | 1 | 01 |
| `css.gradient-fallback` | `background-image` ⇒ a solid `background-color` on the same element | E | 1 | 01, 05 §3 |
| `css.units` | No `rem`, `vw` or `vh` inline | W | 1 | 01 |
| `css.hide-mso` | `display:none` outside MSO blocks ⇒ `mso-hide:all` too | W | 1 | 01 |
| `css.line-height-px` | Text cells use a px line height plus `mso-line-height-rule:exactly` | E | 1 | P1, 05 §2 |

### A.5 Layout, images, MSO, buttons, fonts

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `layout.ghost-table` | Each `max-width` container sits inside an MSO ghost table of the same px width (classic target) | E | 1 | 01 |
| `layout.max-fixed-width` | No fixed width > 320 px outside MSO blocks or `max-width` (data tables and fluid images exempt) | E | 1 | 01, 02 1.4.10 |
| `layout.table-attrs` | Layout tables have `role="presentation" cellpadding="0" cellspacing="0" border="0"`, with no `th` or `caption` inside | E | 1 | P1, 01, 02 A5 |
| `layout.no-dir-padding` | No element with both `dir` and `padding` | W | 1 | 01 |
| `layout.columns` | At most 3 columns | W | 1 | 05 §1 |
| `img.alt` | `alt` present; non-empty when linked or functional; VML has `alt` | E | 1 | 02 A15 |
| `img.alt-quality` | Alt isn't the file name, has no "image of", and is ≤ 125 characters | W | 1 | 05 §4 |
| `img.dimensions` | Integer `width`/`height` attributes on every `<img>` | E | 1 | 01 |
| `img.format` | PNG, JPEG or GIF (WebP/AVIF opt-in); never SVG or `data:` | E | 1 | 01 §6 |
| `img.https` | Absolute HTTPS URLs | E | 1 | 01 |
| `img.fluid-width` | `max-width:100%` ⇒ `width:100%` too | W | 1 | 01 |
| `img.no-picture-srcset` | No `<picture>` or `srcset` (except the opt-in logo swap) | W | 1 | 01 |
| `img.void-class` | No `class` on self-closing void elements | W | 1 | 01 |
| `img.retina` | Intrinsic width ≥ 2× the attribute width (when fetchable) | W | 2 | 05 §4 |
| `img.weight` | Hero ≤ 200 KB; total ≤ 1 MB (when fetchable) | W | 2 | 05 §4 |
| `img.motion` | Animated images: ≤ 3 flashes/s; ≤ 5 s or a finite loop | E | 2 | 02 A22 |
| `img.dark-safe` | Transparent images keep ≥ 3:1 edge contrast on light and dark grounds | W | 2 | 02 |
| `mso.conditional-pairs` | Conditional comments correctly paired by form; no nesting | E | 1 | P1, 01 |
| `mso.version-target` | Only `[if mso]` / `[if !mso]` | W | 1 | 01 |
| `mso.vml-safe` | VML ⇒ `xmlns:v`, hex colours, an `href` equal to its HTML twin | E | 1 | 01 |
| `minify.preserve-mso` | MSO blocks are byte-identical before and after minification | E | 1 | 01 |
| `button.real-link` | Buttons are `<a href>` with text, a background colour and `mso-padding-alt` | E | 1 | 01 |
| `button.no-letter-spacing-hack` | No `letter-spacing` spacer pattern | E | 1 | 01 |
| `button.max-primary` | At most one primary button | W | 1 | P2, 05 §6 |
| `button.target-size` | Static computed height ≥ 44 px (E below 24 px) | E/W | 1 | 02, 05 |
| `font.fallback-tail` | Every `font-family` ends with a core family and a generic family; single quotes inline | E | 1 | 01 |
| `font.webfont-optin` | `@font-face` only with opt-in, `mso-font-alt` and a fallback | E | 1 | 01, 05 |

### A.6 Dark mode (`dark.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `dark.scheme-declared` | Dark CSS present ⇔ the `light dark`/`light only` meta and `:root{color-scheme}` | E | 1 | 02 D2 |
| `dark.explicit-colours` | Text elements have an explicit colour on an explicit ground when `light dark` is declared | E | 1 | 02 D3 |
| `dark.ogsc-twin` | Every `prefers-color-scheme` rule has a `[data-og*]` twin | W | 1 | 02 D5 |
| `dark.targets-inline` | Dark selectors reach the element that carries the inline colour | E | 1 | P1 |
| `dark.light-only-css-twin` | The `light only` meta with a dark palette also has CSS `light dark` | W | 1 | 02 D6 |
| `dark.no-blend-hack` | No `u + .body` blend-mode hack | W | 1 | 02 D7 |
| `dark.light-dark-fallback` | `light-dark()` has a preceding literal | E | 1 | 02 D8 |
| `dark.inline-complete` | Inline styles alone pass contrast (render with `<style>` stripped) | E | 2 | 02 D1 |
| `dark.forced-render` | Rendered contrast passes in the Chromium forced-dark and forced-full simulations | W | 2 | 02 |

### A.7 Accessibility (`a11y.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `a11y.one-h1` | Exactly one `h1` (W if none) | E | 1 | P1, P2 |
| `a11y.heading-order` | No skipped levels; no empty headings | W | 1 | 02 A2 |
| `a11y.layout-grid` | Warns on layout tables with ≥ 2 rows and ≥ 2 columns | W | 1 | 02 A6 |
| `a11y.data-table` | Data tables have `th scope`, a caption or heading, are ≥ 2×2, and have no presentation role | E | 1 | 02 A23 |
| `a11y.no-sectioning` | No `article`, `section`, `nav`, `header`, `footer`, `main` or `aside`, and no landmark roles | E | 1 | 02 A4 |
| `a11y.aria-safe` | No `aria-labelledby`/`describedby`; no `aria-label` on generic elements; no `role="button"` on `<a>`; `aria-roledescription` only when localised | E | 1 | 02 A9–A17 |
| `a11y.link-text` | No empty links; no generic link text (per-locale lists); underlined in running text | E/W | 1 | 02, 05 |
| `a11y.font-size` | ≥ 12 px always (E); W below 14 px; body ≥ 16 px | E/W | 1 | 02 A18 |
| `a11y.line-height` | Body ≥ 1.5; with `mso-line-height-rule:exactly`, ≥ 1.2× | W | 1 | 02 A19 |
| `a11y.alignment` | No justified text; W on centred paragraphs over about 2 lines | E/W | 1 | 02 A20, 05 §1 |
| `a11y.text-spacing` | No fixed heights or `overflow:hidden` on text; no inline `!important` spacing | E | 1 | 02 1.4.12 |
| `a11y.viewport` | No zoom blocking | E | 1 | 02 A29 |
| `a11y.focus` | No `outline:none` on links | E | 1 | 02 2.4.7 |
| `a11y.hidden` | No `hidden` attribute; hidden content uses `display:none` + `mso-hide:all` | E | 1 | 02 A13 |
| `a11y.nbsp-spacer` | No block elements containing only `&nbsp;` | W | 1 | 02 A26 |
| `a11y.colour-only` | Status components carry text or an icon, not colour alone | E | 1 | 02 C5, 05 §3 |
| `a11y.sensory-language` | No "click the green button" / "see the right column" phrasing (per-locale lists) | W | 1 | 02 1.3.3 |
| `a11y.axe` | axe-core 4.14 rule set per preview mode | E/W | 2 | 02 §2.6 |
| `a11y.reflow` | Nothing overflows at 320 px (render) | E | 2 | 02 1.4.10 |
| `a11y.target-size` | Rendered tap targets ≥ 24 px (W below 44) or spaced | E/W | 2 | 02 A21 |
| `a11y.images-off` | With images blocked, the h1, CTA and key facts are still present | E | 2 | 05 §4 |

### A.8 Plain text (`text.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `text.present` | Non-empty and ≥ 80 characters (configurable) | E | 1 | P1 |
| `text.no-markup` | No `<tag>` | E | 1 | P1 |
| `text.no-entities` | No `&name;` / `&#n;` | E | 1 | P1 |
| `text.wrap-78` | Lines ≤ 78 characters (URLs exempt) | W | 1 | 05 §11 |
| `text.urls-full` | Links are absolute URLs | E | 1 | 05 §11 |
| `text.links-match` | Every HTML link appears in the text part, and vice versa | E | 1 | 04 §10.5 |
| `text.parity` | Word overlap between visible HTML text and the text part is above a threshold | W | 1 | 04 (MPART_ALT_DIFF) |
| `text.preheader-first` | The text part starts with the preheader | W | 1 | 01 §10.1 |
| `text.no-preheader-padding` | No preheader filler characters in the text part | E | 1 | 05 §11 |
| `text.no-decorative-runs` | No long runs of `=`, `-` or `*` beyond heading underlines | W | 1 | 02 A27 |
| `text.code-unbroken` | Codes stay on one unbroken line | E | 1 | 05 §11 |

### A.9 Size (`size.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `size.gmail` | UTF-8 bytes of the HTML part with the largest fixture, plus the provider allowance (default 5 KB), < 102 KB (W ≥ 90 KB) | E | 1 | 01 §8, P1 |
| `size.line-length` | No line > 998 octets | E | 1 | 04 §1.1 |
| `size.unsubscribe-above-clip` | The marketing unsubscribe link sits before the clip point | E | 1 | 04 §10.5 |
| `size.provider-budget` | Provider-sent templates stay within the provider budget (for example Cognito's 20,000 characters) | E | 4 | P1 FR-102 |

### A.10 Subject, preheader and copy

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `preheader.first` | The first text node in the wrapper is the hidden preheader | E | 1 | 01 |
| `preheader.not-subject` | Preheader ≠ subject | E | 1 | P1 |
| `preheader.length` | 1–90 visible characters | W | 1 | 05 §7 |
| `preheader.padding` | The padding filler is present and from the configured set | W | 1 | 01, 05 |
| `preheader.no-boilerplate` | No "view in browser" or "trouble viewing" text | E | 1 | 05 §7 |
| `subject.length` | ≤ 60 characters (W); key terms in the first 40 (I) | W | 1 | 05 §7 |
| `subject.no-fake-reply` | No leading `Re:` / `Fwd:` | E | 1 | 05, 03 |
| `subject.no-secret` | No `secret` field in the subject without an opt-in; never in the preheader | E | 1 | 04, 05 ⚠10 |
| `subject.generic` | Warns on generic subjects from a word list | W | 1 | 05 §7 |
| `copy.case` | Sentence case for subjects, headings and buttons, with glossary exceptions | W | 1 | P2 |
| `copy.no-emoji` | No emoji in subject, heading or button (configurable per surface) | W | 1 | P2, 05 |
| `copy.button-label` | Verb-first, ≤ 3 words (configurable), not "click here"/"submit", unique per email | W | 1 | P2, 05 §6 |
| `copy.glossary` | Brand terms written exactly | E | 1 | P2 |
| `copy.paragraph-length` | Info on paragraphs over about 60 words | I | 1 | 05 §8 |
| `copy.placeholder-fallbacks` | Empty and long fixture variants render cleanly ("Hi ," never appears) | E | 1 | 05 §8 |
| `copy.receipt-reconciles` | Receipt fixtures: lines − discounts + shipping + tax = total, in one currency | E | 1 | 05 §9, P1 T-TPL-04 |
| `copy.security-repudiation` | Security templates include "this wasn't me" steps and contact information | E | 1 | 05 §9 |
| `copy.auth-fallback-url` | Auth templates show the URL as text | W | 1 | 05 §6 |

### A.11 Links, auth and security

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `link.hosts` | Every `href`/`src` is HTTPS on an allowed host (or the reply-to `mailto:`) | E | 1 | P2 FR-011 |
| `link.dangerous-schemes` | No `javascript:`, `data:`, `vbscript:` or `file:` | E | 1 | 04 |
| `link.text-matches-href` | URL-like anchor text matches the `href` host | E | 1 | 04 |
| `link.no-shorteners` | No URL shorteners and no IP hosts | E | 1 | 04 |
| `link.url-fields` | Only `url` fields or literal HTTPS URLs appear in `href`/`src` | E | 1 | P1 C8 |
| `auth.token-in-fragment` | Auth templates put tokens after `#`, never in the query | E | 1 | P2, 04 |
| `auth.code-format` | OTP codes are contiguous digits, appearing once in the HTML, once in the text, never in the preheader | E | 1 | 04 §5.1, 05 §9 |
| `auth.expiry-stated` | Code and link templates state an expiry | W | 1 | 05 §9 |
| `auth.no-webview` | No web-view link in templates with codes, tokens or PII | E | 1 | 05 §8 |

### A.12 Compliance (`legal.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `legal.purpose-declared` | Every template declares a purpose | E | 1 | 03 §15.5 |
| `legal.marketing-unsubscribe` | Marketing renders an unsubscribe link in HTML and text, and its metadata requires one-click headers | E | 1 | 03 |
| `legal.postal-address` | Marketing and consent-request render a non-empty postal address | E | 1 | 03 R1 |
| `legal.sender-identity` | Legal name or brand present; "on behalf of" when configured | E | 1 | 03 |
| `legal.privacy-link` | A privacy notice link is present | E | 1 | 03 |
| `legal.reason` | A "why you got this" line is present | E | 1 | 03, P2 |
| `legal.transactional-no-promo` | Transactional templates have no promo slot or coupon/discount markers | E | 1 | 03 R2 |
| `legal.consent-request-clean` | Consent requests have no promo content and no tracking, and do have a remove link | E | 1 | 03 R3 |
| `legal.no-tracking` | No 1×1 or hidden images, recipient-specific image URLs or rewritten links while tracking is off | E | 1 | 03 R6 |
| `legal.opt-out-copy` | The localised opt-out statement key is present | W | 1 | 03 R7 |
| `legal.no-pii-in-urls` | No email address or token in a URL query string | W | 1 | 03 |
| `legal.minor-audience` | Minor-audience templates aren't marketing and use display-name-only data | E | 2 | 03 §9 |
| `legal.subject-prefix` | `kr`/`cn` marketing subjects carry their required prefix | E | 4 | 03 |
| `legal.unsubscribe-lifetime` | Unsubscribe token lifetime ≥ 60 days (never expires by default) | E | 4 | 03 |
| `legal.profile-freshness` | Profile `verifiedOn` is under 12 months old | W | 4 | 03 |

### A.13 i18n (`i18n.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `i18n.missing-keys` | Every locale has every key for every slot | E | 1 | P2 |
| `i18n.unused-keys` | Warns on message keys no template uses | W | 1 | — |
| `i18n.plural-categories` | Plural messages cover every CLDR category of the locale | E | 1 | 05 §10 |
| `i18n.fallback` | The fallback chain resolves to an existing locale | E | 1 | 05 §10 |
| `i18n.intl-format` | No literal currency symbols or hand-built dates in templates or messages | E | 1 | P2, 05 |
| `i18n.rtl-explicit` | In RTL locales, text cells carry `dir` and explicit alignment | E | 1 | 01 |
| `i18n.expansion` | The pseudo-locale builds without errors; static checks pass on it | E | 1 | 05 ⚠5 |
| `i18n.expansion-render` | Pseudo-locale render: no clipping; buttons ≤ 2 lines | E | 2 | 05 ⚠5 |

### A.14 Output and drift (`output.*`)

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `output.drift` | Committed output equals a fresh compile | E | 1 | P1 FR-62 |
| `output.manifest` | The manifest lists exactly the compiled templates and locales, with correct hashes | E | 1 | P1 |
| `output.runtime-dependency` | `@email-kit/runtime` is in the app's dependencies, not devDependencies (replaces `output.module-matches`, which `output.drift` covers; ADR 0007) | E | 1 | ADR 0007 |
| `output.no-orphans` | No compiled template without a source | E | 1 | P1 |
| `output.gitignored` | Warns if the output folder is gitignored | W | 1 | phase-1-scope |
| `output.identifiers` | Derived identifiers are unique and not reserved in target languages | E | 1 | R6 |

### A.15 Send layer (phase 4) and dev tools

| Check | Rule | Lvl | Ph | Source |
|---|---|---|---|---|
| `mime.structure` | `multipart/alternative` with text first and HTML last; `related` only with CID; line limits | E | 4 | 04 §10.5 |
| `headers.defaults` | Message-ID, Date, a single From and `Auto-Submitted` present; no `X-Priority`/`Precedence` | E | 4 | 04 |
| `display-name.rules` | No `@`, emoji or reply hints in display names | E | 4 | 04 |
| `catalog.stream` | Every template maps to a purpose and a stream; one From per purpose | E | 4 | 04 |
| `spam.spamassassin` | Opt-in SpamAssassin score under the threshold (default 2.0) | E | 2 | 04, CHK-14 |

---

## 9. Success metrics (v1.0)

| Metric | Target |
|---|---|
| Time to first compiled email for a new user (timed with someone outside the project) | < 5 minutes |
| Conformance suite pass rate (TS runtime) | 100% |
| Runtime dependencies of the generated module | 0 |
| Renderer size | ≤ 3 KB min+gzip |
| Warm render of a 60-item receipt / cold import of one template | < 5 ms / < 50 ms |
| Compile + check of 50 templates × 2 locales | < 10 s |
| `check` on every starter template | 0 errors |
| Starters in the tier-1 client matrix | Verified pass (recorded) |
| Starters in light and authored dark | WCAG 2.2 AA contrast |
| Type-test coverage of the authoring API and the generated module | Every public type path has a positive and a negative test |
| Line coverage of core, compiler, runtime and checks | ≥ 90% |

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Our own primitives produce worse Outlook output than MJML | Rendering bugs in a large share of B2B inboxes | SPK-02 comparison; MJML-underneath fallback; real-client verification gate (TST-09) |
| The JSX pragma behaves differently across host tsconfigs | Type errors in user projects | SPK-03; init adds `jsx` only when missing; documented setups; TST-05 |
| Runtime plurals and formatting limit i18n | Awkward copy for counts and dates | SPK-04 ADR; caller-formatted values (R5); later formatter spec (LNG-08) |
| Email clients change without notice | Rules become stale | Dated sources; check docs carry dates; caniemail snapshot refresh; changelog policy (PKG-09) |
| Laws change (EU Digital Omnibus, Sri Lanka s.27 commencement) | Compliance gaps | Profiles as data with `verifiedOn`; `legal.profile-freshness`; not-legal-advice notice |
| Confusion with the existing `emailkit` package | Discoverability and support noise | Scoped packages; clear docs and branding ("email-kit compiles templates; it doesn't send") |
| Component licensing (emailcn precedent) | Legal takedown | Clean-room authorship and a provenance record (PKG-08) |
| Scope creep from studio or sending features | Phase 1 slips | Strict phase gates; phase 2 and 3 items stay out of v1.0 |
| npm supply-chain attacks | Compromised releases | Trusted publishing, no install scripts, minimal dependencies (PKG-05/06) |

## 11. Open questions

| # | Question | Decide in |
|---|---|---|
| Q1 | Authoring primitives: own tables or MJML underneath | SPK-02 |
| Q2 | Runtime plurals strategy | SPK-04 |
| Q3 | Alias mapping for `tsc` projects (`#email-kit`) | SPK-06 |
| Q4 | Merge `@email-kit/cli` and `@email-kit/core` into one package? | SPK-12 |
| Q5 | Runtime validator on by default? | M1.1 |
| Q6 | Platform values: compile-time constants versus runtime context, and the split | M1.1 |
| Q7 | Per-recipient time zones: do callers always pass formatted dates (R5)? | M1.3 |
| Q8 | Allow weight 600 in default themes, or only behind a brand-font flag? | M1.2 |
| Q9 | `max(16px, 1rem)` user-scalable text on by default? | M1.2 |
| Q10 | Python/Go runtimes: vendored into generated code or published packages | Phase 3 |

## 12. Glossary

| Term | Meaning |
|---|---|
| Artifact | A compiled template part (HTML, text, subject, preheader) with placeholders, per locale |
| Contract | The language-neutral output: artifacts, `schema.json`, `manifest.json`, dialect and escaping spec |
| mustache-core | email-kit's placeholder dialect: a strict subset of Mustache with its own spec and conformance suite |
| IR | The intermediate tree produced by the JSX runtime, before HTML and text rendering |
| Purpose | Legal type of an email: `transactional`, `marketing` or `consent-request` |
| Category | A project-defined type that decides who may receive an email |
| Role | A semantic colour (`ink`, `canvas`, `actionFill`…) resolved from design tokens |
| Permutation | One resolved theme for a combination of modifiers (for example theme=dark, brand=b) |
| Fixture | Example data for a template, used by the studio and the checks; never for sending |
| Tier-1 clients | Apple Mail iOS and macOS; Gmail web, Android and iOS; GANGA; classic Outlook; new Outlook/OWA; Yahoo |
| GANGA | Gmail apps showing a non-Google (IMAP) account; they strip `<style>` |
