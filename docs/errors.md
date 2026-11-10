# Error reference

Every error email-kit reports has an id, shown in brackets:

```
✗ src/email-kit/templates/order.tsx:12:15 [placeholder-misuse]
```

Each id below says why it happens and how to fix it. The CLI links to these entries (CLI-06).
A test checks that every id the code can raise is listed here.

## Setup (`email-kit init`)

### no-package-json
**Why:** `init` works on the nearest folder with a `package.json`, and there's none from here up.
**Fix:** run it inside the project that sends email, such as `apps/api` in a monorepo.

### init-needs-answers
**Why:** `init` asks before it changes files, and there's no terminal to ask in (CI, a script).
**Fix:** run `email-kit init --yes` to accept the defaults; `--dir`, `--config` and `--no-install` set the rest.

### init-cancelled
**Why:** a question was cancelled (Ctrl+C). Files created before it stay; nothing after it was changed.
**Fix:** run `email-kit init` again: it says "already set up" if the config was written, and `email-kit new` adds templates.

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

### invalid-purpose
**Why:** every template declares its legal purpose, `"transactional"`, `"marketing"` or `"consent-request"`, because it decides which footer parts the `legal.*` checks require (`legal.purpose-declared`).
**Fix:** add `purpose` to `defineEmail()`. Any promotional content makes an email `"marketing"`.

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

### sender-value-missing
**Why:** the template reads `sender.<key>`, but the config doesn't set that sender value.
**Fix:** set it in `email-kit.config.ts`: `sender: { productName: "Acme" }` for a fixed value, or `sender: { siteUrl: { runtime: true } }` for one the backend passes to `createEmails()` at send time.

### no-theme
**Why:** a component called `useTheme()` (or styled with `role(…)`) outside a compile, for example from a test that called it directly.
**Fix:** compile the template with `email-kit compile`, or through the compiler API, which provides the theme.

### outside-evaluation
**Why:** `<Each>`, `<If>` or `<Unless>` ran outside a compile, for example from a test that called the component directly.
**Fix:** compile the template with `email-kit compile`, or through the compiler API.

## Components

### invalid-image
**Why:** an `<Image>` prop breaks a rule clients enforce: `width` and `height` must be whole px (Word ignores CSS widths), an informative or functional image needs alt text, and a literal `src` must be an absolute `https:` URL to a PNG, JPEG or GIF. SVG shows blank in Outlook on the web and new Outlook; classic Outlook can't show WebP or AVIF.
**Fix:** follow the message: export a PNG or JPEG, use the `https:` URL, give the alt text, or use `kind="decorative"` for an image that adds nothing.

### invalid-table
**Why:** a `<DataTable>` has fewer than two columns. NVDA with classic Outlook treats one-column tables as layout and stops announcing headers, and a single column reads better as a list.
**Fix:** use `KeyValue` or `List`, or add the column the data needs.

## Fixtures

### invalid-fixture
**Why:** a fixture in `defineEmail({ fixtures })` doesn't match the template's schema. `email-kit check` renders them, so they must be data the backend could send.
**Fix:** correct the fixture at the path in the message, or the schema if the fixture shows real data it doesn't allow yet.

## Checks

### check-failed
**Why:** a team check in `customChecks` threw while `email-kit check` ran it. The message names the check and repeats its error.
**Fix:** fix the check's `run()`. It gets plain data: guard for elements or attributes that may be missing.

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
**Why:** the message uses ICU syntax email-kit doesn't support: a `number`, `date` or `time` argument (or another type besides `plural` and `select`), or a plural `offset:`.
**Fix:** format numbers, dates and times in your backend and pass the text, marked with `formatted()` in the schema (see [the formatting recipe](recipes/formatting.md)); write plurals without an offset.

### invalid-message
**Why:** a message has an unbalanced `{` or `}`.
**Fix:** balance the braces.

### invalid-plural
**Why:** a `{n, plural, …}` message can't be compiled for a locale. It lacks a category the locale uses (ADR 0003 requires them all, so no number falls through), names one the locale never uses (English has no `zero`; write `=0` for exactly zero), has an `=N` that isn't a whole number, or gets something other than a number field from data or a literal number.
**Fix:** add the categories the message names for that locale, such as `one` and `other` in English or `zero`, `one`, `two`, `few`, `many` and `other` in Arabic, or pass a number field.

### invalid-select
**Why:** a `{x, select, …}` message gets a field without fixed values, or has a case that isn't one of the field's values. The generated module can only prepare the branch for values the schema lists.
**Fix:** make the field an enum (`z.enum(["free", "pro"])`) and name its values as cases, plus `other`.

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

## Themes

### invalid-theme
**Why:** the theme source can't be used. A shadcn CSS file isn't valid CSS, has no `:root { --… }` variables, or its `var()` references form a cycle. A DTCG token file isn't valid JSON, or an alias points at no token or forms a cycle. A `.resolver.json` breaks a rule of the DTCG Resolver Module: an unknown `version`, a modifier with fewer than two contexts or a `default` that isn't one of them, a `$ref` that points at nothing (or at a modifier from a set, or into `resolutionOrder`), an inline entry without `name` and `type`, a cycle, or a `theme.input` naming an unknown modifier or context.
**Fix:** correct the file or the input named in the error. A shadcn theme is the CSS that `shadcn init` writes (`app/globals.css` or similar). For a resolver, `theme.input` picks every modifier except the one with `light` and `dark` contexts, which email-kit resolves both of.

### invalid-colour
**Why:** a theme value isn't a CSS colour email-kit can convert (`oklch()`, `rgb()`, `hsl()`, `color(display-p3 …)`, hex or a named colour).
**Fix:** use one of those forms. Every colour is converted to 6-digit hex for email clients.

### translucent-colour
**Why:** a colour with alpha was used where there is no surface to flatten it onto. Email clients don't support `rgba()` or `opacity` everywhere, so translucent colours are composited at build time.
**Fix:** make the colour opaque, or use it for a role that sits on a surface (borders and text sit on the canvas).

### unresolved-role
**Why:** a colour role has no value in a mode: the theme lacks the token it maps from, and there is no default.
**Fix:** add the variable named in the error to the theme, or override the role in the config.

## Output

### invalid-output
**Why:** the compiler produced something it shouldn't have, such as an invalid placeholder template. This is a bug in email-kit.
**Fix:** please report it, with the template that triggers it.

## At send time

These come from the generated module in a backend, not from the CLI.

- **`missing-value`, `non-scalar-value`, `invalid-number`:** from the placeholder renderer, when the data doesn't match the template. See the [mustache-core spec](spec/mustache-core.md#10-errors).
- **`invalid-data`:** with validation on (the default), the data passed to `render()` doesn't match the template's schema. The error's `issues` list each problem with its path, such as `items[1].qty: expected a number, got "2"`. Call `validate(data)` to check data without rendering, for example when it arrives from a queue.
- **`missing-context`:** `createEmails()` was called without a value the config marks `{ runtime: true }`, or with an empty one. Pass every runtime key as a non-empty string.
- **`invalid-context`:** a value passed to `createEmails()` isn't what that sender value has to be: `siteUrl`, `helpUrl` and `privacyUrl` must be `https://` URLs and `supportEmail` an email address, the same rules the config applies to values set there.
- **`subject-line-break`:** the rendered subject contains CR or LF, usually from user data, and could inject mail headers. Strip line breaks from the value before rendering.
