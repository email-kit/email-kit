// DTCG Resolver Module 2025.10 (THM-01, research 05 §12.1): a `.resolver.json` names token
// `sets` and `modifiers` (each with named `contexts`) and a `resolutionOrder`. An input picks one
// context per modifier; the sources are merged in order, later tokens winning, into one token
// document whose aliases are resolved afterwards (by readDtcg). Same-document pointers
// (`#/sets/x`) and relative files (`brand.tokens.json`, `brand.json#/color`) are supported;
// remote URLs aren't.

import { readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"

import { EmailKitError } from "@email-kit/core/internal"

type Json = Record<string, unknown>

export interface Modifier {
  readonly name: string
  readonly contexts: readonly string[]
  readonly default: string | undefined
}

export interface Resolver {
  /** The resolver file, as configured */
  readonly label: string
  readonly file: string
  readonly modifiers: readonly Modifier[]
  readonly document: Json
}

// The spec's own examples disagree on the version string; Terrazzo writes `2025.10`.
const VERSIONS = new Set(["2025-10-01", "2025-11-01", "2025.10"])

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
  const check = (name: string, value: unknown, where: string) => {
    if (!isObject(value) || !isObject(value.contexts)) return fail(`${where} needs a contexts map`)
    const contexts = Object.keys(value.contexts)
    // Zero contexts is a MUST error in the spec, one context a SHOULD.
    if (contexts.length < 2) fail(`${where} needs at least two contexts, found ${contexts.length}`)
    for (const context of contexts) {
      if (!Array.isArray(value.contexts[context]))
        fail(`${where}.contexts.${context} must be an array of sources`)
    }
    if (value.default !== undefined && !contexts.includes(String(value.default))) {
      fail(`${where}.default "${value.default}" isn't one of its contexts (${contexts.join(", ")})`)
    }
    modifiers.push({
      name,
      contexts,
      default: value.default === undefined ? undefined : String(value.default),
    })
  }
  const names = new Set<string>()
  for (const [i, entry] of (document.resolutionOrder as unknown[]).entries()) {
    const where = `resolutionOrder[${i}]`
    if (!isObject(entry)) fail(`${where} must be a reference or an inline set or modifier`)
    const item = entry as Json
    if (typeof item.$ref === "string") {
      const match = /^#\/(sets|modifiers)\/([^/]+)$/.exec(item.$ref)
      if (!match)
        fail(`${where}: $ref must point at #/sets/<name> or #/modifiers/<name>, not "${item.$ref}"`)
      const [, kind, name] = match as RegExpExecArray
      const target = (document[kind as string] as Json | undefined)?.[name as string]
      if (target === undefined) fail(`${where}: "${item.$ref}" points at nothing`)
      if (names.has(item.$ref)) fail(`${where}: "${item.$ref}" appears twice`)
      names.add(item.$ref)
      if (kind === "modifiers")
        check(name as string, { ...(target as Json), ...strip(item) }, `modifiers.${name}`)
      continue
    }
    if (typeof item.name !== "string" || (item.type !== "set" && item.type !== "modifier")) {
      fail(`${where}: an inline entry needs a name and a type ("set" or "modifier")`)
    }
    if (names.has(item.name as string)) fail(`${where}: the name "${item.name}" appears twice`)
    names.add(item.name as string)
    if (item.type === "modifier") check(item.name as string, item, `${where} (${item.name})`)
  }
  return { label, file, modifiers, document }
}

/**
 * The input checked against the modifiers (resolver §6.1): string values, known modifiers and
 * contexts (case-insensitive keys), and a context for every modifier without a default. All
 * problems are reported together.
 */
