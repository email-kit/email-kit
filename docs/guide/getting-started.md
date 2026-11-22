# Getting started

This page takes you from an existing project to a sent email in about ten minutes: set up
email-kit, look at what it created, compile, render the welcome email from your server and send
it.

You need Node.js 22.12 or later and a project with a `package.json`: the backend that sends email,
such as a Next.js app, a Hono or Express server, or a worker. In a monorepo, use the app's folder,
such as `apps/api`.

## 1. Set up email-kit

In your project's folder, run:

```sh
npm create email-kit
```

`npx @email-kit/cli init` does the same.

It looks at your project (package manager, TypeScript setup, framework, an existing shadcn theme),
shows what it will create and change, and asks before changing any file you already have. Then it
installs the packages, compiles once and prints how to render the welcome email. It never writes
into a folder that isn't its own.

It also asks which AI coding agents you use, such as Claude Code, Codex or Cursor, and writes a
skill that teaches them email-kit. See [AI coding agents](ai-agents.md).

To accept every default without being asked, as in CI, pass `--yes`:
`npm create email-kit -- --yes`. The [CLI reference](../reference/cli.md#init) lists every
flag and what `init` detects.

## 2. Look at what it created

In a project with a `src/` folder:

```
email-kit.config.ts           the config: locales, sender values, import path
src/email-kit/
  index.ts                    what your app imports (it re-exports ./_generated)
  welcome/                    a template: one folder each, named by its id
    template.tsx              the email: its data, sample data and body
    messages.en.json          its copy in English
  _generated/                 written by `email-kit compile`; don't edit it
```

It also:

- adds `@email-kit/runtime` as a dependency, since your app imports it at runtime, and
  `@email-kit/cli`, `@email-kit/core`, `@email-kit/components` and a schema library as
  devDependencies. The schema library is the one your project already uses (Zod, Valibot or
  ArkType), or Zod;
- adds the scripts `email-kit:compile`, `email-kit:watch` and `email-kit:check`;
- sets up the import path for your app, such as `@/email-kit` or `#email-kit`, and saves it in the
  config as `importPath`.

Open `welcome/template.tsx`. It's a real welcome email, and its comments walk through each part of
a template:

```tsx
export default defineEmail({
  id: "welcome",                      // the folder's name; your app calls emails.welcome
  purpose: "transactional",
  schema: z.object({                  // the data render() takes
    name: z.string().min(1),
    plan: z.enum(["free", "pro", "team"]),
    startUrl: z.string().meta(url),
    // …
  }),
  subject: (data, t, sender) => t("subject", { name: data.name, product: sender.productName }),
  preheader: (_data, t) => t("preheader"),
  fixtures: { /* sample data, rendered by `email-kit check` */ },
  component: ({ data, t, sender }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      {/* … */}
      <Button href={data.startUrl}>{t("cta")}</Button>
      <Footer reason={t("footer", { product: sender.productName })} sender={sender.productName} />
    </>
  ),
})
```

`data.name` isn't a value here: templates run when you compile, so it becomes a placeholder that
your server fills when it sends. The words come from `messages.en.json` through `t()`:

```json
{
  "subject": "Welcome to {product}, {name}",
  "heading": "Welcome, {name}!",
  "cta": "Get started"
}
```

## 3. Compile

```sh
npm run email-kit:compile
```

```
Compiled 1 template × 1 locale into src/email-kit/_generated (2 files: 2 written, 0 unchanged, 0 removed)
```

This writes `_generated/index.ts`, the module your app imports, and `_generated/messages.d.ts`,
which types `t()` in your templates. Compile after changing a template, a message file or the
config. While you work, run `npm run email-kit:watch` instead to recompile on every change.

Commit the `_generated` folder, so deploys need no compile step. `email-kit check` fails when it's
out of date. To compile in your build instead, see
[Checks and CI](checks-and-ci.md#commit-the-output-or-compile-in-the-build).

## 4. Render it from your server

Import `emails` with the path `init` printed, and render with data:

```ts
import { emails } from "@/email-kit"

const { subject, html, text } = emails.welcome.render({
  name: "Ada",
  plan: "pro",
  startUrl: "https://example.com/start",
})
```

`render()` checks the data against the schema, picks the locale and returns the subject, the HTML
part and the plain-text part. The data is typed from the schema, so a missing field or a plan
that isn't `free`, `pro` or `team` is an error in your editor. Log `text` to see the email:

```
Welcome, Ada!
==============

Your Shop account is ready, on the Pro plan.

Invite your team from your workspace settings when you're ready.

Get started: https://example.com/start
```

## 5. Send it

Hand the three parts to the library or API you already use. With Resend's HTTP API:

```ts
const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ from: "Shop <hello@shop.example>", to: "ada@example.com", subject, html, text }),
})
if (!response.ok) throw new Error(`Sending failed: ${response.status}`)
```

Every provider takes the same three parts under its own field names. Send `html` and `text`
together, so clients that don't show HTML get the plain text.
[Rendering and sending](sending.md#sending) has a Nodemailer (SMTP) example too.

## 6. Run the checks

```sh
npm run email-kit:check
```

```
Theme
  i tokens.gmail-fill
    The primary fill #e5e5e5 is light (YIQ 229 > 205): Gmail Android may darken it (dark)
    Fix: Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

0 errors, 0 warnings, 2 notes
```

`check` compiles in memory and runs the checks over every template, locale and fixture, the
template sources and the theme. Errors fail it (exit code 1); warnings and notes (`i`) don't. Each
finding links to its entry in the [checks reference](../reference/checks.md). Add it to CI:

```yaml
- run: npm ci
- run: npx email-kit check --reporter github
```

## Next

- [Your first email](first-email.md): build an order-shipped email step by step, with its own
  data, components, copy, conditions, plurals and a second language.
- Keep the welcome email and make it yours, or delete its folder.
- `npx email-kit new <id>` adds another template.
