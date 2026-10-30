// The components evaluated with a test theme: colours come from roles (light hex inline plus a
// role class for the dark CSS), sizes from the type scale, spacing from the space scale.

import { defineEmail, type IrNode, type StandardSchemaV1, type ThemeContext } from "@email-kit/core"
import { evaluate } from "@email-kit/core/internal"
import { describe, expect, it } from "vitest"

import { Button, Divider, Heading, Link, Section, Spacer, Text } from "../src/index.ts"

// Every role reads as "#<role initials>" padded, so tests can see which role was used.
const roles = new Proxy({} as Record<string, string>, {
  get: (_, role: string) =>
    `#${role
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 6)
      .padEnd(6, "0")
      .toLowerCase()}`,
})
const type = (sizePx: number, lineHeightPx: number, weight = 400) => ({
  stack: "sans" as const,
  sizePx,
  lineHeightPx,
  weight,
  letterSpacingPx: 0,
})
const theme = {
  roles,
  typography: {
    stacks: {
      sans: { families: ["Segoe UI", "Arial", "sans-serif"], msoFallback: "Arial" },
      serif: { families: ["Georgia", "serif"], msoFallback: "Georgia" },
      mono: { families: ["Courier New", "monospace"], msoFallback: "Courier New" },
    },
    scale: {
      display: type(36, 44, 700),
      h1: type(28, 36, 700),
      h2: type(22, 30, 700),
      h3: type(18, 26, 700),
      lead: type(18, 28),
      body: type(16, 24),
      bodySm: type(14, 22),
      caption: type(14, 20),
      footer: type(14, 20),
      button: type(16, 24, 700),
      code: type(14, 20),
      otp: type(28, 36, 700),
      wordmark: type(20, 28, 700),
    },
  },
  space: { gutterMobile: 16, gutterDesktop: 32, stack: { sm: 8, md: 16, lg: 24 }, section: 32 },
  radius: {
    none: 0,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 14,
    full: 9999,
    button: 8,
    card: 10,
    badge: 9999,
    code: 6,
    image: 8,
  },
  borderWidth: { hairline: 1, strong: 2 },
  layout: { container: 600 },
  components: {
    button: {
      sm: { minHeight: 36, padX: 16, padY: 7, font: "bodySm" },
      md: { minHeight: 44, padX: 24, padY: 10, font: "button" },
      lg: { minHeight: 52, padX: 32, padY: 14, font: "button" },
    },
    link: { underline: true },
  },
} as unknown as ThemeContext

const schema = {
  "~standard": { version: 1, vendor: "test", validate: (value: unknown) => ({ value }) },
} as StandardSchemaV1<unknown, Record<string, never>>

function render(component: () => unknown): IrNode {
  const definition = defineEmail({
    id: "test",
    purpose: "transactional",
    schema,
    subject: () => "Subject",
    fixtures: {},
    component: component as never,
  })
  return evaluate(definition, { locale: "en", messages: {}, theme }).body
}

type Element = Extract<IrNode, { kind: "element" }>
const style = (node: IrNode) => ((node as Element).attrs.style ?? []).join("")
const classes = (node: IrNode) => ((node as Element).attrs.class ?? []).join("")
const find = (node: IrNode, tag: string): Element => {
  if (node.kind === "element" && node.tag === tag) return node
  for (const child of "children" in node ? node.children : []) {
    try {
      return find(child, tag)
    } catch {}
  }
  throw new Error(`no <${tag}>`)
}

describe("Text and Heading", () => {
  it("uses the type scale, Word's exact line height and a role colour", () => {
    const block = render(() => <Text tone="muted">Hello</Text>)
    const p = find(block, "p")
    // Spacing is the cell's padding, never a margin (research 01 §10).
    expect(style(find(block, "td"))).toBe("padding:0 0 16px")
    expect(style(p)).toBe(
      "margin:0;font-family:'Segoe UI', Arial, sans-serif;font-size:16px;line-height:24px;font-weight:400;mso-line-height-rule:exactly;color:#mutedi",
    )
    expect(classes(p)).toBe("ek-c--mutedInk")
  })

  it("maps levels to h1–h3 and their steps", () => {
    const h = find(
      render(() => <Heading level={2}>Title</Heading>),
      "h2",
    )
    expect(h.tag).toBe("h2")
    expect(style(h)).toContain("font-size:22px;line-height:30px;font-weight:700")
  })
})

describe("Link", () => {
  it("is underlined in the link colour", () => {
    const a = render(() => <Link href="https://example.test">Docs</Link>)
    expect(style(a)).toBe("color:#link00;text-decoration:underline")
    expect(classes(a)).toBe("ek-c--link")
  })
})

describe("Button", () => {
  const button = render(() => <Button href="https://example.test">Reset password</Button>)
  const cell = find(button, "td")
  const link = find(button, "a")

  it("gives Outlook the padding on the cell and everyone else a padded link", () => {
    expect(cell.attrs.bgcolor).toEqual(["#action"])
    expect(style(cell)).toContain("mso-padding-alt:10px 24px")
    expect(style(link)).toContain("display:inline-block;padding:10px 24px")
    expect(link.attrs.href).toEqual(["https://example.test"])
  })

  it("is 44 px tall: a 24 px line plus 10 px padding twice", () => {
    expect(style(link)).toContain("line-height:24px")
  })

  it("takes fill, border and label from the variant's roles, tagged for dark mode", () => {
    expect(classes(cell)).toBe("ek-bg--action-primary-fill ek-bc--action-primary-border")
    expect(classes(link)).toBe("ek-c--action-primary-label")
    const destructive = render(() => (
      <Button href="#" variant="destructive">
        Delete
      </Button>
    ))
    expect(classes(find(destructive, "a"))).toBe("ek-c--action-destructive-label")
  })

  it("is a layout table Word can lay out", () => {
    expect((button as Element).attrs).toMatchObject({
      role: ["presentation"],
      cellpadding: ["0"],
      cellspacing: ["0"],
      border: ["0"],
    })
  })
})

describe("Divider, Spacer and Section", () => {
  it("draws the divider as a 1 px filled cell", () => {
    const line = find(
      find(
        render(() => <Divider />),
        "table",
      ).children[0] as IrNode,
      "table",
    )
    const cell = find(line, "td")
    expect(style(cell)).toBe(
      "height:1px;line-height:1px;font-size:1px;mso-line-height-rule:exactly;background-color:#divide",
    )
    // A non-breaking space keeps the empty cell from collapsing.
    expect(cell.children).toEqual([{ kind: "text", value: "\u00a0" }])
  })

  it("gives the spacer an explicit height and line height", () => {
    expect(
      style(
        find(
          render(() => <Spacer size="lg" />),
          "td",
        ),
      ),
    ).toBe("height:24px;line-height:24px;font-size:1px;mso-line-height-rule:exactly")
  })

  it("spaces sections with padding and can paint a surface", () => {
    const cell = find(
      render(() => <Section surface="muted">x</Section>),
      "td",
    )
    expect(style(cell)).toBe("padding:32px 32px;background-color:#muted0")
    expect(classes(cell)).toBe("ek-bg--muted")
  })
})

describe("outside a compile", () => {
  it("explains that components need the theme", () => {
    expect(() => Text({ children: "x" })).toThrow(expect.objectContaining({ code: "no-theme" }))
  })
})
