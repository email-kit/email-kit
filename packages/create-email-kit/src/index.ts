#!/usr/bin/env node
// `npm create email-kit` (P1-200, INIT-01): runs `email-kit init` from @email-kit/cli on the
// project it's run in, with the same flags (--yes, --dir, --config, --force, --no-install).

import { spawnSync } from "node:child_process"

import { cliPath } from "./cli-path.ts"

const result = spawnSync(process.execPath, [cliPath(), "init", ...process.argv.slice(2)], {
  stdio: "inherit",
})
process.exit(result.status ?? 1)
