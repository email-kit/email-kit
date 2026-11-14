import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, posix, relative } from "node:path"

import { compileWithConfig, summarize } from "../compiler/build.ts"
import { loadConfig } from "../compiler/config/index.ts"
import { formatError } from "../compiler/problems/index.ts"
import { isDirectory, toPosix } from "../paths.ts"
import { type Change, plannedChanges } from "./changes.ts"
import { detectProject, findProject, type PackageManager, type Project } from "./detect.ts"
import { importPathOf, importStrategy } from "./imports.ts"
import { configFile, indexFile, WELCOME_MESSAGES, welcomeTemplate } from "./scaffold.ts"

/** Asks the user `init`'s questions. Tests pass their own answers. */
export interface Prompter {
  confirm(message: string, initial: boolean): Promise<boolean>
  text(message: string, initial: string): Promise<string>
}

export interface InitOptions {
  readonly cwd: string
  /** Accept every default without asking. */
  readonly yes?: boolean
  /** The code root, instead of the detected one. */
  readonly dir?: string
  /** The config file, instead of email-kit.config.ts. */
  readonly config?: string
  /**
   * Whether to replace an existing config file of that name. A folder that's already set up still
   * stops `init`.
   */
  readonly force?: boolean
  /** Whether to install the dependencies. Default: true. */
  readonly install?: boolean
}

/** Where `init` writes its output and asks its questions. */
interface InitIo {
  out(text: string): void
  err(text: string): void
  readonly prompter: Prompter
  /** Whether errors may be printed in colour. */
  readonly color?: boolean
}

/** A file `init` creates, relative to the project. */
interface NewFile {
  readonly path: string
  readonly content: string
}

/** The names `init` tries for its folder in the code root, in order. */
const FOLDERS = ["email-kit", "email-templates", "emails"]

/** How each package manager runs a package's binary. */
const RUNNER: Readonly<Record<PackageManager, string>> = {
  npm: "npx",
  pnpm: "pnpm exec",
  yarn: "yarn",
  bun: "bunx",
}

/** What `init` says when the project already has email-kit. */
const alreadySetUp = (where: string) =>
  `email-kit is already set up here (${where}). Add a template with \`email-kit new <id>\`.`

/**
 * `email-kit init`: adds email-kit to the project it runs in. It shows every file it creates and
 * every change it makes, asks before each change to an existing file, and never writes into a
 * folder or config that isn't email-kit's. Then it installs, compiles once and prints the next
 * steps. `--yes` accepts the defaults. Returns the exit code.
 *
 * A config with the chosen name that mentions `@email-kit/core` means the project is already set
 * up; any other file of that name stops `init`.
 */
export async function init(options: InitOptions, io: InitIo): Promise<number> {
  const dir = findProject(options.cwd)
  const project = detectProject(dir, options.dir)
  const ask = (message: string, initial = true) =>
    options.yes ? Promise.resolve(initial) : io.prompter.confirm(message, initial)

  const configName = options.config ?? "email-kit.config.ts"
  const configPath = join(dir, configName)
  if (existsSync(configPath) && !options.force) {
    if (readFileSync(configPath, "utf8").includes("@email-kit/core")) {
      io.out(alreadySetUp(configName))
      return 0
    }
    io.err(
      `✗ ${configName} exists and isn't an email-kit config. Rename it, or choose another name with --config <path>.`,
    )
    return 1
  }

  const chosen = await chooseFolder(project, options, io)
  if (typeof chosen === "number") return chosen
  const folder = chosen

  const strategy = importStrategy(project, folder)
  const importPath = importPathOf(strategy, folder)
  const defaultRoot = isDirectory(join(dir, "src")) ? "src/email-kit" : "email-kit"
  const theme =
    project.shadcnCss && (await ask(`Use the shadcn theme in ${project.shadcnCss} for the emails?`))
      ? project.shadcnCss
      : undefined
  const files: NewFile[] = [
    {
      path: configName,
      content: configFile({
        root: folder === defaultRoot ? undefined : folder,
        importPath,
        module: strategy.kind === "subpath" ? strategy.module : "ts",
        productName: productName(project),
        theme,
      }),
    },
    { path: posix.join(folder, "index.ts"), content: indexFile(strategy) },
    {
      path: posix.join(folder, "templates/welcome.tsx"),
      content: welcomeTemplate(project.schemaLibrary ?? "zod"),
    },
    { path: posix.join(folder, "messages/en/welcome.json"), content: WELCOME_MESSAGES },
  ]
  const { changes, scriptPrefix } = plannedChanges(project, folder, strategy)

  io.out(plan(project, relative(options.cwd, dir) || ".", importPath, files, changes))
  if (!(await ask("Create these files?"))) {
    io.out("Nothing was changed.")
    return 0
  }
  for (const file of files) {
    mkdirSync(dirname(join(dir, file.path)), { recursive: true })
    writeFileSync(join(dir, file.path), file.content)
  }
  const applied: Change[] = []
  for (const change of changes) {
    if (await ask(`${change.file}: ${change.summary}?`)) {
      change.apply()
      applied.push(change)
    }
  }
  const has = (id: Change["id"]) => applied.some((change) => change.id === id)

  if (has("dependencies") && options.install !== false) install(project, io)
  try {
    io.out(summarize(await compileWithConfig(await loadConfig({ cwd: dir, config: configName }))))
  } catch (error) {
    io.err(
      "! The first compile didn't run: install the dependencies, then run `email-kit compile`.",
    )
    io.err(formatError(error, io))
  }
  io.out(nextSteps(project.packageManager, importPath, has("scripts") ? scriptPrefix : undefined))
  return 0
}

