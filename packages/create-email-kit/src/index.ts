#!/usr/bin/env node
/**
 * `npm create email-kit`: runs `email-kit init` from @email-kit/cli in the folder it's run in,
 * with the same flags (`--yes`, `--dir`, `--config`, `--force`, `--no-install`), and exits as it
 * does.
 *
 * The CLI's only public entry point is its command, so this runs it in a child process, with the
 * terminal passed through for `init`'s questions. A CLI that can't be started is reported, and
 * when `init` is stopped by a signal, this process stops with the same signal, so the shell sees
 * it was interrupted.
 */

import { spawnSync } from "node:child_process"

import { cliPath } from "./cli-path.ts"

/** Runs `email-kit init` and gives its exit code, or stops with the signal that stopped it. */
function main(): number {
  let cli: string
  try {
    cli = cliPath()
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`)
    return 1
  }
  const result = spawnSync(process.execPath, [cli, "init", ...process.argv.slice(2)], {
    stdio: "inherit",
  })
  if (result.error) {
    console.error(`✗ create-email-kit couldn't start email-kit init: ${result.error.message}`)
    return 1
  }
  if (result.signal) process.kill(process.pid, result.signal)
  return result.status ?? 1
}

process.exit(main())
