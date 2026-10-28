import { describe, expect, it } from "vitest"

import { run, VERSION } from "../src/run.ts"

describe("email-kit CLI", () => {
  it("prints the version", () => {
    expect(run(["--version"])).toEqual({ code: 0, output: VERSION })
  })

  it("prints help with no arguments", () => {
    const result = run([])
    expect(result.code).toBe(0)
    expect(result.output).toContain("Usage:")
  })

  it("fails on an unknown command", () => {
    const result = run(["compile"])
    expect(result.code).toBe(1)
    expect(result.output).toContain('Unknown command "compile"')
  })
})
