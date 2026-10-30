import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { readShadcnCss } from "../../src/theme/shadcn.ts"

const neutral = readFileSync(
  fileURLToPath(new URL("../fixtures/themes/shadcn-neutral.css", import.meta.url)),
  "utf8",
)

describe("readShadcnCss", () => {
  it("reads :root and .dark, skipping @theme inline", () => {
    const theme = readShadcnCss(neutral)
    expect(theme.light.primary).toBe("oklch(0.205 0 0)")
    expect(theme.dark?.primary).toBe("oklch(0.922 0 0)")
    expect(theme.light["color-primary"]).toBeUndefined()
    expect(theme.radiusPx).toBe(10)
  })

  it("lets .dark inherit what it doesn't set, as the cascade does", () => {
    const theme = readShadcnCss(":root { --a: red; --b: blue; } .dark { --a: green; }")
    expect(theme.dark).toEqual({ a: "green", b: "blue" })
  })

  it("resolves var() chains and fallbacks, per mode", () => {
    const theme = readShadcnCss(
      ":root { --brand: oklch(0.6 0.2 260); --primary: var(--brand); --ring: var(--missing, #ccc); } .dark { --brand: #fff; }",
    )
    expect(theme.light.primary).toBe("oklch(0.6 0.2 260)")
    expect(theme.dark?.primary).toBe("#fff")
    expect(theme.light.ring).toBe("#ccc")
  })

  it("reads variables inside @layer base (shadcn before Tailwind v4)", () => {
    const theme = readShadcnCss("@layer base { :root { --background: 0 0% 100%; } }")
    expect(theme.light.background).toBe("0 0% 100%")
    expect(theme.dark).toBeUndefined()
  })

  it("explains what it can't use", () => {
    expect(() => readShadcnCss("body { color: red }")).toThrow(
      expect.objectContaining({ code: "invalid-theme" }),
    )
    expect(() => readShadcnCss(":root { --a: var(--b); --b: var(--a); }")).toThrow(
      /--a → --b → --a/,
    )
  })
})
