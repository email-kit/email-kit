# @email-kit/runtime

Renders the emails [email-kit](https://github.com/email-kit/email-kit) compiles. It's the only
email-kit package your app needs when it runs, so it's a **dependency**; the CLI, `core` and
`components` are devDependencies.

> **Preview (0.1).** Usable for transactional email, and changing. See [what's in the
> preview](https://github.com/email-kit/email-kit#status).

```sh
npm install @email-kit/runtime
```

`email-kit init` adds it for you. You don't import it yourself: the module `email-kit compile`
writes does, and your app imports that module.

```ts
import { emails } from "@/email-kit"

const { subject, html, text } = emails.welcome.render({ name: "Ada" }, { locale: "de" })
```

## Small on purpose

The compiler parses every template and writes it into the generated module in a compact form, so
nothing is parsed when an email is sent. What's left to do at send time is here, and the optional
parts have their own entry points, which the generated module imports only when your templates
use them:

| Entry point | Imported when | Min + gzip |
|---|---|---|
| `@email-kit/runtime` | always: filling the templates, keeping only the schema's fields | about 1.4 KB |
| `@email-kit/runtime/validate` | `validate` is on (the default) | about 1.1 KB |
| `@email-kit/runtime/plural` | a message has `{n, plural, …}` or `{x, select, …}` | about 0.5 KB |
| `@email-kit/runtime/locale` | the project compiles more than one locale | about 0.5 KB |
| `@email-kit/runtime/context` | the config has sender values passed at send time | about 0.5 KB |

Everything together is about 3 KB. A test keeps each entry point under its budget.

It has no dependencies, doesn't use `fs`, and uses only web-standard APIs, so it runs in Node 22+,
Bun, Deno, Cloudflare Workers, AWS Lambda and Next.js server code.

## Errors

Rendering problems throw an `EmailRenderError` with a `code`, which the generated module
re-exports. See the [error reference](https://github.com/email-kit/email-kit/blob/main/docs/errors.md#at-send-time).

## Versions

Install the same version as `@email-kit/cli`. The generated module records the format it was
compiled for, and the runtime refuses one it doesn't render (`incompatible-module`) rather than
rendering it wrong. `email-kit check` fails when the runtime is missing or a devDependency.

MIT licensed.
