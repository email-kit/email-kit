// The `email-kit` command runner (CLI-01, CLI-07, CLI-08): `compile` (alias `generate`), `check`
// and `tokens`; init, new and dev arrive with their milestones.

import { cac } from "cac"

import { contextOf, runChecks } from "./checks/engine.ts"
import { formatGithub, formatHuman, formatJson } from "./checks/report.ts"
import { buildProject, compile, describeResult, summarize } from "./compiler/build.ts"
import { loadConfig } from "./compiler/config.ts"
import { formatError } from "./compiler/problems.ts"
import { watchProject } from "./compiler/watch.ts"
import { checkPermutations } from "./theme/check.ts"
import { formatTokens } from "./theme/report.ts"
import { loadTheme } from "./theme/theme.ts"
import { VERSION } from "./version.ts"

export { VERSION }

export interface Io {
  readonly cwd: string
  /** ANSI colours in error output */
  readonly color?: boolean
  out(text: string): void
  err(text: string): void
}

/** Runs the CLI with the given arguments (without `node` and the script path). Returns the exit code. */
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

interface CheckFlags {
  readonly config?: string
  readonly json?: boolean
  readonly reporter?: string
}

const REPORTERS = { human: formatHuman, json: formatJson, github: formatGithub } as const

// P1-169, CLI-04: exits 1 on any error, 0 with warnings and notes only.
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
    const project = await buildProject(config)
    const findings = runChecks(await contextOf(project), config.checks)
    const output = REPORTERS[name as keyof typeof REPORTERS](findings)
    if (output) io.out(output)
    return findings.some((finding) => finding.level === "error") ? 1 : 0
  } catch (error) {
    io.err(formatError(error, io))
    return 1
  }
}

// P1-114, CLI-09: exits 1 when a tokens.* check fails at error level.
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
