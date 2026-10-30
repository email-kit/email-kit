// `email-kit init` (P1-200 to P1-210): adds email-kit to the project it runs in. It detects, shows
// every file it creates and every change it makes, asks before each change to an existing file,
// never writes into a folder or config that isn't ours, then compiles once and prints the next
// steps. `--yes` accepts the defaults.

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"

import { compileWithConfig, summarize } from "../compiler/build.ts"
import { loadConfig } from "../compiler/config.ts"
import { formatError } from "../compiler/problems.ts"
import { VERSION } from "../version.ts"
import { detectProject, findProject, type Project } from "./detect.ts"
import { insertProperty } from "./jsonc.ts"
import {
  configFile,
  type ImportStrategy,
  indexFile,
  WELCOME_MESSAGES,
  WELCOME_TEMPLATE,
} from "./scaffold.ts"

export interface Prompter {
  confirm(message: string, initial: boolean): Promise<boolean>
  text(message: string, initial: string): Promise<string>
}

export interface InitOptions {
  readonly cwd: string
  /** Accept every default without asking */
  readonly yes?: boolean
  /** The code root, instead of the detected one */
  readonly dir?: string
  /** The config file, instead of email-kit.config.ts */
  readonly config?: string
  /** Overwrite our own files */
  readonly force?: boolean
  /** Install the dependencies. Default: true */
  readonly install?: boolean
}

interface InitIo {
  out(text: string): void
  err(text: string): void
  readonly prompter: Prompter
  readonly color?: boolean
}

interface Change {
  readonly id: "dependencies" | "scripts" | "imports" | "jsx" | "paths" | "ignore"
  readonly file: string
  readonly summary: string
  apply(): void
}

const FOLDERS = ["email-kit", "email-templates", "emails"]
const SCRIPT_PREFIXES = ["email-kit", "emails", "ek"]

export async function init(options: InitOptions, io: InitIo): Promise<number> {
  const dir = findProject(options.cwd)
  const project = detectProject(dir, options.dir)
  const rel = (path: string) => relative(dir, path) || "."
  const ask = (message: string, initial = true) =>
    options.yes ? Promise.resolve(initial) : io.prompter.confirm(message, initial)

  // INIT-06: a config with our exact name is ours (already set up) or something else's (stop).
  const configName = options.config ?? "email-kit.config.ts"
  const configPath = join(dir, configName)
  if (existsSync(configPath) && !options.force) {
    if (readFileSync(configPath, "utf8").includes("@email-kit/core")) {
      io.out(
        `email-kit is already set up here (${configName}). Add a template with \`email-kit new <id>\`.`,
      )
      return 0
    }
    io.err(
      `✗ ${configName} exists and isn't an email-kit config. Rename it, or choose another name with --config <path>.`,
    )
    return 1
  }

  // The folder: the first free name in the code root. One that's ours means we're set up.
  const base = project.codeRoot
  let folder: string | undefined
  for (const name of FOLDERS) {
    const candidate = join(base, name)
    if (!existsSync(join(dir, candidate))) {
      folder = candidate
      break
    }
    if (isOurs(join(dir, candidate))) {
      io.out(
        `email-kit is already set up here (${candidate}/). Add a template with \`email-kit new <id>\`.`,
      )
      return 0
    }
  }
  if (!folder) {
    if (options.yes) {
      io.err(
        `✗ ${FOLDERS.map((n) => join(base, n)).join(", ")} are all taken. Choose a folder with --dir.`,
      )
      return 1
    }
    folder = await io.prompter.text("Where should email-kit's folder go?", join(base, "mail"))
    if (existsSync(join(dir, folder))) {
      io.err(`✗ ${folder} exists. email-kit never writes into a folder that isn't its own.`)
      return 1
    }
  }
  const name = folder.split("/").at(-1) as string

  const strategy = importStrategy(project, folder)
  const importPath =
    strategy.kind === "alias"
      ? strategy.path
      : strategy.kind === "subpath"
        ? "#email-kit"
        : `./${name}`
  const defaultRoot = existsSync(join(dir, "src")) ? "src/email-kit" : "email-kit"
  const theme =
    project.shadcnCss && (await ask(`Use the shadcn theme in ${project.shadcnCss} for the emails?`))
      ? project.shadcnCss
      : undefined

  const files = [
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
    { path: join(folder, "index.ts"), content: indexFile(strategy) },
    { path: join(folder, "templates/welcome.tsx"), content: WELCOME_TEMPLATE },
    { path: join(folder, "messages/en/welcome.json"), content: WELCOME_MESSAGES },
  ]
  const { changes, scriptPrefix } = plannedChanges(project, folder, strategy)

  io.out(
    [
      "email-kit init",
      "",
      `  Project    ${rel(dir)} (${project.packageManager}${project.tsconfig ? ", tsconfig.json" : ""})`,
      `  Code root  ${project.codeRoot || "."} (${project.codeRootReason})`,
      `  Imports    ${importPath} (${project.hostReason})`,
      "",
      "  Create",
      ...files.map((file) => `    ${file.path}`),
      ...(changes.length > 0
        ? ["", "  Change, if you agree", ...changes.map((c) => `    ${c.file}: ${c.summary}`)]
        : []),
      "",
    ].join("\n"),
  )
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

  const has = (id: Change["id"]) => applied.some((c) => c.id === id)
  if (has("dependencies") && options.install !== false) {
    io.out(`Installing with ${project.packageManager}…`)
    const result = spawnSync(project.packageManager, ["install"], { cwd: dir, stdio: "inherit" })
    if (result.status !== 0)
      io.err(`! ${project.packageManager} install failed; run it, then \`email-kit compile\`.`)
  }

  // INIT-11: the first compile, then how to use it.
  try {
    io.out(summarize(await compileWithConfig(await loadConfig({ cwd: dir, config: configName }))))
  } catch (error) {
    io.err(
      `! The first compile didn't run: install the dependencies, then run \`email-kit compile\`.`,
    )
    io.err(formatError(error, io))
  }
  const pm = project.packageManager
  const command = (task: "compile" | "check") =>
    has("scripts") && scriptPrefix
      ? `${pm === "npm" || pm === "bun" ? `${pm} run` : pm} ${scriptPrefix}:${task}`
      : `${{ npm: "npx", pnpm: "pnpm exec", yarn: "yarn", bun: "bunx" }[pm]} email-kit ${task}`
  io.out(
    [
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
        [
          `${{ npm: "npx", pnpm: "pnpm exec", yarn: "yarn", bun: "bunx" }[pm]} email-kit new <id>`,
          "another template",
        ],
      ]),
      "",
      "Docs: https://github.com/email-kit/email-kit#readme",
    ].join("\n"),
  )
  return 0
}

