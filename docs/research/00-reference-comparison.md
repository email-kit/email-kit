# 00 — The two reference approaches, compared

What the two packages in `docs/reference-docs/` do, where each is strong or weak, and what the new
framework should take from each. Written 2026-10-27 from the documents alone (no code was read).

| | Package 1 — `email-package-1/` | Package 2 — `email-package-2/` |
|---|---|---|
| Origin | Effy's `packages/email-kit`, written up as a design pack for an open-source framework (`email-kit`, working name) | Bloopp's `@workspace/emails`, documented as it ships (20 templates, 163 tests) |
| Status | Design only for the framework; the Effy kit it extracts from works today (15 templates, ~90 tests) | In production inside one monorepo |
| One-line idea | **Compile early, render cheaply**: MJML + Handlebars compiled at build time to committed HTML artifacts; runtime is string substitution | **Components at runtime**: React Email templates rendered per send, every word from ICU message files |

## 1. Package 1 — MJML + Handlebars, compiled at build time

### How it works

1. **Declare**: one typed **catalogue** entry per email: id, vars (a tiny own schema), `subject(vars,
   profile)`, `preheader(vars, profile)`, audiences, category, failure policy, `sentBy`.
2. **Author**: `templates/<id>.mjml` for HTML and a hand-written `text/<id>.txt.hbs` for plain
   text. Both use Handlebars placeholders. Shared parts come in through `<mj-include>`, text styles
   are `mj-class` recipes, and raw colours are written as `%role%`.
3. **Build** (`email-kit build`):
   - design tokens (CSS custom properties, light/dark) are mapped to semantic **roles** (`ink`,
     `mutedInk`, `canvas`, `actionFill`, …);
   - the role palette is validated (WCAG contrast in light, authored dark and force-inverted light;
     no `#fff` light ground or `#000` dark ground; no mid-grey text);
   - a theme is generated;
   - MJML is compiled;
   - `%role%` is resolved and the `e-h1` cell is promoted to `<h1>`;
   - the build writes `dist/<id>.html`, `dist/<id>.txt`, a bundle module of strings, and a
     manifest of sizes and hashes. The output is deterministic and **committed to git**.
4. **Check** (`email-kit check`): about 50 stable check ids across tokens, sources, compiled HTML,
   size, the text part, the catalogue, the bundle and drift. Results come as human or JSON output,
   and each check can be configured with a reason.
5. **Render**: a pure function `(id, vars, audience, identity) → { subject, preheader, html, text }`.
   Handlebars is the only runtime dependency. Values are HTML-escaped in the HTML part and not
   escaped in the text part. Platform values (product name, support address, postal address) are
   injected after vars, so a call site cannot override them.
6. **Send**: `createMailer({ render, transport, identity, logger })`.
   - Transports (SES, Resend, Postmark, SMTP, memory) are pluggable.
   - Each message has a failure policy: `throw` or `swallow`.
   - Logging carries five fields and never the address, vars or body.
   - Every message gets a template tag and header.
   - "Phantom" sends go to a black-hole address, so send timing doesn't reveal whether an account
     exists.
7. **Provider-sent mail**: templates an identity provider sends itself (for example Cognito
   `CustomMessage`) keep the provider placeholder (`{####}`) and have their own size budget. The
   adapter never throws.

### Strengths

- **Runtime is tiny and language-neutral in principle.** The artifacts are plain HTML and text
  with placeholders, so anything that can run a Handlebars-compatible engine can render them. This
  matters for the Kotlin Multiplatform consumer.
- **Checks are part of the product.** It is the most complete catalogue of real-inbox failure
  modes in either package: Gmail clipping, Outlook Word engine, forced dark mode, missing text part,
  unbalanced MSO comments, undeclared placeholders and drift.
