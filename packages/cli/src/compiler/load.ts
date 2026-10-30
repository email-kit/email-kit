// Loads TS and TSX files (templates, the config) with email-kit's own JSX settings, whatever the
// host tsconfig says (JSX-03). rolldown bundles a file with its local imports; packages stay
// external. Why rolldown: docs/spikes/p0-11-jsx-transform.md and ADR 0006.

import { createHash, randomUUID } from "node:crypto"
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { stripVTControlCharacters } from "node:util"

import type { EmailDefinition } from "@email-kit/core"
import { EmailKitError, isEmailDefinition } from "@email-kit/core/internal"
import { type Plugin, rolldown } from "rolldown"

import { SourceError } from "./problems.ts"

export interface LoadOptions {
  /** Where bundles are written. It must sit inside the project, so packages resolve. */
  readonly cacheDir: string
  /**
   * The host tsconfig, read only for `paths` aliases: `true` finds the nearest one. JSX
   * settings in it are always overridden.
   */
  readonly tsconfig?: string | boolean
}

export interface LoadedModule {
  readonly exports: Readonly<Record<string, unknown>>
  /** Every source file bundled into the module, for watch mode. */
  readonly files: readonly string[]
}

export interface LoadedTemplate {
  readonly definition: EmailDefinition
  /** Every source file bundled into the template, for watch mode. */
  readonly files: readonly string[]
}

const SOURCE = /\.[cm]?tsx?$/

// Bundle source files (relative imports, aliases, TS-source workspace packages); leave compiled
// packages external, so @email-kit/core is the same module instance the compiler uses.
const externals: Plugin = {
  name: "email-kit:externals",
  async resolveId(source, importer, extra) {
    if (source.startsWith(".") || isAbsolute(source) || source.startsWith("\0")) return null
    const resolved = await this.resolve(source, importer, { ...extra, skipSelf: true })
    if (
      resolved &&
      !resolved.external &&
      SOURCE.test(resolved.id) &&
      !resolved.id.endsWith(".d.ts")
    ) {
      return resolved
    }
    return { id: source, external: true }
  },
}

export async function loadTemplate(file: string, options: LoadOptions): Promise<LoadedTemplate> {
  const { exports, files } = await loadModule(file, options)
  if (!isEmailDefinition(exports.default)) {
    throw new EmailKitError(
      "no-definition",
      `${file} must have \`export default defineEmail({ … })\``,
    )
  }
  return { definition: exports.default, files }
}

// With inline source maps, errors thrown while a template runs point at its .tsx lines (CLI-06).
process.setSourceMapsEnabled(true)

/** Bundles and imports a TS or TSX file. */
export async function loadModule(file: string, options: LoadOptions): Promise<LoadedModule> {
  try {
    return await bundleAndImport(file, options)
  } catch (error) {
    throw toSourceError(error) ?? error
  }
}

async function bundleAndImport(file: string, options: LoadOptions): Promise<LoadedModule> {
  const bundle = await rolldown({
    input: file,
    platform: "node",
    tsconfig: options.tsconfig ?? true,
    transform: { jsx: { runtime: "automatic", importSource: "@email-kit/core" } },
    plugins: [externals],
    logLevel: "silent",
  })
  try {
    const { output } = await bundle.generate({
      format: "esm",
      sourcemap: "inline",
      // rolldown writes sources relative to a virtual <cwd>/dist output; make them absolute.
      sourcemapPathTransform: (source, map) => pathToFileURL(resolve(dirname(map), source)).href,
    })
    const [chunk] = output
    const hash = createHash("sha256").update(chunk.code).digest("hex").slice(0, 16)
    const bundled = join(options.cacheDir, `${hash}.mjs`)
    await writeOnce(bundled, chunk.code)
    const exports = (await import(pathToFileURL(bundled).href)) as Record<string, unknown>
    return { exports, files: chunk.moduleIds.filter((id) => SOURCE.test(id)) }
  } finally {
    await bundle.close()
  }
}

interface RolldownDiagnostic {
  readonly code?: string
  readonly message?: string
  readonly id?: string
  readonly loc?: { readonly file?: string; readonly line: number; readonly column: number }
}

const CODES: Readonly<Record<string, string>> = {
  PARSE_ERROR: "syntax-error",
  UNRESOLVED_IMPORT: "unresolved-import",
}

// rolldown reports build failures as `{ errors: [...] }` with 0-based columns.
function toSourceError(error: unknown): SourceError | undefined {
  const [first] = (error as { errors?: readonly RolldownDiagnostic[] } | null)?.errors ?? []
  if (!first) return undefined
  const file = first.loc?.file ?? first.id
  // The message embeds rolldown's own coloured frame; keep the first line, without the colours
  // and the "[PARSE_ERROR]" prefix (we show our own frame and id).
  const message = stripVTControlCharacters(first.message ?? String(error))
    .split("\n")[0]
    ?.replace(/^\[[A-Z_]+\]\s*/, "")
  return new SourceError(
    CODES[first.code ?? ""] ?? "load-failed",
    message || String(error),
    file && first.loc ? { file, line: first.loc.line, column: first.loc.column + 1 } : undefined,
  )
}

// The name is a content hash, so an existing file is already right. Otherwise write a temporary
// file and rename it into place: another compile (a second test, `dev` next to `compile`) may be
// importing the same bundle, and must never see it half-written.
async function writeOnce(file: string, content: string): Promise<void> {
  try {
    await access(file)
    return
  } catch {}
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, content)
  try {
    await rename(temporary, file)
  } catch (error) {
    // Windows refuses to replace a file that is open; the one already there has the same content.
    await rm(temporary, { force: true })
    try {
      await access(file)
    } catch {
      throw error
    }
  }
}
