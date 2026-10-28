// Placeholder command runner for the `email-kit` CLI. The real commands (init,
// new, compile, check, dev, tokens) arrive in phase 1 (backlog P1-087, P1-169,
// P1-200, P1-211, P1-212).

export const VERSION = "0.0.0"

const HELP = `email-kit ${VERSION}

Type-safe email template compiler. This is a pre-release placeholder:
no commands are available yet.

Usage:
  email-kit --help       Show this help
  email-kit --version    Show the version

Docs: https://github.com/email-kit/email-kit`

export interface RunResult {
  code: number
  output: string
}

/** Runs the CLI with the given arguments (without `node` and the script path). */
export function run(args: readonly string[]): RunResult {
  const [first] = args
  if (first === "--version" || first === "-v") return { code: 0, output: VERSION }
  if (first === undefined || first === "--help" || first === "-h") return { code: 0, output: HELP }
  return {
    code: 1,
    output: `Unknown command "${first}". email-kit is a pre-release placeholder.\n\n${HELP}`,
  }
}