- **Theme validation is serious.** It runs three contrast passes, including forced inversion, and
  generates both dark mechanisms (`prefers-color-scheme` and Outlook's `[data-ogsc]`) from one rule
  list.
- **Wrong is unrepresentable or loud.**
  - Template ids form a closed union.
  - `transactional()` cannot take an unsubscribe URL; `lifecycle()` must have one.
  - Sending a provider-sent message through a transport throws.
- **The output can be reviewed.** Generated HTML is committed, so a design change shows up as a
  diff.
- **Operationally mature.** It has the failure policy, safe logging, phantom sends, typed errors
  and a large numbered test plan.

### Weaknesses

- **Authoring DX is the weak point.**
  - The MJML and Handlebars strings are not type-checked inside the template.
  - The HTML and text files are kept in step by hand.
  - `mj-title`/`mj-preview` duplicate the catalogue's subject and preheader.
  - A missed `css-class="e-…"` silently skips dark mode for that element.
  - The header and footer includes repeat in every template.
- **The schema is home-grown**: string, number, boolean and arrays of records only. Optional,
  nested and URL types are still proposals.
- **No i18n in v1.** One language per template set.
- **Regex-based checks.** A real parser is a proposal.
- **Logic-less templates push all formatting to the caller.** That is fine for one language and
  awkward with several.
- **Its own alternatives table rejects React Email** on runtime cost and Outlook output, not on DX.

## 2. Package 2 — React Email + Zod + ICU messages, rendered at runtime

### How it works

1. **Define**: `defineTemplate({ name, category, data: z.strictObject(...), preview, Component,
   requestedByRecipient?, expiresAfterMs?, replyTo?, listUnsubscribe?, subject? })`.
2. **Words**: every string lives in `messages/<lang>/<template>.json` (ICU, through `use-intl`).
   - Helpers `t`, `layout` and `format` (dates, numbers, time zone) are passed into the component.
   - A missing key throws.
   - An ESLint rule forbids literal copy in templates.
3. **Layout**: one shared `<Layout>`: word mark as text, one `<h1>`, the body, at most one button,
   and a footer with the sender, *why you got this*, a help link and, for list emails, a "Remove me"
   link. Colours come from a theme file generated from `tokens.json`. Dark mode is a
   `prefers-color-scheme` block over class names.
4. **Links**: every link is HTTPS on the site's host or the reply-to `mailto:`. Link helpers build
   URLs from `siteUrl`, and template data holds **tokens, never URLs**. Tokens go in the URL
   **fragment**, and the landing page acts only on a button press, so mail scanners that prefetch
   links cannot use up a code.
5. **Build**: `buildTemplate()` parses the data with Zod, makes the helpers, lazily imports
   `@react-email/render`, renders HTML, derives plain text with `toPlainText()`, and picks the
   subject. esbuild bundles the package, and importing only the 11 React Email components the
   layout uses cuts 1.6 MB to 18 KB and ~230 ms off cold start.
6. **Send** (lives in the API, not the package):
   - `sendEmail(tx, { template, to, data, key })` runs inside the caller's DB transaction.
   - It checks the recipient against the category's rules (children never get email).
   - It seals the address and data, stores the send under an idempotency key, and queues a job.
   - The job builds the email and sends it with Resend. With no key set, it writes the email to a
     local file instead.
   - Webhooks record delivered, bounced and complained, and addresses that bounced or complained
     are suppressed.
   - `requestedByRecipient` lets a sign-in code reach an address that once complained.
   - `expiresAfterMs` drops a code that would arrive too late.
7. **Tests**: they are **generic**, looping over every template, so a new template is covered with
   no new test. They check that it:
   - builds in the default and the long test language (+40%);
   - has every link HTTPS on the site's host, and one-click unsubscribe for list emails;
   - has one `<h1>` and at most one named button;
   - has no fixed width over 360 px;
   - rejects bad data;
   - is listed in the preview;
   - follows the copy rules (sentence case, buttons of three words or fewer, no emoji, brand
     glossary);
   - passes AA contrast in light and dark.

### Strengths

- **Best authoring DX of the two.** It has typed TSX components and typed props, Zod schemas that
  give `TemplateData<Name>`, and React Email's live preview.
- **i18n done properly.** It has ICU messages, locale formatting, throw-on-missing, and a long
  pseudo-language to catch layout breakage.
- **Link and token safety.** The fragment-token and press-to-act pattern defeats link scanners.
  Data holds tokens and never URLs, and links stay on the site's own host.
- **Category semantics.** A category decides *who may receive* an email, beyond whether it
  carries an unsubscribe link. That is where legal rules (children, consent) attach.
- **Send-path guarantees.** Idempotency, transactional outbox, sealing, suppression, expiry and a
  local-file dev transport.
- **Zero-effort test coverage** for new templates, plus copy rules as tests.

### Weaknesses

- **Runtime React render.** The renderer is JS-only, so it can't serve the Kotlin Multiplatform
  consumer. It costs cold start and bundle size (both were worked around by hand), and every send
  is async.
- **Plain text is derived** by `toPlainText()` rather than authored. That is cheaper to write, but
  table debris and wording can't be tuned per part.
- **Fewer client-specific safeguards.** There is no Gmail size budget, no forced-dark (inversion)
  validation, and no Outlook.com `[data-ogsc]` rules. MSO handling is left to React Email's
  defaults.
- **No committed output and no drift check.** What ships is what the renderer produces on the day.
- **Checks live only in Vitest and ESLint.** There is no CLI and no check engine, and the checks
  aren't reusable outside the repo.
- **Coupled to one product.** It is Bloopp's host, Sri Lanka time zone, `en-LK`, glossary and
  categories. The send path lives in the API, so it isn't reusable.

## 3. Side by side

| Concern | Package 1 | Package 2 | Better for the framework |
|---|---|---|---|
| Authoring | MJML + `.txt.hbs` | TSX components | **2**, with 1's discipline (no literal colours or fonts, one `<h1>`) |
| Component reuse | `mj-include` partials | React components | **2** |
| Data schema | Own tiny schema (no deps) | Zod `strictObject` | **2**, through a schema-agnostic layer, exportable to JSON Schema for other languages |
| Typed call sites | Closed id union + `VarsOf` | `TemplateName` + `TemplateData<Name>` | Both; the same idea |
| Subject / preheader | Functions of vars and audience | Message keys, or `subject(data, t)` | Merge: message-based with an optional function |
| i18n | None in v1 | ICU messages, locale formats, long test language | **2** |
| Theme source | CSS custom properties → roles | `tokens.json` → generated theme | Merge: CSS **and** JSON/W3C tokens → roles |
| Theme validation | 3-pass contrast, inversion, mid-tone, no pure white/black | AA contrast in light and dark | **1** |
| Dark mode | Media query **and** `[data-ogsc]` from one list; targets inner elements | Media query on classes | **1** |
| Outlook handling | MJML ghost tables, MSO font override, 96 DPI | React Email defaults | **1** (the research decides how much is still needed) |
| Rendering | Build time; runtime is substitution | Runtime React render, async | **1** for runtime cost and other languages; keep **2**'s authoring |
| Output | Committed artifacts + bundle + manifest | `dist/index.js` bundle | **1** |
| Plain text | Hand-written per template | Derived from the HTML | Merge: derived by default from components that know their text form, with an override |
| Checks | ~50 ids, configurable, JSON output, drift | Vitest + ESLint | **1** as the engine; add **2**'s link, copy, width and i18n checks |
| Links | `url` var type (proposed), escaping | HTTPS, allowed hosts, fragment tokens, helpers | **2**, plus **1**'s `url` type |
| Categories | `transactional` / `lifecycle` (type-enforced unsubscribe) | 7 categories driving recipient rules | Merge: categories that carry both legal and recipient semantics |
| Audiences / platform values | Configured audiences, injected platform vars | `siteUrl`, language | **1** |
| Sending | Transport-neutral mailer, failure policy, safe logs, phantom sends | Idempotency, outbox, suppression, expiry, webhooks (in the app) | Merge in an optional send package; the core stays "build, never send" |
| Provider-sent (Cognito, …) | Placeholder passthrough, char budget, adapter | — | **1** |
| Preview | Static fixture pages (dev server proposed) | React Email dev server | New studio: **2**'s live server with **1**'s proposals (subject, preheader, light/dark, text, size, fixture cases), plus locale and check results |
| CLI | `init`, `new`, `build`, `check`, `preview`, `dev`, `send-test`, `tokens` | `pnpm` scripts | **1** |
| Testing | Matchers, memory transport, numbered test plan | Generic per-template tests, copy-rule tests | Both |
| Errors | Typed error classes | `ZodError` / `Error` | **1** |

## 4. What the framework should take

**From package 1**
- Compile at build time to **language-neutral artifacts**: HTML and text with placeholders, plus a
  manifest. That keeps runtime tiny and lets a Kotlin service render the same email.
- The check engine: stable ids, per-check config with a reason, JSON output, drift detection,
  size budgets.
- Role-based theming with three-pass contrast validation, and both dark-mode mechanisms generated
  from one list.
- The catalogue's guarantees:
  - a closed id union;
  - unsubscribe tied to the category at the type level;
  - injected platform values that a call site can't override;
  - per-message failure policy.
- Provider-sent messages; the transport interface; safe logging; phantom sends; typed errors;
  the CLI command set; testing matchers.

**From package 2**
- TSX components as the authoring model, with typed props and data schemas.
- i18n from day one: ICU messages, locale formatting, throw on a missing key, and a long
  pseudo-language for tests.
- One shared layout that enforces structure: one heading, at most one primary button, and a
  footer with sender, reason and help.
- The link policy: HTTPS only, allowed hosts, tokens in fragments, data holds tokens and never
  URLs, link helpers shared with the app.
- Facts on the template that the send path acts on: `category`, `requestedByRecipient`,
  `expiresAfterMs`, `replyTo`, `listUnsubscribe`.
- Generic tests that cover every template automatically; copy rules (sentence case, button
  length, glossary) as configurable checks.
- Send-path ideas for the optional send package: idempotency keys, local capture when no provider
  is configured, suppression and expiry hooks.

## 5. Tensions to resolve in the design phase

These come straight from combining the two. The research files feed each one.

| # | Tension | Why it matters | Research that informs it |
|---|---|---|---|
| T1 | **TSX authoring and precompiled artifacts.** Loops, conditionals and optional rows in JSX must compile to placeholder sections (for example `<Each>` and `<If>` components that emit Mustache/Handlebars blocks) instead of running at send time. | Decides whether the KMP app can render emails, and how small runtime is | 06 (tooling, placeholder engines, KMP) |
| T2 | **Placeholder engine.** Handlebars (JS; JVM-only port) or Mustache (spec'd, many ports) or Liquid. Escaping must behave the same in every runtime. | Cross-language correctness and security | 06, 04 (escaping contexts) |
| T3 | **i18n at build or at runtime.** Either one artifact per template × locale, or messages resolved at runtime. Plurals and date/number formatting must work in every runtime. | Artifact count, KMP support, formatting parity | 05 (i18n), 06 |
| T4 | **Schema.** Zod, a schema-agnostic layer (Standard Schema), or the own tiny schema, with JSON Schema export for other languages. | Types in TS, validation elsewhere | 06 |
| T5 | **Plain text.** Hand-written, derived, or derived with overrides. | Deliverability and accessibility quality versus authoring effort | 04, 05, 02 |
| T6 | **Commit artifacts or build in CI.** | Reviewable diffs versus noise | 06 |
| T7 | **Component distribution.** An npm package, a shadcn-style registry (copy-in), or both. | Upgrades versus customisation | 05, 06 |
| T8 | **How much Outlook (Word) support.** Classic Outlook is being retired. Decide how much MSO/VML machinery stays the default. | Output size, complexity, MJML vs React Email | 01 |
| T9 | **Category model.** Merge `transactional`/`lifecycle` with package-2's recipient categories and the legal categories (commercial, transactional, relationship) across jurisdictions. | Compliance checks and footer requirements | 03 |
| T10 | **Scope of sending.** Keep sending out of the core, or ship transports, idempotency and a webhook normaliser as an optional package. **Decided 2026-10-27: phase 1 is a generator only, with no sending** (see `../phase-1-scope.md`). | Package boundaries and dependencies | 04, 06 |
| T11 | **Theme input.** CSS custom properties (shadcn), W3C DTCG JSON, or both; OKLCH → sRGB hex at build time. | DX for teams on shadcn/Tailwind v4 | 05, 06 |

## 6. What is product-specific and must not carry over

| From | Specific to that product |
|---|---|
| Package 1 | Effy's four audiences and `effy*` platform vars; `MAIL_*` env keys; the `effy-template` tag; SES-only sending; Cognito hard-coded; the General Sans stack; the tokens path |
| Package 2 | Bloopp's host and back-office link rules; `Asia/Colombo` and `en-LK`; the brand glossary ("box", never "kit"); the seven Bloopp categories; Resend and the API's outbox, sealing and job queue; port 7330 |
