---
"@email-kit/cli": minor
"create-email-kit": minor
---

Teach AI coding agents email-kit. The CLI now ships an Agent Skill (a `SKILL.md` that links to the documentation the CLI now ships, for the installed version) for Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Antigravity, Windsurf and any agent that reads `AGENTS.md`.

- `email-kit init` asks which agents you use, with the ones your repository shows already selected, and writes the skill to `.agents/skills/email-kit/` and `.claude/skills/email-kit/`, with a short section pointing to it in `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`. `--agents <list>` and `--no-agents` decide without asking; `--yes` takes the detected agents.
- `email-kit agents` adds or updates them later, such as after an upgrade.
- `email-kit check` warns when a copy of the skill differs from the one the installed CLI ships (`agents.skill-outdated`).
