// P1-100 (config), P1-102 (DTCG and variables inputs), P1-105–108 (type, space, radius, layout,
// buttons, dark), P1-110 (checks), P1-112 (theme.json) and P1-114 (`email-kit tokens`).

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import { compile, summarize } from "../../src/compiler/build.ts"
import { resolveConfig } from "../../src/compiler/config/index.ts"
import { run } from "../../src/run.ts"
import { readDtcg } from "../../src/theme/dtcg.ts"
import { loadTheme } from "../../src/theme/theme.ts"
import { validateTheme } from "../../src/theme/validate.ts"

const THEMES = fileURLToPath(new URL("../fixtures/themes/", import.meta.url))
const FIXTURE = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL("../.tmp/theme-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

const levels = (findings: ReturnType<typeof validateTheme>, level: string) =>
  findings.filter((f) => f.level === level).map((f) => f.id)

describe("the default theme", () => {
  const theme = loadTheme(undefined, THEMES)

  it("starts a project without errors or warnings", () => {
    const findings = validateTheme(theme)
    expect(levels(findings, "error")).toEqual([])
    expect(levels(findings, "warning")).toEqual([])
  })

  it("has the research 05 defaults", () => {
    expect(theme.typography.scale.body).toEqual({
      stack: "sans",
      sizePx: 16,
      lineHeightPx: 24,
      weight: 400,
      letterSpacingPx: 0,
    })
    expect(theme.typography.stacks.sans.families.at(-1)).toBe("sans-serif")
    expect(theme.typography.stacks.sans.msoFallback).toBe("Arial")
    expect(theme.typography.stacks.mono.msoFallback).toBe("Courier New")
    // shadcn's multiplicative radius scale on 10 px
    expect(theme.radius).toMatchObject({
      sm: 6,
      md: 8,
      lg: 10,
      xl: 14,
      full: 9999,
      button: 8,
      card: 10,
    })
    expect(theme.layout.container).toBe(600)
    expect(theme.dark).toBe("authored")
  })
})

describe("sources", () => {
  it("reads DTCG files per mode: colour spaces, aliases, $root, hex fallbacks", () => {
    const theme = loadTheme(
      { source: { light: "brand-light.tokens.json", dark: "brand-dark.tokens.json" } },
      THEMES,
    )
    expect(theme.source).toBe("brand-light.tokens.json + brand-dark.tokens.json")
    const { light, dark } = theme.roles
    expect(light.canvas).toBe("#ffffff")
    // `card` aliases `{color.background}`; `muted` is a `$root` aliasing `{brand.50}`
    expect(light.card).toBe("#ffffff")
    expect(light.muted).toBe("#f0f5ff")
    // the designer's hex fallback wins over converting display-p3
    expect(light["action.destructive.fill"]).toBe("#b91c1c")
    // radius 0.5rem → 8 px
    expect(theme.radius.lg).toBe(8)
    expect(dark?.hairline).toMatch(/^#[0-9a-f]{6}$/)
    expect(theme.roles.notes).toContainEqual(
      expect.objectContaining({ role: "hairline", mode: "dark", kind: "flattened" }),
    )
  })

  it("names DTCG tokens the way the shadcn mapping expects", () => {
    const { colours } = readDtcg(readFileSync(join(THEMES, "brand-light.tokens.json"), "utf8"))
    expect(Object.keys(colours)).toEqual(
      expect.arrayContaining([
        "brand-600",
        "background",
        "muted",
        "muted-foreground",
        "primary-foreground",
      ]),
    )
  })

  it("explains broken DTCG aliases", () => {
    expect(() =>
      readDtcg('{ "color": { "$type": "color", "a": { "$value": "{color.b}" } } }'),
    ).toThrow(/points at no token/)
    expect(() =>
      readDtcg(
        '{ "color": { "$type": "color", "a": { "$value": "{color.b}" }, "b": { "$value": "{color.a}" } } }',
      ),
    ).toThrow(/cycle/)
  })

  it("takes the variables inline, and shadcn CSS by path", () => {
    const inline = loadTheme(
      {
        source: {
          light: {
            background: "#ffffff",
            foreground: "#111111",
            card: "#ffffff",
            muted: "#f4f4f4",
            "muted-foreground": "#555555",
            primary: "#1d4ed8",
            "primary-foreground": "#ffffff",
            secondary: "#f4f4f4",
            "secondary-foreground": "#111111",
            destructive: "#991b1b",
            border: "#dddddd",
          },
        },
      },
      THEMES,
    )
    expect(inline.roles.light.link).toBe("#1d4ed8")
    expect(inline.roles.dark).toBeUndefined()
    expect(inline.dark).toBe("none")
    expect(loadTheme({ source: "shadcn-neutral.css" }, THEMES).roles.light.canvas).toBe("#ffffff")
  })

  it("resolves {token} references in role overrides", () => {
    const theme = loadTheme(
      { source: { light: "brand-light.tokens.json" }, roles: { link: "{brand.600}" } },
      THEMES,
    )
    expect(theme.roles.light.link).toBe(theme.roles.light["action.primary.fill"])
    expect(() =>
      loadTheme(
        { source: { light: "brand-light.tokens.json" }, roles: { link: "{brand.900}" } },
        THEMES,
      ),
    ).toThrow(expect.objectContaining({ code: "unresolved-role" }))
  })
})

describe("checks beyond colour", () => {
  it("reports font stacks, weights, sizes, button height, container", () => {
    const theme = loadTheme(
      {
        typography: {
          stacks: { serif: ["Georgia", "Times New Roman"] },
          scale: {
            caption: { sizePx: 12 },
            footer: { sizePx: 13 },
            h2: { weight: 600 },
            button: { lineHeightPx: 18 },
          },
        },
        layout: { container: 700 },
      },
      THEMES,
    )
    const findings = validateTheme(theme)
    expect(levels(findings, "error")).toEqual(
      expect.arrayContaining(["tokens.font-stack", "tokens.min-size", "tokens.button-height"]),
    )
    expect(levels(findings, "warning")).toEqual(
      expect.arrayContaining(["tokens.weights", "tokens.min-size", "tokens.container"]),
    )
    expect(findings.find((f) => f.id === "tokens.button-height")?.message).toBe(
      "The md button is 38px tall; touch targets need 44px",
    )
  })
})

function project(theme: string): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
  cpSync(join(THEMES, "shadcn-neutral.css"), join(dir, "app.css"))
  const config = join(dir, "email-kit.config.ts")
  writeFileSync(
    config,
    readFileSync(config, "utf8").replace("locales:", `theme: ${theme},\n  locales:`),
  )
  return dir
}

function capture(cwd: string) {
  const out: string[] = []
  const err: string[] = []
  return { io: { cwd, out: (t: string) => out.push(t), err: (t: string) => err.push(t) }, out, err }
}

describe("email-kit tokens", () => {
  it("prints the roles with contrast ratios and the findings, exit 0 without errors", async () => {
    const dir = project('{ source: "app.css" }')
    const { io, out } = capture(dir)
    expect(await run(["tokens"], io)).toBe(0)
    await expect(out.join("\n")).toMatchFileSnapshot(
      "../__golden__/theme/tokens-shadcn-neutral.txt",
    )
  })

  it("exits 1 when a check fails at error level", async () => {
    const dir = project('{ source: "app.css", roles: { link: "#cccccc" } }')
    const { io, out } = capture(dir)
    expect(await run(["tokens"], io)).toBe(1)
    expect(out.join("\n")).toContain(
      "✗ tokens.link-contrast (light): link #cccccc on canvas #ffffff",
    )
  })
})

describe("compile with a theme", () => {
  it("validates the theme, mentions findings in the summary, and writes theme.json when asked", async () => {
    const dir = project('{ source: "app.css", emit: true }')
    const result = await compile({ cwd: dir })
    expect(summarize(result)).toContain(
      "Theme: 0 errors, 4 warnings. Run `email-kit tokens` for details.",
    )
    const theme = JSON.parse(
      readFileSync(join(dir, "src", "email-kit", "compiled", "theme.json"), "utf8"),
    )
    expect(theme).toMatchObject({
      source: "app.css",
      dark: "authored",
      roles: { light: { canvas: "#ffffff" } },
    })
    expect(theme.files).toBeUndefined()
    const manifest = JSON.parse(
      readFileSync(join(dir, "src", "email-kit", "compiled", "manifest.json"), "utf8"),
    )
    expect(manifest.files).toContain("theme.json")
  })

  it("checks the theme config's names, with suggestions", () => {
    const file = join(FIXTURE, "email-kit.config.ts")
    expect(() =>
      resolveConfig(
        { theme: { sorce: "x.css", roles: { MutedInk: "#000" }, dark: "auto" } },
        { file, cacheDir: TMP },
      ),
    ).toThrow(
      [
        "  • theme.sorce: unknown option (known: source, input, roles, typography, radius, layout, dark, emit)",
        "  • theme.roles.MutedInk: unknown role (did you mean mutedInk?)",
        '  • theme.dark: must be "authored" or "none"',
      ].join("\n"),
    )
  })
})
