import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"

import { parse as parseJsonc } from "jsonc-parser"

/** email-kit's JSX import source: the package whose `jsx-runtime` templates compile with. */
export const IMPORT_SOURCE = "@email-kit/core"

/** The comment that names email-kit's JSX runtime for one file, whatever the tsconfig says. */
export const JSX_PRAGMA = `/** @jsxImportSource ${IMPORT_SOURCE} */`

/** The parts of a tsconfig this module reads. */
interface Tsconfig {
  readonly extends?: string | readonly string[]
  readonly compilerOptions?: { readonly jsxImportSource?: string }
  readonly references?: readonly unknown[]
}

/**
 * The `jsxImportSource` TypeScript uses for the files in `dir`, from the nearest tsconfig.json at
 * or above it, following `extends`. The search stops at the project, the nearest folder with a
 * package.json. `undefined` when it can't tell: no tsconfig in the project, one that doesn't set
 * it, or a solution-style tsconfig with `references`, whose files belong to the configs it
 * references (a Vite app's `tsconfig.app.json`, say).
 */
export function configuredImportSource(dir: string): string | undefined {
  for (let folder = resolve(dir); ; folder = dirname(folder)) {
    const file = join(folder, "tsconfig.json")
    if (existsSync(file)) {
      const json = readTsconfig(file)
      if (!json || json.references !== undefined) return undefined
      return importSourceOf(file, json, new Set())
    }
    if (existsSync(join(folder, "package.json")) || dirname(folder) === folder) return undefined
  }
}

/**
 * Whether a JSX file in `dir` needs the pragma to type-check with email-kit's JSX: yes, unless
 * its tsconfig already makes `@email-kit/core` the import source.
 */
export function needsPragma(dir: string): boolean {
  return configuredImportSource(dir) !== IMPORT_SOURCE
}

/** A file's `@jsxImportSource` pragma: the import source it names, and its offset in the text. */
export interface Pragma {
  readonly source: string
  readonly at: number
}

/**
 * A file's `@jsxImportSource` pragma. TypeScript reads pragmas only from the comments before the
 * first token, so one further down doesn't count.
 */
export function pragmaOf(text: string): Pragma | undefined {
  const leading = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/.exec(text)?.[0] ?? ""
  const match = /@jsxImportSource\s+(\S+?)(?=\s|\*\/|$)/.exec(leading)
  return match?.[1] ? { source: match[1], at: match.index } : undefined
}

/** A tsconfig, which may have comments and trailing commas; `undefined` if it can't be read. */
function readTsconfig(file: string): Tsconfig | undefined {
  try {
    return (parseJsonc(readFileSync(file, "utf8")) ?? {}) as Tsconfig
  } catch {
    return undefined
  }
}

/** A tsconfig's `jsxImportSource`, its own or, failing that, the last `extends` that sets it. */
function importSourceOf(file: string, json: Tsconfig, seen: Set<string>): string | undefined {
  const own = json.compilerOptions?.jsxImportSource
  if (own !== undefined || seen.has(file)) return own
  seen.add(file)
  const bases = typeof json.extends === "string" ? [json.extends] : (json.extends ?? [])
  for (const base of [...bases].reverse()) {
    const path = resolveExtends(file, base)
    const parent = path && readTsconfig(path)
    const source = parent ? importSourceOf(path, parent, seen) : undefined
    if (source !== undefined) return source
  }
  return undefined
}

/** Where an `extends` entry points: a relative path, or a package's tsconfig. */
function resolveExtends(from: string, base: string): string | undefined {
  if (base.startsWith(".") || base.startsWith("/")) {
    const path = resolve(dirname(from), base)
    if (existsSync(path)) return path
    return existsSync(`${path}.json`) ? `${path}.json` : undefined
  }
  const require = createRequire(from)
  for (const request of [base, `${base}/tsconfig.json`, `${base}.json`]) {
    try {
      return require.resolve(request)
    } catch {}
  }
  return undefined
}
