import { RESERVED_KEY } from "../config/sender.ts"
import { type Placeholder, placeholderInfo } from "../data/placeholder.ts"
import { openScope } from "../data/scope.ts"
import { EmailKitError } from "../shared/errors.ts"
import type { IrNode, IrSection } from "../tree/ir.ts"
import { fragment, toNodes } from "../tree/nodes.ts"
import { type Choice, type Part, parse } from "./message-format.ts"

/** A message resolved for one locale: text with placeholders. */
export type Message = IrNode

/**
 * A value for a message parameter: text, a number, a data placeholder, or another message from
 * `t()`. A plural needs a number or a number field. A select needs text or a field with fixed
 * values, such as `z.enum([…])`.
 */
export type MessageParam = string | number | Placeholder<string> | Placeholder<number> | Message

/**
 * Looks up a message for the locale being compiled and fills in its parameters. Throws if the
 * message or a parameter is missing, or if a parameter isn't used.
 *
 * @example
 * ```tsx
 * t("cart.items", { count: data.itemCount })
 * ```
 */
export type Translate = (key: string, params?: Readonly<Record<string, MessageParam>>) => Message

export type Messages = Readonly<Record<string, string>>

/**
 * Each template's message keys and their parameters, filled in by the `messages.d.ts` that
 * `email-kit compile` writes from the default locale. Until then it's empty and `t()` accepts any
 * key.
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
const ONLY_OTHER: PluralSupport = { categories: ["other"], category: () => "other" }

/** The section key for a select value; the generated module encodes values the same way. */
export function selectKey(value: string): string {
  return `v_${value.replace(/[^A-Za-z0-9]/gu, (c) => `_${(c.codePointAt(0) as number).toString(16)}_`)}`
}

/**
 * Makes the `t()` a template gets for one locale. Literal plural and select values are resolved
 * here. A data field becomes one section per case, on flags the generated module adds under `_ek`
 * before rendering, such as `{{#_ek.plural.count.one}}` or `{{#_ek.select.plan.v_pro}}`. Exact
 * cases (`=0`) win over categories, and every category the locale uses is required, so no number
 * falls through.
 */
export function createTranslate(
  locale: string,
  messages: Messages,
  plurals: PluralSupport = ONLY_OTHER,
  onUse?: (key: string) => void,
): Translate {
  return (key, params = {}) => {
    if (!Object.hasOwn(messages, key)) {
      throw new EmailKitError("missing-message", `Locale "${locale}" has no message "${key}"`)
    }
    onUse?.(key)
    const where = `Message "${key}" in locale "${locale}"`
    const call: Call = { locale, where, plurals, params, used: new Set() }
    const nodes = render(call, parse(messages[key] as string, where))
    const unused = Object.keys(params).filter((name) => !call.used.has(name))
    if (unused.length > 0) {
      throw new EmailKitError(
        "unused-message-param",
        `${where} doesn't use the parameter(s) ${unused.join(", ")}`,
      )
    }
    return fragment(nodes)
  }
}

/** One `t()` call: what rendering its message needs, and the parameters used so far. */
interface Call {
  readonly locale: string
  readonly where: string
  readonly plurals: PluralSupport
  readonly params: Readonly<Record<string, MessageParam>>
  readonly used: Set<string>
}

function param(call: Call, name: string): MessageParam {
  if (!Object.hasOwn(call.params, name)) {
    throw new EmailKitError("missing-message-param", `${call.where} needs the parameter "${name}"`)
  }
  call.used.add(name)
  return call.params[name] as MessageParam
}

/** Renders message parts. `pound` is what `#` prints inside a plural. */
function render(call: Call, parts: readonly Part[], pound?: MessageParam): IrNode[] {
  const nodes: IrNode[] = []
  for (const part of parts) {
    if (part.kind === "text") nodes.push({ kind: "text", value: part.value })
    else if (part.kind === "argument") toNodes(param(call, part.name), nodes)
    else if (part.kind === "pound") toNodes(pound, nodes)
    else if (part.kind === "plural") nodes.push(...plural(call, part, param(call, part.name)))
    else nodes.push(...select(call, part, param(call, part.name)))
  }
  return nodes
}

