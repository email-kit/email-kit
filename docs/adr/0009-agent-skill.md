# ADR 0009: One Agent Skill for AI coding agents, written by the CLI

**Status:** Accepted (2026-11-22).

## Context

More and more email changes start as a request to an AI coding agent ("add a password-reset
email", "send the receipt in German") rather than as a read of the guide. An agent that doesn't know
email-kit writes what it knows from other email libraries: arithmetic on data fields, `.map()` over
a list, `{total, number}` in a message, a hard-coded colour, an edit to `_generated/`. Each of these
fails the compile or the checks, and the agent then guesses at the fix.

Agents read project files that tell them how a project works, but every tool has its own
locations:

| Tool | Skills (`SKILL.md` folders) | Always-loaded instructions |
|---|---|---|
| Claude Code | `.claude/skills/` | `CLAUDE.md`; `AGENTS.md` only when there's no `CLAUDE.md` |
| Codex | `.agents/skills/` | `AGENTS.md` |
| Cursor | `.agents/skills/`, `.cursor/skills/` | `AGENTS.md`, `.cursor/rules/` |
| GitHub Copilot | `.agents/skills/`, `.github/skills/`, `.claude/skills/` | `AGENTS.md`, `.github/copilot-instructions.md` |
| Gemini CLI | `.agents/skills/`, `.gemini/skills/` | `GEMINI.md` |
| Antigravity | `.agents/skills/` | `AGENTS.md`, `GEMINI.md` |
| Windsurf | `.agents/skills/`, `.windsurf/skills/` | `AGENTS.md` |

(Checked against each tool's documentation in November 2026.) Two formats are now shared:
[Agent Skills](https://agentskills.io) (a folder with `SKILL.md` and the files it refers to, loaded
when its description matches the task) and `AGENTS.md`. Tools that wrap these agents, such as T3
Code, read the same files as the agent they run.

What an agent needs is long: the authoring rules, every component, the message syntax, the
config, the checks and the errors. That's the documentation, which changes with each release.

## Options

1. **Document it, and let users write their own agent files.** Each project writes a partial,
   soon out-of-date copy of the docs.
2. **A file per tool, each with the full instructions.** Seven copies to keep in step, in
   formats that keep changing, and instructions loaded into every conversation whether or not it
   touches email.
3. **One Agent Skill, generated from the docs, shipped in `@email-kit/cli` and written into the
   project by the CLI, with a short pointer in each tool's instructions file.**

## Decision

**Option 3.**

- **The skill.** `skills/email-kit/SKILL.md` in this repository, hand-written: when to use it,
  the workflow, the rules agents break most often, an example, and links to the guide and
  reference pages a task may need. Here its links go to the docs site.
- **Shipped with the CLI, with the docs it links to.** The build copies the skill into
  `@email-kit/cli`, with a copy of those pages in `dist/docs/`, generated from `docs/` by a test,
  as `docs/reference/checks.md` is from the catalogue, so they can't drift from the docs. The copy
  the CLI writes into a project links to the installed CLI's pages
  (`node_modules/@email-kit/cli/dist/docs/`), so they always match the installed version, and
  names the site as the fallback before an install. It records `metadata.email-kit-version`.
- **Only `SKILL.md` in the project.** Copying the pages into each project would put about 180 KB
  of committed files in every repository and change them with every upgrade. Linking to the site
  alone was the other way: it describes the latest version rather than the installed one, needs
  network access that sandboxed and CI agents often lack, and a one-file dump of the docs is too
  big for an agent to read whole.
- **Two copies in the project:** `.agents/skills/email-kit/` for every tool that reads the shared
  location, and `.claude/skills/email-kit/` for Claude Code, which doesn't. Copies rather than
  symlinks, which Windows checkouts and some tools don't follow. They go at the repository root,
  which every tool searches whichever folder it starts in.
- **A pointer, not the content, in the instructions files.** A section of about six lines, between
  `<!-- email-kit:start -->` and `<!-- email-kit:end -->` markers, names the email-kit folder, the
  commands and the skill's path. It goes in `AGENTS.md`, in `CLAUDE.md` when the repository has one
  (creating `CLAUDE.md` would stop Claude Code reading `AGENTS.md`), and in `GEMINI.md` for Gemini
  CLI. The start marker carries the project's path in a monorepo, so each app has its own section.
  Running again replaces the section and nothing else in the file.
- **`init` asks, `email-kit agents` updates.** `init` looks for signs of each tool (`.claude/`,
  `CLAUDE.md`, `.cursor/`, `AGENTS.md`, `GEMINI.md`…) and preselects them in a question; `--yes`
  takes the detected tools, and `--agents <list>` or `--no-agents` decide without asking. It asks
  before changing an instructions file that exists, as it does for every other file.
  `email-kit agents` adds or refreshes the files later, after an upgrade.
- **`check` notices an old skill.** `agents.skill-outdated` warns when a copy in the project
  differs from the one the installed CLI ships.
- **Outside the CLI:** the docs site serves the skill as files and a zip, with where each tool
  wants it, and `npx skills add email-kit/email-kit` installs it from this repository.

## Consequences

- An agent gets the documentation for the installed version, loaded only when a task touches
  email, one page at a time. Every conversation pays only for the few lines in the instructions
  file.
- A new tool that reads `.agents/skills/` or `AGENTS.md` works with no change here. A tool with its
  own locations is one entry in the CLI's list of agents.
- The skill is one committed file in each of two folders, which an upgrade changes;
  `email-kit agents` and `agents.skill-outdated` keep them current.
- The pages are in `node_modules`, which is gitignored, so a tool's search doesn't find them, and
  they're missing before an install. `SKILL.md` links to them by path, which agents open directly,
  and names the site for when they're missing.
- Detection can't see a tool that leaves no file in the repository. The question lists every tool,
  and `email-kit agents` adds one later.
- If agents come to need actions rather than documents (compile and check results as structured
  data, previews), a later ADR can add an MCP server. The CLI's commands and error ids cover that
  for now.
