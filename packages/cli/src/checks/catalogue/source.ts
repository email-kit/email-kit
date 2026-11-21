import { dirname } from "node:path"

import { IMPORT_SOURCE, JSX_PRAGMA, needsPragma, pragmaOf } from "../../jsx.ts"
import { isNode, type Node, type SourceFile, staticString, walk } from "../source.ts"
import type { Check } from "../types.ts"
import { NAMED_COLOURS, type Report } from "./util.ts"

/** Keywords that aren't colours, though some are CSS colour values. */
const ALLOWED = new Set(["transparent", "inherit", "currentcolor", "initial", "unset", "none"])

/** A CSS colour function, such as `rgb(` or `oklch(`. */
const COLOUR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i

/** A hex colour of 3, 4, 6 or 8 digits. */
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
/** JSX attributes that carry colours, lowercased. */
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

/** The first literal colour in a value: a hex, a colour function or a colour name. */
function colourIn(value: string): string | undefined {
  const hex = HEX.exec(value)
  if (hex) return hex[0]
  const fn = COLOUR_FUNCTION.exec(value)
  if (fn) return `${fn[1]}()`
  for (const word of value.toLowerCase().split(/[^a-z]+/)) {
    if (word && !ALLOWED.has(word) && NAMED_COLOURS.has(word)) return word
  }
  return undefined
}

/** A property name lowercased without hyphens, so `fontSize` and `font-size` compare equal. */
const normal = (name: string) => name.toLowerCase().replaceAll("-", "")

/** One property of a style object: its name, its value, and the whole property node. */
interface StyleProperty {
  readonly key: string
  readonly value: Node
  readonly node: Node
}

/** Each file's style properties, found once for the three checks that read them. */
const found = new WeakMap<SourceFile, readonly StyleProperty[]>()

/** The properties of every style object in the file. */
function styleProperties(source: SourceFile): readonly StyleProperty[] {
  let properties = found.get(source)
  if (!properties) {
    properties = [...findStyleProperties(source)]
    found.set(source, properties)
  }
  return properties
}

function* findStyleProperties(source: SourceFile): Generator<StyleProperty> {
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
  /** The properties an expression gives a style, following what it's built from. */
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

/** Runs `fn` for every source file, for checks that look at one file at a time. */
function eachSource(
  sources: readonly SourceFile[],
  report: Report,
  fn: (source: SourceFile, problem: (message: string, at: number) => void) => void,
): void {
  for (const source of sources) fn(source, (message, at) => report({ message, source, at }))
}

/**
 * The `source.*` checks: templates and components take their values from the theme. The style
 * checks read style objects: a JSX `style={{…}}`, through spreads, conditionals and `&&`, or
 * `style={NAME}` where `NAME` is an object constant in the same file. Data, such as a fixture's
 * `{ color: "Red" }`, is never a style, so it isn't flagged.
 */
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
    /**
     * 0 or 1px is allowed: it keeps an empty spacer or divider cell from growing to the text's
     * line height.
     */
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
          if (literal !== undefined && !/^[01](px)?$/.test(literal.trim())) {
            problem(`\`${key}\` is a literal size`, node.start)
          }
        }
      }),
  },
  {
    id: "source.jsx-pragma",
    level: "warn",
    rule: `Templates and user components with JSX start with \`${JSX_PRAGMA}\`, unless their tsconfig sets \`"jsxImportSource": "${IMPORT_SOURCE}"\`.`,
    fix: `Add \`${JSX_PRAGMA}\` as the file's first line. The compile is right either way; without it, TypeScript and your editor check the file against another framework's JSX types.`,
    run: (context, report) =>
      eachSource(context.sources, report, (source, problem) => {
        if (!/\.[jt]sx$/.test(source.path)) return
        const pragma = pragmaOf(source.text)
        if (pragma?.source === IMPORT_SOURCE) return
        if (pragma) {
          problem(`the JSX pragma names ${pragma.source}, not ${IMPORT_SOURCE}`, pragma.at)
          return
        }
        if (!needsPragma(dirname(source.path))) return
        for (const { node } of walk(source.program())) {
          if (node.type === "JSXElement" || node.type === "JSXFragment") {
            problem(
              `JSX without the pragma, and the tsconfig doesn't set ${IMPORT_SOURCE}`,
              node.start,
            )
            return
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
