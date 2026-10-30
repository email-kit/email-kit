// The `email-kit` command runner (CLI-01, CLI-07, CLI-08). M1.1 has `compile` (alias `generate`);
// init, new, check, dev and tokens arrive with their milestones.

import { EmailKitError } from "@email-kit/core/internal"
import { cac } from "cac"

import { compile, summarize } from "./compiler/build.ts"
import { CompileError } from "./compiler/project.ts"
import { VERSION } from "./version.ts"

export { VERSION }

export interface Io {
  readonly cwd: string
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
    .option("--quiet", "Print errors only")
    .action((options: { config?: string; quiet?: boolean }) => {
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

async function compileCommand(
  options: { config?: string; quiet?: boolean },
  io: Io,
): Promise<number> {
  try {
    const result = await compile({ cwd: io.cwd, config: options.config })
    if (!options.quiet) io.out(summarize(result))
    return 0
  } catch (error) {
    io.err(formatError(error))
    return 1
  }
}

// Each problem: where, the error id, and the message (CLI-06; code frames and docs URLs follow).
export function formatError(error: unknown): string {
  if (error instanceof CompileError) {
    const lines = error.problems.map((p) => `✗ ${p.file} [${p.code}]\n${indent(p.message)}`)
    const n = error.problems.length
    return `${lines.join("\n\n")}\n\n${n} ${n === 1 ? "problem" : "problems"}; nothing was written.`
  }
  if (error instanceof EmailKitError) return `✗ [${error.code}] ${error.message}`
  return `✗ ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")
}
