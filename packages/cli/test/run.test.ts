import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it, vi } from "vitest"

import { run, VERSION } from "../src/run.ts"

const TMP = fileURLToPath(new URL(".tmp/run-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

function capture(cwd = process.cwd()) {
  const out: string[] = []
  const err: string[] = []
  return { io: { cwd, out: (t: string) => out.push(t), err: (t: string) => err.push(t) }, out, err }
}

describe("email-kit CLI", () => {
  it("prints the version", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const { io } = capture()
    expect(await run(["--version"], io)).toBe(0)
    expect(info.mock.calls[0]?.[0]).toContain(`email-kit/${VERSION}`)
    info.mockRestore()
  })

  it("prints help with no arguments", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const { io } = capture()
    expect(await run([], io)).toBe(0)
    expect(String(info.mock.calls[0]?.[0])).toContain("compile")
    info.mockRestore()
  })

  it("fails on an unknown command", async () => {
    const { io, err } = capture()
    expect(await run(["deploy"], io)).toBe(1)
    expect(err[0]).toContain('Unknown command "deploy"')
  })

  it("compiles a project, also as `generate`", async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "cli-"))
    cpSync(fileURLToPath(new URL("fixtures/project/", import.meta.url)), dir, {
      recursive: true,
      filter: (path) => !path.includes(`${sep}_generated`),
    })
    const first = capture(dir)
    expect(await run(["compile"], first.io)).toBe(0)
    expect(first.out[0]).toMatch(/^Compiled 1 template × 2 locales into src\/email-kit\/_generated/)

    const quiet = capture(dir)
    expect(await run(["generate", "--quiet"], quiet.io)).toBe(0)
    expect(quiet.out).toEqual([])
  })

  it("prints sizes and changed files with --verbose, and refuses --quiet --verbose", async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "verbose-"))
    cpSync(fileURLToPath(new URL("fixtures/project/", import.meta.url)), dir, {
      recursive: true,
      filter: (path) => !path.includes(`${sep}_generated`),
    })
    const verbose = capture(dir)
    expect(await run(["compile", "--verbose"], verbose.io)).toBe(0)
    const details = verbose.out[1] ?? ""
    expect(details).toMatch(/^ {2}order-confirmation {2}en {5}html \d+\.\d KB {2}text \d+\.\d KB$/m)
    expect(details).toMatch(/^ {22}de {5}html /m)
    expect(details).toContain("written: index.ts, messages.d.ts")

    const both = capture(dir)
    expect(await run(["compile", "--quiet", "--verbose"], both.io)).toBe(1)
    expect(both.err[0]).toBe("✗ --quiet and --verbose can't be used together")
  })

  it("reports a missing config with exit code 1", async () => {
    mkdirSync(TMP, { recursive: true })
    const { io, err } = capture(mkdtempSync(join(TMP, "none-")))
    expect(await run(["compile"], io)).toBe(1)
    expect(err[0]).toMatch(/^✗ \[config-not-found\] No email-kit.config.ts/)
  })
})
