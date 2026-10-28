# email-kit

A type-safe email template compiler. Write emails in TSX with themed, email-safe components; run
`email-kit compile`; import the result in your backend:

```ts
import { emails } from "@/email-kit"

const { subject, html, text } = emails.orderConfirmation.render({ orderNumber: "A-1042" })
```

Compiled emails work in Outlook, Gmail, Apple Mail and Yahoo, in light and dark mode, meet WCAG
2.2 AA, and carry the footer elements the law requires. A check engine proves it on every compile.

> **Status:** pre-release (phase 0, foundations). Nothing is usable yet.

## Packages

| Package | What it is |
|---|---|
| [`@email-kit/cli`](packages/cli) | The `email-kit` command: `init`, `new`, `compile`, `check`, `dev` |
| [`@email-kit/core`](packages/core) | `defineEmail`, the JSX runtime and types |
| [`@email-kit/components`](packages/components) | shadcn-style, email-safe components |
| [`create-email-kit`](packages/create-email-kit) | `npm create email-kit` |

## Docs

- [PRD](docs/prd.md) and [backlog](docs/backlog.md)
- [Phase 1 scope](docs/phase-1-scope.md) and [architecture direction](docs/architecture-direction.md)
- [Research](docs/research/README.md): email-client rendering, dark mode and accessibility, law,
  deliverability, design and theming, tooling
- [Architecture decision records](docs/adr/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
