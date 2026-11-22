import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

/** The AI coding agents `email-kit agents` knows where to set up. */
export type AgentId =
  | "claude"
  | "codex"
  | "cursor"
  | "copilot"
  | "gemini"
  | "antigravity"
  | "windsurf"
  | "agents-md"

/** Where an agent reads skills from, relative to the repository root. */
export type SkillsFolder = ".agents/skills" | ".claude/skills"

/** The instructions file an agent always reads. Claude Code's depends on the repository. */
export type InstructionsFile = "AGENTS.md" | "GEMINI.md" | "claude"

export interface Agent {
  readonly id: AgentId
  readonly label: string
  /** The label as it reads inside a sentence, when that differs. */
  readonly inSentence?: string
  /** Shown beside the label when the user picks agents. */
  readonly hint?: string
  readonly skills: SkillsFolder
  readonly instructions: InstructionsFile
  /** Files and folders, relative to the repository root or the project, that show it's in use. */
  readonly signs: readonly string[]
}

/**
 * Every agent, in the order the question lists them. Each tool's locations are from its own docs
 * (November 2026); see ADR 0009. Tools that wrap these agents, such as T3 Code or Conductor, read
 * the files of the agent they run.
 */
export const AGENTS: readonly Agent[] = [
  {
    id: "claude",
    label: "Claude Code",
    skills: ".claude/skills",
    instructions: "claude",
    signs: ["CLAUDE.md", "CLAUDE.local.md", ".claude"],
  },
  {
    id: "codex",
    label: "Codex",
    skills: ".agents/skills",
    instructions: "AGENTS.md",
    signs: [".codex"],
  },
  {
    id: "cursor",
    label: "Cursor",
    skills: ".agents/skills",
    instructions: "AGENTS.md",
    signs: [".cursor", ".cursorrules", ".cursorignore"],
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    skills: ".agents/skills",
    instructions: "AGENTS.md",
    signs: [
      ".github/copilot-instructions.md",
      ".github/instructions",
      ".github/prompts",
      ".github/agents",
      ".github/skills",
    ],
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    skills: ".agents/skills",
    instructions: "GEMINI.md",
    signs: ["GEMINI.md", ".gemini"],
  },
  {
    id: "antigravity",
    label: "Antigravity",
    skills: ".agents/skills",
    instructions: "AGENTS.md",
    signs: [".agent", ".agents/rules", ".agents/workflows"],
  },
  {
    id: "windsurf",
    label: "Windsurf",
    skills: ".agents/skills",
    instructions: "AGENTS.md",
    signs: [".windsurf", ".windsurfrules"],
  },
  {
    id: "agents-md",
    label: "Other agents that read AGENTS.md",
    inSentence: "other agents that read AGENTS.md",
    hint: "Zed, Jules, Amp, opencode, Aider and more",
    skills: ".agents/skills",
    instructions: "AGENTS.md",
    signs: ["AGENTS.md", ".agents/skills"],
  },
]

/** The agent with this id. */
export const agentOf = (id: AgentId): Agent => AGENTS.find((agent) => agent.id === id) as Agent

/**
 * The agents named in `--agents`: ids separated by commas, `all`, or `none`. Returns an error
 * message for an id it doesn't know.
 */
export function parseAgents(value: string): readonly AgentId[] | string {
  const names = value
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
  if (names.length === 1 && names[0] === "none") return []
  if (names.length === 1 && names[0] === "all") return AGENTS.map((agent) => agent.id)
  const unknown = names.filter((name) => !AGENTS.some((agent) => agent.id === name))
  if (unknown.length > 0) {
    return `Unknown agent "${unknown[0]}" (known: ${AGENTS.map((a) => a.id).join(", ")}, all, none)`
  }
  return AGENTS.map((agent) => agent.id).filter((id) => names.includes(id))
}

/**
 * The repository the project is in: the nearest folder from `dir` up with a `.git` (a folder, or a
 * file in a worktree or submodule). Agents look for their files there, whichever folder they
 * start in. Without one, the project's own folder.
 */
export function repositoryRoot(dir: string): string {
  for (let at = resolve(dir); ; at = dirname(at)) {
    if (existsSync(join(at, ".git"))) return at
    if (dirname(at) === at) return resolve(dir)
  }
}

/** The agents with a sign of use in the repository root or the project's folder, in list order. */
export function detectAgents(root: string, project: string): readonly AgentId[] {
  const folders = [...new Set([root, project])]
  return AGENTS.filter((agent) =>
    agent.signs.some((sign) => folders.some((folder) => existsSync(join(folder, sign)))),
  ).map((agent) => agent.id)
}
