# ADR 0003: Runtime plurals

**Status:** Proposed. **Decision needed from the maintainer.** **Task:** P0-06 (SPK-04).

## Context

Messages are resolved at compile time, one artifact per template × locale (I18N-02). A plural that
depends on send-time data can't be resolved then:

```json
{ "items": "{count, plural, one {# item} other {# items}}" }
```

with `t("items", { count: data.itemCount })`.

mustache-core has no comparisons or functions (R1, R2). A branch can only be chosen by a section
over a value that is present or absent. So *something* has to turn the number into a section key.

Plural categories follow CLDR and differ a lot between locales. Checked with `Intl.PluralRules`,
CLDR 47 in Node 24.13:

| Locale | Categories | Traps |
|---|---|---|
| en, de | one, other | — |
| si | one, other | **0 is "one"** |
| fr | one, many, other | 0, 1 **and 1.5** are "one" |
| ar | zero, one, two, few, many, other | 11 is "many", 100 is "other" |
| pl, ru | one, few, many, other | ru: 21 is "one", 22 "few", 11 "many" |
| ja | other | Plural forms aren't grammatical |

The same mechanism also serves ICU `select` on a send-time enum (`{plan, select, free {…} pro {…}
other {…}}`) and exact matches (`=0 {No items}`).

## Options

The authoring side is the same in every option: the ICU message above. They differ in what the
compiled template and the caller do.

**(a) The caller passes the category.**
- Compiled: `{{#itemCountPlural.one}}{{itemCount}} item{{/itemCountPlural.one}}{{#itemCountPlural.other}}…`
- Call: `render({ itemCount: 3, itemCountPlural: { other: true } })`. The schema gains a
  generated field, typed as the union of every locale's categories.
- For: no logic in the runtime.
- Against: every caller reimplements CLDR selection, in every language, and must pick the
  template's locale. It is easy to get wrong silently (Sinhala 0, French 1.5) and awkward to type.

**(b) The generated module selects the category (recommended).**
- Compiled: `{{#_ek.plural.itemCount.one}}{{itemCount}} item{{/_ek.plural.itemCount.one}}…`, with
  `_ek` a reserved root key.
- Call: `render({ itemCount: 3 }, { locale: "en" })`. Before rendering, the generated `render()`
  adds `_ek: { plural: { itemCount: { other: true } } }`. That is a spec'd data-preparation step,
  the same step that projects data onto the schema (P0-10).
- The category function is **generated at compile time from CLDR**, only for the project's
  locales, in each target language. So output doesn't depend on the runtime's ICU version.
- Conformance cases cover `(locale, number) → category` and the prepared data.
- For: callers pass plain numbers; the selection is correct and identical in every language.
- Against: a small function per locale in each generated module; a "data preparation" chapter in
  the runtime spec; one reserved key.

**(c) The caller formats the whole phrase.**
- The schema has `itemsText: z.string()`; the message is just `{itemsText}`; the backend builds
  "3 items" itself.
- For: nothing new in the compiler or runtimes.
- Against: the copy leaves the message files. Translators lose it, and the `i18n.*` checks can't
  see it.

## Recommendation

**Option (b).** It is the only one that keeps both properties: copy stays in messages, and output
is byte-identical across languages. Details to settle when it is accepted:

- **`#` prints the number in mustache-core's canonical format** (`1000`, not `1,000`). That's fine
  for the small counts typical in email. For locale-grouped numbers, the author passes a
  caller-formatted string as a second argument (R5) and uses it in the branches instead of `#`.
- **Numbers are doubles,** so the CLDR `v` operand (visible fraction digits) is 0 for integral
  values: the double `1.0` is "one" in English. Callers who need "1.0 items" pass a formatted
  string.
- **The compiler pins the CLDR version** and records it in the manifest (`cldr: "47"`).
- **`i18n.plural-categories` checks each locale's messages** against that locale's required
  categories (I18N-06). A missing category is a compile error; `other` is always required.
- **`select` on string enums and `=N` exact matches use the same mechanism,** with keys such as
  `_ek.select.plan.pro` and `_ek.plural.itemCount.exact_0`.
- **The schema rejects user fields named `_ek`** (`source.schema-portable`).

## Decision

_Pending: (a), (b) or (c), chosen by the maintainer._
