# P0-03: JSX → IR → placeholder compiler prototype

**Status:** done. **Done when:** "the prototype emits HTML and text with mustache-core
placeholders that render correctly with sample data". This is met by
[`packages/cli/test/compile.test.ts`](../../packages/cli/test/compile.test.ts) and its
[golden files](../../packages/cli/test/__golden__/order-confirmation/).

## What was built

| Piece | Where | Becomes |
|---|---|---|
| JSX runtime → IR | `packages/core/src/jsx-runtime.ts`, `ir.ts` | P1-030, P1-033 |
| Typed `data` proxy | `packages/core/src/placeholder.ts` | P1-016, P1-036 |
| `defineEmail` (Standard Schema, typed fixtures, id check) | `packages/core/src/define.ts` | P1-010, P1-011, P1-013 |
| `<Each>`, `<If>` (with a render prop), `<Unless>` | `packages/core/src/control.ts` | P1-017 |
| `t()` with `{name}` arguments, placeholders allowed as values | `packages/core/src/i18n.ts` | P1-151 |
| Template loader (rolldown, see [P0-11](p0-11-jsx-transform.md)) | `packages/cli/src/compiler/load.ts` | P1-032 |
| IR → HTML and text, subject and preheader | `packages/cli/src/compiler/*.ts` | P1-060, P1-080 |

The fixture template ([`order-confirmation.tsx`](../../packages/cli/test/fixtures/order-confirmation.tsx))
uses:
- scalars;
- a list (`<Each>`);
- an optional field (`<If>` / `<Unless>`);
- attribute placeholders (`href`, and a translated `title`);
- messages with placeholder arguments, in two locales;
- a user component.

It compiles to `{{…}}`, `{{#items}}…{{/items}}` and `{{^discount}}…{{/discount}}`. Rendering
through the mustache-core reference renderer gives the expected HTML and text. Hostile values are
escaped in HTML and kept verbatim in text.

## Proven

- **Templates are type-safe end to end with a Zod 4 schema.** The type tests in
  [`types.check.tsx`](../../packages/cli/test/types.check.tsx) reject:
  - misspelt fields and item fields;
  - booleans, lists, optional and nullable fields rendered as text;
  - arithmetic and string methods on placeholders;
  - `<Each>` over a non-list;
  - `<If>` on a required non-boolean;
  - fixtures of the wrong shape, and an unknown `purpose`.
- **Misuse fails at compile time with a clear message,** for what types can't see: arithmetic,
  template literals, `.map()` (points to `<Each>`), spreading a list, and data in `style`.
- **One tree gives both parts.** The text part has the preheader first, underlined headings, `-`
  lists and `Label: URL` links. Section tags sit on their own lines, and mustache-core's standalone
  rule removes them.
- **The output always parses as mustache-core.** Every part is re-parsed after compiling, as a
  self-check.

## Findings for phase 1

1. **Name shadowing through the context stack (P1-016, high).** Mustache looks names up from the
   innermost context outwards, which causes two hazards:
   - Inside `<Each of={data.items}>`, `{data.currency}` emits `{{currency}}`, which an item key
     named `currency` would **shadow**.
   - An optional item key that is missing **falls through** to an outer value of the same name.

   The prototype only catches the `{{.}}` case (an outer item used inside a nested section). The
   compiler has the JSON Schema, so it can catch both. Proposal:
   - a compile error on any key collision between a used path and the contexts pushed around it,
     suggesting a rename;
   - and/or have `render()` fill missing optional keys with `null`, so the lookup stops at the
     item.
2. **`{data.x && …}` and `data.x ? a : b` are silently always true.** A proxy is an object, and
   JavaScript can't trap truthiness, and neither TypeScript nor the runtime catches it. Proposal:
   a new source check (`source.placeholder-condition`) using the type checker, plus a docs note.
3. **One type error in JSX children hides the others.** An erroring child becomes `any`, which
   widens the whole children list. This is TypeScript's behaviour; the type tests put each
   negative case in its own element.
4. **Two copies of `@email-kit/core` must cooperate.** Under Vitest, and in projects with two
   installs, the template's core is a different module instance from the compiler's. Proxies
   (`Symbol.for`) and evaluation state (a `Symbol.for` slot on `globalThis`) already work across
   copies. The CLI should still check that the versions match.
5. **The text part can't express some things:**
   - a literal `{{` in copy;
   - a `{` right before a placeholder;
   - heading underlines of the true width (the prototype counts a placeholder as its name).

   The first two are compile errors (spec §12). The underline needs a decision in P1-082:
   accept the approximation, or use another heading style.
6. **`<If>` on an optional object pushes that object** (Mustache semantics), adding to finding 1.
   The render-prop value keeps the field's path, so its own fields resolve. Fields from outside
   can still be shadowed.
7. **Messages return IR, not strings,** so arguments can be placeholders (`t("orderLine", { order:
   data.orderNumber })`). Real ICU parsing (P1-151) must keep that property. Plurals wait for the
   P0-06 ADR.

## Not done (by design)

- the real document skeleton, CSS pipeline and tables (P1-061+);
- `<Else>`, `<Raw>` and `url` fields;
- typed message keys;
- the manifest and generated module;
- the CLI command (`email-kit compile`).

The compiler is a library inside `@email-kit/cli` for now.
