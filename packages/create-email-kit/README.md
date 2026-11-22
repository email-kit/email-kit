# email-kit

Type-safe email templates for TypeScript backends. Write the emails your app sends in TSX with
themed, email-safe components. `email-kit compile` turns them into a small typed module your server
imports, and `email-kit check` checks every one for email clients, dark mode, accessibility and
copy.

**[Documentation](https://email-kit.dev)** · [Getting started](https://email-kit.dev/guide/getting-started/) · [GitHub](https://github.com/email-kit/email-kit)

## Get started

In the project that sends email (in a monorepo, the app's folder), run:

```sh
npm create email-kit
```

It detects your package manager, TypeScript setup and framework, installs the packages below, adds
a config and a welcome template, and compiles once. It asks before changing any file you already
have; `npm create email-kit -- --yes` accepts every default, as in CI. `npx @email-kit/cli init`
does the same.

Then render the welcome email from your server, with the import `init` prints for your project:

```ts
import { emails } from "./email-kit"

const { subject, html, text } = emails.welcome.render({
  name: "Ada",
  plan: "pro",
  startUrl: "https://example.com/start",
})
```

email-kit doesn't send email: hand `subject`, `html` and `text` to any provider's API.

While you work:

```sh
npx email-kit compile         # after changing a template or message; --watch keeps it running
npx email-kit check           # the checks; exits 1 on errors, for CI
npx email-kit new <id>        # another template, with messages in every locale
```

The [getting started guide](https://email-kit.dev/guide/getting-started/) goes through it step by
step, and [your first email](https://email-kit.dev/guide/first-email/) builds one from scratch.

### With an AI coding agent

`init` also asks which AI coding agents you use (Claude Code, Codex, Cursor, GitHub Copilot, Gemini
CLI, Antigravity, Windsurf and others) and writes a skill that teaches them email-kit, for the
version you have. Run `npx email-kit agents` to add one later or update it after an upgrade. See
[AI coding agents](https://email-kit.dev/guide/ai-agents/).

## A template

Each template is a folder with `template.tsx` and a `messages.<locale>.json` per language:

```tsx
import { Button, Heading, Text } from "@email-kit/components"
import { defineEmail, url } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "welcome",
  purpose: "transactional",
  schema: z.object({ name: z.string().min(1), startUrl: z.string().meta(url) }),
  subject: (data, t) => t("subject", { name: data.name }),
  fixtures: { default: { name: "Ada", startUrl: "https://example.com/start" } },
  component: ({ data, t }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body")}</Text>
      <Button href={data.startUrl}>{t("cta")}</Button>
    </>
  ),
})
```

Templates run when you compile, not when you send: your server imports the generated module, which
needs only `@email-kit/runtime`.

## The packages

They work together and are released together: install the same version of each.
`npm create email-kit` installs them for you.

| Package | What it is | Install as |
|---|---|---|
| [`create-email-kit`](https://www.npmjs.com/package/create-email-kit) | `npm create email-kit`: runs `email-kit init` in the folder you're in | not installed |
| [`@email-kit/cli`](https://www.npmjs.com/package/@email-kit/cli) | The `email-kit` command: `init`, `new`, `compile`, `check`, `tokens` and `agents` | devDependency |
| [`@email-kit/core`](https://www.npmjs.com/package/@email-kit/core) | What templates are written with: `defineEmail`, the JSX runtime, `If`/`Each`/`Unless`, field markers (`url`, `secret`, `formatted`), `defineConfig` and `defineCheck` | devDependency |
| [`@email-kit/components`](https://www.npmjs.com/package/@email-kit/components) | Email-safe components themed from your shadcn CSS or design tokens: `Text`, `Heading`, `Link`, `Button`, `Image`, `Divider`, `Spacer`, `Section`, `List`, `KeyValue`, `Callout`, `OtpCode`, `DataTable`, `LineItems` and `Footer` | devDependency |
| [`@email-kit/runtime`](https://www.npmjs.com/package/@email-kit/runtime) | Renders the compiled emails. The only one your app needs when it runs | **dependency** |

### The runtime

`@email-kit/runtime` has no dependencies and uses only web-standard APIs, so it runs in Node 22+,
Bun, Deno, Cloudflare Workers, AWS Lambda and Next.js server code. You don't import it yourself:
the generated module does, and only the entry points your templates use, from about 1.4 KB to 3 KB
min+gzip:

| Entry point | Imported when |
|---|---|
| `@email-kit/runtime` | always |
| `@email-kit/runtime/validate` | `validate` is on (the default) |
| `@email-kit/runtime/plural` | a message has a plural or a select |
| `@email-kit/runtime/locale` | the project compiles more than one locale |
| `@email-kit/runtime/context` | the config has sender values passed at send time |

Rendering problems throw an `EmailRenderError` with a `code`; see the
[error reference](https://email-kit.dev/reference/errors/). A module compiled by another version of
the CLI fails with `incompatible-module` rather than rendering wrong.

## Status

**1.0.** Stable for transactional email; breaking changes come only in a major release. Not yet:
marketing email (unsubscribe links, multi-column layouts), testing in real email clients (classic
Outlook especially), and the preview studio.

## More

- [Guide](https://email-kit.dev/guide/): templates, components, messages and locales, theme and dark
  mode, checks and CI, rendering and sending, and AI coding agents.
- Reference: [CLI](https://email-kit.dev/reference/cli/),
  [configuration](https://email-kit.dev/reference/configuration/),
  [checks](https://email-kit.dev/reference/checks/), [errors](https://email-kit.dev/reference/errors/).
- [Issues](https://github.com/email-kit/email-kit/issues) and
  [changelog](https://github.com/email-kit/email-kit/blob/main/packages/cli/CHANGELOG.md).

The CLI requires Node.js 22.12 or later. MIT licensed; the CLI's third-party notices are in its
`THIRD_PARTY_NOTICES.md`.
