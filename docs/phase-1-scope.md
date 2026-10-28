# Phase 1 scope: a template generator

Decided 2026-10-27. This replaces the "author, check, generate **and send**" framing in the research
docs for phase 1.

## Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Sending in phase 1? | **No.** Phase 1 only generates templates |
| D2 | Who consumes the output? | Backends (sending is always server-side) |
| D3 | Target language | **TypeScript only** for now; other backend languages later |
| D4 | Which email formats? | **Every part the email standard needs** (see "What gets generated") |
| D5 | Preview studio in phase 1? | **Yes** |
| D6 | Commit the generated output? | **Yes**, in a folder named **`compiled/`** (reasons below) |
| D7 | i18n in phase 1? | **Yes**, one output per template and locale |
| D8 | How is it added to a project? | **As an npm package (devDependency) in any backend repo**, single repo or monorepo alike. `init` adds a config file and an `email-kit/` folder to the existing project. It never creates a nested project: no inner `package.json`, no inner `tsconfig.json`, no new workspace package |
| D9 | CLI command name | **`compile`**, which writes `email-kit/compiled/`; `generate` is kept as an alias |
| D10 | Framework name | **email-kit**. npm org [`@email-kit`](https://www.npmjs.com/org/email-kit) and GitHub org [`email-kit`](https://github.com/email-kit), both created 2026-10-27 |

## Name and packages

**Why scoped packages.** The unscoped name `email-kit` can't be published. npm treats names that
differ only by punctuation as the same name, and `emailkit` already exists (a library for sending
email). Everything is published under the `@email-kit` scope instead:

| Package | Contents |
|---|---|
| `@email-kit/cli` | The `email-kit` command (`init`, `new`, `compile`, `check`, `dev`): the compiler, the checks and the studio |
| `@email-kit/core` | `defineEmail`, the JSX runtime (`@jsxImportSource @email-kit/core`), `<Each>`, `<If>`, types |
| `@email-kit/components` | The shadcn-style component library |
| `create-email-kit` (unscoped) | A tiny starter, so `npm create email-kit` runs `init`. **Reserve this name now**: it is free today, and anyone could take it |

How the packages split is a design detail. The CLI and core may become one package.

**How the name appears in a project**

| Where | Looks like |
|---|---|
| Starting a new project | `npm create email-kit` (or `npx @email-kit/cli init`) |
| Commands, after install | `npx email-kit compile` · `npx email-kit dev` · `npx email-kit check` |
| package.json scripts | `email-kit:compile` · `email-kit:check` · `email-kit:dev` |
| Config file | `email-kit.config.ts` |
| Folder | `src/email-kit/` (`templates/`, `messages/`, `compiled/`, `index.ts`) |
| Import in app code | `import { emails } from "@/email-kit"` |
| Template files | `/** @jsxImportSource @email-kit/core */` · `import { defineEmail } from "@email-kit/core"` |

`npx email-kit …` only works once the package is installed, because it then finds the local
command. Before installing, the unscoped name never resolves, so starting always goes through
`npm create email-kit` or `npx @email-kit/cli`. The existing `emailkit` package also blocks anyone
else from publishing an unscoped `email-kit`, so it can't be squatted.

## What it is

A **code generator** for email, in the spirit of `drizzle-kit generate`:

1. Install it.
2. Write templates in TSX with the framework's components and theme.
3. Run one command.
4. Get the email's parts as files, plus a **typed TS module** that exports every template.

Backend code imports that module and passes the result to whatever sends its email (Resend, SES,
SMTP, …). **Phase 1 never sends email.** It only produces what goes inside one.

Because the generated module is self-contained (no imports, no runtime dependencies), the framework
is only needed while developing and generating. It is installed as a **devDependency**, as
`drizzle-kit` is.

## Who uses the output

| Consumer | Uses |
|---|---|
| A Node backend (Express, Fastify, Nest, …) | The generated TS module |
| Next.js (route handlers, server actions) | The generated TS module |
| Hono (Node, Bun, Cloudflare Workers) | The generated TS module. It has no `fs` and no dependencies, so it runs on the edge |
| Other backend languages (Kotlin, …) | **Later.** The placeholder syntax is kept portable (a Mustache subset) so that adding them costs no redesign |

Frontends (Vite SPAs, a KMP mobile client) never send email; they call a backend.

## What gets generated (the parts an email needs)

A sent email is a `multipart/alternative` MIME message. The template side of it is:

| Part | Standard / reason | Generated as |
|---|---|---|
| **HTML body** (`text/html`) | The designed email | `<locale>.html` + a string in `index.ts` |
| **Plain-text body** (`text/plain`) | MIME alternative; mail with no text part is a spam signal (SpamAssassin `MIME_HTML_ONLY`); text-only readers, watches and screen readers use it; some webmails (GMX, Web.de) take the preview from it | `<locale>.txt` + a string in `index.ts`. Derived from the component tree, with a per-template override |
| **Subject** (`Subject:` header) | RFC 5322 | A placeholder template string in `index.ts` and `manifest.json` |
| **Preheader** (preview text) | Not a header: the hidden first text of the HTML, and the first line of the text part | Embedded in both bodies, and also exported on its own |
| **Metadata** for a later send layer | `purpose` (transactional / marketing / consent-request), `category`, whether a `List-Unsubscribe` header is required, expiry | `manifest.json` + typed fields in `index.ts` |

Not generated:
- **AMP for Email** (`text/x-amp-html`) is optional. It needs registration with Google, and Apple
  Mail and Outlook don't support it (research 01 §10.2). It could be added later as a third part.
- **Headers, MIME assembly, attachments and CID images** belong to sending, which is out of scope.

## How it sits in a project

```
my-backend/                         ← any existing backend project (or one app inside a monorepo)
├── package.json                    ← existing; init adds the devDependency and scripts (asks first)
├── tsconfig.json                   ← existing; left alone (see "JSX without touching tsconfig")
├── email-kit.config.ts                 ← new; like drizzle.config.ts: theme, locales, paths, checks
└── src/
    ├── server.ts                   ← the app's own code
    └── email-kit/                     ← new (email-kit/ at the root when there is no src/)
        ├── templates/
        │   └── order-confirmation.tsx
        ├── messages/
        │   └── en/order-confirmation.json
        ├── index.ts                ← new; one line, export * from "./compiled", so "@/email-kit" works
        └── compiled/               ← committed; never edited by hand
            ├── index.ts            ← typed module: exports `emails`, inlined render(), types
            ├── manifest.json       ← ids, purpose, locales, sizes, hashes, framework version
            └── order-confirmation/
                ├── en.html         ← final HTML, placeholders such as {{orderNumber}}
                └── en.txt          ← plain-text part, same placeholders
```

Every path is configurable in `email-kit.config.ts`: templates, messages, output. A monorepo team that
wants several backends to share one set of emails can keep the `email-kit/` folder in a shared package
they already have and point the config at it. The framework doesn't create or require that
arrangement.

`index.ts` holds every part as strings. Loose `.html` files are not copied into Lambda or Worker
bundles, so the module can't depend on them at runtime. The `.html`/`.txt` files are there for
review: open them in a browser, read them in a diff, and `check` compares them for drift. Later
languages will read them too.

## Example project structures

Legend: **(new)** added by `init` · **(+)** existing file that `init` changes, only with consent ·
**(gen)** written by `compile` and committed · unmarked = the project's own files, left alone.

### A. Polyrepo: a Hono API

```
acme-api/
├── package.json                 (+) devDependency + scripts email-kit:compile / email-kit:check / email-kit:dev
├── tsconfig.json                (+) only if missing: "jsx", and the "@/email-kit" path alias
├── .gitattributes               (+) src/email-kit/compiled/** linguist-generated=true
├── email-kit.config.ts              (new) theme, locales, paths
└── src/
    ├── index.ts                     the Hono app
    ├── routes/
    │   └── orders.ts                import { emails } from "@/email-kit"
    └── email-kit/                  (new)
        ├── index.ts             (new) export * from "./compiled"
        ├── components/              optional: the team's own components (a branded footer, …)
        ├── templates/
        │   ├── welcome.tsx
        │   └── order-confirmation.tsx
        ├── messages/
        │   ├── en/
        │   │   ├── welcome.json
        │   │   └── order-confirmation.json
        │   └── si/
        │       └── …
        └── compiled/            (gen) never edited by hand
            ├── index.ts
            ├── manifest.json
            ├── welcome/
            │   ├── en.html  en.txt
            │   └── si.html  si.txt
            └── order-confirmation/
                └── …
```

### B. Polyrepo: a Next.js app (sending from route handlers and server actions)

`create-next-app` lets a project keep its code in `src/` or at the root. `init` follows whichever
the project uses. Either way, the `@/*` alias already points at the code root, so the import is the
same.

**B1. With `src/`** (`@/*` → `./src/*`)

```
acme-web/
├── package.json                 (+)
├── tsconfig.json                    Next.js's own; left alone (it already has "jsx" and the @/* alias)
├── email-kit.config.ts              (new)
└── src/
    ├── app/
    │   ├── api/orders/route.ts      import { emails } from "@/email-kit"
    │   └── checkout/actions.ts      server action, same import
    └── email-kit/                  (new) beside app/, never inside it
        ├── index.ts             (new) export * from "./compiled"
        ├── templates/ …
        ├── messages/ …
        └── compiled/            (gen)
```

**B2. Without `src/`** (`@/*` → `./*`)

```
acme-web/
├── package.json                 (+)
├── tsconfig.json                    left alone
├── email-kit.config.ts              (new)
├── app/
│   ├── api/orders/route.ts          import { emails } from "@/email-kit"
│   └── checkout/actions.ts
└── email-kit/                      (new) at the root, beside app/: the same level as email-kit.config.ts
    ├── index.ts                 (new) export * from "./compiled"
    ├── templates/ …
    ├── messages/ …
    └── compiled/                (gen)
```

`email-kit/` is never placed inside `app/`, so none of it can become a route. Import the module only
from server code: route handlers, server actions and server-only modules.

### C. Monorepo: emails live in the backend that sends them (the usual case)

```
acme/
├── package.json                     left alone
├── pnpm-workspace.yaml              left alone
├── turbo.json                       left alone (the team may add email-kit:compile as a task)
├── apps/
│   ├── api/                         Hono: `init` was run here
│   │   ├── package.json         (+)
│   │   ├── email-kit.config.ts      (new)
│   │   └── src/
│   │       ├── routes/orders.ts     import { emails } from "@/email-kit"
│   │       └── email-kit/          (new)
│   │           ├── index.ts     (new)
│   │           ├── templates/ …
│   │           ├── messages/ …
│   │           └── compiled/    (gen)
│   ├── web/                         Next.js frontend that calls the API: no emails here
│   └── admin/                       Vite SPA: no emails here
└── packages/
    └── ui/                          unrelated
```

This is the same as A, just inside `apps/api`. The framework doesn't know or care that it's a
monorepo.

### D. Monorepo: two backends share one set of emails

When both the Next.js server and the Hono API send email, keep the emails in a shared package the
team **already has**, and run `init` there. The framework doesn't create this package.

```
acme/
├── apps/
│   ├── web/                         Next.js; depends on "@acme/server"
│   │   └── src/app/api/invite/route.ts   import { emails } from "@acme/server/emails"
│   └── api/                         Hono; depends on "@acme/server"
│       └── src/routes/orders.ts          import { emails } from "@acme/server/emails"
└── packages/
    └── server/                      the team's existing shared backend package (db, auth, …)
        ├── package.json         (+) devDependency, scripts, and one exports entry:
        │                            "./emails": "./src/email-kit/index.ts"
        ├── email-kit.config.ts      (new)
        └── src/
            ├── db/ …
            └── email-kit/          (new)
                ├── index.ts     (new)
                ├── templates/ …
                ├── messages/ …
                └── compiled/    (gen)
```

`init` offers to add the `exports` entry because it is running inside a package that others import.
Some consumers don't compile TypeScript from workspace packages: plain Node without a TS loader, or
Next.js without `transpilePackages`. For those, the config can emit `index.js` + `index.d.ts`
instead of `index.ts`. The output format is a design detail to settle.

In D the apps import by package name (`@acme/server/emails`), which already reads like an alias.
Inside `packages/server` itself, `@/email-kit` works as in the other examples.

## Importing with an `@` alias

Every example imports with one line:

```ts
import { emails } from "@/email-kit"
```

**How `@/email-kit` resolves**
- `init` creates `email-kit/index.ts`, which holds one line: `export * from "./compiled"`. It is
  created once and owned by the project, so `@/email-kit` stays stable even if the output folder moves.
- If the project already has the common `@/*` alias (Next.js has it by default, and many templates
  do), `@/email-kit` resolves through it with **no config change**.
- If it doesn't, `init` offers to add **one exact alias** to `tsconfig.json`:
  `"paths": { "@/email-kit": ["./src/email-kit/index.ts"] }`, or `./email-kit/index.ts` without `src/`. It
  doesn't add a general `@/*`, so the rest of the project's imports are unaffected.
- `@/` can't clash with an npm package, because it isn't a valid npm scope.

**Where a tsconfig alias works at runtime.** `paths` is read by TypeScript and by some tools; it is
not a Node.js feature.

| Project setup | `@/email-kit` works? |
|---|---|
| Next.js | Yes, natively |
| Bun | Yes, natively |
| `tsx` (dev servers) | Yes |
| Bundled builds: esbuild, tsup, Wrangler (Cloudflare Workers) | Yes, they read tsconfig `paths` |
| Plain `tsc` build, then `node dist/…` | **No.** `tsc` doesn't rewrite aliases, so the import fails at runtime |
| Node running `.ts` directly (built-in type stripping) | **No.** Node ignores tsconfig `paths` |

For the last two, `init` detects the setup (for example a `tsc` build script and a `node dist`
start script, with no bundler) and offers three choices:
1. **Node's own alias**, `#emails`, through the `imports` field in `package.json`. It works natively
   in Node and is understood by TypeScript. Node requires `#` here; `@` is reserved for npm scoped
   packages.
2. **Add `tsc-alias`** to the build so `@/email-kit` is rewritten in `dist/`.
3. **Keep a relative import** (`../emails`).

In a `tsc`-built project, `#emails` has to point at the source for type-checking and at the compiled
file at runtime. How to map that cleanly is to be settled in the prototype.

The alias that was chosen is saved in `email-kit.config.ts`. The studio, the docs `init` prints, and
`new` all use it in their import examples.

## JSX without touching tsconfig

Templates are `.tsx`, but the host project's TypeScript setup belongs to the host:
- a plain Node API may have no `jsx` setting at all;
- a Hono app may use `jsxImportSource: "hono/jsx"`;
- a Next.js app uses React's settings.

The framework must work in all three without a nested `tsconfig.json`:

| Concern | Approach |
|---|---|
| **Generating** | The CLI compiles templates itself, with its own JSX settings. The host's tsconfig doesn't affect `compile`, `check` or `dev` |
| **Type-checking in the editor** | Each template starts with a per-file pragma (`/** @jsxImportSource @email-kit/core */`, scaffolded by `init` and `new`). It points that file at the framework's JSX types without changing the project-wide setting, so Hono or React JSX elsewhere keeps working |
| **A project with no `jsx` option** | TypeScript refuses `.tsx` files when `jsx` is unset. `init` offers to add one line (`"jsx": "react-jsx"`), which changes nothing for the project's `.ts` files. It never rewrites anything else |
| **To verify in the prototype** | How the pragma behaves under each host setting (`preserve` in Next.js, `react-jsx` + `hono/jsx`, unset) and with `tsc --noEmit` in CI |

## The output folder name: `compiled/` (decided)

The output lives at `email-kit/compiled/`, beside `email-kit/templates/`. The pair reads as source →
output: you write `templates/`, and the compiler writes `compiled/`. The name says what the folder
holds: the templates compiled ahead of time from TSX into HTML, text and a TS module, with their
placeholders still in place.

**Requirements the name had to meet**
1. **It mustn't be a name that tools delete or hide.**
   - `dist/`, `build/` and `out/` are usually gitignored, wiped by `clean` scripts, and cached as
     Turborepo outputs.
   - Dot-folders are hidden in editors and skipped by many glob patterns.
   - `artifacts/` is gitignored by some toolchains (Hardhat, CI setups).
2. **It mustn't collide with common `.gitignore` lines.** Some repos ignore `generated` because of
   Prisma setups, which would silently drop a folder called `generated/`.
3. **It must describe the content, not just "something made this".**
4. **It must read well under its parent:** `email-kit/compiled`.

| Option | Verdict |
|---|---|
| **`compiled/`** | **Chosen.** Describes the content, pairs with `templates/`, short, not a common ignore entry |
| `precompiled/` | The most exact term (it is what Handlebars calls templates compiled ahead of time), but long |
| `gen/` | protobuf/Go convention; less self-explanatory |
| `generated/` | Common gitignore entry |
| `_generated/` | The first proposal, dropped on 2026-10-27: it says how the folder was made, not what it holds |
| `dist/` / `out/` / `build/` / `artifacts/` / dot-folders | Rejected (requirement 1) |

App code never sees the name: it imports `@/email-kit`, which re-exports `./compiled`.

**Guards the CLI adds, whatever the name:**
- `out` is configurable in `email-kit.config.ts`.
- `compile` warns if `git check-ignore` reports the folder as ignored.
- `init` adds the folder's **exact path** to `.gitattributes` (for example
  `src/email-kit/compiled/** linguist-generated=true`), so GitHub collapses the diffs. It uses the
  exact path, not `**/compiled/**`, so unrelated `compiled` folders aren't affected. It adds the
  same path to any Prettier, Biome or ESLint ignore files that exist.
