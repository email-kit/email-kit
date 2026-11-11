import { EmailKitError } from "../shared/errors.ts"

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * A piece of a parsed ICU message: plain text, an argument (`{name}`), the `#` inside a plural, or
 * a plural or select with its cases.
 */
export type Part =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "argument"; readonly name: string }
  | { readonly kind: "pound" }
  | {
      readonly kind: "plural" | "select"
      readonly name: string
      readonly cases: ReadonlyMap<string, readonly Part[]>
    }

export type Choice = Extract<Part, { kind: "plural" | "select" }>

/**
 * Parses an ICU message, supporting arguments, `plural` and `select`. `where` names the message in
 * error messages. Quoting follows ICU: `''` is a quote, and a `'` before `{`, `}`, `#` or `|`
 * quotes the text up to the next lone `'`.
 */
export function parse(source: string, where: string): Part[] {
  let pos = 0
  const fail = (message: string): never => {
    throw new EmailKitError("invalid-message", `${where}: ${message} (at character ${pos + 1})`)
  }
  const space = () => {
    while (/\s/.test(source[pos] ?? "")) pos++
  }
  const word = () => {
    const match = /^[^\s{},]+/.exec(source.slice(pos))
    if (!match) fail("expected a name")
    pos += (match as RegExpExecArray)[0].length
    return (match as RegExpExecArray)[0]
  }
  const message = (inPlural: boolean, depth: number): Part[] => {
    const parts: Part[] = []
    let text = ""
    const flush = () => {
      if (text) parts.push({ kind: "text", value: text })
      text = ""
    }
    while (pos < source.length) {
      const c = source[pos] as string
      if (c === "'") {
        if (source[pos + 1] === "'") {
          text += "'"
          pos += 2
        } else if (/[{}#|]/.test(source[pos + 1] ?? "")) {
          pos++
          while (pos < source.length) {
            if (source[pos] === "'" && source[pos + 1] === "'") {
              text += "'"
              pos += 2
            } else if (source[pos] === "'") {
              pos++
              break
            } else text += source[pos++]
          }
        } else {
          text += "'"
          pos++
        }
      } else if (c === "{") {
        flush()
        parts.push(argument(depth))
      } else if (c === "}") {
        if (depth === 0) fail('an unbalanced "}"')
        break
      } else if (c === "#" && inPlural) {
        flush()
        parts.push({ kind: "pound" })
        pos++
      } else {
        text += c
        pos++
      }
    }
    flush()
    return parts
  }
  const argument = (depth: number): Part => {
    pos++
    space()
    const name = word()
    if (!NAME.test(name)) fail(`"${name}" isn't an argument name: use letters, digits and _`)
    space()
    if (source[pos] === "}") {
      pos++
      return { kind: "argument", name }
    }
    if (source[pos] !== ",") fail(`expected "," or "}" after {${name}`)
    pos++
    space()
    const type = word()
    space()
    if (type !== "plural" && type !== "select") {
      throw new EmailKitError(
        "unsupported-message",
        `${where} uses {${name}, ${type}}. Pass ${type === "number" || type === "date" || type === "time" ? `the ${type}` : "the value"} formatted by your backend (Intl.NumberFormat, Intl.DateTimeFormat) as a string argument instead.`,
      )
    }
    if (source[pos] !== ",") fail(`expected "," after {${name}, ${type}`)
    pos++
    space()
    if (source.startsWith("offset:", pos)) {
      throw new EmailKitError(
        "unsupported-message",
        `${where} uses a plural offset, which email-kit doesn't support`,
      )
    }
    const cases = new Map<string, readonly Part[]>()
    while (pos < source.length && source[pos] !== "}") {
      const key = word()
      space()
      if (source[pos] !== "{") fail(`expected "{" after the case "${key}"`)
      pos++
      if (cases.has(key)) fail(`the case "${key}" appears twice`)
      cases.set(key, message(type === "plural", depth + 1))
      if (source[pos] !== "}") fail(`the case "${key}" isn't closed`)
      pos++
      space()
    }
    if (source[pos] !== "}") fail(`{${name}, ${type}, …} isn't closed`)
    pos++
    if (!cases.has("other")) {
      throw new EmailKitError(
        "invalid-message",
        `${where}: {${name}, ${type}} needs an "other" case`,
      )
    }
    return { kind: type, name, cases }
  }
  const parts = message(false, 0)
  if (pos < source.length) fail('an unbalanced "}"')
  return parts
}

/**
 * A message's arguments and how it uses them, for the generated `t()` types: a plural takes a
 * number, a select a string, a plain `{name}` any message value. A name used as a plural and
 * anything else counts as a plural, since its number can also be printed as text.
 */
export function messageArguments(
  source: string,
  where: string,
): ReadonlyMap<string, "plural" | "select" | "text"> {
  const out = new Map<string, "plural" | "select" | "text">()
  const visit = (parts: readonly Part[]) => {
    for (const part of parts) {
      if (part.kind === "argument") {
        if (!out.has(part.name)) out.set(part.name, "text")
      } else if (part.kind === "plural" || part.kind === "select") {
        if (out.get(part.name) !== "plural") out.set(part.name, part.kind)
        for (const parts of part.cases.values()) visit(parts)
      }
    }
  }
  visit(parse(source, where))
  return out
}

/** Turns parts back into an ICU message, quoting any literal `'`, `{`, `}`, `#` and `|`. */
export function serialize(parts: readonly Part[]): string {
  return parts
    .map((part) => {
      if (part.kind === "text")
        return part.value.replace(/'/g, "''").replace(/[{}#|]/g, (c) => `'${c}'`)
      if (part.kind === "argument") return `{${part.name}}`
      if (part.kind === "pound") return "#"
      const cases = [...part.cases].map(([key, value]) => `${key} {${serialize(value)}}`).join(" ")
      return `{${part.name}, ${part.kind}, ${cases}}`
    })
    .join("")
}
