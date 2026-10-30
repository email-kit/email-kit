// UI-22: `Conditional` branches in the HTML and text parts.

import { Conditional, type IrNode } from "@email-kit/core"
import { describe, expect, it } from "vitest"

import { renderHtml } from "../src/compiler/html.ts"
import { renderTextPart } from "../src/compiler/text.ts"

const branch = (when: "mso" | "notMso" | "htmlOnly" | "textOnly"): IrNode =>
  Conditional({ when, children: `[${when}]` })
const all: IrNode = {
  kind: "fragment",
  children: (["mso", "notMso", "htmlOnly", "textOnly"] as const).map(branch),
}

describe("Conditional", () => {
  it("wraps Word's branches in the comments each engine reads", () => {
    expect(renderHtml(branch("mso"))).toBe("<!--[if mso]>[mso]<![endif]-->")
    // Other clients see the content between two complete comments; Word skips it.
    expect(renderHtml(branch("notMso"))).toBe("<!--[if !mso]><!-->[notMso]<!--<![endif]-->")
  })

  it("keeps htmlOnly in the HTML part and textOnly in the text part", () => {
    expect(renderHtml(all)).not.toContain("[textOnly]")
    expect(renderHtml(all)).toContain("[htmlOnly]")
    const text = renderTextPart(all, "")
    expect(text).toContain("[notMso][textOnly]")
    expect(text).not.toMatch(/\[mso\]|\[htmlOnly\]/)
  })
})
