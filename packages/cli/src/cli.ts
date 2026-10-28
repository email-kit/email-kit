#!/usr/bin/env node
import process from "node:process"

import { run } from "./run.ts"

const { code, output } = run(process.argv.slice(2))
if (code === 0) console.log(output)
else console.error(output)
process.exitCode = code
