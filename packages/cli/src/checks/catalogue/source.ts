// A.2 Sources (`source.*`): templates and user components take values from the theme (UI-01).
// The style lints read style objects: a JSX `style={{…}}` (through spreads, conditionals and
// `&&`), or `style={NAME}` where NAME is an object constant in the same file. Data, such as a
// fixture's `{ color: "Red" }`, is never a style, so it isn't flagged.

import { colorsNamed } from "culori"

import { isNode, type Node, type SourceFile, staticString, walk } from "../source.ts"
import type { Check, Problem } from "../types.ts"

const NAMED = new Set(Object.keys(colorsNamed))
const ALLOWED = new Set(["transparent", "inherit", "currentcolor", "initial", "unset", "none"])
const COLOUR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i
const HEX = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i

/** Style properties and attributes that carry colours, lowercased without hyphens. */
const COLOUR_PROPS = new Set([
  ...["color", "background", "backgroundcolor", "border", "bordercolor", "outline", "outlinecolor"],
  ...[
    "bordertop",
    "borderright",
    "borderbottom",
    "borderleft",
    "bordertopcolor",
    "borderrightcolor",
  ],
  ...["borderbottomcolor", "borderleftcolor", "textdecorationcolor", "boxshadow", "textshadow"],
  ...["fill", "stroke", "caretcolor", "columnrulecolor", "msoborderalt"],
])
const COLOUR_ATTRS = new Set([
  "bgcolor",
  "color",
  "bordercolor",
  "background",
  "fill",
  "stroke",
  "link",
  "vlink",
  "alink",
  "text",
])

export function colourIn(value: string): string | undefined {
  const hex = HEX.exec(value)
  if (hex) return hex[0]
  const fn = COLOUR_FUNCTION.exec(value)
  if (fn) return `${fn[1]}()`
  for (const word of value.toLowerCase().split(/[^a-z]+/)) {
    if (word && !ALLOWED.has(word) && NAMED.has(word)) return word
  }
  return undefined
}

const normal = (name: string) => name.toLowerCase().replaceAll("-", "")

interface StyleProperty {
  readonly key: string
  readonly value: Node
  readonly node: Node
}

/** The properties of every style object in the file. */
function* styleProperties(source: SourceFile): Generator<StyleProperty> {
  const program = source.program()
  const constants = new Map<string, Node>()
  for (const { node } of walk(program)) {
    if (
      node.type === "VariableDeclarator" &&
      isNode(node.id) &&
      node.id.type === "Identifier" &&
      isNode(node.init)
    ) {
      constants.set(node.id.name as string, node.init)
    }
  }
  const seen = new Set<Node>()
  function* fromExpression(expression: Node | undefined): Generator<StyleProperty> {
    if (!expression || seen.has(expression)) return
    seen.add(expression)
    switch (expression.type) {
      case "ObjectExpression":
        for (const property of expression.properties as Node[]) {
          if (property.type === "SpreadElement") {
            yield* fromExpression(property.argument as Node)
          } else if (property.type === "Property" && isNode(property.value)) {
            const key = property.key as Node
            const name = key.type === "Identifier" ? (key.name as string) : staticString(key)
            if (name !== undefined) yield { key: name, value: property.value, node: property }
          }
        }
        break
      case "Identifier":
        yield* fromExpression(constants.get(expression.name as string))
        break
      case "ConditionalExpression":
        yield* fromExpression(expression.consequent as Node)
        yield* fromExpression(expression.alternate as Node)
        break
      case "LogicalExpression":
        yield* fromExpression(expression.right as Node)
        break
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "ParenthesizedExpression":
        yield* fromExpression(expression.expression as Node)
        break
    }
  }
  for (const { node } of walk(program)) {
    if (node.type !== "JSXAttribute") continue
    const name = (node.name as Node).name
    const value = node.value as Node | null
    if (name === "style" && value?.type === "JSXExpressionContainer") {
      yield* fromExpression(value.expression as Node)
    }
  }
}