- Every generated file starts with a "generated, do not edit" header.
- `check` fails when the files differ from what the templates would generate (drift).

## How a template looks (illustrative, not final API)

```tsx
/** @jsxImportSource @email-kit/core */
import { defineEmail, Layout, Text, Each } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "order-confirmation",
  purpose: "transactional",
  schema: z.object({
    orderNumber: z.string(),
    items: z.array(z.object({ name: z.string(), qty: z.number() })),
  }),
  subject: (d, t) => t("subject", { order: d.orderNumber }),
  preheader: (d, t) => t("preheader"),
  fixtures: { default: { orderNumber: "A-1042", items: [{ name: "Tea", qty: 2 }] } },
  component: ({ data, t }) => (
    <Layout heading={t("heading")}>
      <Text>{t("orderLine", { order: data.orderNumber })}</Text>
      <Each of={data.items}>{(item) => <Text>{item.name} × {item.qty}</Text>}</Each>
    </Layout>
  ),
})
```

At compile time `data` is a proxy. `{data.orderNumber}` becomes `{{orderNumber}}`, and `<Each>`
becomes `{{#items}}…{{/items}}`. The subject and preheader functions are compiled the same way.
Each locale is rendered once into static HTML and text that keep their placeholders. Values are
filled in at send time.

## How a backend uses it

