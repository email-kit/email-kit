import { dirname, relative, resolve } from "node:path"

import { EmailKitError } from "@email-kit/core/internal"

import { isObject, readText } from "../shared.ts"

type Json = Record<string, unknown>

/** A modifier: a choice between named contexts, such as `brand` with `acme` and `globex`. */
export interface Modifier {
  readonly name: string
  /** Its context names, in the file's order. */
  readonly contexts: readonly string[]
  /** The context used when the input doesn't choose one. */
  readonly default: string | undefined
}

/**
 * One step of the resolution order: a set, whose sources always apply, or a modifier, whose
 * chosen context's sources apply.
 */
type Step =
  | { readonly kind: "set"; readonly name: string; readonly sources: readonly unknown[] }
  | {
      readonly kind: "modifier"
      readonly name: string
      readonly contexts: Readonly<Record<string, readonly unknown[]>>
    }

/** A checked resolver file. */
export interface Resolver {
  /** The resolver file as the config names it, for messages. */
  readonly label: string
  /** The resolver file's path. Relative sources are read from its folder. */
  readonly file: string
  readonly modifiers: readonly Modifier[]
  /** The resolution order, with each `#/sets/…` or `#/modifiers/…` reference replaced. */
  readonly order: readonly Step[]
  /** The whole document, which `#/…` pointers in sources point into. */
  readonly document: Json
}

/** The accepted versions: the spec's own examples disagree, and Terrazzo writes `2025.10`. */
const VERSIONS = new Set(["2025-10-01", "2025-11-01", "2025.10"])

/**
 * Reads a DTCG Resolver Module 2025.10 file. A `.resolver.json` names token `sets`, `modifiers`
 * (each with named `contexts`, and at least two of them) and a `resolutionOrder`. Pointers within
 * the document (`#/sets/x`) and relative files (`brand.tokens.json`, `brand.json#/color`) are
 * supported; remote URLs aren't. The order is checked here, and its sources when they're read.
 */
export function readResolver(file: string, label: string): Resolver {
  const document = readJson(file, label)
  const fail = (message: string): never => {
    throw new EmailKitError("invalid-theme", `${label}: ${message}`)
  }
  if (!isObject(document)) return fail("isn't a resolver document")
  if (!VERSIONS.has(String(document.version))) {
    fail(
      `version must be "2025.10" (or the spec's "2025-10-01"), not ${JSON.stringify(document.version)}`,
    )
  }
  if (!Array.isArray(document.resolutionOrder)) fail("resolutionOrder must be an array")

  const modifiers: Modifier[] = []
  /** A set's or modifier's step, once its contents are checked. */
  const step = (kind: Step["kind"], name: string, item: Json, where: string): Step => {
    if (kind === "set") {
      if (!Array.isArray(item.sources)) return fail(`${name} has no sources array`)
      return { kind, name, sources: item.sources }
    }
    if (!isObject(item.contexts)) return fail(`${where} needs a contexts map`)
    const contexts = Object.keys(item.contexts)
    if (contexts.length < 2) fail(`${where} needs at least two contexts, found ${contexts.length}`)
    for (const context of contexts) {
      if (!Array.isArray(item.contexts[context])) {
        fail(`${where}.contexts.${context} must be an array of sources`)
      }
    }
    if (item.default !== undefined && !contexts.includes(String(item.default))) {
      fail(`${where}.default "${item.default}" isn't one of its contexts (${contexts.join(", ")})`)
    }
    const fallback = item.default === undefined ? undefined : String(item.default)
    modifiers.push({ name, contexts, default: fallback })
    return { kind, name, contexts: item.contexts as Record<string, unknown[]> }
  }

  const names = new Set<string>()
  const order = (document.resolutionOrder as unknown[]).map((entry, i): Step => {
    const where = `resolutionOrder[${i}]`
    if (!isObject(entry)) return fail(`${where} must be a reference or an inline set or modifier`)
    if (typeof entry.$ref === "string") {
      const ref = entry.$ref
      const match = /^#\/(sets|modifiers)\/([^/]+)$/.exec(ref)
      if (!match) {
        return fail(
          `${where}: $ref must point at #/sets/<name> or #/modifiers/<name>, not "${ref}"`,
        )
      }
      const [, group = "", name = ""] = match
      const target = (document[group] as Json | undefined)?.[name]
      if (target === undefined) fail(`${where}: "${ref}" points at nothing`)
      if (names.has(ref)) fail(`${where}: "${ref}" appears twice`)
      names.add(ref)
      const kind = group === "sets" ? "set" : "modifier"
      return step(kind, name, { ...(target as Json), ...withoutRef(entry) }, `${group}.${name}`)
    }
    const { name, type } = entry
    if (typeof name !== "string" || (type !== "set" && type !== "modifier")) {
      return fail(`${where}: an inline entry needs a name and a type ("set" or "modifier")`)
    }
    if (names.has(name)) fail(`${where}: the name "${name}" appears twice`)
    names.add(name)
    return step(type, name, entry, `${where} (${name})`)
  })
  return { label, file, modifiers, order, document }
}

