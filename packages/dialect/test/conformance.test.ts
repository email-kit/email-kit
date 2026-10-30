// Runs the shared mustache-core conformance suite (R8) against the TS reference renderer. Every
// future runtime (Python, Go…) runs the same JSON files.

import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { DIALECT, MustacheCoreError, type Profile, render } from "../src/index.ts"

interface Case {
  name: string
  description?: string
  profile: Profile
  template: string
  data: unknown
  expected?: string
  error?: string
}

interface CaseFile {
  dialect: string
  name: string
  description: string
  cases: Case[]
}

const SUITE_DIR = fileURLToPath(new URL("../../../conformance/mustache-core/", import.meta.url))
const CASE_KEYS = new Set([
  "name",
  "description",
  "profile",
  "template",
  "data",
  "expected",
  "error",
])

const files: CaseFile[] = readdirSync(SUITE_DIR)
  .filter((file) => file.endsWith(".json") && !file.endsWith(".schema.json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(SUITE_DIR + file, "utf8")) as CaseFile)

describe("conformance suite", () => {
  it("has well-formed case files", () => {
    for (const file of files) {
      expect(file.dialect).toBe(DIALECT)
      const names = new Set<string>()
      for (const c of file.cases) {
        expect(Object.keys(c).filter((key) => !CASE_KEYS.has(key))).toEqual([])
        expect(["html", "text"]).toContain(c.profile)
        expect(typeof c.template).toBe("string")
        expect("data" in c).toBe(true)
        expect((c.expected === undefined) !== (c.error === undefined)).toBe(true)
        expect(names.has(c.name), `duplicate case "${c.name}" in ${file.name}`).toBe(false)
        names.add(c.name)
      }
    }
  })

  it("has at least 50 cases", () => {
    expect(files.flatMap((file) => file.cases).length).toBeGreaterThanOrEqual(50)
  })
})

for (const file of files) {
  describe(file.name, () => {
    for (const c of file.cases) {
      it(c.name, () => {
        if (c.error === undefined) {
          expect(render(c.template, c.data, c.profile)).toBe(c.expected)
        } else {
          const run = () => render(c.template, c.data, c.profile)
          expect(run).toThrow(MustacheCoreError)
          expect(run).toThrow(expect.objectContaining({ code: c.error }))
        }
      })
    }
  })
}