```ts
import { emails } from "@/email-kit" // see "Importing with an @ alias"

emails.orderConfirmation.en.html // raw HTML template with {{placeholders}}
emails.orderConfirmation.en.text

const { subject, preheader, html, text } = emails.orderConfirmation.render(
  { orderNumber: "A-1042", items: [{ name: "Tea", qty: 2 }] }, // typed from the schema
  { locale: "en" }                                             // falls back to the default locale
)
await resend.emails.send({ from, to, subject, html, text }) // the backend's own sending code
```

`render()` is a tiny substitution function inlined into the generated module. It escapes values for
HTML, leaves the text part unescaped, and has no dependencies. The exact export shape is a design
detail still to be settled.

## Commands

| Command | Does |
|---|---|
| `init` | Adds the config, the `email-kit/` folder and an example template to the current project (see "What `init` does") |
| `new <id>` | Scaffolds a template with its messages and fixture |
| `compile [--watch]` | Writes `compiled/`. `generate` is kept as an alias, for people used to `drizzle-kit generate` |
| `check [--json]` | Runs every rule from the research (rendering, dark mode, accessibility, size, content and legal slots, drift) on the generated output |
| `dev` | The preview studio |

## What `init` does

`npm create email-kit` (or `npx @email-kit/cli init`) works on **the project it is run in**: the nearest folder with a `package.json`.
In a monorepo you run it inside the app that sends email, such as `apps/api`. It asks before it
writes anything, and `--yes` accepts the defaults.

