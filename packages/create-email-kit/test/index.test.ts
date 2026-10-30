import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { cliPath } from "../src/cli-path.ts"

describe("create-email-kit", () => {
  it("runs email-kit init from @email-kit/cli", () => {
    expect(existsSync(cliPath())).toBe(true)
    const help = execFileSync(process.execPath, [cliPath(), "init", "--help"], { encoding: "utf8" })
    expect(help).toContain("--no-install")
  })
})
