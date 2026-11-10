# email-kit in a Next.js app

The happy path: one email template, compiled by email-kit, rendered in a Next.js route handler.
In this repo the packages come from the workspace; in your app they come from npm (or, before a
release, `link:` paths to a clone of this repo).

```
email-kit.config.ts                    locales and sender values
src/email-kit/templates/welcome.tsx    the template: schema, fixtures, components, messages
src/email-kit/messages/en/welcome.json the copy, with an ICU plural
src/email-kit/compiled/                written by `email-kit compile` (git-ignored)
src/app/api/email/welcome/route.ts     imports `@/email-kit/compiled` and renders
```

## Run it

```sh
pnpm install && pnpm build        # from the repository root, once
cd examples/nextjs
pnpm dev                          # compiles the emails, then starts Next.js
```

Open http://localhost:3000 and follow the links, or post data:

```sh
curl -X POST localhost:3000/api/email/welcome -H 'content-type: application/json' \
  -d '{"name":"Ada","trialDays":2,"startUrl":"https://shop.example/start"}'
```

Bad data gets a 400 with every problem and its path. `pnpm test` calls the route handlers
directly, and `pnpm build` runs the production build.

## Doing the same in your app

`email-kit init` does steps 1 to 3 for you: run it in your app (`npx @email-kit/cli@preview init`, or
`pnpm exec email-kit init` with the packages linked from a clone). It detects Next.js, puts the
folder next to your code, uses your `@/*` alias, asks before each change to an existing file, and
compiles once. `email-kit new <id>` adds templates. By hand:

1. Add `@email-kit/cli`, `@email-kit/core`, `@email-kit/components` and `zod` as dev
   dependencies: templates run only at compile time, and the compiled module imports nothing.
2. Copy `email-kit.config.ts` and a template. **Start every template with
   `/** @jsxImportSource @email-kit/core */`**: Next.js configures JSX for React, and type-checks
   every `.tsx` file.
3. Compile before Next.js builds: `"build": "email-kit compile && next build"`. While developing,
   run `email-kit compile --watch` next to `next dev`.
4. `t()` in templates is typed from your messages once you've compiled: a misspelt key or a
   missing parameter is an editor error. The types are in `src/email-kit/compiled/messages.d.ts`,
   which your tsconfig picks up if it includes the folder (Next.js's default does).
5. Import `@/email-kit/compiled` in server code (route handlers, server actions) and call
   `emails.<template>.render(data, { locale })`. The module has no dependencies.
6. `email-kit check` runs the checks; add it to CI.
