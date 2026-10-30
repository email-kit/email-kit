// Compile-time message lookup (I18N-02): ICU MessageFormat 1 arguments, `plural` and `select`.
// A plural or select over a data field becomes sections on keys the generated module prepares
// before rendering (ADR 0003): `{{#_ek.plural.count.one}}…`, `{{#_ek.select.plan.v_pro}}…`.
// Literal values are resolved here. Other argument types (number, date) are refused: values
// arrive formatted by the caller (R5). Typed keys arrive with P1-159.

import { EmailKitError } from "./errors.ts"
import type { IrNode, IrSection } from "./ir.ts"
import { fragment, toNodes } from "./jsx-runtime.ts"
import { openScope, type Placeholder, placeholderInfo } from "./placeholder.ts"

/** A message resolved for one locale: text with placeholders. */
export type Message = IrNode

export type MessageParam = string | number | Placeholder<string> | Placeholder<number> | Message

export type Translate = (key: string, params?: Readonly<Record<string, MessageParam>>) => Message

export type Messages = Readonly<Record<string, string>>

/**
 * Each template's message keys and their parameters, filled in by the `messages.d.ts` that
 * `email-kit compile` writes from the default locale (P1-159). Empty until then, and `t()` stays
 * untyped.
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by the generated messages.d.ts
export interface MessageRegistry {}

/** `t()` for one template: its keys, and each message's parameters with their types. */
export type TypedTranslate<Id extends string> = Id extends keyof MessageRegistry
  ? <Key extends keyof MessageRegistry[Id] & string>(
      key: Key,
      ...params: ParamsArgument<MessageRegistry[Id][Key]>
    ) => Message
  : Translate

type ParamsArgument<P> = [keyof P] extends [never] ? [params?: Record<string, never>] : [params: P]

/** The locale's CLDR plural rules, from the compiler. */
export interface PluralSupport {
  /** The categories the locale uses, such as ["one", "other"] */
  readonly categories: readonly string[]
  category(n: number): string
}

const CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"])
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/** The section key for a select value; the generated module encodes values the same way. */
export function selectKey(value: string): string {
  return `v_${value.replace(/[^A-Za-z0-9]/gu, (c) => `_${(c.codePointAt(0) as number).toString(16)}_`)}`
}

// ICU MessageFormat 1 (the subset email copy needs), parsed into parts.
type Part =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "argument"; readonly name: string }
  | { readonly kind: "pound" }
  | {
      readonly kind: "plural" | "select"
      readonly name: string
      readonly cases: ReadonlyMap<string, readonly Part[]>
    }

type Choice = Extract<Part, { kind: "plural" | "select" }>

function parse(source: string, where: string): Part[] {
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
        // '' is a quote; '{…' quotes up to the next lone quote (ICU's apostrophe mode).
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
    pos++ // {
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
 * number, a select a string, a plain `{name}` any message value.
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
        // A plural wins over the others: its number also prints as text.
        if (out.get(part.name) !== "plural") out.set(part.name, part.kind)
        for (const parts of part.cases.values()) visit(parts)
      }
    }
  }
  visit(parse(source, where))
  return out
}