/**
 * email-kit's folder: the first name in `FOLDERS` that's free in the code root, else the one the
 * user types. A folder that's already email-kit's means the project is set up. Returns the exit
 * code instead when `init` stops.
 */
async function chooseFolder(
  project: Project,
  options: InitOptions,
  io: InitIo,
): Promise<string | number> {
  const base = project.codeRoot
  for (const name of FOLDERS) {
    const candidate = posix.join(base, name)
    if (!existsSync(join(project.dir, candidate))) return candidate
    if (isOurs(join(project.dir, candidate))) {
      io.out(alreadySetUp(`${candidate}/`))
      return 0
    }
  }
  if (options.yes) {
    const taken = FOLDERS.map((name) => posix.join(base, name)).join(", ")
    io.err(`✗ ${taken} are all taken. Choose a folder with --dir.`)
    return 1
  }
  const folder = toPosix(
    await io.prompter.text("Where should email-kit's folder go?", posix.join(base, "mail")),
  )
  if (existsSync(join(project.dir, folder))) {
    io.err(`✗ ${folder} exists. email-kit never writes into a folder that isn't its own.`)
    return 1
  }
  return folder
}

/** What `init` will do: what it found, the files it creates, and the changes it asks about. */
function plan(
  project: Project,
  where: string,
  importPath: string,
  files: readonly NewFile[],
  changes: readonly Change[],
): string {
  return [
    "email-kit init",
    "",
    `  Project    ${where} (${project.packageManager}${project.tsconfig ? ", tsconfig.json" : ""})`,
    `  Code root  ${project.codeRoot || "."} (${project.codeRootReason})`,
    `  Imports    ${importPath} (${project.hostReason})`,
    "",
    "  Create",
    ...files.map((file) => `    ${file.path}`),
    ...(changes.length > 0
      ? ["", "  Change, if you agree", ...changes.map((c) => `    ${c.file}: ${c.summary}`)]
      : []),
    "",
  ].join("\n")
}

/**
 * Installs the dependencies `init` added. pnpm and Yarn freeze the lockfile in CI, so the install
 * is told it may change it, and it runs through a shell on Windows, where package managers are
 * `.cmd` shims. A failed install is reported, and `init` carries on.
 */
function install(project: Project, io: InitIo): void {
  const pm = project.packageManager
  io.out(`Installing with ${pm}…`)
  const result = spawnSync(pm, pm === "pnpm" ? ["install", "--no-frozen-lockfile"] : ["install"], {
    cwd: project.dir,
    stdio: "inherit",
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: "false" },
    shell: process.platform === "win32",
  })
  if (result.status !== 0) io.err(`! ${pm} install failed; run it, then \`email-kit compile\`.`)
}

/**
 * The closing message: how to render the welcome email, and the commands to run next, through
 * the scripts `init` added when it added them.
 */
function nextSteps(
  pm: PackageManager,
  importPath: string,
  scriptPrefix: string | undefined,
): string {
  const command = (task: "compile" | "check") =>
    scriptPrefix
      ? `${pm === "npm" || pm === "bun" ? `${pm} run` : pm} ${scriptPrefix}:${task}`
      : `${RUNNER[pm]} email-kit ${task}`
  return [
    "",
    "Done. Render the welcome email in your server code:",
    "",
    `  import { emails } from "${importPath}"`,
    "",
    '  const { subject, html, text } = emails.welcome.render({ name: "Ada", startUrl: "https://example.com/start" })',
    "",
    ...columns([
      [command("compile"), "after changing a template or message"],
      [command("check"), "the checks, for CI"],
      [`${RUNNER[pm]} email-kit new <id>`, "another template"],
    ]),
    "",
    "Docs: https://github.com/email-kit/email-kit#readme",
  ].join("\n")
}

/** Commands and their notes, with the notes lined up. */
function columns(rows: readonly [string, string][]): string[] {
  const width = Math.max(...rows.map(([command]) => command.length))
  return rows.map(([command, note]) => `  ${command.padEnd(width)}   ${note}`)
}

/** Whether a folder is email-kit's: its compiled/manifest.json carries email-kit's signature. */
function isOurs(folder: string): boolean {
  try {
    const manifest = JSON.parse(
      readFileSync(join(folder, "compiled/manifest.json"), "utf8"),
    ) as Record<string, unknown>
    return (
      typeof manifest.emailKit === "string" && String(manifest.dialect).startsWith("mustache-core")
    )
  } catch {
    return false
  }
}

/** The product name for the config, from the package name: `@acme/web-app` → `Web App`. */
function productName(project: Project): string {
  const name = String(project.packageJson.name ?? "Your product").replace(/^@[^/]+\//, "")
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}
