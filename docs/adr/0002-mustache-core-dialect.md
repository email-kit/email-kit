# ADR 0002: The mustache-core placeholder dialect and escaping table

**Status:** Proposed (2026-10-30). **Task:** P0-07 (SPK-05), recorded in P0-12.
**Evidence:**
- [`docs/reference/mustache-core.md`](../reference/mustache-core.md) (the spec);
- [`conformance/mustache-core/`](../../conformance/mustache-core/README.md) (142 cases);
- [`packages/dialect`](../../packages/dialect/src/index.ts) (TS reference renderer, 1.4 KB
  min+gzip).

## Context

Compiled templates carry placeholders that a backend fills at send time (R1). Python, Go and
later runtimes must produce byte-identical output from the same template and data (R8). Every
template engine decides some things its own way: truthiness, escaping, number printing, missing
values. So a stock engine can't be the contract.

## Options

1. **Stock Mustache semantics,** each language using its own engine. Outputs differ in escaping
   (mustache.js also escapes `/`, `` ` ``, `=`), missing values (blank) and number printing
   (`1.0` in Python).
2. **Handlebars or Liquid.** They have helpers and filters, which are code in the artifact (against
   R1). They also have more surface to reimplement, and no outer-context lookup by default
   (Handlebars).
3. **Our own small dialect that is a strict subset of Mustache,** with every open decision fixed
   in a spec and a conformance suite.

## Decision (proposed)

**Option 3, `mustache-core@1`.**

**Syntax** is Mustache's own:
- `{{x}}`, `{{{x}}}`, sections, inverted sections, `{{.}}` and dotted names;
- fixed `{{ }}` delimiters, and the standalone-line rule;
- no comments, partials, set-delimiters, `{{&x}}` or lambdas: those are syntax errors.

**Fixed semantics:**

| Topic | Rule |
|---|---|
| Name lookup | Mustache's context-stack search; own keys of plain objects only |
| Falsy | nothing (missing or `null`), `false`, `0`, `""`, `[]` |
| `true` in a section | renders once, context unchanged |
| Missing variable | error `missing-value`; never a blank |
| Object or array as a variable | error `non-scalar-value` |
| Numbers | IEEE 754 doubles printed with ECMAScript `Number::toString`; NaN and infinities are errors |
| Booleans | `true` / `false` |
| `html` profile | escape exactly `&` `<` `>` `"` `'` → `&amp;` `&lt;` `&gt;` `&quot;` `&#39;`, in text and attributes |
| `text` profile | no escaping (plain-text part, subject, preheader) |
| Validation | the whole template is parsed before any output; nine stable error codes |

**Producer guarantees** (spec §12):
- templates always parse, and contain no literal `{{`;
- HTML static text writes every `{` as `&#123;`;
- `{{{ }}}` appears only behind the `<Raw>` allow-list.

## Consequences

- **A runtime is about 200 lines with no dependencies.** It conforms by passing every case in
  `conformance/mustache-core/`, in any language.
- **Stock Mustache and Handlebars can still render the templates, but not byte-identically**
  (spec §13; to be verified in P1-044).
- **Name shadowing through the context stack** is a compiler responsibility. Proposals from P0-03
  and P0-10:
  - `render()` projects data onto the schema (drop unknown keys, fill missing optional keys with
    `null`);
  - a compile-time collision check.
- **Nothing may re-parse compiled HTML with a spec-compliant parser.** P0-09 showed that
  html5ever moves section tags out of tables and decodes `&#123;` into `{{{tag}}}`, an unescaped
  placeholder (see ADR 0005).
- **The dialect is versioned.** Manifests record `dialect: "mustache-core@1"` (DLG-06). Any change
  to a conformance case's expected bytes needs a new dialect version.
