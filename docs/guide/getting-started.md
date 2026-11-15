# Getting started

email-kit compiles TSX email templates into a typed module. Your server imports that module and
calls `render()`. At runtime it needs one small package, `@email-kit/runtime`; the templates and
the other email-kit packages are only needed when you compile.

You need Node.js 22.12 or later for the CLI, and a project with a `package.json`.

## Set up a project

Run one of these in the project that sends email (in a monorepo, the app folder, such as
`apps/api`):

```sh
npm create email-kit@preview
npx @email-kit/cli@preview init
```

Both run `email-kit init`. While email-kit is in preview its packages are published under the npm
dist-tag `preview`, so ask for it by name as above. With the CLI installed, `npx email-kit init`
does the same.

`init` shows what it will create and change, asks before each change to an existing file, then
installs, compiles once and prints how to render the welcome email. It never writes into a folder
that isn't its own. Run it again and it says the project is already set up.

### What it detects

| What | How |
|---|---|
| Package manager | The `packageManager` field, else the lockfile (`pnpm-lock.yaml`, `bun.lock`, `yarn.lock`), else npm |
| Code root | In order: `rootDir` or a single `include` in `tsconfig.json`; the `@/*` or `~/*` path alias; `src/app` or `src/pages` (then `src`); `app` or `pages` (then the project root); a `src/` folder with code; the project root |
| Host | Bun; a bundler in the dependencies (`next`, `vite`, `tsup`, `esbuild`, `wrangler`, `tsx`, `@remix-run/dev`, `astro`, `nuxt`); a script that runs `node` on a `.ts` file (Node type stripping); a script that runs `tsc` |
| shadcn theme | A CSS file with `--primary` in `:root`: the one `components.json` names, or `app/globals.css` and similar. `init` asks whether to use it as the email theme |

The host decides how your app imports the emails:

| Host | Import | How |
|---|---|---|
| A bundler or Bun, with a `tsconfig.json` | `@/email-kit` | Your `@/*` alias if it already reaches the folder; otherwise `init` adds the path `@/email-kit` to `tsconfig.json` |
| A `tsc` build run with `node` | `#email-kit` | `"imports"` in `package.json`, pointing at `_generated/index.mjs`; the config gets `module: "mjs"` |
| Node type stripping | `#email-kit` | `"imports"` in `package.json`, pointing at the folder's `index.ts` |
| Anything else | `./email-kit` | A relative import |

The import path is saved as `importPath` in the config, so `email-kit new` prints examples with it.

### Flags

`npm create email-kit` passes its flags on: `npm create email-kit@preview -- --yes`.

| Flag | Does |
|---|---|
| `--yes` | Accept every default without asking. Use it in CI and scripts, where there's no terminal to ask in |
| `--dir <path>` | Put the email-kit folder in this code root instead of the detected one |
| `--config <path>` | Name the config file something other than `email-kit.config.ts` |
| `--force` | Overwrite an existing config file of that name. A folder that's already set up still stops `init` |
| `--no-install` | Don't run the package manager after adding the dependencies |

### What it creates

In a project with a `src/` folder:

```
email-kit.config.ts                 the config: locales, sender values, import path
src/email-kit/
  index.ts                          re-exports ./_generated: what your app imports
  welcome/                          a template: one folder each, named by its id
    template.tsx                    the template
    messages.en.json                its copy, one file per locale
  _generated/                       written by `email-kit compile`; don't edit
```

The welcome template is a real email that also shows each part of a template: plain copy, a
select, plurals, `If`, `Unless` and `Each`, with a fixture for each branch. Its comments point to
[Writing templates](templates.md). Change it into your own welcome email, or delete it.

A folder holding `template.tsx` is a template. Folders whose names start with `_`, such as
`_shared/` for components the templates import, never are.

The folder is the first free one of `email-kit`, `email-templates` and `emails` in the code root.
Without a `src/` folder it sits at the project root.

With your agreement, `init` also:

- adds `@email-kit/runtime` as a dependency, and `@email-kit/cli`, `@email-kit/core` and
  `@email-kit/components` as devDependencies, with
  a schema library: the one the project already uses (Valibot also gets
  `@valibot/to-json-schema`; ArkType needs nothing more), or `zod` if it uses none. The welcome
  template, and every template `email-kit new` writes, uses that library;
