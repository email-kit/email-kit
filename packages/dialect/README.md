# @email-kit/dialect (internal)

The TS reference renderer for [mustache-core](../../docs/spec/mustache-core.md), the placeholder
dialect of compiled email-kit templates. It isn't published. The compiler inlines this source into
every generated module, so `src/index.ts` must stay self-contained: no imports and only standard
ECMAScript.

```ts
import { parse, render } from "@email-kit/dialect"

render("Hello, {{name}}!", { name: "Ada & Co" }, "html") // "Hello, Ada &amp; Co!"
render("Hello, {{name}}!", { name: "Ada & Co" }, "text") // "Hello, Ada & Co!"

const template = parse("{{#items}}- {{name}}\n{{/items}}") // parse once, render many times
render(template, { items: [{ name: "Tea" }] }, "text")       // "- Tea\n"
```

Errors are thrown as `MustacheCoreError`, with a `code` from spec §10.

`pnpm test` runs the shared [conformance suite](../../conformance/mustache-core/README.md) and the
unit tests.
