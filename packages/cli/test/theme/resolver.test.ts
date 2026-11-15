// DTCG Resolver Module 2025.10 sources, with every permutation checked.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import { run } from "../../src/run.ts"
import { checkPermutations } from "../../src/theme/check.ts"
import { checkInput, readResolver, resolveTokens } from "../../src/theme/source/resolver.ts"
import { loadTheme } from "../../src/theme/theme.ts"

const DIR = fileURLToPath(new URL("../fixtures/themes/resolver/", import.meta.url))
const TMP = fileURLToPath(new URL("../.tmp/resolver-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

const SOURCE = { source: "theme.resolver.json" }

describe("a resolver source", () => {
  const theme = loadTheme(SOURCE, DIR)

  it("takes light and dark from the modifier with those contexts, the brand from its default", () => {
    expect(theme.source).toBe("theme.resolver.json")
    expect(theme.roles.light["action.primary.fill"]).toBe("#1d4ed8")
    // Dark mode: the page ground from `background`, the canvas from `card`.
    expect(theme.roles.dark?.pageGround).toBe("#09090b")
    expect(theme.roles.dark?.canvas).toBe("#18181b")
    expect(theme.dark).toBe("authored")
  })

  it("resolves aliases after merging: light.tokens.json points at brands.json's tokens", () => {
    expect(theme.roles.light["action.secondary.fill"]).toBe("#eff6ff")
  })

  it("lets keys next to $ref override the referenced file, shallowly", () => {
    // base.tokens.json says 10 px; the set's source overrides it with 6 px.
    expect(theme.radius.lg).toBe(6)
  })

  it("lists every file it read, for --watch", () => {
    expect(theme.files.map((f) => f.slice(DIR.length)).sort()).toEqual([
      "base.tokens.json",
      "brands.json",
      "dark.tokens.json",
      "light.tokens.json",
      "theme.resolver.json",
    ])
  })

  it("picks other modifiers with theme.input, inline contexts included", () => {
    const pale = loadTheme({ ...SOURCE, input: { brand: "pale" } }, DIR)
    expect(pale.source).toBe("theme.resolver.json (brand=pale)")
    expect(pale.roles.light["action.primary.fill"]).toBe("#f5d90a")
    expect(pale.permutations).toEqual([{ brand: "acme" }])
    expect(theme.permutations).toEqual([{ brand: "pale" }])
  })

  it("checks the permutations that aren't selected, and labels what fails there", () => {
    const findings = checkPermutations(theme, SOURCE, DIR)
    const pale = findings.filter((f) => f.permutation === "brand=pale")
    expect(pale.length).toBeGreaterThan(0)
    expect(pale.some((f) => f.level === "error" && f.message.includes("#f5d90a"))).toBe(true)
    // Findings the selected theme already has aren't repeated per permutation.
    const selected = findings.filter((f) => f.permutation === undefined).map((f) => f.message)
    expect(pale.filter((f) => selected.includes(f.message))).toEqual([])
  })
})

describe("email-kit tokens with a resolver", () => {
  it("reports a failing brand that isn't selected, and exits 1", async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "project-"))
    const fixture = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
    cpSync(fixture, dir, { recursive: true, filter: (path) => !path.includes(`${sep}_generated`) })
    cpSync(DIR, join(dir, "tokens"), { recursive: true })
    const config = join(dir, "email-kit.config.ts")
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace(
        "locales:",
        'theme: { source: "tokens/theme.resolver.json" },\n  locales:',
      ),
    )
    const out: string[] = []
    const io = { cwd: dir, out: (t: string) => out.push(t), err: () => {} }
    expect(await run(["tokens"], io)).toBe(1)
    const report = out.join("\n")
    expect(report).toContain("Theme: tokens/theme.resolver.json (dark: authored)")
    expect(report).toMatch(/✗ tokens\.[a-z-]+ \(brand=pale, light\): .*#f5d90a/)
  })
})