1. **Find the project.** Read `package.json`, and detect the package manager (from the lockfile) and
   `tsconfig.json`.
2. **Find the code root**, the folder the app's own code lives in. `email-kit/` goes there, so the
   generated module is always inside what the build compiles. Use the first of these that answers:
   1. `tsconfig.json` `rootDir`, or an `include` that lists only one folder (for example
      `["src"]`);
   2. the `@/*` (or `~/*`) path alias target: `./src/*` means `src/`, and `./*` means the root;
   3. framework layout: Next.js `src/app` or `src/pages` means `src/`, and `app/` or `pages/` at the
      root means the root;
   4. a `src/` folder that contains code means `src/`;
   5. otherwise, the project root.

   Show the result and let the user change it (`--dir`).
3. **Create the files:**
   - `email-kit.config.ts` at the project root;
   - `<code root>/email-kit/` with `index.ts` (the one-line re-export), `templates/welcome.tsx` and
     `messages/en/welcome.json`. That is `src/email-kit/` or `email-kit/`.

   If shadcn theme variables are found (for example in `globals.css` or `components.json`), offer
   to use them as the theme.
4. **Make small, listed changes to existing files, only with consent:**
   - `package.json`: add the framework as a devDependency (installed with the detected package
     manager) and the scripts `email-kit:compile`, `email-kit:check` and `email-kit:dev`;
   - `tsconfig.json`: add `"jsx": "react-jsx"` **only if `jsx` is missing**, and the exact
     `"@/email-kit"` path **only if `@/*` doesn't already cover it**; nothing else. Where tsconfig
     aliases don't work at runtime, offer the alternatives in "Importing with an `@` alias";
   - `.gitattributes` and the lint and format ignore files: add the `compiled` entries.
