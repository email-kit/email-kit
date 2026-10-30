// I18N-05: pseudo-locales change only a message's literal text, by length, and stay valid ICU.

import { describe, expect, it } from "vitest"

import { expansion, messageArguments, pseudoMessage } from "../src/i18n.ts"

const EN = ["one", "other"]
const AR = ["zero", "one", "two", "few", "many", "other"]

describe("en-XA: accented, bracketed, padded by length", () => {
  it("accents every ASCII letter, and only letters", () => {
    expect(
      pseudoMessage("abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 123", "expand", EN),
    ).toMatch(/^\[áƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýž ÁƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ 123 /)
  })

  it("grows short strings most (research 05 ⚠5)", () => {
    expect([5, 15, 25, 40, 60, 100].map(expansion)).toEqual([3, 2, 1.8, 1.6, 1.5, 1.3])
    // "Get started" is 11 characters: 11 more of padding, inside the brackets.
    const button = pseudoMessage("Get started", "expand", EN)
    expect(button).toBe("[Ĝéţ šţáŕţéð one two thr]")
    expect(button.length).toBeGreaterThanOrEqual("Get started".length * 2)
  })

  it("leaves arguments, plural keywords and # alone, and quotes what needs it", () => {
    const pseudo = pseudoMessage(
      "It''s {name}: {n, plural, one {# item} other {# items}} '{'x'}'",
      "expand",
      EN,
    )
    expect(pseudo).toContain("{name}")
    expect(pseudo).toContain("{n, plural, one {# îţéɱ} other {# îţéɱš}}")
    expect(pseudo).toContain("Îţ''š ")
    expect(pseudo).toContain("'{'ẋ'}'")
    expect([...messageArguments(pseudo, "test")]).toEqual([
      ["name", "text"],
      ["n", "plural"],
    ])
  })
})

describe("ar-XB: right to left", () => {
  it("wraps text in a right-to-left override, and keeps arguments outside it", () => {
    expect(pseudoMessage("Hi {name}!", "rtl", AR)).toBe("\u202eHi \u202c{name}\u202e!\u202c")
  })

  it("gives a plural every category Arabic uses, from its other case", () => {
    const pseudo = pseudoMessage("{n, plural, =0 {none} one {# item} other {# items}}", "rtl", AR)
    for (const category of AR) expect(pseudo).toContain(`${category} {`)
    expect(pseudo).toContain("=0 {\u202enone\u202c}")
    expect(pseudo).toContain("few {#\u202e items\u202c}")
  })
})
