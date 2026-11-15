# mustache-core v1

**Dialect id:** `mustache-core@1` · **Status:** draft. It becomes final with the first stable
release; until then, cases may change. The decision behind it is
[ADR 0002](../adr/0002-mustache-core-dialect.md).

mustache-core is the placeholder language of compiled email-kit templates. The compiler writes it;
a small runtime in each backend language renders it at send time. This document defines the dialect. The conformance suite in
[`conformance/mustache-core/`](../../conformance/mustache-core/) defines the exact bytes. When the
two disagree, that is a bug in one of them, and the fix goes into both.

The TS reference renderer is [`packages/dialect`](../../packages/dialect/src/index.ts).

## 1. Goals

- **Same bytes in every language.** The same template and data give identical output in TS,
  Python, Go and any later runtime. Everything a language would otherwise decide for itself
  (truthiness, number printing, escaping) is fixed here.
- **Small enough to write in a day.** A runtime is about 200 lines with no dependencies.
- **A subset of Mustache.** Every mustache-core template is a valid
  [Mustache](https://github.com/mustache/spec) template. Section 13 lists where stock engines
  render it differently.
- **Fail loudly.** A missing value is an error, never a silent blank.

## 2. Terms

| Term | Meaning |
|---|---|
| **Template** | A string of text and tags |
| **Tag** | `{{…}}` or `{{{…}}}` |
| **Data** | The root value passed to render, usually an object |
| **Context stack** | The values that names are looked up in, innermost last. It starts as `[data]` |
| **Nothing** | The result of a lookup that finds no key, or finds the value `null` |
| **Profile** | The escaping rules for a template part: `html` or `text` (section 9) |

## 3. Data model

Data is a JSON value: null, boolean, number, string, array or object. A runtime converts its
language's values to this model before lookup:

- **Objects** are maps from string keys to values. Only the object's own keys exist: nothing is
  inherited from prototypes or classes, and `{{constructor}}` on `{}` finds nothing.
- **Arrays** have no keys. `{{items.length}}` and `{{items.0}}` find nothing or are invalid.
- **Strings** have no keys. `{{name.length}}` finds nothing.
- **Numbers** are IEEE 754 binary64 doubles. A runtime with integer or decimal types converts them
  to the nearest double first (`9007199254740993` becomes `9007199254740992`). NaN and the
  infinities are invalid (`invalid-number`).
- A missing key (or `undefined`, `None`, a nil pointer) and `null` are the same: **nothing**.

## 4. Syntax

Delimiters are always `{{` and `}}`. They can't be changed.

| Form | Meaning |
|---|---|
| `{{name}}` | Variable: the value, escaped by the profile |
| `{{{name}}}` | Raw variable: the value, never escaped |
| `{{#name}}…{{/name}}` | Section |
| `{{^name}}…{{/name}}` | Inverted section |

**Names.** A name is `.` (the implicit iterator: the current context) or a dotted path:

```
name    = "." / segment *( "." segment )
segment = ( ALPHA / "_" ) *( ALPHA / DIGIT / "_" )     ; ASCII only
```

Names are case-sensitive. `items.0`, `first-name`, `a..b` and `a.` are invalid (`invalid-name`).

**Inside a tag:**
- The sigil (`#`, `^`, `/`) must be the first character after `{{`.
- Spaces (U+0020) and tabs (U+0009) around the name are ignored: `{{ name }}`, `{{# items }}`,
  `{{{ html }}}`. No other whitespace is allowed.
- `{{{` starts a raw tag that ends at the next `}}}`. `{{` starts any other tag, which ends at the
  next `}}`. A tag with no end is `unclosed-tag`.

**Not supported.** These raise `unsupported-tag`:
- comments `{{! }}`
- partials `{{> }}`
- set delimiters `{{= =}}`
- `{{& }}` (use `{{{ }}}`)
- inheritance `{{< }}` and `{{$ }}`

Lambdas, helpers and filters don't exist either.

**Literal braces.** Every `{{` in a template starts a tag, and there is no escape for it. A `}}`
outside a tag is plain text. Producers keep `{{` out of template text (section 12).

**Sections nest.** Each `{{/name}}` closes the innermost open section, and its name must match
exactly: otherwise it is `mismatched-close`, or `unexpected-close` when nothing is open. Every
section must be closed (`unclosed-section`).

**Whole-template validation.** A runtime parses and validates the entire template before
rendering anything. A syntax error inside a section that would be skipped is still an error.

## 5. Standalone lines

This is the same rule as Mustache's. It lets templates for the plain-text part put section tags on
their own lines without leaving blank lines behind.

A **line** ends after `\n`. `\r\n` counts as one line ending. The last line may have no ending. A
section, inverted or closing tag is **standalone** when its line holds only:
1. optional spaces and tabs,
2. that one tag,
3. optional spaces and tabs,
4. the line ending, or the end of the template.

The whole line is removed, including the spaces, the tabs and the line ending.

- Variables are never standalone.
- Two tags on one line are not standalone.
- Standalone removal happens while parsing, so it's the same whatever the data is.

## 6. Name resolution

To resolve a name against the context stack:

1. **`.`** is the innermost context.
2. **The first segment:** search the contexts from the innermost outwards. Skip any context that
   isn't an object. Stop at the first object that **has the key**, even if its value is `null`.
   If no context has it, the result is nothing.
3. **Each later segment** is looked up only in the value found so far. If that value isn't an
   object or doesn't have the key, the result is nothing. The search never goes back to outer
   contexts (Mustache's "broken chain" rule).

## 7. Sections and truthiness

A value is **falsy** when it is nothing, `false`, `0` (including `-0`), `""` or `[]`. Everything
else is truthy, including `{}`, `"0"` and `" "`.

| Value of `name` | `{{#name}}…{{/name}}` | `{{^name}}…{{/name}}` |
|---|---|---|
| falsy | renders nothing | renders the block once, context unchanged |
| non-empty array | renders the block once per item, each item pushed as the context | nothing |
| `true` | renders the block once, **context unchanged** | nothing |
| object, non-empty string, non-zero number | renders the block once with the value pushed | nothing |

Tags inside a block that isn't rendered are never evaluated, so they raise no render errors.
Inside a section over a list of strings, `{{.}}` is the item. Inside `{{#flag}}`, `{{.}}` is
still the enclosing context.

## 8. Variables

`{{name}}` and `{{{name}}}` resolve the name (section 6) and turn the value into text:

| Value | Text |
|---|---|
| string | the string, unchanged: no trimming, no Unicode normalisation, no line-ending conversion |
| number | the ECMAScript `Number::toString(x)` format (ECMA-262), radix 10 |
| `true` / `false` | `true` / `false` |
| nothing | error `missing-value` |
| array or object | error `non-scalar-value` |

The number format is the shortest decimal string that converts back to the same double:

| Value | Text | Rule |
|---|---|---|
| `42`, `-7`, `100.0` | `42`, `-7`, `100` | integers have no fraction or exponent |
| `-0` | `0` | negative zero has no sign |
| `0.1`, `0.30000000000000004` | same | shortest round-trip digits |
| `1e20` | `100000000000000000000` | decimal while the exponent is below 21 |
| `1e21`, `1.7976931348623157e308` | `1e+21`, `1.7976931348623157e+308` | exponent from `1e21`, with `+` |
| `0.000001`, `2.5e-5` | `0.000001`, `0.000025` | decimal down to `1e-6` |
| `1e-7`, `5e-324` | `1e-7`, `5e-324` | exponent below `1e-6`, no leading zeros |

- **JS:** `String(x)`.
- **Python:** `repr(float)` gives the same digits but a different layout (`1e-07`, `1e+20`,
  `100.0`), so the runtime reformats them.
- **Go:** `strconv.FormatFloat(x, 'g', -1, 64)` gives the same digits, also with layout fixes.

Templates should rarely print raw numbers anyway, because values that depend on the locale arrive
already formatted as strings
([ADR 0008](../adr/0008-backend-formats-values.md)).

## 9. Escaping profiles

Each template part is rendered with one profile:

| Part | Profile |
|---|---|
| HTML part | `html` |
| plain-text part, subject, preheader | `text` |

**`html` profile.** Values from `{{name}}` are escaped with exactly this table, in text and
attribute contexts alike. No other character is changed.

| Character | Becomes |
|---|---|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

**`text` profile.** Values are inserted unchanged.

**Both profiles:**
- `{{{name}}}` is never escaped.
- Template text is never escaped.
- Values are never parsed as templates, so a value of `{{secret}}` prints as `{{secret}}`.

Rules that depend on where a value is used are not part of the dialect. They belong to the
compiler and the generated module:
- which fields may appear in `href` and `src`;
- rejecting CR and LF in the subject.

A runtime API should treat an unknown profile as `html`, so a mistake fails safe.

## 10. Errors

Every runtime uses these codes. Messages are free text; the conformance suite checks only the code.

| Code | When | Kind |
|---|---|---|
| `unclosed-tag` | `{{` without `}}`, or `{{{` without `}}}` | syntax |
| `unsupported-tag` | a comment, partial, set-delimiter, `&`, `<` or `$` tag | syntax |
| `invalid-name` | the tag content isn't a valid name (section 4) | syntax |
| `unclosed-section` | the template ends inside a section | syntax |
| `unexpected-close` | `{{/name}}` with no open section | syntax |
| `mismatched-close` | `{{/name}}` doesn't match the innermost open section | syntax |
| `missing-value` | a variable resolves to nothing | render |
| `non-scalar-value` | a variable resolves to an array or object | render |
| `invalid-number` | a variable or section resolves to NaN or an infinity | render |

- **Syntax errors** are raised before any output, for the whole template.
- **Render errors** stop the render. No partial output is returned.

## 11. Conformance suite

The suite lives at [`conformance/mustache-core/`](../../conformance/mustache-core/README.md). Each
file follows [`case-file.schema.json`](../../conformance/mustache-core/case-file.schema.json) and
groups cases by topic. Each case gives:
- the profile,
- the template,
- the data,
- either `expected` (the exact output) or `error` (a code from section 10).

A runtime conforms to `mustache-core@1` when it passes every case in every file.

The suite has 142 cases. It will grow to at least 200, adding very long (10 KB) values and cases
from the Mustache spec.

## 12. What producers guarantee

The email-kit compiler only writes templates that:

- **Parse without errors.** Every name is valid.
- **Contain no literal `{{`.** In HTML it writes `&#123;&#123;` instead. In the text part and the
  subject, copy containing `{{` is a compile error.
- **Use `{{{ }}}` only behind the `<Raw>` allow-list**. Data is always escaped.
- **Reference only names the data schema defines**, so a `missing-value` error at send time means
  the data didn't match the schema. Validating before rendering catches this earlier.

## 13. Compatibility with stock engines

Backends may render compiled templates with their own Mustache or Handlebars engine.
These are the known differences; they haven't yet been verified by running the suite against
those engines.

| Engine | Difference |
|---|---|
| mustache.js | Also escapes `/`, `` ` `` and `=`. Renders missing values as empty strings. `0` is falsy, as here |
| Mustache spec engines (Ruby, Java, Python ports) | Renders missing values as empty strings. Some treat `0` and `""` as truthy. Numbers print the language's own way (`1.0`, `1e-07`) |
| Handlebars | Also escapes `=` and `` ` ``, and writes `'` as `&#x27;`. Doesn't search outer contexts unless `compat: true`. `0` is falsy. Missing values render as empty strings unless `strict: true` |

For output that is identical byte for byte, use an email-kit runtime.

## 14. Design decisions

| Decision | Choice | Why |
|---|---|---|
| Base syntax | A strict subset of Mustache, standalone lines included | Mustache has a formal spec and an engine in every language. Keeping the standalone rule means stock engines lay out the plain-text part the same way |
| Name lookup | Mustache's context-stack search | Required for stock-engine compatibility. The compiler emits names that resolve the intended way |
| Falsy values | nothing, `false`, `0`, `""`, `[]` | Matches mustache.js and Handlebars, and how JS and Python authors read optional fields. Mustache leaves this to each language, so it has to be fixed here |
| `true` in a section | Context unchanged | Matches mustache.js |
| Missing variable | Error | A silent blank in a sent email is worse than a failed send |
| Booleans as text | `true` / `false` | Every language can produce them. Printing one is usually a template bug, but not an ambiguous one |
| Numbers as text | ECMAScript `Number::toString` | One exact, documented algorithm, native in the TS runtime and reproducible elsewhere |
| `'` escape | `&#39;` | What mustache.js writes; decimal is understood by every HTML parser, including old email clients |
| Escaped characters | Only `& < > " '` | Enough for HTML text and quoted attributes. A smaller table is easier to match exactly in every language |
| Not supported | Comments, partials, delimiters, `&`, lambdas | Templates carry no code and are never composed at runtime, and less for each runtime to implement |

## 15. Data preparation in generated modules

mustache-core itself has no logic. A generated module's `render(data, { locale })` prepares the
data before filling the templates
([ADR 0003](../adr/0003-runtime-plurals.md)). A runtime in another language must produce
the same prepared data, byte for byte in what the templates can see.

1. **Project** the data onto the schema's model: unknown keys go; a missing optional key becomes
   `null`.
2. **Prepare** every object, depth first. For an object, start from a copy of its parent's
   entries (empty at the root), then for each of its fields, through nested objects but not into
   lists:
   - a number field: `plural.<path>` = `{ <category>: true }`, with the category from the
     locale's CLDR rules (the CLDR version is in the manifest as `cldr`), plus
     `exact_<n>: true` when the value is a non-negative safe integer;
   - a string field with an `enum`: `select.<path>` = `{ <key>: true }`, where the key is `v_`
     followed by the value with every character outside `A–Z a–z 0–9` written as `_<hex code
     point>_` (`pro-plus` → `v_pro_2d_plus`).
   If any entries result, set the object's `_ek` to `{ plural, select }`. An object's own entries
   replace its parent's of the same name, the same way a field shadows an outer one in name
   resolution (§6). Lists are prepared item by item, each item inheriting the list owner's entries.
3. **Add the context** at the root: `_ek.context` holds the values passed to `createEmails()`.

`_ek` is reserved: schemas can't declare it, and projection drops it from the data.

Templates read these keys with sections. A message `{count, plural, =0 {…} one {…} other {…}}`
compiles to `{{#_ek.plural.count.exact_0}}…{{/…}}`, then the category sections inside inverted
sections of the exact matches; a `select` compiles to a section per case and the `other` case
inside inverted sections of the others. In a list item, `_ek` resolves to the item's own entry,
which is why every object inherits its parents' entries.

A CLDR category function takes a double `n` and uses the operands of UTS #35 computed from its
shortest round-trip decimal form: `i` the integer part, `v` and `f` the fraction digits and their
value, `w` and `t` the same without trailing zeros, `c` and `e` zero.

## 16. Locale resolution in generated modules

`render(data, { locale })` picks one of the compiled locales for the requested BCP 47 tag:
RFC 4647 lookup, honouring CLDR's parent locales. The generated module embeds the
data, from the CLDR version in the manifest, filtered to the project's languages: `parents`
(a lowercase tag → the next tag; `und` means the root), `scripts` (a language → its likely
script) and `regions` (`language-region` → the script it implies, when that differs from the
language's). Explicit `locales.fallback` entries are written into `parents`, over CLDR's.

1. **Key** a tag by lowercasing it, turning `_` into `-`, and, when its second subtag is a
   region rather than a script, inserting the script `regions` gives (`zh-TW` → `zh-hant-tw`).
   Compiled locales are keyed the same way.
2. **Look up** the requested key among the compiled keys. A match returns that compiled locale.
3. **Step** to `parents[key]` if there is one; otherwise drop the last subtag, and any
   single-character subtag (`x`, `u`) left at the end. Dropping a script that isn't the
   language's likely one to reach the bare language (`sr-latn` → `sr`) ends the lookup, as does
   reaching `und` or `root`, or running out of subtags. Otherwise go to 2.
4. **Default:** the first compiled locale.

Examples, with CLDR 47: `es-AR` → `es-419` → `es`; `pt-AO` → `pt-PT` → `pt`; `en-AU` →
`en-001` → `en`; `zh-TW` → `zh-Hant-TW` → `zh-Hant` → root, never `zh` (Simplified).
