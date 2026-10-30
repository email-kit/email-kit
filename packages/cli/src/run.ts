// The `email-kit` command runner (CLI-01, CLI-07, CLI-08). M1.1 has `compile` (alias `generate`);
// init, new, check, dev and tokens arrive with their milestones.

import { cac } from "cac"

import { compile, summarize } from "./compiler/build.ts"
import { formatError } from "./compiler/problems.ts"
import { watchProject } from "./compiler/watch.ts"
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
    .action((options: CompileFlags) => {
      pending = compileCommand(options, io)
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
}

async function compileCommand(options: CompileFlags, io: Io): Promise<number> {
  if (options.watch) {
    const watcher = await watchProject({
      cwd: io.cwd,
      config: options.config,
      onCompile: (outcome) => {
        if ("error" in outcome) io.err(formatError(outcome.error, io))
        else if (!options.quiet) io.out(summarize(outcome.result))
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
    const result = await compile({ cwd: io.cwd, config: options.config })
    if (!options.quiet) io.out(summarize(result))
    return 0
  } catch (error) {
    io.err(formatError(error, io))
    return 1
  }
}
