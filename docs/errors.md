# Error reference

Every error email-kit reports has an id, shown in brackets:

```
✗ src/email-kit/templates/order.tsx:12:15 [placeholder-misuse]
```

Each id below says why it happens and how to fix it. The CLI links to these entries (CLI-06).
A test checks that every id the code can raise is listed here.

## Config

### config-not-found
**Why:** `email-kit compile` looks for `email-kit.config.ts` (or `.mts`, `.js`, `.mjs`) in the current folder.
**Fix:** run the command from the project root, create the config with `npx email-kit init`, or pass `--config <path>`.

### invalid-config
**Why:** the config has unknown options, paths that overlap, or locale tags that aren't canonical BCP 47 (such as `en_US` or `pt-br`). Every problem is listed with its path.
**Fix:** correct each listed option. Locale tags take the form `en`, `pt-BR` or `zh-Hant`, and the list must include the default locale.

### no-templates-folder
**Why:** the templates folder (`<root>/templates` by default) doesn't exist.
**Fix:** create it, or set `templates` in the config.

## Loading files

### syntax-error
**Why:** a template, a component or the config doesn't parse.
**Fix:** fix the code at the reported line. The code frame shows where the parser stopped.

### unresolved-import
**Why:** an import can't be found from the file that imports it.
**Fix:** check the path, and install the package if it is one. Aliases come from the project's tsconfig `paths`.

### load-failed
**Why:** a file failed to load or run for a reason email-kit doesn't recognise, such as an exception thrown at the top level of a template.
**Fix:** read the message and the reported location. If it points into email-kit itself, please report it.

### no-definition
**Why:** a file in the templates folder doesn't `export default defineEmail({ … })`.
**Fix:** add the default export. Helpers that aren't templates go in another folder, or in a file whose name starts with `_`.

## Templates

### invalid-id
**Why:** template ids are lowercase words joined by hyphens (`order-confirmation`), because they become file names and code identifiers.
**Fix:** rename the id. Never rename an id that has shipped: backends call it by name.

### duplicate-id
**Why:** two templates use the same id.
**Fix:** give each template its own id.

### identifier-collision
**Why:** two ids become the same key in the generated `emails` object.
**Fix:** rename one of the templates.

### static-condition
**Why:** `<If>`, `<Unless>` and `<Each>` choose content at send time, so they need a field from `data`.
**Fix:** for conditions known at compile time, use plain JavaScript: `{isMarketing && <Footer />}`.

### function-child
**Why:** a function was rendered as a child. Only `<Each>` and `<If>` take a function child.
**Fix:** call the function, or move it inside `<Each>` or `<If>`.

### invalid-child
**Why:** a child has a type that can't be rendered (an object, a symbol).
**Fix:** render strings, numbers, placeholders, elements or arrays of them.

### invalid-attribute
**Why:** an attribute or the subject got a value that can't be text: an element, or an object.
**Fix:** use strings, numbers, placeholders or a message from `t()`. The subject is text only.

### data-dependent-style
**Why:** styles are fixed when the template compiles, so a `style` value can't come from `data`.
**Fix:** choose between fixed styles with `<If>` and `<Unless>`.

### platform-value-missing
**Why:** the template reads `platform.<key>`, but the config doesn't set that platform value.
**Fix:** set it in `email-kit.config.ts`: `platform: { productName: "Acme" }` for a fixed value, or `platform: { siteUrl: { runtime: true } }` for one the backend passes to `createEmails()` at send time.

### outside-evaluation
**Why:** `<Each>`, `<If>` or `<Unless>` ran outside a compile, for example from a test that called the component directly.
**Fix:** compile the template with `email-kit compile`, or through the compiler API.

## Data and placeholders

### placeholder-misuse
**Why:** at compile time `data` holds placeholders, not values. Arithmetic, string methods, template literals, `.map()` and spreading need the real value, which only exists at send time.
**Fix:** compute the value in the backend and pass it as its own field. Use `<Each of={…}>` for lists.

### non-scalar-placeholder
**Why:** `data` itself, or an object field, was rendered where text belongs.
**Fix:** render one of its scalar fields.

### invalid-field-name
**Why:** field names become placeholder names and code identifiers in every language, so they are limited to letters, digits and `_`.
**Fix:** rename the field in the schema, for example `firstName` instead of `first-name`.

### shadowed-item
**Why:** inside a nested `<Each>` or `<If>`, `{{.}}` means the innermost value, so an outer list item can't be reached through it.
**Fix:** use a list of objects and a field of the item, or restructure so the item is used in its own `<Each>`.

## Messages

### missing-message
**Why:** `t("key")` asks for a message that the locale's message file doesn't have. Every locale needs every key (I18N-03).
**Fix:** add the key to the file named in the error (`<messages>/<locale>/<template>.json`).

### missing-message-param
**Why:** the message uses `{name}`, but `t()` didn't pass `name`.
**Fix:** pass the parameter, or remove it from the message.

### unused-message-param
**Why:** `t()` passed a parameter that the message doesn't use, which usually means a typo in one of them.
**Fix:** use it in the message, or stop passing it.

### unsupported-message
**Why:** the message uses ICU syntax beyond simple `{name}` arguments (plural, select), which isn't supported yet.
**Fix:** use simple arguments for now. Runtime plurals follow ADR 0003.

### invalid-message
**Why:** a message has an unbalanced `{` or `}`.
**Fix:** balance the braces.

### invalid-messages
**Why:** a message file isn't valid JSON, or isn't a flat object of `"key": "message"` strings.
**Fix:** correct the file named in the error.

## Text part and subject

### literal-braces
**Why:** the plain-text part and the subject can't express a literal `{{`, or a `{` right before a placeholder: the placeholder language would read them as a tag.
**Fix:** rephrase the copy, or put the brace after a space.

### multi-line
**Why:** the subject and the preheader are a single line.
**Fix:** remove the line break.

## Schemas

### schema-not-portable
**Why:** the data schema uses something that Python, Go and other backends can't represent: a union, a record, a tuple, `Date`, `bigint`, `any`, a default or a transform (R4). Each issue is listed with its field path.
**Fix:** reshape the field. Dates and money arrive as strings the backend formats (R5).

### unsupported-schema
**Why:** the schema library has no JSON Schema support email-kit can use.
**Fix:** use Zod 4, ArkType 2, or Valibot with `@valibot/to-json-schema`.

### missing-converter
**Why:** Valibot schemas need the official converter.
**Fix:** `npm install -D @valibot/to-json-schema`.

## Output

### invalid-output
**Why:** the compiler produced something it shouldn't have, such as an invalid placeholder template. This is a bug in email-kit.
**Fix:** please report it, with the template that triggers it.

## At send time

These come from the generated module in a backend, not from the CLI.

- **`missing-value`, `non-scalar-value`, `invalid-number`:** from the placeholder renderer, when the data doesn't match the template. See the [mustache-core spec](spec/mustache-core.md#10-errors).
- **`missing-context`:** `createEmails()` was called without a value the config marks `{ runtime: true }`, or with an empty one. Pass every runtime key as a non-empty string.
- **`subject-line-break`:** the rendered subject contains CR or LF, usually from user data, and could inject mail headers. Strip line breaks from the value before rendering.
