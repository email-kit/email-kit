import { type Part, parse, serialize } from "./message-format.ts"

type Mode = "expand" | "rtl"

const ACCENTS: Readonly<Record<string, string>> = Object.fromEntries(
  [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((c, i) => [
    c,
    [..."áƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÁƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ"][i] as string,
  ]),
)
const FILLER = "one two three four five six seven eight nine ten"
const RLO = "‮"
const PDF = "‬"

/**
 * How many times longer a pseudo-localised string is, by the original's length. Short strings grow
 * most, as they do in real translations: 3× up to 10 characters, down to 1.3× over 70.
 */
export function expansion(length: number): number {
  if (length <= 10) return 3
  if (length <= 20) return 2
  if (length <= 30) return 1.8
  if (length <= 50) return 1.6
  if (length <= 70) return 1.5
  return 1.3
}

/**
 * Pseudo-localises an ICU message, changing only its literal text, never its arguments, case
 * names or `#`. `expand` (en-XA) accents letters, brackets the message and pads it to the length
 * `expansion()` gives. `rtl` (ar-XB) wraps each piece of text in a right-to-left override. Plurals
 * get every category in `categories`, copied from their `other` case.
 */
export function pseudoMessage(
  source: string,
  mode: Mode,
  categories: readonly string[],
  where = "a message",
): string {
  const parts = parse(source, where)
  const out = transform(parts, mode, categories)
  if (mode === "rtl") return serialize(out)
  const length = visibleLength(parts)
  const pad = filler(Math.ceil(length * (expansion(length) - 1)))
  return serialize([
    { kind: "text", value: "[" },
    ...out,
    { kind: "text", value: pad ? ` ${pad}]` : "]" },
  ])
}

function transform(parts: readonly Part[], mode: Mode, categories: readonly string[]): Part[] {
  return parts.map((part): Part => {
    if (part.kind === "text") return { kind: "text", value: pseudoText(part.value, mode) }
    if (part.kind !== "plural" && part.kind !== "select") return part
    const cases = new Map<string, readonly Part[]>()
    for (const [key, value] of part.cases) {
      if (part.kind === "select" || key.startsWith("=") || categories.includes(key)) {
        cases.set(key, transform(value, mode, categories))
      }
    }
    if (part.kind === "plural") {
      const other = transform(part.cases.get("other") ?? [], mode, categories)
      for (const category of categories) if (!cases.has(category)) cases.set(category, other)
    }
    return { ...part, cases }
  })
}

function pseudoText(value: string, mode: Mode): string {
  if (mode === "rtl") return `${RLO}${value}${PDF}`
  return [...value].map((c) => ACCENTS[c] ?? c).join("")
}

/** About how long the message looks: an argument or `#` counts as 4, a choice as its `other`. */
function visibleLength(parts: readonly Part[]): number {
  let length = 0
  for (const part of parts) {
    if (part.kind === "text") length += part.value.length
    else if (part.kind === "argument" || part.kind === "pound") length += 4
    else length += visibleLength(part.cases.get("other") ?? [])
  }
  return length
}

/** Words from `FILLER`, cut to `length` characters. */
function filler(length: number): string {
  return FILLER.repeat(Math.ceil(length / FILLER.length) + 1)
    .slice(0, length)
    .trim()
}