export function checkInput(
  resolver: Resolver,
  input: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const problems: string[] = []
  const chosen: Record<string, string> = {}
  const byName = new Map(resolver.modifiers.map((m) => [m.name.toLowerCase(), m]))
  for (const [key, value] of Object.entries(input)) {
    const modifier = byName.get(key.toLowerCase())
    if (!modifier) {
      problems.push(
        `"${key}" isn't a modifier (known: ${resolver.modifiers.map((m) => m.name).join(", ") || "none"})`,
      )
    } else if (typeof value !== "string") {
      problems.push(`${modifier.name} must be a context name, not ${JSON.stringify(value)}`)
    } else if (!modifier.contexts.includes(value)) {
      problems.push(
        `${modifier.name} has no context "${value}" (known: ${modifier.contexts.join(", ")})`,
      )
    } else {
      chosen[modifier.name] = value
    }
  }
  for (const modifier of resolver.modifiers) {
    if (
      chosen[modifier.name] !== undefined ||
      problems.some((p) => p.startsWith(`${modifier.name} `))
    )
      continue
    if (modifier.default === undefined) {
      problems.push(
        `${modifier.name} has no default; choose one of ${modifier.contexts.join(", ")}`,
      )
    } else {
      chosen[modifier.name] = modifier.default
    }
  }
  if (problems.length > 0) {
    throw new EmailKitError("invalid-theme", `${resolver.label}: ${problems.join("; ")}`)
  }
  return chosen
}

/** One permutation: the merged token document and the files it read. */
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

  // A source: inline tokens, a set (`#/sets/x`), a file, or a file with a pointer. Keys next to
  // `$ref` override the referenced object's keys, shallowly (resolver §4.3.2).
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
    if (stack.includes(key))
      fail(`${[...stack, key].map((k) => display(k, resolver.file)).join(" → ")} is a cycle`)
    if (path === "" && pointer?.startsWith("/modifiers/"))
      fail(`"${ref}": only resolutionOrder can point at a modifier`)
    if (pointer?.startsWith("/resolutionOrder"))
      fail(`"${ref}": nothing may point into resolutionOrder`)
    let doc = document
    if (path) {
      files.add(target)
      doc = readJson(target, display(target, resolver.file)) as Json
    }
    const value = pointer ? at(doc, pointer, ref) : doc
    const extra = strip(source)
    // A set referenced as a source contributes its own sources.
    if (path === "" && pointer?.startsWith("/sets/")) {
      const sources = (value as Json).sources
      if (!Array.isArray(sources)) fail(`"${ref}" has no sources array`)
      return (sources as unknown[]).flatMap((s) => load(s, target, doc, [...stack, key]))
    }
    if (!isObject(value)) return fail(`"${ref}" isn't a token group`)
    return [{ ...value, ...extra }]
  }

  const document = resolver.document
  const sets = (document.sets ?? {}) as Json
  const modifiers = (document.modifiers ?? {}) as Json
  for (const entry of document.resolutionOrder as Json[]) {
    let item = entry
    let kind = entry.type as string | undefined
    if (typeof entry.$ref === "string") {
      const [, k, name] = /^#\/(sets|modifiers)\/(.+)$/.exec(entry.$ref) as RegExpExecArray
      kind = k === "sets" ? "set" : "modifier"
      item = {
        ...((k === "sets" ? sets : modifiers)[name as string] as Json),
        ...strip(entry),
        name,
      }
    }
    const sources =
      kind === "set" ? item.sources : (item.contexts as Json)[chosen[item.name as string] as string]
    if (!Array.isArray(sources)) fail(`${String(item.name)} has no sources array`)
    for (const source of sources as unknown[]) {
      for (const tokens of load(source, resolver.file, document, [])) merge(merged, tokens)
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

// Groups merge key by key; a token (anything with $value) replaces the earlier one whole.
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

function strip(value: Json): Json {
  const { $ref: _, ...rest } = value
  return rest
}

function readJson(file: string, label: string): unknown {
  let text: string
  try {
    text = readFileSync(file, "utf8")
  } catch {
    throw new EmailKitError("invalid-theme", `The theme file ${label} can't be read`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new EmailKitError(
      "invalid-theme",
      `${label} isn't valid JSON: ${(error as Error).message}`,
    )
  }
}

function display(key: string, base: string): string {
  return relative(dirname(base), key.replace(/#$/, "")) || key
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
