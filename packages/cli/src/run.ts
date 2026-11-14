import { cac } from "cac"

import { CATALOGUE } from "./checks/catalogue/index.ts"
import { fromCustom } from "./checks/custom.ts"
import { compileFindings, contextOf, runChecks } from "./checks/engine.ts"
import { formatGithub, formatHuman, formatJson } from "./checks/report.ts"
import { buildProject, compile, describeResult, summarize } from "./compiler/build.ts"
import { loadConfig } from "./compiler/config/index.ts"
import { formatError } from "./compiler/problems/index.ts"
import { watchProject } from "./compiler/watch.ts"
import { init, type Prompter } from "./init/index.ts"
import { newTemplate } from "./init/new.ts"
import { terminalPrompter } from "./init/prompts.ts"
import { checkPermutations } from "./theme/check.ts"
import { formatTokens } from "./theme/report.ts"
import { loadTheme } from "./theme/theme.ts"
import { VERSION } from "./version.ts"

export { VERSION }

export interface Io {
  readonly cwd: string
  /** Whether error output uses ANSI colours. */
  readonly color?: boolean
  /** Answers `init`'s questions. Leave it out to ask in the terminal. */
  readonly prompter?: Prompter
  out(text: string): void
  err(text: string): void
}

/**
 * Runs the `email-kit` command with the given arguments, without `node` and the script path:
 * `compile` (or `generate`), `init`, `new`, `check` or `tokens`. Returns the exit code.
 */
export async function run(args: readonly string[], io: Io): Promise<number> {
  const cli = cac("email-kit")
  let pending: Promise<number> | undefined

  cli
    .command("compile", "Compile the templates into the output folder")
    .alias("generate")
    .option("--config <path>", "Use this config file instead of ./email-kit.config.ts")
    .option("--watch", "Recompile when a template, component, message or the config changes")
    .option("--quiet", "Print errors only")
    .option("--verbose", "Also print each template's sizes per locale, and the files that changed")
    .action((options: CompileFlags) => {
      pending = compileCommand(options, io)
    })
  cli
    .command("init", "Add email-kit to this project: a config, a folder and a welcome template")
    .option("--yes", "Accept every default without asking (for CI)")
    .option(
      "--dir <path>",
      "Put the email-kit folder in this code root instead of the detected one",
    )
    .option("--config <path>", "Name the config file something other than email-kit.config.ts")
    .option("--force", "Overwrite an existing config")
    .option("--no-install", "Don't run the package manager after adding the dependencies")
    .action((options: InitFlags) => {
      pending = initCommand(options, io)
    })
  cli
    .command("new <id>", "Add a template, with its messages in every locale and a fixture")
    .option("--config <path>", "Use this config file instead of ./email-kit.config.ts")
    .action((id: string, options: { config?: string }) => {
      pending = newTemplate(id, { cwd: io.cwd, config: options.config }).then(
        (text) => {
          io.out(text)
          return 0
        },
        (error: unknown) => {
          io.err(formatError(error, io))
          return 1
        },
      )
    })
  cli
    .command("check", "Compile in memory and run the checks; exits 1 on any error")
    .option("--config <path>", "Use this config file instead of ./email-kit.config.ts")
    .option("--json", "Print the findings as JSON (versioned schema)")
    .option("--reporter <name>", "human, json or github (annotations for GitHub Actions)")
    .action((options: CheckFlags) => {
      pending = checkCommand(options, io)
    })
  cli
    .command(
      "tokens",
      "Print the theme's colour roles per mode with contrast ratios, and its findings",
    )
    .option("--config <path>", "Use this config file instead of ./email-kit.config.ts")
    .action((options: { config?: string }) => {
      pending = tokensCommand(options, io)
    })
  cli.help()
  cli.version(VERSION)

  try {
    cli.parse(["node", "email-kit", ...args])
  } catch (error) {
    io.err(`✗ ${(error as Error).message}`)
    return 1
  }
  if (pending) return pending
  const [command] = cli.args
  if (command !== undefined) {
    io.err(`✗ Unknown command "${command}". Run \`email-kit --help\` for the commands.`)
    return 1
  }
  if (!cli.options.help && !cli.options.version) cli.outputHelp()
  return 0
}