5. **Never:**
   - create a nested `package.json` or `tsconfig.json`;
   - create a workspace package or edit workspace files;
   - overwrite an existing file without `--force`.
6. **Pick another name when a default is taken.** The project may already have something with the
   same name, such as an `email-kit/` folder or an `email-kit.config.ts` left over from something
   else.
   - **First, check whether it is ours.** A folder or file counts as ours if the config points at it,
     or if a `compiled/manifest.json` carries the framework's signature. If it is ours, the
     project is already initialised: say so and stop.
   - **If it isn't ours, never write into it or overwrite it.** Propose the next free name and let
     the user accept it or type their own. With `--yes`, take the first free one.

   | Default | Taken, so try in order |
   |---|---|
   | `src/email-kit/` | `src/email-templates/` → `src/emails/` → the user's choice |
   | `email-kit.config.ts` | No fallback: a foreign file with our exact config name means something is wrong. Stop and ask the user to rename it, or pass `--config <path>` |
   | Scripts `email-kit:compile`, `email-kit:check`, `email-kit:dev` | `emails:*` → `ek:*` |
   | Output `compiled/` set by the user to an existing folder | Refuse unless it is empty or ours, so generated files can never replace someone else's |

   Whatever names are chosen are written into `email-kit.config.ts`, so every later command finds them.