- adds the scripts `email-kit:compile`, `email-kit:check` and `email-kit:watch`
  (`email-kit compile --watch`), or the same under the prefix `emails:` or `ek:` if those are
  taken;
- adds `"jsx": "react-jsx"` to `tsconfig.json` when it has no JSX setting;
- marks the `_generated` folder as generated in `.gitattributes`, and ignores it in
  `.prettierignore` and `.eslintignore` if you have them.

Only `@email-kit/runtime` is a dependency, because the generated module imports it when your app
runs: it renders the compiled templates, has no dependencies of its own, and adds about 1.5 KB to
3 KB to a bundle, minified and gzipped. The rest is only needed to compile, so a production install
without devDependencies leaves it out. `email-kit check` fails if the runtime is missing or a
devDependency (`output.runtime-dependency`).

## Compile

```sh
npx email-kit compile
```

It writes the `_generated/` folder:

```
_generated/
  index.ts                the module your app imports (index.mjs + index.d.mts with module: "mjs")
  messages.d.ts           the types that make t() typed in templates
```

That's all your app needs. The compiler owns the folder: each compile removes anything it didn't
write. For a backend that doesn't run the module, `contract: true` also writes each email's parts
as files; see [Other backends](sending.md#other-backends).

| Flag | Does |
|---|---|
| `--watch` | Recompile when a template, component, message or the config changes |
| `--quiet` | Print errors only |
| `--verbose` | Also print each template's sizes per locale, and the files that changed |
| `--config <path>` | Use this config file instead of `./email-kit.config.ts` |

`email-kit generate` is the same command. Errors carry an id, such as `[placeholder-misuse]`; the
[error reference](../reference/errors.md) explains each one.

Keep `messages.d.ts` in your TypeScript project (it is, if your `tsconfig.json` includes the
`_generated/` folder): it gives `t()` its keys and parameter types.

### Commit the output, or compile in the build

By default `email-kit check` expects the `_generated` folder to be committed, so deploys need no
compile step: `output.drift` fails when it is out of date, and `output.gitignored` warns when it
is ignored. If you'd rather compile in your build (`"build": "email-kit compile && next build"`),
gitignore the folder and turn that check off with your reason (see
[check levels](configuration.md#checks)).

## Render from server code

```ts
import { emails } from "@/email-kit"

const { subject, html, text } = emails.welcome.render({
  name: "Ada",
  plan: "pro",
  startUrl: "https://example.com/start",
})
```

`render()` validates the data against the template's schema, picks the locale, and returns the
subject, the HTML part and the plain-text part. Send `html` and `text` together as
`multipart/alternative`. [Rendering and sending](sending.md) covers the whole API, and how to
pass values that differ by environment with `createEmails()`.

## Check in CI

```sh
npx email-kit check
```

`check` compiles in memory (it writes nothing) and runs the [checks](../reference/checks.md) over the
compiled emails, the renders of every fixture, the template sources and the theme. It exits 1 on
any error, and 0 when there are only warnings and notes.

| Flag | Does |
|---|---|
| `--reporter <name>` | `human` (the default), `json` or `github`, which writes annotations for GitHub Actions |
| `--json` | The same as `--reporter json`: the findings in a versioned JSON schema |
| `--config <path>` | Use this config file |

In GitHub Actions:

```yaml
- run: npm ci
- run: npx email-kit check --reporter github
```

`email-kit tokens` prints the theme's colour roles in light and dark with their contrast ratios,
and exits 1 when a `tokens.*` check fails at error level.

## Add a template

```sh
npx email-kit new password-reset
```

`new` creates the folder `password-reset/`, with a `template.tsx` holding a schema, a fixture and
two components, and a `messages.<locale>.json` for every locale in the config. Ids are lowercase words joined by hyphens; an id
that's in use is refused, never overwritten. The template becomes `emails.passwordReset` after
the next compile.

The new template is a starting point: until you write its copy and add a preheader, `check`
reports it (`text.present`, `preheader.length`).

## Next

- [Writing templates](templates.md)
- [Components](components.md)
- [Configuration](configuration.md)

Not in the preview yet: the preview studio (`email-kit dev`), marketing email (unsubscribe links,
multi-column layouts), and testing in real email clients.
