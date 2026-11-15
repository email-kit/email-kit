# Architecture direction: type-safe TS now, other languages later

Decided 2026-10-27. Phase 1 targets TypeScript only, and it must be **fully type-safe**. Python, Go
and other backend languages will follow, so every technology and boundary below is chosen so that
adding a language means **adding one emitter and one small runtime, not changing the compiler**.

Builds on [phase-1-scope.md](phase-1-scope.md) and the research in
[research/](research/README.md) (especially 06 §3: placeholder engines and cross-language
artifacts).

## The core idea: a language-neutral middle layer

```
 Authoring (TS only, forever)          Language-neutral contract              Targets (one emitter each)
 ─────────────────────────────         ─────────────────────────              ──────────────────────────
 email-kit.config.ts                   per template and locale:               TypeScript  (phase 1)
 templates/*.tsx    ──compile──▶         html · text · subject · preheader ─▶   index.ts: types + render()
 messages/<locale>/*.json                (mustache-core placeholders)         Python      (later)
 schema (Zod / Standard Schema)        schema.json (JSON Schema 2020-12)  ─▶    module: dataclasses + render()
                                       manifest.json (versioned)              Go          (later)
                                                                              package: structs + Render()
                                       conformance suite (shared tests)  ──▶  every runtime must pass it
```

- **Authoring stays TypeScript.** Developers write TSX. The compiler, checks and studio are written
  in TS. They never need porting.
- **The contract is the product.** Everything a backend needs is plain data: strings with
  placeholders, a JSON Schema, a manifest. No JavaScript is left in it.
- **A target is an emitter plus a runtime.**
  - The emitter generates code in that language: types and an entry module.
  - The runtime is a tiny renderer for the placeholder dialect, about 200 lines in each language.
  - Both must pass the shared conformance suite.

## Rules that keep other languages possible

These are design constraints for phase 1, even though only TS ships.

| # | Rule | Why |
|---|---|---|
| R1 | **No code in the compiled output.** All logic (layout, components, conditionals the compiler can decide, i18n lookups) runs at compile time. At send time only the placeholder dialect runs | A Python or Go backend can't run JavaScript |
| R2 | **One placeholder dialect, "mustache-core", with its own spec.** Variables `{{x}}`, raw `{{{x}}}`, sections `{{#x}}…{{/x}}`, inverted `{{^x}}…{{/x}}`, lists, `{{.}}`. No runtime partials, lambdas, helpers or filters | Each language implements it identically. Mustache has a formal spec to build on (research 06 §3.2) |
| R3 | **One escaping table**, defined by us and used in every runtime: HTML-escape in the HTML part, nothing in the text part and subject | Mustache, Handlebars and Liquid each escape differently at the byte level, so one table keeps output identical everywhere |
| R4 | **The data schema is JSON Schema 2020-12, limited to types every language has:** string, number, integer, boolean, string enums, arrays, nested objects, optional fields. No `Date` objects (use ISO strings), no free unions, no maps with dynamic keys in phase 1 | It maps cleanly to TS types, Python dataclasses and TypedDicts, and Go structs |
| R5 | **No formatting inside templates at send time.** Dates, money and numbers that depend on runtime data arrive already formatted as strings (the schema can carry a `format` hint, e.g. `date-time`, `currency`) | Locale formatting differs between JS `Intl`, Python `babel` and Go `x/text`. Byte-identical output across languages needs the caller to format. Open question: runtime plurals (below) |
| R6 | **Identifiers are derived deterministically.** A template id `order-confirmation` becomes `orderConfirmation` in TS, `order_confirmation` in Python and `OrderConfirmation` in Go. Reserved words in each language are escaped by a fixed rule | Every emitter names things the same predictable way |
| R7 | **The manifest is versioned.** It carries `schemaVersion`, `dialect: "mustache-core@1"`, the escaping profile and the email-kit version. A runtime refuses a manifest it doesn't understand | Lets the contract evolve without silent breakage |
| R8 | **A shared conformance suite.** Golden cases (template + data → exact expected bytes, including hostile values: markup, quotes, `{{`, emoji, RTL text) live in the repo as JSON. The TS runtime runs it in phase 1; every future runtime must pass the same files | Proves "same email in every language" |
| R9 | **Metadata is data, not code.** `purpose`, `category`, locales and whether a `List-Unsubscribe` header is required are fields in the manifest, not functions | A later send layer in any language can read them |

## Type safety in TypeScript (phase 1)

Type safety covers both sides: writing templates and using them.

### When writing a template

