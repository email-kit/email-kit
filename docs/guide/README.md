# Introduction

email-kit turns emails written in TSX into a typed module your server imports. You write each
email as a template with components, its copy in message files, and a schema for the data it
takes. `email-kit compile` turns them into HTML and plain text. Your backend calls `render()` with
the data and hands the result to whatever sends your mail.

```tsx
<Heading>{t("heading", { name: data.name })}</Heading>
<Text>{t("intro", { count: data.itemCount })}</Text>
<Button href={data.trackingUrl}>{t("track")}</Button>
```

```ts
import { emails } from "@/email-kit"

const { subject, html, text } = emails.orderShipped.render({ name: "Ada", itemCount: 2, … })
```

## How it works

1. **You write templates.** Each template is a folder with `template.tsx` and a
   `messages.<locale>.json` per language. Components such as `Button` and `Footer` handle the
   markup email clients need, with colours and type from your theme.
2. **email-kit compiles them, once per locale.** Templates run when you compile, not when you
   send, so the output is plain HTML and text with placeholders where data goes. The compiler
   checks your copy, types and markup as it goes.
3. **Your server renders them.** The generated module validates the data, picks the locale and
   fills the placeholders. At runtime it needs one small package, `@email-kit/runtime`, with no
   dependencies of its own.
4. **`email-kit check` runs the checks:** accessibility, dark mode, size limits, links, copy and
   the theme, over every template, locale and sample. Run it in CI.

email-kit doesn't send email. It works with any provider, because `render()` returns the subject,
the HTML part and the plain-text part, which every provider's API takes.

## The guide

Read the first two pages in order; the rest covers one topic each.

1. [Getting started](getting-started.md): set up a project with `npm create email-kit`, compile,
   render and send the welcome email.
2. [Your first email](first-email.md): build an order-shipped email from scratch, with data,
   components, copy, conditions, plurals, a second language and checks.
3. [Templates](templates.md): `defineEmail`, schemas, field markers, fixtures, control flow and
   sender values.
4. [Components](components.md): every component and its props, and how to write your own.
5. [Messages and locales](messages.md): `t()`, plurals, selects, languages, fallback and
   pseudo-locales.
6. [Theme and dark mode](theme.md): your colours and type, from shadcn CSS or design tokens.
7. [Checks and CI](checks-and-ci.md): running `check`, changing levels, team checks, CI.
8. [Rendering and sending](sending.md): the generated module, validation, locales, and sending.
9. [Formatting dates, money and numbers](formatting.md): formatting values in your backend.
10. [AI coding agents](ai-agents.md): the skill that teaches Claude Code, Codex, Cursor and other
    agents to write email-kit emails.

Reference:

- [CLI](../reference/cli.md): every command and flag, and what `init` detects.
- [Configuration](../reference/configuration.md): every option of `email-kit.config.ts`.
- [Checks](../reference/checks.md): every check `email-kit check` runs, with its default level and fix.
- [Errors](../reference/errors.md): every error id, why it happens and how to fix it.
- [mustache-core](../reference/mustache-core.md): the placeholder language of the compiled output.
