import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, posix } from "node:path"

import type { Prompter } from "../init/index.ts"
import { relativePath } from "../paths.ts"
import { hasSection, type Pointer, section, withSection } from "./instructions.ts"
import {
  docsFolder,
  hasExactly,
  SKILL_NAME,
  type SkillFiles,
  skillForProject,
  skillState,
  writeSkill,
} from "./skill.ts"
import {
  AGENTS,
  type AgentId,
  agentOf,
  detectAgents,
  repositoryRoot,
  type SkillsFolder,
} from "./targets.ts"

/** The project whose emails the agents learn about. Paths are absolute. */
export interface AgentsProject {
  /** The folder holding the config. */
  readonly dir: string
  /** The email-kit folder. */
  readonly folder: string
  /** The output folder. */
  readonly out: string
  readonly importPath: string | undefined
  /** How the project runs a package's binary, such as `npx` or `pnpm exec`. */
  readonly runner: string
}

export interface AgentsOptions {
  /** Take the detected agents and accept every change without asking. */
  readonly yes?: boolean
  /** The agents from `--agents`, instead of detecting or asking. */
  readonly agents?: readonly AgentId[]
  /**
   * `init`, which offers agents as one step of setting up and says nothing when there are none,
   * or `agents`, the command that's only for this.
   */
  readonly command: "init" | "agents"
}

interface AgentsIo {
  out(text: string): void
  err(text: string): void
  readonly prompter: Prompter
}

/** A skill folder to write, at `<root>/<folder>/email-kit`. */
interface SkillTarget {
  readonly path: string
  readonly status: "create" | "update" | "unchanged" | "foreign"
}

/** An instructions file to give the project's section. */
interface InstructionsTarget {
  readonly path: string
  readonly status: "create" | "add" | "update" | "unchanged"
  readonly content: string
}

/**
 * Sets up the AI coding agents a project uses: it writes the email-kit skill where they read
 * skills, and a short section in the instructions file each always reads, pointing to it. The
 * agents come from `--agents`, from what the repository shows (with `--yes`), or from a question
 * with those preselected. A new file is created with the rest; a change to an existing file is
 * asked about first. Returns the exit code.
 */
export async function setUpAgents(
  project: AgentsProject,
  options: AgentsOptions,
  io: AgentsIo,
): Promise<number> {
  const root = repositoryRoot(project.dir)
  const detected = detectAgents(root, project.dir)
  const agents = options.agents ?? (await chooseAgents(detected, options, io))
  if (agents === undefined) return 1
  if (agents.length === 0) {
    if (options.command === "agents") io.out("Nothing was changed.")
    return 0
  }

  const docs = docsFolder(root, project.dir)
  const files = skillForProject(docs)
  const skills = skillTargets(root, agents, files)
  const instructions = instructionTargets(root, project, agents, skills)
  io.out(plan(root, project.dir, agents, skills, instructions, docs))

  const changes = instructions.filter((t) => t.status === "add" || t.status === "update")
  const accepted = new Set<string>()
  for (const target of changes) {
    const message =
      target.status === "add"
        ? `${target.path}: add a section that points agents to the email-kit skill?`
        : `${target.path}: update email-kit's section?`
    if (options.yes || (await io.prompter.confirm(message, true))) accepted.add(target.path)
  }
  for (const skill of skills) {
    if (skill.status === "create" || skill.status === "update") {
      writeSkill(join(root, skill.path), files)
    }
  }
  for (const target of instructions) {
    if (target.status === "create" || accepted.has(target.path)) {
      writeFileSync(join(root, target.path), target.content)
    }
  }

  const labels = list(agents.map(nameOf))
  const written =
    skills.some((s) => s.status === "create" || s.status === "update") ||
    instructions.some((t) => t.status === "create" || accepted.has(t.path))
  io.out(
    written
      ? `Set up the email-kit skill for ${labels}.`
      : `The email-kit skill for ${labels} is up to date.`,
  )
  return 0
}

/**
 * The agents to set up: with `--yes` the detected ones, otherwise the user's pick, with those
 * preselected. `undefined` when `email-kit agents --yes` finds none, which it reports.
 */
async function chooseAgents(
  detected: readonly AgentId[],
  options: AgentsOptions,
  io: AgentsIo,
): Promise<readonly AgentId[] | undefined> {
  if (options.yes) {
    if (detected.length > 0 || options.command === "init") return detected
    io.err(
      `✗ No AI coding agent's files in this repository. Name them with --agents, such as --agents claude,codex (known: ${AGENTS.map((a) => a.id).join(", ")}).`,
    )
    return undefined
  }
  return io.prompter.multiselect(
    "Which AI coding agents should learn to write email-kit emails? (none to skip)",
    AGENTS.map((agent) => ({
      value: agent.id,
      label: agent.label,
      ...(agent.hint !== undefined && { hint: agent.hint }),
    })),
    detected,
  )
}

/** The skill folders the agents read, shared first, with what writing them would do. */
function skillTargets(root: string, agents: readonly AgentId[], files: SkillFiles): SkillTarget[] {
  const folders = new Set<SkillsFolder>(agents.map((id) => agentOf(id).skills))
  return ([".agents/skills", ".claude/skills"] as const)
    .filter((folder) => folders.has(folder))
    .map((folder) => {
      const path = posix.join(folder, SKILL_NAME)
      const state = skillState(join(root, path))
      const status =
        state.kind === "missing"
          ? "create"
          : state.kind === "foreign"
            ? "foreign"
            : hasExactly(join(root, path), files)
              ? "unchanged"
              : "update"
      return { path, status }
    })
}