function plural(call: Call, part: Choice, value: MessageParam): IrNode[] {
  const exact = checkPluralCases(call, part)
  const { categories, category } = call.plurals
  const body = (key: string, pound: MessageParam) => render(call, part.cases.get(key) ?? [], pound)

  if (typeof value === "number") {
    const key = part.cases.has(`=${value}`) ? `=${value}` : category(value)
    return body(key, String(value))
  }
  const info = placeholderInfo(value)
  if (!info) {
    throw new EmailKitError(
      "invalid-plural",
      `${call.where}: {${part.name}, plural} needs a number from data, or a number`,
    )
  }
  if (info.path.length === 0) {
    throw new EmailKitError(
      "invalid-plural",
      `${call.where}: {${part.name}, plural} needs a named field; a list item value ({{.}}) ` +
        "can't carry plural data",
    )
  }
  const at = (key: string) => [RESERVED_KEY, "plural", ...info.path, key]
  const fallback = categories.map((c) => section(at(c), info.scope, false, body(c, value)))
  const cases = exact.map((n) => ({ path: at(`exact_${n}`), children: body(`=${n}`, value) }))
  return withFallback(info.scope, cases, fallback)
}

/**
 * Checks a plural's case names against the locale's categories, and returns its exact numbers
 * (`=0` gives 0).
 */
function checkPluralCases(call: Call, part: Choice): number[] {
  const { categories } = call.plurals
  const uses = categories.join(", ")
  const exact: number[] = []
  for (const name of part.cases.keys()) {
    if (name.startsWith("=")) {
      const n = Number(name.slice(1))
      if (!/^=\d+$/.test(name) || !Number.isSafeInteger(n)) {
        throw new EmailKitError(
          "invalid-plural",
          `${call.where}: "${name}" must be = and a whole number, such as =0`,
        )
      }
      exact.push(n)
    } else if (!CATEGORIES.has(name)) {
      throw new EmailKitError(
        "invalid-plural",
        `${call.where}: "${name}" isn't a plural category (zero, one, two, few, many, other) or =N`,
      )
    } else if (!categories.includes(name)) {
      const hint = name === "zero" ? "; use =0 for exactly zero" : ""
      throw new EmailKitError(
        "invalid-plural",
        `${call.where}: "${call.locale}" never uses the category "${name}" (it uses ${uses})${hint}`,
      )
    }
  }
  const missing = categories.filter((c) => !part.cases.has(c))
  if (missing.length > 0) {
    const hint =
      missing.includes("one") && exact.includes(1)
        ? ' (=1 only matches exactly 1; "one" covers more numbers in some languages)'
        : ""
    throw new EmailKitError(
      "invalid-plural",
      `${call.where}: {${part.name}, plural} needs ${missing.join(", ")} too; ` +
        `"${call.locale}" uses ${uses}${hint}`,
    )
  }
  return exact
}

function select(call: Call, part: Choice, value: MessageParam): IrNode[] {
  const body = (key: string) => render(call, part.cases.get(key) ?? [])

  if (typeof value === "string") return body(part.cases.has(value) ? value : "other")
  const info = placeholderInfo(value)
  if (!info || info.path.length === 0) {
    throw new EmailKitError(
      "invalid-select",
      `${call.where}: {${part.name}, select} needs a named field from data, or a string`,
    )
  }
  const at = (key: string) => [RESERVED_KEY, "select", ...info.path, selectKey(key)]
  const keys = [...part.cases.keys()].filter((key) => key !== "other")
  const cases = keys.map((key) => ({ path: at(key), children: body(key) }))
  return withFallback(info.scope, cases, body("other"))
}

/**
 * A section for each case, then `fallback` wrapped in inverted sections so it renders only when
 * no case matches: `{{#a}}…{{/a}}{{#b}}…{{/b}}{{^a}}{{^b}}fallback{{/b}}{{/a}}`.
 */
function withFallback(
  scope: number,
  cases: readonly { readonly path: readonly string[]; readonly children: IrNode[] }[],
  fallback: IrNode[],
): IrNode[] {
  let rest = fallback
  for (const { path } of [...cases].reverse()) rest = [section(path, scope, true, rest)]
  return [...cases.map(({ path, children }) => section(path, scope, false, children)), ...rest]
}

function section(
  path: readonly string[],
  scope: number,
  inverted: boolean,
  children: IrNode[],
): IrSection {
  return { kind: "section", inverted, path, scope, opens: openScope(), children }
}
