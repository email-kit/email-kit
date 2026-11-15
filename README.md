# email-kit

A type-safe email template compiler. Write emails in TSX with themed, email-safe components; run
`email-kit compile`; import the result in your backend:

```ts
import { emails } from "@/email-kit"

const { subject, html, text } = emails.orderConfirmation.render({ orderNumber: "A-1042" })
```

The goal: emails that work in Outlook, Gmail, Apple Mail and Yahoo, in light and dark mode, meet
WCAG 2.2 AA and carry what the law requires, with a check engine that proves it on every compile.

## Status

**Preview (0.1).** Usable for transactional email in TypeScript backends, and changing.

Works today:

- `email-kit init` sets up a project and `new` adds templates. Tested end to end with Next.js, a
  `tsc` build and Node type stripping; Bun and other bundlers are detected but not yet tested. See [`examples/nextjs`](examples/nextjs) and [`examples/playground`](examples/playground).
- TSX templates with typed data (Zod, Valibot or ArkType schemas) and typed `t()` messages; ICU
  plurals and selects; locale fallback over CLDR; pseudo-locales.
- Themes from shadcn CSS or DTCG tokens (resolvers too), with contrast checks and authored dark mode.
- Every email centred in a fluid container (600px by default) with a ghost table for classic
  Outlook, and fifteen components, including `Button`, `OtpCode`, `DataTable`, `LineItems` and a
  transactional `Footer`.
- A small generated module that renders with `@email-kit/runtime` (zero dependencies, about 1.5
  KB to 3 KB gzipped), with a runtime data validator; `.ts`, or `.mjs` with types.
- `email-kit check`: 111 of the 175 planned checks, over the output, renders of every fixture,
  the sources and the theme; human, JSON and GitHub reporters; team checks.

Not yet:

- Marketing email: unsubscribe links, legal footer slots and multi-column layouts.
- Testing in real email clients, classic Outlook especially.
- The preview studio (`email-kit dev`).
- The rest of the check catalogue.

## Packages

| Package | What it is |
|---|---|
| [`@email-kit/cli`](packages/cli) | The `email-kit` command: `init`, `new`, `compile`, `check`, `tokens` |
| [`@email-kit/core`](packages/core) | `defineEmail`, the JSX runtime and types |
| [`@email-kit/components`](packages/components) | shadcn-style, email-safe components |
| [`create-email-kit`](packages/create-email-kit) | `npm create email-kit` |

## Docs

- [User guide](docs/guide/README.md): getting started, templates, components, configuration and
  sending
- Reference: [the checks](docs/reference/checks.md), [error codes](docs/reference/errors.md) and
  [mustache-core](docs/reference/mustache-core.md), the placeholder language (draft), with its
  [conformance suite](conformance/mustache-core/README.md)
- [Architecture decision records](docs/adr/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