/** JSX attributes with a static string value. */
function* attributes(source: SourceFile): Generator<{ name: string; value: string; node: Node }> {
  for (const { node } of walk(source.program())) {
    if (node.type !== "JSXAttribute") continue
    const name = (node.name as Node).name
    const raw = node.value as Node | null
    if (typeof name !== "string" || !raw) continue
    const value =
      raw.type === "JSXExpressionContainer"
        ? staticString(raw.expression as Node)
        : staticString(raw)
    if (value !== undefined) yield { name, value, node }
  }
}

function eachSource(
  sources: readonly SourceFile[],
  report: (problem: Problem) => void,
  fn: (source: SourceFile, problem: (message: string, at: number) => void) => void,
): void {
  for (const source of sources) fn(source, (message, at) => report({ message, source, at }))
}

export const SOURCE: readonly Check[] = [
  {
    id: "source.no-literal-colour",
    level: "error",
    rule: "No literal colours in the styles and colour attributes of templates and user components.",
    fix: 'Use a theme role: `style={{ color: role("mutedInk") }}`. Roles get their dark-mode rules and contrast checks; literals get neither.',
    run: (context, report) =>
      eachSource(context.sources, report, (source, problem) => {
        for (const { key, value, node } of styleProperties(source)) {
          const text = staticString(value)
          const colour = text === undefined ? undefined : colourIn(text)
          if (colour && COLOUR_PROPS.has(normal(key)))
            problem(`\`${key}\` uses the literal colour ${colour}`, node.start)
        }
        for (const { name, value, node } of attributes(source)) {
          const colour = colourIn(value)
          if (colour && COLOUR_ATTRS.has(name.toLowerCase()))
            problem(`\`${name}="${value}"\` is a literal colour`, node.start)
        }
      }),
  },
  {
    id: "source.no-font-family",
    level: "error",
    rule: "No `font-family` in templates or user components.",
    fix: "Font stacks come from the theme (`theme.typography.stacks`), with the fallback classic Outlook needs; use Text, Heading or the font() helper.",
    run: (context, report) =>
      eachSource(context.sources, report, (source, problem) => {
        for (const { key, node } of styleProperties(source)) {
          if (normal(key) === "fontfamily") problem(`\`${key}\` is set directly`, node.start)
        }
        for (const { name, node } of attributes(source)) {
          if (name.toLowerCase() === "face") problem("`face` sets a font directly", node.start)
        }
      }),
  },
  {
    id: "source.no-font-size",
    level: "error",
    rule: "No literal `font-size` in templates or user components, except 0 or 1px on spacer and divider cells.",
    fix: "Sizes come from the type scale: use Text or Heading with a size, or the font() helper.",
    run: (context, report) =>
      eachSource(context.sources, report, (source, problem) => {
        for (const { key, value, node } of styleProperties(source)) {
          if (normal(key) !== "fontsize") continue
          const literal =
            value.type === "Literal"
              ? String(value.value)
              : value.type === "TemplateLiteral" && (value.expressions as unknown[]).length === 0
                ? staticString(value)
                : undefined
          // 0 or 1px keeps an empty spacer or divider cell from growing to the text's line height.
          if (literal !== undefined && !/^[01](px)?$/.test(literal.trim())) {
            problem(`\`${key}\` is a literal size`, node.start)
          }
        }
      }),
  },
  {
    id: "source.fixture-exists",
    level: "error",
    rule: "Every template has at least one fixture.",
    fix: "Add sample data under `fixtures` in defineEmail(): the checks render it, and so will the preview studio.",
    run: (context, report) => {
      for (const template of context.templates) {
        if (template.fixtures.length === 0) {
          report({
            message: `${template.id} has no fixtures`,
            subject: { template: template.id, file: template.file },
          })
        }
      }
    },
  },
]