export function createTranslate(
  locale: string,
  messages: Messages,
  plurals?: PluralSupport,
): Translate {
  return (key, params = {}) => {
    if (!Object.hasOwn(messages, key)) {
      throw new EmailKitError("missing-message", `Locale "${locale}" has no message "${key}"`)
    }
    const where = `Message "${key}" in locale "${locale}"`
    const used = new Set<string>()
    const param = (name: string): MessageParam => {
      if (!Object.hasOwn(params, name)) {
        throw new EmailKitError("missing-message-param", `${where} needs the parameter "${name}"`)
      }
      used.add(name)
      return params[name] as MessageParam
    }

    const render = (parts: readonly Part[], pound: MessageParam | undefined): IrNode[] => {
      const nodes: IrNode[] = []
      for (const part of parts) {
        if (part.kind === "text") nodes.push({ kind: "text", value: part.value })
        else if (part.kind === "argument") toNodes(param(part.name), nodes)
        else if (part.kind === "pound") toNodes(pound, nodes)
        else if (part.kind === "plural") nodes.push(...plural(part, param(part.name)))
        else nodes.push(...select(part, param(part.name)))
      }
      return nodes
    }

    const plural = (part: Choice, value: MessageParam): IrNode[] => {
      const rules = plurals ?? { categories: ["other"], category: () => "other" }
      const exact: number[] = []
      for (const name of part.cases.keys()) {
        if (name.startsWith("=")) {
          const n = Number(name.slice(1))
          if (!/^=\d+$/.test(name) || !Number.isSafeInteger(n)) {
            throw new EmailKitError(
              "invalid-plural",
              `${where}: "${name}" must be = and a whole number, such as =0`,
            )
          }
          exact.push(n)
        } else if (!CATEGORIES.has(name)) {
          throw new EmailKitError(
            "invalid-plural",
            `${where}: "${name}" isn't a plural category (zero, one, two, few, many, other) or =N`,
          )
        } else if (!rules.categories.includes(name)) {
          throw new EmailKitError(
            "invalid-plural",
            `${where}: "${locale}" never uses the category "${name}" (it uses ${rules.categories.join(", ")})${name === "zero" ? "; use =0 for exactly zero" : ""}`,
          )
        }
      }
      // ADR 0003: every category the locale uses is required, so no number falls through.
      const missing = rules.categories.filter((c) => !part.cases.has(c))
      if (missing.length > 0) {
        throw new EmailKitError(
          "invalid-plural",
          `${where}: {${part.name}, plural} needs ${missing.join(", ")} too; "${locale}" uses ${rules.categories.join(", ")}${missing.includes("one") && exact.includes(1) ? ' (=1 only matches exactly 1; "one" covers more numbers in some languages)' : ""}`,
        )
      }
      if (typeof value === "number") {
        const chosen = part.cases.get(`=${value}`) ?? part.cases.get(rules.category(value)) ?? []
        return render(chosen, String(value))
      }
      const info = placeholderInfo(value)
      if (!info)
        throw new EmailKitError(
          "invalid-plural",
          `${where}: {${part.name}, plural} needs a number from data, or a number`,
        )
      if (info.path.length === 0) {
        throw new EmailKitError(
          "invalid-plural",
          `${where}: {${part.name}, plural} needs a named field; a list item value ({{.}}) can't carry plural data`,
        )
      }
      const at = (name: string) => ["_ek", "plural", ...info.path, name]
      const categories = rules.categories.map((c) =>
        branch(at(c), info.scope, false, render(part.cases.get(c) ?? [], value)),
      )
      // Exact matches win over categories (ICU): the categories render only when none matches.
      let rest: IrNode[] = categories
      for (const n of [...exact].reverse())
        rest = [branch(at(`exact_${n}`), info.scope, true, rest)]
      return [
        ...exact.map((n) =>
          branch(at(`exact_${n}`), info.scope, false, render(part.cases.get(`=${n}`) ?? [], value)),
        ),
        ...rest,
      ]
    }

    const select = (part: Choice, value: MessageParam): IrNode[] => {
      const keys = [...part.cases.keys()].filter((k) => k !== "other")
      if (typeof value === "string")
        return render(part.cases.get(value) ?? part.cases.get("other") ?? [], undefined)
      const info = placeholderInfo(value)
      if (!info || info.path.length === 0) {
        throw new EmailKitError(
          "invalid-select",
          `${where}: {${part.name}, select} needs a named field from data, or a string`,
        )
      }
      const at = (k: string) => ["_ek", "select", ...info.path, selectKey(k)]
      let other: IrNode[] = render(part.cases.get("other") ?? [], undefined)
      for (const k of [...keys].reverse()) other = [branch(at(k), info.scope, true, other)]
      return [
        ...keys.map((k) =>
          branch(at(k), info.scope, false, render(part.cases.get(k) ?? [], undefined)),
        ),
        ...other,
      ]
    }

    const nodes = render(parse(messages[key] as string, where), undefined)
    const unused = Object.keys(params).filter((name) => !used.has(name))
    if (unused.length > 0) {
      throw new EmailKitError(
        "unused-message-param",
        `${where} doesn't use the parameter(s) ${unused.join(", ")}`,
      )
    }
    return fragment(nodes)
  }
}

function branch(
  path: readonly string[],
  scope: number,
  inverted: boolean,
  children: IrNode[],
): IrSection {
  return { kind: "section", inverted, path, scope, opens: openScope(), children }
}
