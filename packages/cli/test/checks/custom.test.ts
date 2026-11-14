// Team checks from the config run beside the catalogue, with the same config,
// findings and reporters.

import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import type { Finding } from "../../src/checks/types.ts"
import { run } from "../../src/run.ts"

const FIXTURE = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL("../.tmp/custom-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

/** The fixture project with this config body after `defineConfig({ locales…, sender…,`. */
function project(extra: string): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
  writeFileSync(
    join(dir, "email-kit.config.ts"),
    `import { defineCheck, defineConfig } from "@email-kit/core"

const helpLink = defineCheck({
  id: "acme.help-link",
  level: "warn",
  rule: "Every email links to the help centre.",
  fix: "Add the footer's help link.",
  docs: "https://wiki.acme.test/email/help-link",
  run({ emails }, report) {
    for (const email of emails) {
      const links = email.elements("a").map((a) => a.attributes.href ?? "")
      if (!links.some((href) => href.startsWith("https://help.acme.test"))) {
        report({ email, message: "No link to https://help.acme.test" })
      }
    }
  },
})

const shopLink = defineCheck({
  id: "acme.no-shop-link",
  level: "error",
  rule: "Transactional mail doesn't send people to the shop.",
  fix: "Link to the order instead.",
  run({ emails }, report) {
    for (const email of emails) {
      for (const a of email.elements("a")) {
        if (a.text === "Visit our shop") report({ email, at: a.offset, message: "A link to the shop" })
      }
    }
  },
})

export default defineConfig({
  locales: { default: "en" },
  sender: { productName: "Shop Example", siteUrl: { runtime: true } },
  ${extra}
})
`,
  )
  return dir
}

async function check(dir: string): Promise<{ code: number; findings: Finding[]; err: string }> {
  const out: string[] = []
  const err: string[] = []
  const code = await run(["check", "--json"], {
    cwd: dir,
    out: (t) => out.push(t),
    err: (t) => err.push(t),
  })
  const json = out.length > 0 ? JSON.parse(out.join("\n")) : { findings: [] }
  return { code, findings: json.findings as Finding[], err: err.join("\n") }
}

describe("team checks", () => {
  it("run from the config, with locations, levels and their own docs", async () => {
    const { code, findings } = await check(project("customChecks: [helpLink, shopLink],"))
    const team = findings.filter((f) => f.id.startsWith("acme."))
    expect(team.map((f) => [f.id, f.level, f.subject.line !== undefined, f.docs])).toEqual([
      ["acme.help-link", "warn", false, "https://wiki.acme.test/email/help-link"],
      ["acme.no-shop-link", "error", true, ""],
    ])
    expect(team[1]?.subject).toMatchObject({
      template: "order-confirmation",
      locale: "en",
      column: expect.any(Number),
    })
    expect(code).toBe(1)
  })

  it("take levels from the checks config, like built-in ones", async () => {
    const { code, findings } = await check(
      project(
        'customChecks: [helpLink, shopLink],\n  checks: { "acme.no-shop-link": { level: "off", reason: "Promo pilot until March" } },',
      ),
    )
    expect(findings.map((f) => f.id)).not.toContain("acme.no-shop-link")
    expect(code).toBe(0)
  })

  it("can run on the renders, and see which fixture", async () => {
    const extra = `customChecks: [defineCheck({
    id: "acme.fixtures-seen",
    level: "info",
    on: "render",
    rule: "Lists the renders.",
    fix: "Nothing to fix.",
    run({ emails }, report) {
      report({ message: [...new Set(emails.map((e) => e.fixture))].join(", ") })
    },
  })],`
    const { findings } = await check(project(extra))
    expect(findings.find((f) => f.id === "acme.fixtures-seen")?.message).toBe(
      "default, generated empty, generated long, generated hostile",
    )
  })

  it("are validated: their own family, unique ids, a level, a rule, a fix and run()", async () => {
    const extra = `customChecks: [
    { id: "img.mine", level: "warn", rule: "r", fix: "f", run() {} },
    { id: "Acme", level: "loud", rule: "", fix: "f" },
    helpLink,
    helpLink,
  ],`
    const { code, err } = await check(project(extra))
    expect(code).toBe(1)
    expect(err).toContain(
      'customChecks[0].id: "img." is email-kit\'s; use your own family, such as "acme.mine"',
    )
    expect(err).toContain(
      'customChecks[1].id: must be "family.name" in lowercase, such as "acme.help-link"',
    )
    expect(err).toContain('customChecks[1].level: must be "error", "warn" or "info"')
    expect(err).toContain("customChecks[1].rule: must be a sentence")
    expect(err).toContain("customChecks[1].run: must be a function (context, report) => void")
    expect(err).toContain('customChecks[3].id: "acme.help-link" is defined twice')
  })

  it("fail the run, naming the check, when one throws", async () => {
    const extra = `customChecks: [defineCheck({
    id: "acme.broken",
    level: "error",
    rule: "r",
    fix: "f",
    run() {
      throw new Error("undefined is not a function")
    },
  })],`
    const { code, err } = await check(project(extra))
    expect(code).toBe(1)
    expect(err).toContain(
      "[check-failed] The team check acme.broken failed: undefined is not a function",
    )
  })
})
