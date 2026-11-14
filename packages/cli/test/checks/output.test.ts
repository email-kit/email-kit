// output.* (Appendix A.12) and the checks the compiler enforces, reported by `email-kit check`.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import { CATALOGUE } from "../../src/checks/catalogue/index.ts"
import { contextOf } from "../../src/checks/context.ts"
import { runChecks } from "../../src/checks/engine.ts"
import type { CheckContext, Finding } from "../../src/checks/types.ts"
import { buildProject, compile } from "../../src/compiler/build.ts"
import { loadConfig } from "../../src/compiler/config/index.ts"
import { run } from "../../src/run.ts"

const FIXTURE = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL("../.tmp/output-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

const OUT = "src/email-kit/compiled"
const OUTPUT_CHECKS = CATALOGUE.filter((c) => c.id.startsWith("output."))

async function compiledProject(): Promise<string> {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
  await compile({ cwd: dir })
  return dir
}

/** The output checks, with the folder treated as committed (this repo ignores test/.tmp). */
async function outputFindings(dir: string, gitignored = false): Promise<string[]> {
  const context: CheckContext = await contextOf(await buildProject(await loadConfig({ cwd: dir })))
  return runChecks({ ...context, output: { ...context.output, gitignored } }, {}, OUTPUT_CHECKS)
    .filter((f) => f.id.startsWith("output."))
    .map((f) => `${f.id}: ${f.message}`)
}

describe("output.*", () => {
  it("passes on a fresh compile", async () => {
    expect(await outputFindings(await compiledProject())).toEqual([])
  })

  it("output.module-matches: reads the escapes of an .mjs module (\\xA0)", async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "project-"))
    cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
    const config = join(dir, "email-kit.config.ts")
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace("defineConfig({", 'defineConfig({\n  module: "mjs",'),
    )
    // A non-breaking space, which oxc prints as \xA0 (JSON has no \x escapes).
    const messages = join(dir, "src/email-kit/messages/en/order-confirmation.json")
    writeFileSync(
      messages,
      readFileSync(messages, "utf8").replace('"Thanks, {name}!"', '"Thanks,\\u00a0{name}!"'),
    )
    await compile({ cwd: dir })
    expect(readFileSync(join(dir, OUT, "index.mjs"), "utf8")).toContain("\\xA0")
    expect(await outputFindings(dir)).toEqual([])
  })

  it("output.drift: a template changed since the compile", async () => {
    const dir = await compiledProject()
    const messages = join(dir, "src/email-kit/messages/en/order-confirmation.json")
    writeFileSync(
      messages,
      readFileSync(messages, "utf8").replace("View your order", "See your order"),
    )
    expect(await outputFindings(dir)).toEqual([
      "output.drift: index.ts differs from a fresh compile",
      "output.drift: manifest.json differs from a fresh compile",
      // The typed t() quotes each message in its doc comment.
      "output.drift: messages.d.ts differs from a fresh compile",
      "output.drift: order-confirmation/en.html differs from a fresh compile",
      "output.drift: order-confirmation/en.txt differs from a fresh compile",
    ])
  })

  it("output.manifest and output.module-matches: a compiled file edited by hand", async () => {
    const dir = await compiledProject()
    const html = join(dir, OUT, "order-confirmation/de.html")
    writeFileSync(html, readFileSync(html, "utf8").replace("Danke", "Vielen Dank"))
    const found = await outputFindings(dir)
    expect(found).toContain(
      "output.manifest: order-confirmation/de.html was changed after it was compiled",
    )
    expect(found).toContain(
      "output.module-matches: The module's copy of order-confirmation/de.html differs from the file",
    )
  })

  it("output.no-orphans: compiled output with no template", async () => {
    const dir = await compiledProject()
    mkdirSync(join(dir, OUT, "old-promo"))
    writeFileSync(join(dir, OUT, "old-promo/schema.json"), "{}")
    expect(await outputFindings(dir)).toEqual([
      "output.no-orphans: old-promo/ is compiled output with no template",
    ])
  })

  it("output.drift: never compiled; output.gitignored instead when git ignores it", async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "project-"))
    cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
    expect(await outputFindings(dir)).toEqual([`output.drift: ${OUT} hasn't been compiled`])
    expect(await outputFindings(dir, true)).toEqual([`output.gitignored: git ignores ${OUT}`])
  })
})

describe("checks the compiler enforces", () => {
  it("are reported by email-kit check as findings, with the location", async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "project-"))
    cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
    const messages = join(dir, "src/email-kit/messages/de/order-confirmation.json")
    const json = JSON.parse(readFileSync(messages, "utf8"))
    delete json.view
    writeFileSync(messages, JSON.stringify(json))
    const out: string[] = []
    const code = await run(["check", "--json"], {
      cwd: dir,
      out: (t) => out.push(t),
      err: () => {},
    })
    expect(code).toBe(1)
    const [finding] = JSON.parse(out.join("\n")).findings as Finding[]
    expect(finding).toMatchObject({
      id: "i18n.missing-keys",
      level: "error",
      subject: { file: "src/email-kit/templates/order-confirmation.tsx", line: expect.any(Number) },
      message: expect.stringContaining('Locale "de" has no message "view"'),
    })
  })
})
