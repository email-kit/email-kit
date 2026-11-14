// Fixture validation, generated variants and the fixture sweep, with the checks that run on
// renders: size.gmail and copy.placeholder-fallbacks.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { CATALOGUE } from "../../src/checks/catalogue/index.ts"
import { contextOf } from "../../src/checks/context.ts"
import { runChecks } from "../../src/checks/engine.ts"
import { parseEmail } from "../../src/checks/parse.ts"
import type { CheckContext, CheckedEmail, Finding } from "../../src/checks/types.ts"
import { buildProject, compile } from "../../src/compiler/build.ts"
import { loadConfig } from "../../src/compiler/config/index.ts"
import { fixturesWithVariants, generate, validateFixtures } from "../../src/compiler/fixtures.ts"
import type { Field } from "../../src/compiler/schema/index.ts"
import { run } from "../../src/run.ts"

const FIXTURE = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL("../.tmp/sweep-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

function project(edit: (template: string) => string): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
  const file = join(dir, "src/email-kit/templates/order-confirmation.tsx")
  writeFileSync(file, edit(readFileSync(file, "utf8")))
  return dir
}

const str = (extra: Partial<Field> = {}): Field => ({ type: "string", nullable: false, ...extra })
const model: Field = {
  type: "object",
  nullable: false,
  properties: [
    { name: "name", required: true, field: str({ constraints: { minLength: 1, maxLength: 40 } }) },
    { name: "note", required: false, field: str() },
    { name: "tier", required: true, field: str({ enum: ["gold", "platinum"] }) },
    { name: "code", required: true, field: str({ constraints: { pattern: "^[A-Z]{3}$" } }) },
    { name: "hero", required: true, field: str({ url: true }) },
    { name: "middle", required: true, field: { ...str(), nullable: true } },
    {
      name: "items",
      required: true,
      field: { type: "array", nullable: false, constraints: { maxItems: 3 }, items: str() },
    },
  ],
}
const base = {
  name: "Ada",
  tier: "gold",
  code: "ABC",
  hero: "https://cdn.test/hero.png",
  middle: "B",
  items: ["Tea"],
}

describe("generated variants", () => {
  it("empty: optional fields out, strings at their minimum, nullable null, lists empty", () => {
    expect(generate(model, base, "empty")).toEqual({
      name: "x",
      tier: "gold",
      code: "ABC",
      hero: "https://cdn.test/hero.png",
      middle: null,
      items: [],
    })
  })

  it("long: every field, strings to their maximum, the longest enum value, lists full", () => {
    const long = generate(model, base, "long") as Record<string, unknown>
    expect((long.name as string).length).toBe(40)
    expect((long.note as string).length).toBeGreaterThan(100)
    expect(long.tier).toBe("platinum")
    // A pattern can't be satisfied blindly: the fixture's value stays.
    expect(long.code).toBe("ABC")
    expect(long.hero).toMatch(/^https:\/\/cdn\.test\/hero\.png\?utm_campaign=w+$/)
    expect(long.items).toHaveLength(3)
  })

  it("hostile: markup, quotes and mustache tags, appended to URLs so their path stays", () => {
    const hostile = generate(model, base, "hostile") as Record<string, unknown>
    expect(hostile.note).toContain('<script>alert("x")</script>')
    expect(hostile.note).toContain("{{name}}")
    expect(hostile.hero).toBe('https://cdn.test/hero.png?q=<script>&x="y"&z={{name}}')
  })

  it("cuts text to maxLength in UTF-16 units without splitting the emoji", () => {
    const length = '<script>alert("x")</script> & "q" \'a\' {{name}} {{{raw}}} \u202eevil\u202c '
      .length
    for (const max of [length + 1, length + 2]) {
      const value = generate(str({ constraints: { maxLength: max } }), undefined, "hostile")
      expect((value as string).length).toBeLessThanOrEqual(max)
      expect(value).not.toMatch(/[\ud800-\udbff]$/)
    }
  })

  it("long: a list keeps at least minItems, even past the usual 25", () => {
    const list: Field = {
      type: "array",
      nullable: false,
      constraints: { minItems: 30 },
      items: str(),
    }
    expect(generate(list, ["Tea"], "long")).toHaveLength(30)
  })

  it("keeps only the variants the schema accepts", async () => {
    const schema = z.object({ name: z.string().regex(/^[A-Z][a-z]+$/), qty: z.number() })
    const field: Field = {
      type: "object",
      nullable: false,
      properties: [
        { name: "name", required: true, field: str() },
        { name: "qty", required: true, field: { type: "number", nullable: false } },
      ],
    }
    // The regex isn't in this model, so every generated name fails it: only the fixture stays.
    const fixtures = await fixturesWithVariants(schema, field, { default: { name: "Ada", qty: 1 } })
    expect(fixtures.map((f) => f.name)).toEqual(["default"])
  })
})

