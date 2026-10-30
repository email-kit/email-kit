// Loads a TSX template with email-kit's own JSX settings, whatever the host tsconfig says
// (JSX-03). rolldown bundles the template with its local imports; packages stay external. See
// spikes/jsx-transform/RESULTS.md for why rolldown (P0-11).

import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { pathToFileURL } from "node:url"

import type { EmailDefinition } from "@email-kit/core"
import { EmailKitError, isEmailDefinition } from "@email-kit/core/internal"
import { type Plugin, rolldown } from "rolldown"

export interface LoadOptions {
  /** Where bundles are written. It must sit inside the project, so packages resolve. */
  readonly cacheDir: string
  /**
   * The host tsconfig, read only for `paths` aliases: `true` finds the nearest one. JSX
   * settings in it are always overridden.
   */
  readonly tsconfig?: string | boolean
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
  const bundle = await rolldown({
    input: file,
    platform: "node",
    tsconfig: options.tsconfig ?? true,
    transform: { jsx: { runtime: "automatic", importSource: "@email-kit/core" } },
    plugins: [externals],
    logLevel: "silent",
  })
  try {
    const { output } = await bundle.generate({ format: "esm" })
    const [chunk] = output
    const hash = createHash("sha256").update(chunk.code).digest("hex").slice(0, 16)
    const bundled = join(options.cacheDir, `${hash}.mjs`)
    await mkdir(options.cacheDir, { recursive: true })
    await writeFile(bundled, chunk.code)
    const module = (await import(pathToFileURL(bundled).href)) as { default?: unknown }
    if (!isEmailDefinition(module.default)) {
      throw new EmailKitError(
        "no-definition",
        `${file} must have \`export default defineEmail({ … })\``,
      )
    }
    return { definition: module.default, files: chunk.moduleIds.filter((id) => SOURCE.test(id)) }
  } finally {
    await bundle.close()
  }
}