function columns(rows: readonly [string, string][]): string[] {
  const width = Math.max(...rows.map(([command]) => command.length))
  return rows.map(([command, note]) => `  ${command.padEnd(width)}   ${note}`)
}

/** ADR 0004: an alias where tsconfig paths work at runtime, subpath imports for tsc and Node. */
function importStrategy(project: Project, folder: string): ImportStrategy {
  const imports = project.packageJson.imports as Record<string, unknown> | undefined
  if (project.host === "bundler" && project.tsconfig) {
    const target = project.tsconfig.json.compilerOptions?.paths?.["@/*"]?.[0]
    const covers =
      target !== undefined &&
      target.replace(/^\.\/?/, "").replace(/\/?\*$/, "") === project.codeRoot
    // `@/*` already reaches the folder: use it; otherwise add one exact path (INIT-04).
    const name = folder.split("/").at(-1) as string
    return covers && folder === join(project.codeRoot, name)
      ? { kind: "alias", path: `@/${name}`, addPath: false }
      : { kind: "alias", path: "@/email-kit", addPath: true }
  }
  if ((project.host === "tsc" || project.host === "node-strip") && !imports?.["#email-kit"]) {
    return project.host === "tsc"
      ? { kind: "subpath", target: `./${folder}/compiled/index.mjs`, module: "mjs" }
      : { kind: "subpath", target: `./${folder}/index.ts`, module: "ts" }
  }
  return { kind: "relative" }
}