| What | How it is type-checked |
|---|---|
| The data a template receives | `defineEmail` is generic over its schema. `data` is typed from it, so `data.ordrNumber` is a compile error |
| Placeholders | `data` is a typed proxy at compile time. `{data.orderNumber}` is only allowed for scalar fields, and `<Each of={data.items}>` only for arrays, with `item` typed in the callback |
| Conditionals | `<If when={data.discount}>` only accepts optional or boolean fields |
| Words | Message keys and their ICU parameters are typed from `messages/<default-locale>/*.json` (generated declaration). `t("heading")` with a missing key, or a missing `{order}` parameter, is a compile error |
| Locales | Every locale must have every key. `check` fails on gaps, and the long pseudo-locale is generated |
| Components | Typed props on every component from `@email-kit/components` |
| Metadata | `purpose` is a literal union; marketing templates require the unsubscribe slot at the type level |

### When using the compiled output

> **Changed by [ADR 0007](adr/0007-project-layout-and-runtime-package.md) (2026-11-15):** the
> renderer is no longer inlined. The generated module imports `@email-kit/runtime`, a published
> package with no dependencies, installed as the app's one email-kit dependency, and only the entry
> points its templates use. Templates are parsed at compile time. The rest of this section holds.

The generated `index.ts` is self-contained: no imports, no runtime dependencies. Its types are
**emitted from `schema.json`**, not imported from Zod, so a backend never needs Zod, React or
email-kit at runtime:

```ts
// generated (shape is illustrative)
export type TemplateId = "order-confirmation" | "welcome"
export type Locale = "en" | "si"

export interface OrderConfirmationData {
  orderNumber: string
  items: { name: string; qty: number }[]
  discount?: string
}

export const emails: {
  orderConfirmation: {
    render(data: OrderConfirmationData, opts?: { locale?: Locale }): RenderedEmail
    meta: { id: "order-confirmation"; purpose: "transactional"; locales: readonly Locale[] }
    // raw templates per locale: html, text, subject, preheader
  }
  // …
}
```

- A wrong field, a missing required field, an unknown locale or an unknown template id is a
  **compile error** in the backend.
- **Runtime validation** (for data that arrives untyped, from a queue or a webhook) is opt-in.
  `compile` can emit a small dependency-free validator generated from the same JSON Schema. Whether
  it is on by default is a design detail.

## Technology choices, with future languages in mind

| Area | Choice | Why it fits "TS now, more languages later" |
|---|---|---|
| Authoring | TSX with **email-kit's own JSX runtime** (`@jsxImportSource @email-kit/core`), not React | Full control over what a node becomes: placeholder nodes, `<Each>`/`<If>` emitting sections, and a text renderer for the plain-text part from the same tree. No React dependency in user projects. Output is language-neutral strings |
| Data schema | **Standard Schema** input (Zod 4 as the documented default; Valibot and ArkType accepted) → **JSON Schema 2020-12** via `~standard.jsonSchema` | JSON Schema is the one format every language can generate types from. The author keeps Zod's DX (research 06 §3.3) |
| Placeholder dialect | **mustache-core**: our own spec, with the Mustache spec suite as a reference | Small enough to implement in any language. No dependency on a JS template engine (research 06 §3.2) |
| Type generation | Our own small emitters from JSON Schema: TS now; later Python (dataclasses or TypedDict, optionally pydantic) and Go (structs with json tags) | Predictable, idiomatic output. quicktype is a reference, not a dependency |
| i18n | ICU MessageFormat messages, resolved **at compile time** per locale (one artifact per template × locale) | Runtimes need no i18n library. Runtime-dependent parts are the open question below |
| Theme | DTCG 2025.10 or shadcn CSS variables → roles → validated hex at compile time | The output is plain inline styles, the same for every language |
| HTML pipeline | CSS inlining (juice or css-inline), colour conversion (culori), parsing for checks (parse5/htmlparser2) | Build-time only, TS-side |
| CLI and studio | `cac`/`citty` + `@clack/prompts`, config loading through `jiti`, a Vite-based studio | Build-time only. The studio previews the compiled artifacts through the TS runtime, so it previews exactly what any language would render |

**What never runs in a backend:** React, Zod, the compiler, MJML, CSS tooling. The backend gets
strings, types and a tiny renderer.

## Adding a language later

1. Write the emitter: types from `schema.json` and an entry module with the identifier rules (R6).
2. Write the runtime: mustache-core plus the escaping table (R2, R3), about 200 lines.
3. Pass the conformance suite (R8).
4. Add the target to the config: `targets: ["ts", "python"]`. The compiler is unchanged.

## Open questions this raises

| Question | Options |
|---|---|
| **Runtime plurals** ("1 item" / "3 items" when the count arrives at send time) | (a) The caller passes the plural category, typed per locale. (b) Compile each plural branch into a section keyed by a spec'd category function that every runtime implements, using CLDR rules. (c) The caller formats the whole phrase. Decide in the design |
| **Runtime formatting** (dates, money) | Caller-formatted strings (R5) in phase 1. Later, a small spec'd formatter set if demand justifies it |
| **Optional runtime validation** | On by default, or opt-in per project |
| **Python and Go runtime packaging** | Published packages (`email-kit` on PyPI, a Go module) versus a runtime vendored into the generated code. Vendoring keeps "no runtime dependency", as in TS |