describe("inputs", () => {
  const resolver = readResolver(join(DIR, "theme.resolver.json"), "theme.resolver.json")

  it("fills defaults and matches modifier names case-insensitively", () => {
    expect(checkInput(resolver, { Brand: "pale" })).toEqual({ brand: "pale", theme: "light" })
  })

  it("reports every problem at once", () => {
    expect(() => checkInput(resolver, { brand: "nope", size: "xl", theme: 1 })).toThrow(
      'theme.resolver.json: brand has no context "nope" (known: acme, pale); "size" isn\'t a modifier (known: brand, theme); theme must be a context name, not 1',
    )
  })

  it("loads only the selected context's sources", () => {
    const { files } = resolveTokens(resolver, { brand: "pale" })
    expect(files.some((f) => f.endsWith("brands.json"))).toBe(false)
  })

  it("rejects input for a non-resolver source, and for the light/dark modifier", () => {
    expect(() =>
      loadTheme({ source: { light: "../brand-light.tokens.json" }, input: { brand: "x" } }, DIR),
    ).toThrow("theme.input only applies to a .resolver.json source")
    expect(() => loadTheme({ ...SOURCE, input: { theme: "dark" } }, DIR)).toThrow(
      "theme.input.theme: email-kit resolves both light and dark; leave it out",
    )
  })
})

describe("documents the spec requires tools to reject", () => {
  let n = 0
  const write = (document: object, extra: Record<string, object> = {}) => {
    const dir = join(TMP, String(n++))
    mkdirSync(dir, { recursive: true })
    for (const [name, content] of Object.entries(extra))
      writeFileSync(join(dir, name), JSON.stringify(content))
    writeFileSync(join(dir, "t.resolver.json"), JSON.stringify({ version: "2025.10", ...document }))
    return join(dir, "t.resolver.json")
  }
  const load = (file: string) => resolveTokens(readResolver(file, "t.resolver.json"), {})
  const theme = (contexts: object, extra: object = {}) => ({
    modifiers: { theme: { contexts, ...extra } },
    resolutionOrder: [{ $ref: "#/modifiers/theme" }],
  })

  it.each([
    [
      "a missing or unknown version",
      { version: "1.0", resolutionOrder: [] },
      'version must be "2025.10"',
    ],
    ["a modifier with no contexts", theme({}), "needs at least two contexts, found 0"],
    ["a modifier with one context", theme({ light: [] }), "needs at least two contexts, found 1"],
    [
      "a default that isn't a context",
      theme({ light: [], dark: [] }, { default: "dim" }),
      'default "dim" isn\'t one of its contexts',
    ],
    [
      "a pointer at nothing",
      { resolutionOrder: [{ $ref: "#/sets/missing" }] },
      '"#/sets/missing" points at nothing',
    ],
    [
      "a pointer into resolutionOrder",
      { resolutionOrder: [{ $ref: "#/resolutionOrder/0" }] },
      "must point at #/sets/<name> or #/modifiers/<name>",
    ],
    [
      "a set without sources",
      { sets: { a: {} }, resolutionOrder: [{ $ref: "#/sets/a" }] },
      "a has no sources array",
    ],
    [
      "an inline entry without a type",
      { resolutionOrder: [{ name: "x", sources: [] }] },
      "needs a name and a type",
    ],
    [
      "duplicate inline names",
      {
        resolutionOrder: [
          { name: "x", type: "set", sources: [] },
          { name: "x", type: "set", sources: [] },
        ],
      },
      'the name "x" appears twice',
    ],
  ])("%s", (_, document, message) => {
    expect(() => readResolver(write(document), "t.resolver.json")).toThrow(message)
  })

  it("a set pointing at a modifier", () => {
    const file = write({
      sets: { a: { sources: [{ $ref: "#/modifiers/theme" }] } },
      ...theme({ light: [], dark: [] }, { default: "light" }),
      resolutionOrder: [{ $ref: "#/sets/a" }],
    })
    expect(() => load(file)).toThrow("only resolutionOrder can point at a modifier")
  })

  it("a cycle between sets", () => {
    const file = write({
      sets: { a: { sources: [{ $ref: "#/sets/b" }] }, b: { sources: [{ $ref: "#/sets/a" }] } },
      resolutionOrder: [{ $ref: "#/sets/a" }],
    })
    expect(() => load(file)).toThrow(/is a cycle/)
  })

  it("lets a later source replace a token whole, and merges groups key by key", () => {
    const file = write(
      {
        sets: {
          a: {
            sources: [
              { $ref: "one.json" },
              { color: { $type: "color", b: { $value: "#000000" } } },
            ],
          },
        },
        resolutionOrder: [
          { $ref: "#/sets/a" },
          { name: "late", type: "set", sources: [{ color: { a: { $value: "#222222" } } }] },
        ],
      },
      {
        "one.json": { color: { $type: "color", a: { $value: "#111111", $description: "first" } } },
      },
    )
    const { document } = load(file)
    expect(document.color).toEqual({
      $type: "color",
      a: { $value: "#222222" },
      b: { $value: "#000000" },
    })
  })
})