function plannedChanges(
  project: Project,
  folder: string,
  strategy: ImportStrategy,
): { changes: Change[]; scriptPrefix: string | undefined } {
  const { dir } = project
  const changes: Change[] = []
  const pkg = project.packageJson
  const deps = {
    ...(pkg.dependencies as object | undefined),
    ...(pkg.devDependencies as object | undefined),
  }
  const missing = [
    ...["@email-kit/cli", "@email-kit/core", "@email-kit/components"].filter((n) => !(n in deps)),
    ...("zod" in deps ? [] : ["zod"]),
  ]
  const editPackage = (edit: (json: Record<string, unknown>) => void) => () => {
    const file = join(dir, "package.json")
    const text = readFileSync(file, "utf8")
    const json = JSON.parse(text) as Record<string, unknown>
    edit(json)
    const indent = /^(\s+)"/m.exec(text)?.[1] ?? "  "
    writeFileSync(file, `${JSON.stringify(json, null, indent)}${text.endsWith("\n") ? "\n" : ""}`)
  }
  if (missing.length > 0) {
    changes.push({
      id: "dependencies",
      file: "package.json",
      summary: `add the devDependencies ${missing.join(", ")}`,
      apply: editPackage((json) => {
        const dev = { ...(json.devDependencies as Record<string, string> | undefined) }
        for (const name of missing) dev[name] = name === "zod" ? "^4" : `^${VERSION}`
        json.devDependencies = Object.fromEntries(
          Object.entries(dev).sort(([a], [b]) => a.localeCompare(b)),
        )
      }),
    })
  }
  // Scripts under the first prefix that's free, or already ours (INIT-06).
  const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
  const prefix = SCRIPT_PREFIXES.find((p) =>
    [
      [`${p}:compile`, "email-kit compile"],
      [`${p}:check`, "email-kit check"],
    ].every(
      ([script, command]) =>
        scripts[script as string] === undefined || scripts[script as string] === command,
    ),
  )
  if (prefix && !(scripts[`${prefix}:compile`] && scripts[`${prefix}:check`])) {
    changes.push({
      id: "scripts",
      file: "package.json",
      summary: `add the scripts ${prefix}:compile and ${prefix}:check`,
      apply: editPackage((json) => {
        json.scripts = {
          ...(json.scripts as object | undefined),
          [`${prefix}:compile`]: "email-kit compile",
          [`${prefix}:check`]: "email-kit check",
        }
      }),
    })
  }
  if (strategy.kind === "subpath") {
    changes.push({
      id: "imports",
      file: "package.json",
      summary: `add "imports": { "#email-kit": "${strategy.target}" } so the app imports #email-kit`,
      apply: editPackage((json) => {
        json.imports = { ...(json.imports as object | undefined), "#email-kit": strategy.target }
      }),
    })
  }
  const tsconfig = project.tsconfig
  if (tsconfig) {
    // One property added in the file's own style; comments and every other line stay.
    const editTsconfig = (path: string[], value: unknown) => () => {
      writeFileSync(tsconfig.file, insertProperty(readFileSync(tsconfig.file, "utf8"), path, value))
    }
    if (tsconfig.json.compilerOptions?.jsx === undefined) {
      changes.push({
        id: "jsx",
        file: "tsconfig.json",
        summary: 'add "jsx": "react-jsx" (templates name their JSX runtime themselves)',
        apply: editTsconfig(["compilerOptions", "jsx"], "react-jsx"),
      })
    }
    if (strategy.kind === "alias" && strategy.addPath) {
      changes.push({
        id: "paths",
        file: "tsconfig.json",
        summary: `add the path "@/email-kit": ["./${folder}"]`,
        apply: editTsconfig(["compilerOptions", "paths", "@/email-kit"], [`./${folder}`]),
      })
    }
  }
  const compiled = `${folder}/compiled`
  const appendLine = (file: string, line: string, summary: string, create: boolean) => {
    const path = join(dir, file)
    const text = existsSync(path) ? readFileSync(path, "utf8") : undefined
    if ((text === undefined && !create) || text?.split("\n").includes(line)) return
    changes.push({
      id: "ignore",
      file,
      summary,
      apply: () =>
        writeFileSync(path, `${text ?? ""}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`),
    })
  }
  appendLine(
    ".gitattributes",
    `${compiled}/** linguist-generated=true`,
    `mark ${compiled}/ as generated`,
    true,
  )
  appendLine(".prettierignore", `${compiled}/`, `ignore ${compiled}/`, false)
  appendLine(".eslintignore", `${compiled}/`, `ignore ${compiled}/`, false)
  return { changes, scriptPrefix: prefix }
}

/** A folder whose compiled/manifest.json carries our signature. */
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

function productName(project: Project): string {
  const name = String(project.packageJson.name ?? "Your product").replace(/^@[^/]+\//, "")
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}
