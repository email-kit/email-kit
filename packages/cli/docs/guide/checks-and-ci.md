<!-- Generated from docs/guide/checks-and-ci.md for AI coding agents: run `pnpm --filter @email-kit/cli test -u` after changing the docs. -->

# Checks and CI

`email-kit check` looks for problems that make an email render badly, read badly or break rules:
accessibility, dark mode, size limits, links, copy, translations, the theme and the project setup.
The [checks reference](../reference/checks.md) lists every check with its default level and fix.

```sh
npx email-kit check
```

## What it checks

`check` compiles in memory (it writes nothing), then runs the checks over:

- **the compiled emails**, every template in every locale, including the two
  [pseudo-locales](messages.md#pseudo-locales);
- **renders of every fixture**, and of three variants it generates from the schema: an empty one
  (optional fields left out, strings at their minimum length), a long one (long strings, 25 items
  per list unless `maxItems` says fewer) and a hostile one (markup, quotes and braces);
- **the template sources**, for literal colours, fonts and sizes that should come from the theme;
- **the theme**, for contrast and dark mode;
- **the project**, for an out-of-date `_generated` folder and a missing runtime dependency.

So the schema's limits matter: a required name without `.min(1)` can render as "Thanks, !" in the
empty variant, and a list without a maximum can push the long variant past Gmail's clipping size.

## Reading the output

```
order-shipped (en)
  ! a11y.link-text  src/email-kit/order-shipped/template.tsx
    Generic link text "Click here"
    Fix: Say where the link goes ("View your order"): screen reader users list links out of context.
    Docs: https://github.com/email-kit/email-kit/blob/main/docs/reference/checks.md#a11ylink-text

0 errors, 1 warning, 2 notes
```

Findings are grouped by template and locale, with a group each for the theme and the project.
Each has a level:

| Mark | Level | Fails `check`? |
|---|---|---|
| `✗` | error | Yes: exit code 1 |
| `!` | warning | No |
| `i` | note (info) | No |

| Flag | Does |
|---|---|
| `--reporter <name>` | `human` (the default), `json` or `github`, which writes annotations for GitHub Actions |
| `--json` | The same as `--reporter json`: the findings in a versioned JSON schema |
| `--config <path>` | Use this config file instead of `./email-kit.config.ts` |

## In CI

Run `check` on every pull request. With GitHub Actions, the `github` reporter puts each finding on
the line it's about:

```yaml
- run: npm ci
- run: npx email-kit check --reporter github
```

`check` needs the devDependencies, so run it after a full install.

## Commit the output, or compile in the build

By default `check` expects the `_generated` folder to be committed, so deploys need no compile
step: `output.drift` fails when it's out of date (run `email-kit compile` and commit), and
`output.gitignored` warns when it's ignored.

To compile in your build instead, run the compile before the app's build
(`"build": "email-kit compile && next build"`), gitignore the folder, and turn both checks off
with your reason:

```ts
checks: {
  "output.drift": { level: "off", reason: "The build compiles the emails" },
  "output.gitignored": { level: "off", reason: "The build compiles the emails" },
}
```

Either way, `@email-kit/runtime` must be a dependency, not a devDependency, since the app imports
it when it runs (`output.runtime-dependency`).

## Change a check's level

Each check has a default level. Change it per project in `email-kit.config.ts`, with the reason a
reviewer will read:

```ts
checks: {
  "img.fluid-width": { level: "off", reason: "Hero images are fixed width by design" },
  "i18n.unused-keys": { level: "error", reason: "We keep message files tidy" },
}
```

| Field | Type | |
|---|---|---|
| `level` | `"off"`, `"info"`, `"warn"` or `"error"` | `error` fails `check` (exit 1); `warn` and `info` are reported only |
| `reason` | `string` | Required, and not empty |

An unknown check id fails the config, with a suggestion if it's close to a real one. [Team checks](#team-checks) take levels the same way. Checks that the compiler enforces, such as `source.fixture-valid`, fail
the compile whatever their level.

## Team checks

Add your own rules with `defineCheck()` in `customChecks`. They run alongside the catalogue, take
levels from `checks`, and show in every reporter.

```ts
import { defineCheck, defineConfig } from "@email-kit/core"

const helpLink = defineCheck({
  id: "acme.help-link",
  level: "warn",
  rule: "Every email links to the help centre.",
  fix: "Add the footer's help link.",
  run({ emails }, report) {
    for (const email of emails) {
      const hrefs = email.elements("a").map((a) => a.attributes.href ?? "")
      if (!hrefs.some((href) => href.startsWith("https://help.acme.example"))) {
        report({ email, message: "No link to the help centre" })
      }
    }
  },
})

export default defineConfig({
  customChecks: [helpLink],
})
```

| Field | Type | |
|---|---|---|
| `id` | `string` | `family.name` in lowercase, with a family of your own (`acme.help-link`); email-kit's families, such as `html.` or `text.`, are refused |
| `level` | `"error"`, `"warn"` or `"info"` | The default level |
| `rule` | `string` | The rule, in one sentence |
| `fix` | `string` | The usual fix |
| `docs` | `string` | Where your docs for it live |
| `on` | `"template"`, `"render"` or `"both"` | `template` (the default) checks the compiled templates, with `{{placeholders}}` where data goes; `render` checks the renders of every fixture and generated variant |
| `run` | `(context, report) => void` | The check |

`context.emails` holds one entry per template and locale (and, for renders, per fixture):

| Field | |
|---|---|
| `template`, `locale` | Which email |
| `fixture` | For renders: the fixture's name, or a generated variant such as `"generated empty"` |
| `subject`, `preheader`, `html`, `text` | The parts |
| `elements(name?)` | Every element, or those with a tag name: `{ name, attributes, text, offset, mso }`, where `mso` is true inside a classic-Outlook-only block |

`report({ message, email?, at?, fix? })` records a problem: leave out `email` for a project-wide
one, give `at` (an element's `offset`) to point at a place in the HTML, and `fix` to replace the
check's usual fix. A check that throws is reported as
[`check-failed`](../reference/errors.md#check-failed).