interface CompileFlags {
  readonly config?: string
  readonly watch?: boolean
  readonly quiet?: boolean
  readonly verbose?: boolean
}

interface InitFlags {
  readonly yes?: boolean
  readonly dir?: string
  readonly config?: string
  readonly force?: boolean
  readonly install?: boolean
}

interface CheckFlags {
  readonly config?: string
  readonly json?: boolean
  readonly reporter?: string
}

const REPORTERS = { human: formatHuman, json: formatJson, github: formatGithub } as const

/**
 * `email-kit check`: compiles in memory, pseudo-locales included, and runs the built-in and custom
 * checks. Returns 1 if any finding is an error, 0 if there are only warnings and notes. A compile
 * that fails on a check the compiler enforces is reported as that check's findings.
 */
async function checkCommand(options: CheckFlags, io: Io): Promise<number> {
  const name = options.json ? "json" : (options.reporter ?? "human")
  if (!(name in REPORTERS)) {
    io.err(`✗ Unknown reporter "${name}" (known: ${Object.keys(REPORTERS).join(", ")})`)
    return 1
  }
  if (options.json && options.reporter && options.reporter !== "json") {
    io.err("✗ --json and --reporter can't be used together")
    return 1
  }
  try {
    const config = await loadConfig({ cwd: io.cwd, config: options.config })
    const project = await buildProject(config, { pseudo: true })
    const checks = [...CATALOGUE, ...config.customChecks.map(fromCustom)]
    const findings = runChecks(await contextOf(project), config.checks, checks)
    const output = REPORTERS[name as keyof typeof REPORTERS](findings)
    if (output) io.out(output)
    return findings.some((finding) => finding.level === "error") ? 1 : 0
  } catch (error) {
    const { findings, rest } = compileFindings(error)
    if (findings.length > 0) io.out(REPORTERS[name as keyof typeof REPORTERS](findings))
    for (const other of rest) io.err(formatError(other, io))
    return 1
  }
}

/**
 * `email-kit tokens`: prints the theme's colour roles with their contrast, and its findings.
 * Returns 1 if a `tokens.*` check fails at error level.
 */
async function tokensCommand(options: { config?: string }, io: Io): Promise<number> {
  try {
    const config = await loadConfig({ cwd: io.cwd, config: options.config })
    const theme = loadTheme(config.theme, config.dir)
    const findings = checkPermutations(theme, config.theme, config.dir)
    io.out(formatTokens(theme, findings))
    return findings.some((finding) => finding.level === "error") ? 1 : 0
  } catch (error) {
    io.err(formatError(error, io))
    return 1
  }
}

/** `email-kit init`: asks in the terminal unless `io` brings its own prompter. */
async function initCommand(options: InitFlags, io: Io): Promise<number> {
  try {
    return await init(
      { cwd: io.cwd, ...options },
      {
        out: io.out,
        err: io.err,
        prompter: io.prompter ?? terminalPrompter,
        ...(io.color !== undefined && { color: io.color }),
      },
    )
  } catch (error) {
    io.err(formatError(error, io))
    return 1
  }
}

/** `email-kit compile`: once, or on every change with `--watch` until Ctrl+C. */
async function compileCommand(options: CompileFlags, io: Io): Promise<number> {
  if (options.quiet && options.verbose) {
    io.err("✗ --quiet and --verbose can't be used together")
    return 1
  }
  const report = (result: Parameters<typeof summarize>[0]) => {
    if (options.quiet) return
    io.out(summarize(result))
    if (options.verbose) io.out(describeResult(result))
  }
  if (options.watch) {
    const watcher = await watchProject({
      cwd: io.cwd,
      config: options.config,
      onCompile: (outcome) => {
        if ("error" in outcome) io.err(formatError(outcome.error, io))
        else report(outcome.result)
      },
    })
    io.out("Watching for changes. Press Ctrl+C to stop.")
    await new Promise<void>((resolve) => {
      process.once("SIGINT", resolve)
      process.once("SIGTERM", resolve)
    })
    watcher.close()
    return 0
  }
  try {
    report(await compile({ cwd: io.cwd, config: options.config }))
    return 0
  } catch (error) {
    io.err(formatError(error, io))
    return 1
  }
}
