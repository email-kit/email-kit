# AI coding agents

AI coding agents such as Claude Code, Codex, Cursor and GitHub Copilot can write email-kit emails
for you, but only once they know how it works. Without help, an agent writes what it knows from
other email libraries: arithmetic on data fields, `{total, number}` in a message, a hard-coded
colour, an edit to `_generated/`. Each of these fails the compile or the checks.

email-kit ships an [Agent Skill](https://agentskills.io) that teaches them: a `SKILL.md` with the
workflow, the rules and an example, which links to this documentation. Agents load it when a task
involves your emails: adding or changing an email, its copy or languages, fixing a `compile` or
`check` error, or writing the code that sends it.

## Set it up

`npm create email-kit` asks which agents you use, with the ones it finds in your repository
already selected. For a project that's already set up, or to add an agent later, run:

```sh
npx email-kit agents
```

It writes two things:

- **The skill,** in the folders the agents read skills from: `.agents/skills/email-kit/` (Codex,
  Cursor, GitHub Copilot, Gemini CLI, Antigravity, Windsurf and others) and
  `.claude/skills/email-kit/` (Claude Code). It's only a `SKILL.md`: its links go to the pages of
  this documentation that come with the CLI, in `node_modules/@email-kit/cli/dist/docs/`, so agents
  read the docs for the version you have installed. Before an install, it sends them here instead.
- **A short section in each agent's instructions file:** `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`.
  It says where your emails are, which commands to run, and which skill to read. It sits between
  `<!-- email-kit:start -->` and `<!-- email-kit:end -->`, and running `email-kit agents` again
  replaces only that section.

They go at the root of your repository, which agents search whichever folder they start in. In a
monorepo, each app that sends email gets its own section. Commit both, so everyone on the team, and
agents running in CI or the cloud, gets them.

`email-kit agents` shows what it will write and asks before it changes a file you already have. It
never writes into a skill folder it didn't create.

| Flag | Does |
|---|---|
| `--agents <list>` | These agents instead of asking: `claude`, `codex`, `cursor`, `copilot`, `gemini`, `antigravity`, `windsurf`, `agents-md` (any other agent that reads `AGENTS.md`), `all` or `none` |
| `--yes` | Take the agents your repository shows and accept every change, as in CI |
| `--config <path>` | Use this config file |

With `npm create email-kit`, pass `--agents <list>` to choose without being asked, or
`--no-agents` to skip this step.

Tools that run one of these agents, such as T3 Code or Conductor, read the files of the agent they
run.

## Keep it up to date

The skill describes the email-kit version that wrote it. After you upgrade, run
`npx email-kit agents` again. `email-kit check` warns when a copy differs from the one your
installed CLI ships ([`agents.skill-outdated`](../reference/checks.md#agentsskill-outdated)).

## Without the CLI

To install the skill with the [`skills`](https://github.com/vercel-labs/skills) CLI, which knows
where each agent reads skills from:

```sh
npx skills add email-kit/email-kit
```

This installs the skill from the `main` branch, which may be newer than the version you have. Run
`npx email-kit agents` afterwards to match your version, or `npx skills update` to refresh it.

To set it up by hand, download [email-kit-skill.zip](https://email-kit.dev/skills/email-kit-skill.zip)
(or read [its SKILL.md](https://email-kit.dev/skills/email-kit/SKILL.md) first). It holds an
`email-kit/` folder: unzip it into your agent's skills folder, at the root of your repository, so
that `SKILL.md` ends up at the path below. This copy links to the pages on this site, which
describe the latest version, and tells agents to read the installed CLI's copy instead when there
is one.

```sh
curl -LO https://email-kit.dev/skills/email-kit-skill.zip
unzip email-kit-skill.zip -d .agents/skills    # and -d .claude/skills for Claude Code
```


| Agent | Skill folder | Instructions file |
|---|---|---|
| Claude Code | `.claude/skills/email-kit/` | `CLAUDE.md`, or `AGENTS.md` when you have no `CLAUDE.md` |
| Codex | `.agents/skills/email-kit/` | `AGENTS.md` |
| Cursor | `.agents/skills/email-kit/` | `AGENTS.md` |
| GitHub Copilot | `.agents/skills/email-kit/` | `AGENTS.md` |
| Gemini CLI | `.agents/skills/email-kit/` | `GEMINI.md` |
| Antigravity | `.agents/skills/email-kit/` | `AGENTS.md` |
| Windsurf | `.agents/skills/email-kit/` | `AGENTS.md` |
| Others | `.agents/skills/email-kit/` | `AGENTS.md` |

The instructions file is optional, but it helps agents find the skill. Add a few lines like these,
with your own paths and commands:

```md
## Emails (email-kit)

The emails this project sends are email-kit templates in `src/email-kit/`, one folder per email.
Before you add or change an email, its copy or translations, or the code that sends it, read the
email-kit skill: `.agents/skills/email-kit/SKILL.md`.

- `npx email-kit new <id>` adds an email. After each change, run `npx email-kit compile`, then
  `npx email-kit check`, and fix what they report.
- Never edit `src/email-kit/_generated/`: it's compiled output.
- The app imports the emails from `@/email-kit`, as `emails.<id>.render(data, { locale })`.
```

For a one-off question in a chat that can't read your repository, point the agent at
[llms-full.txt](https://email-kit.dev/llms-full.txt), the whole documentation in one file.
