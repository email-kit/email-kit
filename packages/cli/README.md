# @email-kit/cli

The `email-kit` command: set up a project, compile TSX email templates to HTML and plain text,
and check them against email-client, accessibility and copy rules.

> **1.0.** Stable for transactional email. Not yet: marketing email
> (unsubscribe links, multi-column layouts), testing in real email clients (classic Outlook
> especially), and the preview studio. See [what 1.0
> covers](https://github.com/email-kit/email-kit#status).

```sh
npx @email-kit/cli init   # or: npm create email-kit
npx email-kit compile             # templates → a typed module your server imports
npx email-kit check               # the checks, for CI (exit 1 on errors)
```

| Command | Does |
|---|---|
| `init` | Adds a config, an `email-kit/` folder and a welcome template to the project it runs in. Asks before each change to an existing file; `--yes` for CI |
| `new <id>` | Adds a template, with messages in every locale |
| `compile` | Writes HTML, text, JSON Schema and a dependency-free module (`--watch`, `--verbose`) |
| `check` | Runs the checks on the compiled emails, renders of every fixture, the sources and the theme (`--json`, `--reporter github`) |
| `tokens` | Prints the theme's colour roles in light and dark with their contrast |

Requires Node.js 22.12 or later. MIT licensed; third-party notices in `THIRD_PARTY_NOTICES.md`.
