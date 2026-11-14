import { createHash } from "node:crypto"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import type { EmailDefinition } from "@email-kit/core"
import { EmailKitError, isEmailDefinition } from "@email-kit/core/internal"
import { rolldown } from "rolldown"

import { toSourceError } from "./errors.ts"
import { externals, isSource } from "./externals.ts"
import { writeOnce } from "./write-once.ts"

export interface LoadOptions {
  /** Where bundles are written. It must sit inside the project, so packages resolve. */
  readonly cacheDir: string
  /**
   * The host tsconfig, read only for `paths` aliases: `true` finds the nearest one. JSX
   * settings in it are always overridden.
   */
  readonly tsconfig?: string | boolean
}

/** A bundled and imported module. */
export interface LoadedModule {
  /** The module's exports. */
  readonly exports: Readonly<Record<string, unknown>>
  /** Every source file bundled into the module, for watch mode. */
  readonly files: readonly string[]
}

/** A loaded template file. */
export interface LoadedTemplate {
  /** Its default export, from `defineEmail()`. */
  readonly definition: EmailDefinition
  /** Every source file bundled into the template, for watch mode. */
  readonly files: readonly string[]
}

/** Lets stack traces use the bundles' inline source maps, so they point at the source lines. */
process.setSourceMapsEnabled(true)

/** Loads a template file, which must default-export a `defineEmail()` definition. */
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

/**
 * Bundles a TS or TSX file, such as a template or the config, with its local imports, then imports
 * it. JSX always uses email-kit's runtime, whatever the project's tsconfig says. The bundle has an
 * inline source map, so errors thrown while a template runs point at its own lines. A build error
 * becomes a `SourceError` with the file and line.
 */
export async function loadModule(file: string, options: LoadOptions): Promise<LoadedModule> {
  try {
    return await bundleAndImport(file, options)
  } catch (error) {
    throw toSourceError(error) ?? error
  }
}

/**
 * Bundles the file to `<cacheDir>/<hash>.mjs` and imports it. The name is the code's hash, so an
 * unchanged file reuses its bundle, and a changed one gets a new URL that Node hasn't cached.
 */
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
      sourcemapPathTransform: (source, map) => pathToFileURL(resolve(dirname(map), source)).href,
    })
    const [chunk] = output
    const hash = createHash("sha256").update(chunk.code).digest("hex").slice(0, 16)
    const bundled = join(options.cacheDir, `${hash}.mjs`)
    await writeOnce(bundled, chunk.code)
    const exports = (await import(pathToFileURL(bundled).href)) as Record<string, unknown>
    return { exports, files: chunk.moduleIds.filter(isSource) }
  } finally {
    await bundle.close()
  }
}