/**
 * The instructions files the agents read, with the section each gets. Claude Code reads
 * `CLAUDE.md`, and `AGENTS.md` only when the repository has no `CLAUDE.md`, so it gets
 * `CLAUDE.md` when there is one and shares `AGENTS.md` otherwise: creating `CLAUDE.md` would hide
 * `AGENTS.md` from it.
 */
function instructionTargets(
  root: string,
  project: AgentsProject,
  agents: readonly AgentId[],
  skills: readonly SkillTarget[],
): InstructionsTarget[] {
  const shared = posix.join(".agents/skills", SKILL_NAME)
  // The shared skill email-kit wrote before, which agents not set up this time may still read.
  const sharedBefore = skillState(join(root, shared)).kind === "ours"
  const files = new Map<string, SkillsFolder>()
  const add = (file: string, folder: SkillsFolder) => {
    // A file shared by several agents points to the shared skill folder. `AGENTS.md` keeps
    // pointing there while it exists, so adding Claude Code alone doesn't move other agents.
    const keepShared = file === "AGENTS.md" && sharedBefore
    if (files.get(file) !== ".agents/skills")
      files.set(file, keepShared ? ".agents/skills" : folder)
  }
  for (const id of agents) {
    const agent = agentOf(id)
    if (agent.instructions === "claude") add(claudeFile(root), agent.skills)
    else add(agent.instructions, agent.skills)
  }
  const relative = (path: string) => relativePath(root, path) || "."
  const usable = new Set(skills.filter((s) => s.status !== "foreign").map((s) => s.path))
  if (sharedBefore) usable.add(shared)
  return [...files].flatMap(([path, folder]) => {
    const skillPath = posix.join(folder, SKILL_NAME)
    if (!usable.has(skillPath)) return []
    const pointer: Pointer = {
      project: relativePath(root, project.dir),
      folder: relative(project.folder),
      out: relative(project.out),
      importPath: project.importPath,
      runner: project.runner,
      skill: posix.join(skillPath, "SKILL.md"),
    }
    const file = join(root, path)
    const existing = existsSync(file) ? readFileSync(file, "utf8") : undefined
    const content = withSection(existing, pointer.project, section(pointer))
    const status =
      existing === undefined
        ? "create"
        : existing === content
          ? "unchanged"
          : hasSection(existing, pointer.project)
            ? "update"
            : "add"
    return [{ path, status, content }]
  })
}

/** Claude Code's instructions file: the `CLAUDE.md` the repository has, else `AGENTS.md`. */
function claudeFile(root: string): string {
  if (existsSync(join(root, "CLAUDE.md"))) return "CLAUDE.md"
  if (existsSync(join(root, ".claude/CLAUDE.md"))) return ".claude/CLAUDE.md"
  // CLAUDE.local.md is personal and usually ignored; it already hides AGENTS.md from Claude Code.
  if (existsSync(join(root, "CLAUDE.local.md"))) return "CLAUDE.md"
  return "AGENTS.md"
}

/** What setting up the agents will do, before it asks about changes to existing files. */
function plan(
  root: string,
  projectDir: string,
  agents: readonly AgentId[],
  skills: readonly SkillTarget[],
  instructions: readonly InstructionsTarget[],
  docs: string,
): string {
  const where = relativePath(projectDir, root)
  const note = { create: "new", update: "update", unchanged: "up to date" } as const
  const write = [
    ...skills
      .filter((s) => s.status !== "foreign")
      .map((s) => [`${s.path}/`, `the skill (${note[s.status as keyof typeof note]})`]),
    ...instructions
      .filter((t) => t.status === "create" || t.status === "unchanged")
      .map((t) => [
        t.path,
        t.status === "create" ? "email-kit's section (new)" : "email-kit's section (up to date)",
      ]),
  ] as [string, string][]
  const change = instructions.filter((t) => t.status === "add" || t.status === "update")
  const foreign = skills.filter((s) => s.status === "foreign")
  const width = Math.max(0, ...write.map(([path]) => path.length))
  return [
    "",
    "AI coding agents",
    "",
    `  Agents   ${list(agents.map(nameOf))}`,
    ...(where ? [`  Where    the repository root, ${where}`] : []),
    `  Docs     ${docs}/, the installed CLI's, which the skill links to`,
    ...(write.length > 0
      ? ["", "  Write", ...write.map(([path, what]) => `    ${path.padEnd(width)}   ${what}`)]
      : []),
    ...(change.length > 0
      ? [
          "",
          "  Change, if you agree",
          ...change.map(
            (t) =>
              `    ${t.path}: ${t.status === "add" ? "add a section that points agents to the skill" : "update email-kit's section"}`,
          ),
        ]
      : []),
    ...(foreign.length > 0
      ? [
          "",
          "  Skip",
          ...foreign.map(
            (s) =>
              `    ${s.path}/ is a folder email-kit didn't write. Move it, then run \`email-kit agents\` again.`,
          ),
        ]
      : []),
    "",
  ].join("\n")
}

/** An agent's name as it reads in a sentence. */
const nameOf = (id: AgentId) => {
  const agent = agentOf(id)
  return agent.inSentence ?? agent.label
}

/** Names joined for a sentence: `A`, `A and B`, `A, B and C`. */
function list(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}
