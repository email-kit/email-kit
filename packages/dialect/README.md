# @email-kit/dialect (internal)

The parser and TS reference renderer for [mustache-core](../../docs/spec/mustache-core.md), the
placeholder dialect of compiled email-kit templates. It isn't published: the CLI bundles it. The
compiler parses each template with `parse()` and writes it into the generated module with
`compile()`, in the compact form [`@email-kit/runtime`](../runtime/README.md) renders. `render()`
is that runtime's renderer on the compiled template, so the conformance suite tests the code that
ships.

```ts
import { compile, parse, render } from "@email-kit/dialect"

render("Hello, {{name}}!", { name: "Ada & Co" }, "html") // "Hello, Ada &amp; Co!"
render("Hello, {{name}}!", { name: "Ada & Co" }, "text") // "Hello, Ada & Co!"

const template = parse("{{#items}}- {{name}}\n{{/items}}") // parse once, render many times
render(template, { items: [{ name: "Tea" }] }, "text")       // "- Tea\n"

compile("Hi {{name}}") // ["Hi ", [0, "name"]]: what the generated module carries
```

Errors are thrown as `MustacheCoreError`, with a `code` from spec §10.

`pnpm test` runs the shared [conformance suite](../../conformance/mustache-core/README.md) and the
unit tests.