/**
 * Checks an input against the modifiers: string values, known modifiers and contexts
 * (case-insensitive keys), and a context for every modifier without a default. All problems are
 * reported together. Returns the context for every modifier, by its own name.
 */
export function checkInput(
  resolver: Resolver,
  input: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const problems: string[] = []
  const reported = new Set<string>()
  const chosen: Record<string, string> = {}
  const byName = new Map(resolver.modifiers.map((m) => [m.name.toLowerCase(), m]))
  for (const [key, value] of Object.entries(input)) {
    const modifier = byName.get(key.toLowerCase())
    if (!modifier) {
      const known = resolver.modifiers.map((m) => m.name).join(", ") || "none"
      problems.push(`"${key}" isn't a modifier (known: ${known})`)
    } else if (typeof value !== "string") {
      problems.push(`${modifier.name} must be a context name, not ${JSON.stringify(value)}`)
      reported.add(modifier.name)
    } else if (!modifier.contexts.includes(value)) {
      const known = modifier.contexts.join(", ")
      problems.push(`${modifier.name} has no context "${value}" (known: ${known})`)
      reported.add(modifier.name)
    } else {
      chosen[modifier.name] = value
    }
  }
  for (const modifier of resolver.modifiers) {
    if (chosen[modifier.name] !== undefined || reported.has(modifier.name)) continue
    if (modifier.default === undefined) {
      const contexts = modifier.contexts.join(", ")
      problems.push(`${modifier.name} has no default; choose one of ${contexts}`)
    } else {
      chosen[modifier.name] = modifier.default
    }
  }
  if (problems.length > 0) {
    throw new EmailKitError("invalid-theme", `${resolver.label}: ${problems.join("; ")}`)
  }
  return chosen
}

/**
 * Merges the sources for one input, in resolution order, later tokens winning, into one token
 * document; `readDtcgDocument()` resolves its aliases. A source is inline tokens, a set
 * (`#/sets/x`, which contributes its own sources), a file, or a file with a pointer. Keys next to
 * `$ref` override the referenced object's keys, shallowly. Returns the files it read too.
 */