describe("fixture validation", () => {
  it("fails with every issue and its path", async () => {
    const schema = z.object({ items: z.array(z.object({ qty: z.number() })) })
    await expect(
      validateFixtures(schema, { ok: { items: [] }, bad: { items: [{ qty: "2" }] } }, "receipt"),
    ).rejects.toThrow(/^receipt: a fixture doesn't match the schema:\n {2}• bad\.items\[0\]\.qty: /)
  })

  it("fails the compile on an invalid fixture", async () => {
    const dir = project((t) => t.replace('orderNumber: "A-1042"', "orderNumber: 1042"))
    const error = await compile({ cwd: dir }).catch((e: unknown) => e)
    expect((error as { problems: { code: string; message: string }[] }).problems).toEqual([
      expect.objectContaining({
        code: "invalid-fixture",
        message: expect.stringContaining("• default.orderNumber: "),
      }),
    ])
  })
})

describe("the fixture sweep", () => {
  let context: CheckContext
  beforeAll(async () => {
    context = await contextOf(await buildProject(await loadConfig({ cwd: FIXTURE })))
  })

  it("renders each locale with the fixture and every accepted variant", () => {
    const names = [...new Set(context.rendered.map((e) => e.fixture))]
    expect(names).toEqual(["default", "generated empty", "generated long", "generated hostile"])
    expect(context.rendered).toHaveLength(8)
    const long = context.rendered.find((e) => e.fixture === "generated long" && e.locale === "en")
    expect(long?.html.split("<li ").length).toBe(26)
  })

  it("keeps hostile data escaped: no markup reaches the HTML", () => {
    const hostile = context.rendered.find((e) => e.fixture === "generated hostile")
    expect(hostile?.html).toContain("&lt;script&gt;")
    expect(runChecks(context).filter((f) => f.id === "html.no-forms-embeds")).toEqual([])
  })

  it("reports a value that breaks only with data, naming the fixture", async () => {
    const dir = project((t) =>
      t.replace("customerName: z.string().min(1)", "customerName: z.string()"),
    )
    const out: string[] = []
    const io = { cwd: dir, out: (t: string) => out.push(t), err: () => {} }
    expect(await run(["check", "--json"], io)).toBe(1)
    const findings = (JSON.parse(out.join("\n")).findings as Finding[]).filter(
      (f) => f.id === "copy.placeholder-fallbacks",
    )
    expect(findings.map((f) => [f.subject.locale, f.subject.fixture, f.message])).toEqual([
      ["en", "generated empty", "The text has punctuation with nothing between: “Thanks, !”"],
      ["de", "generated empty", "The text has punctuation with nothing between: “Danke, !”"],
    ])
    expect(findings[0]?.subject.line).toBeUndefined()
  })
})

describe("checks on renders", () => {
  const email = (html: string, extra: Partial<CheckedEmail> = {}): CheckedEmail => ({
    template: "welcome",
    locale: "en",
    file: "out/welcome/en.html",
    subject: "Welcome",
    preheader: "Your account is ready",
    html,
    text: "",
    parsed: parseEmail(html),
    fixture: "default",
    ...extra,
  })
  const only = (rendered: CheckedEmail[]): CheckContext => ({
    emails: [],
    rendered,
    pseudo: [],
    pseudoErrors: [],
    messages: [],
    output: { dir: "out", absolute: "/nowhere", expected: [], gitignored: true },
    templates: [],
    sources: [],
    theme: undefined as never,
    themeFindings: [],
    outlookClassic: true,
    themeFile: undefined,
  })
  // Contexts made up here have no output folder: leave output.* to its own tests.
  const runRendered = (context: CheckContext) =>
    runChecks(
      context,
      {},
      CATALOGUE.filter((c) => !c.id.startsWith("output.")),
    )
  const ids = (findings: Finding[]) =>
    findings.map((f) => `${f.id} ${f.level} ${f.subject.fixture}`)

  it("size.gmail: the largest render per template and locale", () => {
    const small = email("<p>hi</p>")
    const big = email(`<p>${"x".repeat(100 * 1024)}</p>`, { fixture: "generated long" })
    const near = email(`<p>${"x".repeat(86 * 1024)}</p>`, {
      locale: "de",
      fixture: "generated long",
    })
    expect(ids(runRendered(only([small, big, near])))).toEqual([
      "size.gmail error generated long",
      "size.gmail warn generated long",
    ])
  })

  it.each([
    ["Hi , welcome", "a space before a comma"],
    ["Order  confirmed", "two spaces in a row"],
    ["Your plan ()", "empty brackets"],
  ])("copy.placeholder-fallbacks: %s", (text, what) => {
    const [finding] = runRendered(only([email("<p></p>", { text })]))
    expect(finding?.message).toContain(what)
  })

  it("preheader.length and subject.length: on renders of the project's own fixtures only", () => {
    const long = email("<p></p>", { subject: "S".repeat(61), preheader: "P".repeat(91) })
    const none = email("<p></p>", { preheader: "", locale: "de" })
    const generated = email("<p></p>", { subject: "S".repeat(200), fixture: "generated long" })
    expect(runRendered(only([long, none, generated])).map((f) => `${f.id}: ${f.message}`)).toEqual([
      "preheader.length: The preheader is 91 characters",
      "preheader.length: There's no preheader",
      "subject.length: The subject is 61 characters",
    ])
  })

  it("checks data-driven image URLs once rendered", () => {
    const rendered = email(
      '<img src="https://cdn.test/hero.webp" alt="" width="600" height="300">',
      {
        fixture: "generated long",
      },
    )
    const [finding] = runRendered(only([rendered]))
    expect([finding?.id, finding?.subject.fixture, finding?.subject.line]).toEqual([
      "img.format",
      "generated long",
      undefined,
    ])
  })
})
