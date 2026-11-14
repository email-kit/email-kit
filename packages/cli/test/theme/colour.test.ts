// Colour conversion to hex for email, and the measures the token checks use.

import { describe, expect, it } from "vitest"

import { contrast, lightness, toHex, yiq } from "../../src/theme/colour.ts"

describe("toHex", () => {
  it.each([
    // shadcn's neutral theme
    ["oklch(1 0 0)", "#ffffff"],
    ["oklch(0.145 0 0)", "#0a0a0a"],
    ["oklch(0.205 0 0)", "#171717"],
    ["oklch(0.97 0 0)", "#f5f5f5"],
    ["oklch(0.556 0 0)", "#737373"],
    ["oklch(0.922 0 0)", "#e5e5e5"],
    ["oklch(0.577 0.245 27.325)", "#e7000b"],
    ["oklch(0.708 0 0)", "#a1a1a1"],
    ["oklch(0.704 0.191 22.216)", "#ff6467"],
    // other syntaxes
    ["#FF0000", "#ff0000"],
    ["rgb(255 0 0)", "#ff0000"],
    ["hsl(0 100% 50%)", "#ff0000"],
    ["rebeccapurple", "#663399"],
  ])("%s → %s", (value, hex) => {
    expect(toHex(value).hex).toBe(hex)
  })

  it("gamut-maps out-of-sRGB colours instead of clamping (CSS Color 4)", () => {
    // clamping shifts the hue to #00d6eb; mapping gives #00c9d2
    expect(toHex("oklch(0.75 0.25 200)")).toEqual({
      hex: "#00c9d2",
      outOfGamut: { clamped: "#00d6eb" },
    })
    expect(toHex("color(display-p3 1 0 0)").outOfGamut).toBeDefined()
    expect(toHex("oklch(0.5 0.05 250)").outOfGamut).toBeUndefined()
  })

  it("flattens alpha over the surface, keeping greys neutral", () => {
    // shadcn dark --border: oklch(1 0 0 / 10%) on #0a0a0a. 10 + 245 × 0.1 = 34.5 → 35, as clients
    // composite, rather than #222222 from rounding down.
    expect(toHex("oklch(1 0 0 / 10%)", "#0a0a0a")).toEqual({
      hex: "#232323",
      flattened: { alpha: 0.1, over: "#0a0a0a" },
    })
    expect(toHex("rgb(0 0 0 / 50%)", "#ffffff").hex).toBe("#808080")
  })

  it("rejects what it can't convert", () => {
    expect(() => toHex("not-a-colour")).toThrow(expect.objectContaining({ code: "invalid-colour" }))
    expect(() => toHex("oklch(1 0 0 / 10%)")).toThrow(
      expect.objectContaining({ code: "translucent-colour" }),
    )
  })
})

describe("measures", () => {
  it("computes WCAG contrast", () => {
    // #737373 on white 4.74:1, #e7000b 4.77:1, #a1a1a1 on #0a0a0a 7.66:1
    expect(contrast("#737373", "#ffffff")).toBeCloseTo(4.74, 2)
    expect(contrast("#e7000b", "#ffffff")).toBeCloseTo(4.77, 1)
    expect(contrast("#a1a1a1", "#0a0a0a")).toBeCloseTo(7.66, 1)
  })

  it("computes L* for the mid-tone band", () => {
    // #707070 / #808080 / #909090 → L* 47 / 54 / 60; #2563eb L* 46
    expect(Math.round(lightness("#707070"))).toBe(47)
    expect(Math.round(lightness("#808080"))).toBe(54)
    expect(Math.round(lightness("#909090"))).toBe(60)
    expect(Math.round(lightness("#2563eb"))).toBe(46)
  })

  it("computes YIQ brightness", () => {
    expect(yiq("#ffffff")).toBe(255)
    expect(yiq("#000000")).toBe(0)
  })
})