7. **Finish.** Run the first `compile`, then print how to import the module and how to open the
   studio.

Flags such as `--dir <path>` and `--config <path>` let scripts and CI run it without prompts.

## The phase-1 studio

The studio renders the **generated** output with fixtures, never a separate renderer, so what you
preview is what ships. Phase 1 has:
- template and fixture lists;
- a locale switcher, including a long pseudo-locale;
- light and dark views;
- phone and desktop widths;
- HTML, plain-text and source tabs;
- subject and preheader as an inbox row;
- an HTML size meter against Gmail's clip;
- check results inline;
- live reload on save;
- downloading a `.eml` to open in real mail apps (no sending involved).

The full studio list in research 02, 05 and 06 comes later: forced-dark simulations, accessibility
overlays, a theme inspector, send-test and others.

## In scope for phase 1

- The shadcn-style component package and the theme system (shadcn CSS variables or W3C DTCG tokens
  → roles → validated hex)
- Compiling JSX to placeholder templates (`<Each>`, `<If>`, data proxies), per locale
- Outputs: HTML, plain text, subject, preheader, metadata, the typed TS module and the manifest
- i18n
- The check engine
- The CLI, with `init` working in any backend project
- The phase-1 studio

## Out of scope for phase 1 (possible later phases)

- Other backend languages: Kotlin, Go, Python, and so on.
- AMP for Email.
- Sending in all its parts:
  - transports, MIME and header building, `List-Unsubscribe` headers;
  - idempotency, retries, failure policy and send logging;
  - suppression, bounce and complaint webhooks;
  - open and click tracking, consent records and jurisdiction checks at send time;
  - the DNS `doctor` command;
  - identity-provider adapters.

