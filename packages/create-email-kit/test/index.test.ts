import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import { cliPath } from "../src/cli-path.ts"

const ENTRY = fileURLToPath(new URL("../src/index.ts", import.meta.url))

/** Runs the package's entry point, as `npm create email-kit` does, with the sources as they are. */
function create(args: string[], cwd: string) {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", ENTRY, ...args],
    { cwd, encoding: "utf8" },
  )
}

/** Whether a folder or any folder above it has a package.json. */
function insideProject(dir: string): boolean {
  for (let current = dir; ; current = dirname(current)) {
    if (existsSync(join(current, "package.json"))) return true
    if (dirname(current) === current) return false
  }
}

const outside = mkdtempSync(join(tmpdir(), "create-email-kit-"))
afterAll(() => rmSync(outside, { recursive: true, force: true }))

describe("create-email-kit", () => {
  it("finds email-kit init in @email-kit/cli", () => {
    expect(existsSync(cliPath())).toBe(true)
    const help = execFileSync(process.execPath, [cliPath(), "init", "--help"], { encoding: "utf8" })
    expect(help).toContain("--no-install")
  })

  it("passes its flags to email-kit init", () => {
    const result = create(["--help"], outside)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("--no-install")
  })

  // Outside any project, init stops before it writes anything.
  it.skipIf(insideProject(outside))("exits with init's exit code", () => {
    const result = create(["--yes", "--no-install"], outside)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("No package.json")
  })
})
