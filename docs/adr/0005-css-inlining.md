# ADR 0005: CSS inlining

**Status:** Accepted (2026-10-30). **Task:** P0-09 (SPK-07), recorded in P0-12.
**Evidence:** `docs/spikes/p0-09-css-inliner.md` (removed in commit `23d757a`; in git history). The bench, `spikes/css-inliner/`,
was removed after phase 0 (in git history before commit `0151249`).

## Context

Every presentational declaration must be inline, because `<style>` is stripped by several
clients. Only enhancement rules (media queries, dark-mode twins, client hooks) stay in `<style>`
(BLD-03). The usual tool is an inliner run over the finished HTML. Here that HTML still contains
mustache-core placeholders, MSO conditional comments and VML.

## Options

The options were tested on a realistic compiled email.

| Option | Result |
|---|---|
| `@css-inline/css-inline` 0.23 | **Unsafe.** Its spec-compliant parser moved `{{#items}}` out of a `<table>`, so the rows stopped repeating. It also decoded `&#123;{{code}}&#125;` into `{{{code}}}`, an unescaped placeholder |
| css-inline + a protection layer | Correct. But we would own a context-aware HTML scanner, and the first version mishandled `<title>` |
| `juice` 12 | Placeholders correct (built-in `{{ }}` protection, a forgiving parser). Silently drops unmatched enhancement rules (`[data-ogsc]`, `a[x-apple-data-detectors]`) unless they are in `<style data-embed>`. 19.7 MB of dependencies |
| **No HTML inliner** | Components write inline `style` from theme tokens into the IR; the compiler generates `<style>` from rule lists |

## Decision

**No HTML inliner in the pipeline.**
- Styles are inline when the IR is built.
- `<style>` holds only generated enhancement rules, which are never inlined.
- Compiled HTML is never re-parsed and re-serialised.

That works because users don't write CSS:
- UI-01 and the `source.no-literal-*` checks require token-based components;
- there are no class rules to inline that we don't generate ourselves.

**If stylesheet authoring is ever added** (registry blocks with classes, a `styles` escape
hatch), use **juice**, with:
- the generated enhancement rules in `<style data-embed>`;
- its `{{ }}` code-block protection on;
- this spike's checks as regression tests.

## Consequences

- **The serialiser owns style output (P1-062):** deterministic property order, `px` units, 6-digit
  hex, and an explicit `style` prop winning over component defaults.
- **No inliner dependency;** MSO comments stay byte-identical by construction.
- **The `css.*` checks still verify the final output,** so a component that emits bad CSS is
  caught.
- **BLD-03's wording changes:** "inlining" becomes "inline styles written by the compiler"
  (done in the PRD).
