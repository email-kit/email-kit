// Compile-time message lookup (I18N-02). Prototype (P0-03): simple `{name}` arguments only. ICU
// MessageFormat (plural, select, quoting) and typed keys arrive with P1-151 and P1-159.

import { EmailKitError } from "./errors.ts"
import type { IrNode } from "./ir.ts"
import { fragment, toNodes } from "./jsx-runtime.ts"
import type { Placeholder } from "./placeholder.ts"

/** A message resolved for one locale: text with placeholders. */
export type Message = IrNode

export type MessageParam = string | number | Placeholder<string> | Placeholder<number> | Message

export type Translate = (key: string, params?: Readonly<Record<string, MessageParam>>) => Message

export type Messages = Readonly<Record<string, string>>

const ARGUMENT = /^[A-Za-z_][A-Za-z0-9_]*$/

export function createTranslate(locale: string, messages: Messages): Translate {
  return (key, params = {}) => {
    if (!Object.hasOwn(messages, key)) {
      throw new EmailKitError("missing-message", `Locale "${locale}" has no message "${key}"`)
    }
    const source = messages[key] as string
    const where = `Message "${key}" in locale "${locale}"`
    const nodes: IrNode[] = []
    const used = new Set<string>()
    let pos = 0
    for (const match of source.matchAll(/\{([^{}]*)\}|[{}]/g)) {
      if (match.index > pos) nodes.push({ kind: "text", value: source.slice(pos, match.index) })
      pos = match.index + match[0].length
      const argument = match[1]?.trim()
      if (argument === undefined && /^\{\s*[A-Za-z_]\w*\s*,/.test(source.slice(match.index))) {
        throw new EmailKitError(
          "unsupported-message",
          `${where} uses an ICU {argument, type, …} form. The prototype supports only {name}.`,
        )
      }
      if (argument === undefined) {
        throw new EmailKitError("invalid-message", `${where} has an unbalanced "${match[0]}"`)
      }
      if (!ARGUMENT.test(argument)) {
        throw new EmailKitError(
          "unsupported-message",
          `${where} uses "{${argument}}". The prototype supports only simple {name} arguments.`,
        )
      }
      if (!Object.hasOwn(params, argument)) {
        throw new EmailKitError(
          "missing-message-param",
          `${where} needs the parameter "${argument}"`,
        )
      }
      used.add(argument)
      toNodes(params[argument], nodes)
    }
    if (pos < source.length) nodes.push({ kind: "text", value: source.slice(pos) })
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