export function resolveTokens(
  resolver: Resolver,
  input: Readonly<Record<string, unknown>>,
): { document: Json; files: string[] } {
  const chosen = checkInput(resolver, input)
  const files = new Set<string>([resolver.file])
  const merged: Json = {}
  const fail = (message: string): never => {
    throw new EmailKitError("invalid-theme", `${resolver.label}: ${message}`)
  }

  /**
   * The token groups one source gives. `base` is the file it's in, `document` that file's
   * content, and `stack` the references followed to reach it, to report a cycle.
   */
  const load = (
    source: unknown,
    base: string,
    document: Json,
    stack: readonly string[],
  ): Json[] => {
    if (!isObject(source)) return fail(`a source must be an object, not ${JSON.stringify(source)}`)
    if (typeof source.$ref !== "string") return [source]
    const ref = source.$ref
    const [path = "", pointer] = ref.split("#") as [string, string | undefined]
    const target = path ? resolve(dirname(base), path) : base
    const key = `${target}#${pointer ?? ""}`
    if (stack.includes(key)) {
      fail(`${[...stack, key].map((k) => display(k, resolver.file)).join(" → ")} is a cycle`)
    }
    if (path === "" && pointer?.startsWith("/modifiers/")) {
      fail(`"${ref}": only resolutionOrder can point at a modifier`)
    }
    if (pointer?.startsWith("/resolutionOrder")) {
      fail(`"${ref}": nothing may point into resolutionOrder`)
    }
    let doc = document
    if (path) {
      files.add(target)
      doc = readJson(target, display(target, resolver.file)) as Json
    }
    const value = pointer ? at(doc, pointer, ref) : doc
    if (path === "" && pointer?.startsWith("/sets/")) {
      const sources = isObject(value) ? value.sources : undefined
      if (!Array.isArray(sources)) return fail(`"${ref}" has no sources array`)
      return sources.flatMap((s: unknown) => load(s, target, doc, [...stack, key]))
    }
    if (!isObject(value)) return fail(`"${ref}" isn't a token group`)
    return [{ ...value, ...withoutRef(source) }]
  }

  for (const step of resolver.order) {
    const name = chosen[step.name] as string
    const sources = step.kind === "set" ? step.sources : (step.contexts[name] ?? [])
    for (const source of sources) {
      for (const tokens of load(source, resolver.file, resolver.document, [])) {
        merge(merged, tokens)
      }
    }
  }
  return { document: merged, files: [...files] }
}

/** Every input for the modifiers other than `except`, so each permutation can be checked. */
export function permutations(resolver: Resolver, except?: string): Record<string, string>[] {
  let inputs: Record<string, string>[] = [{}]
  for (const modifier of resolver.modifiers) {
    if (modifier.name === except) continue
    inputs = inputs.flatMap((input) =>
      modifier.contexts.map((c) => ({ ...input, [modifier.name]: c })),
    )
  }
  return inputs
}

/** An input as text, such as `brand=acme, size=lg`, for reports. */
export function inputLabel(input: Readonly<Record<string, string>>): string {
  return Object.entries(input)
    .map(([name, context]) => `${name}=${context}`)
    .join(", ")
}

/** Merges groups key by key. A token, anything with `$value`, replaces the earlier one whole. */
function merge(target: Json, source: Json): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key]
    if (isObject(value) && !("$value" in value) && isObject(existing) && !("$value" in existing)) {
      merge(existing, value)
    } else {
      target[key] = isObject(value) ? structuredClone(value) : value
    }
  }
}

/** The value a JSON pointer such as `/sets/base` points at, with `~1` and `~0` unescaped. */
function at(document: Json, pointer: string, ref: string): unknown {
  let value: unknown = document
  for (const raw of pointer.split("/").slice(1)) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~")
    if (!isObject(value) || !(key in value)) {
      throw new EmailKitError("invalid-theme", `"${ref}" points at nothing`)
    }
    value = value[key]
  }
  return value
}

/** An object without its `$ref`: the keys that override what it references. */
function withoutRef(value: Json): Json {
  const { $ref: _, ...rest } = value
  return rest
}

function readJson(file: string, label: string): unknown {
  const text = readText(file, label)
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new EmailKitError(
      "invalid-theme",
      `${label} isn't valid JSON: ${(error as Error).message}`,
    )
  }
}

/** A file reference for messages: relative to the resolver's folder, without an empty `#`. */
function display(key: string, base: string): string {
  return relative(dirname(base), key.replace(/#$/, "")) || key
}
