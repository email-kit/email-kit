import { VERSION } from "../../version.ts"
import type { Check } from "../types.ts"

/** The `agents.*` checks: the email-kit skill AI coding agents read matches this version. */
export const AGENTS: readonly Check[] = [
  {
    id: "agents.skill-outdated",
    level: "warn",
    rule: "Each copy of the email-kit skill for AI coding agents (`.agents/skills/email-kit/`, `.claude/skills/email-kit/`) matches the one the installed CLI ships.",
    fix: "Run `email-kit agents` to update it: agents follow the skill, and an older one describes an older email-kit.",
    run: (context, report) => {
      for (const skill of context.agentSkills ?? []) {
        if (skill.current) continue
        report({
          message:
            skill.version && skill.version !== VERSION
              ? `${skill.file} is the skill from email-kit ${skill.version}; this is ${VERSION}`
              : `${skill.file} differs from the skill email-kit ${VERSION} ships`,
          subject: { file: skill.file },
        })
      }
    },
  },
]