## How the research applies now

| Research file | Applies in phase 1 | Parked for later |
|---|---|---|
| 01 Client rendering | All of it: it decides what the generated HTML looks like | AMP |
| 02 Dark mode and accessibility | All of it | The advanced studio modes |
| 03 Legal | What goes **in** the template: `purpose`, required footer slots (postal address, reason, privacy link, unsubscribe-link placeholder for marketing), no promotional content in transactional mail, no tracking pixels | Consent records, jurisdiction profiles at send time, suppression |
| 04 Deliverability and security | Template-level rules: text/HTML parity, link rules, no shorteners, code formatting, secrets kept out of subjects, size budget, escaping | Headers, MIME, authentication, transports, runtime send guards, `doctor` |
| 05 Design, content, theming | All of it | — |
| 06 Tooling | Authoring model, placeholder dialect, theme pipeline, components, studio, CLI, packaging | The KMP artifact format and Kotlin code generation (§3.3–3.4) |

## What changes in the plan

- **T10 (scope of sending) is decided:** no sending in phase 1.
- **T1 (JSX to precompiled templates) is the central problem.** It is the generator itself, so
  prototype it first, together with the JSX-pragma behaviour above.
- **The generated module must be self-contained:** no React and no framework package at runtime.
  That is what lets the framework be a devDependency.
- **The placeholder dialect stays a portable Mustache subset,** even though only TS is generated
  now. It costs nothing today and makes later languages a new emitter rather than a redesign.
- **MJML is at most an internal step,** never an output a backend imports.
- **The research's monorepo assumptions are dropped.** The framework is an ordinary package for
  any backend project.
