#!/usr/bin/env node
import process from "node:process"

import { run } from "./run.ts"

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  // https://no-color.org: any non-empty NO_COLOR turns colours off.
  color: process.stderr.isTTY === true && !process.env.NO_COLOR,
  out: (text) => console.log(text),
  err: (text) => console.error(text),
})
