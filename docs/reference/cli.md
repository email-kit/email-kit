# CLI

The `email-kit` command comes from `@email-kit/cli`. Run it with `npx email-kit <command>`, or
through the scripts `init` adds (`npm run email-kit:compile`). It needs Node.js 22.12 or later.

| Command | Does |
|---|---|
| [`init`](#init) | Add email-kit to a project: a config, a folder and a welcome template |
| [`new <id>`](#new) | Add a template, with its messages in every locale and a fixture |
| [`compile`](#compile) | Compile the templates into the output folder (alias: `generate`) |
| [`check`](#check) | Compile in memory and run the checks; exits 1 on any error |
| [`tokens`](#tokens) | Print the theme's colour roles with contrast ratios, and its findings |

`email-kit --help` lists them, `email-kit <command> --help` shows a command's flags, and
`email-kit --version` prints the version. Every command except `init` takes `--config <path>` to
use a config file other than `./email-kit.config.ts`.

Errors carry an id in brackets, such as `[placeholder-misuse]`, explained in the
[error reference](errors.md).

## init

```sh
npm create email-kit@preview          # runs `email-kit init` without installing the CLI first
npx @email-kit/cli@preview init
npx email-kit init                    # with the CLI installed
```

Run it in the project that sends email; in a monorepo, the app's folder, such as `apps/api`.
`npm create email-kit` passes its flags on after `--`: `npm create email-kit@preview -- --yes`.

`init` shows what it will create and change, asks before each change to an existing file, then
installs, compiles once and prints how to render the welcome email. It never writes into a folder
that isn't its own. Run it again and it says the project is already set up.

| Flag | Does |
|---|---|
| `--yes` | Accept every default without asking. Use it in CI and scripts, where there's no terminal to ask in |
| `--dir <path>` | Put the email-kit folder in this code root instead of the detected one |
| `--config <path>` | Name the config file something other than `email-kit.config.ts` |
| `--force` | Overwrite an existing config file of that name. A folder that's already set up still stops `init` |
| `--no-install` | Don't run the package manager after adding the dependencies |

### What it detects

| What | How |
|---|---|
| Package manager | The `packageManager` field, else the lockfile (`pnpm-lock.yaml`, `bun.lock`, `yarn.lock`), else npm |
| Code root | In order: `rootDir` or a single `include` in `tsconfig.json`; the `@/*` or `~/*` path alias; `src/app` or `src/pages` (then `src`); `app` or `pages` (then the project root); a `src/` folder with code; the project root |
| Host | Bun; a bundler in the dependencies (`next`, `vite`, `tsup`, `esbuild`, `wrangler`, `tsx`, `@remix-run/dev`, `astro`, `nuxt`); a script that runs `node` on a `.ts` file (Node type stripping); a script that runs `tsc` |
| Schema library | Zod, Valibot or ArkType in the dependencies, else Zod |
| shadcn theme | A CSS file with `--primary` in `:root`: the one `components.json` names, or `app/globals.css` and similar. `init` asks whether to use it as the email theme |

The host decides how your app imports the emails:

| Host | Import | How |
|---|---|---|
| A bundler or Bun, with a `tsconfig.json` | `@/email-kit` | Your `@/*` alias if it already reaches the folder; otherwise `init` adds the path `@/email-kit` to `tsconfig.json` |
| A `tsc` build run with `node` | `#email-kit` | `"imports"` in `package.json`, pointing at `_generated/index.mjs`; the config gets `module: "mjs"` |
| Node type stripping | `#email-kit` | `"imports"` in `package.json`, pointing at the folder's `index.ts` |
| Anything else | `./email-kit` | A relative import |

The import path is saved as `importPath` in the config, so `email-kit new` prints examples with it.

### What it creates and changes

```
email-kit.config.ts                 the config: locales, sender values, import path
src/email-kit/
  index.ts                          re-exports ./_generated: what your app imports
  welcome/
    template.tsx                    a welcome email that shows each part of a template
    messages.en.json
  _generated/                       written by `email-kit compile`
```

The folder is the first free one of `email-kit`, `email-templates` and `emails` in the code root.
Without a `src/` folder it sits at the project root.

With your agreement, `init` also:

- adds `@email-kit/runtime` as a dependency, and `@email-kit/cli`, `@email-kit/core`,
  `@email-kit/components` and the schema library as devDependencies (Valibot also gets
  `@valibot/to-json-schema`);
- adds the scripts `email-kit:compile`, `email-kit:check` and `email-kit:watch`
  (`email-kit compile --watch`), or the same under the prefix `emails:` or `ek:` if those are
  taken;
- adds `"jsx": "react-jsx"` to `tsconfig.json` when it has no JSX setting;
- marks the `_generated` folder as generated in `.gitattributes`, and ignores it in
  `.prettierignore` and `.eslintignore` if you have them.

Only `@email-kit/runtime` is a dependency, because the generated module imports it when your app
runs. It has no dependencies of its own and adds about 1.5 KB to 3 KB to a bundle, minified and
gzipped. The rest is only needed to compile.

## new

```sh
npx email-kit new password-reset
```

Creates the folder `password-reset/` in the email-kit folder, with a `template.tsx` holding a
schema, a fixture and a few components, and a `messages.<locale>.json` for every locale in the
config. Ids are lowercase words joined by hyphens. An id that's in use is refused, never
overwritten. The template becomes `emails.passwordReset` after the next compile.

| Flag | Does |
|---|---|
| `--config <path>` | Use this config file |

## compile

```sh
npx email-kit compile
```

Writes the output folder, `_generated/` by default:

```
_generated/
  index.ts          the module your app imports (index.mjs + index.d.mts with module: "mjs")
  messages.d.ts     the types that make t() typed in templates
```

The compiler owns the folder: each compile removes anything it didn't write. Config options add
more files: `contract` (each email's parts as files, for other backends), `perTemplateEntries`
(a module per template) and `theme.emit` (`theme.json`). See [Configuration](configuration.md).

On an error, nothing is written and the command exits 1. `email-kit generate` is the same
command.

| Flag | Does |
|---|---|
| `--watch` | Recompile when a template, component, message or the config changes |
| `--quiet` | Print errors only |
| `--verbose` | Also print each template's sizes per locale, and the files that changed |
| `--config <path>` | Use this config file |

## check

```sh
npx email-kit check
```

Compiles in memory (it writes nothing) and runs the [checks](checks.md) over the compiled emails,
the renders of every fixture and generated variant, the template sources, the theme and the
project. It exits 1 on any error, and 0 when there are only warnings and notes. See
[Checks and CI](../guide/checks-and-ci.md).

| Flag | Does |
|---|---|
| `--reporter <name>` | `human` (the default), `json` or `github`, which writes annotations for GitHub Actions |
| `--json` | The same as `--reporter json`: the findings in a versioned JSON schema |
| `--config <path>` | Use this config file |

## tokens

```sh
npx email-kit tokens
```

Prints the theme's colour roles in light and dark with their contrast ratios, then the theme's
findings. It exits 1 when a `tokens.*` check fails at error level. See
[Theme and dark mode](../guide/theme.md#see-the-resolved-theme).

| Flag | Does |
|---|---|
| `--config <path>` | Use this config file |
