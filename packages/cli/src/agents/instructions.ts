/** What the instructions section says about the project, with paths relative to the repository. */
export interface Pointer {
  /** The project's folder (the config's), or `""` when it's the repository root. */
  readonly project: string
  /** The email-kit folder. */
  readonly folder: string
  /** The output folder. */
  readonly out: string
  /** How the app imports the emails, such as `@/email-kit`. */
  readonly importPath: string | undefined
  /** How the project runs a package's binary: `npx`, `pnpm exec`, `yarn` or `bunx`. */
  readonly runner: string
  /** The skill's `SKILL.md`. */
  readonly skill: string
}

const END = "<!-- email-kit:end -->"

/** The section's first line. In a monorepo it names the project, so each app has its own. */
const startOf = (project: string) =>
  project ? `<!-- email-kit:start ${project} -->` : "<!-- email-kit:start -->"

/**
 * The section email-kit keeps in `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`: where the emails are,
 * the commands, and the skill to read for the rest. It's short because agents load these files
 * into every conversation; the skill loads only when a task needs it.
 */
export function section(pointer: Pointer): string {
  const { project, folder, out, importPath, runner, skill } = pointer
  const cli = (command: string) => `\`${runner} email-kit ${command}\``
  const imports = importPath
    ? `\`${importPath}\`, as \`emails.<id>.render(data, { locale })\``
    : `\`${folder}/index.ts\`, as \`emails.<id>.render(data, { locale })\``
  return [
    startOf(project),
    `## Emails${project ? ` in ${project}` : ""} (email-kit)`,
    "",
    `The emails this project sends are email-kit templates in \`${folder}/\`, one folder per email. ` +
      "Before you add or change an email, its copy or translations, or the code that sends it, " +
      `read the email-kit skill: \`${skill}\`.`,
    "",
    ...(project ? [`- Run email-kit commands in \`${project}\`.`] : []),
    `- ${cli("new <id>")} adds an email. After each change, run ${cli("compile")}, then ${cli("check")}, and fix what they report.`,
    `- Never edit \`${out}/\`: it's compiled output.`,
    `- The app imports the emails from ${imports}.`,
    END,
  ].join("\n")
}

/** `text` escaped for use in a regular expression. */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * An instructions file with the project's section added or replaced, and everything else left as
 * it was. `existing` is the file's content, or `undefined` for a file that doesn't exist yet.
 */
export function withSection(existing: string | undefined, project: string, text: string): string {
  if (existing === undefined || existing.trim() === "") return `${text}\n`
  const block = new RegExp(`${escapeRegExp(startOf(project))}\\r?\\n[\\s\\S]*?${escapeRegExp(END)}`)
  if (block.test(existing)) return existing.replace(block, () => text)
  return `${existing.replace(/\s*$/, "")}\n\n${text}\n`
}

/** Whether an instructions file has a section for the project. */
export const hasSection = (existing: string, project: string): boolean =>
  existing.includes(startOf(project))
