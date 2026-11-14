import { isAbsolute } from "node:path"

import type { Plugin } from "rolldown"

/** A TypeScript source file, which the bundler compiles, as opposed to compiled JavaScript. */
export function isSource(id: string): boolean {
  return /\.[cm]?tsx?$/.test(id) && !id.endsWith(".d.ts")
}

/**
 * Bundles source files: relative imports, `paths` aliases and workspace packages written in
 * TypeScript. Compiled packages stay external, so `@email-kit/core` is the same module instance
 * the compiler uses, and its theme and scope state is shared.
 */
export const externals: Plugin = {
  name: "email-kit:externals",
  async resolveId(source, importer, extra) {
    if (source.startsWith(".") || isAbsolute(source) || source.startsWith("\0")) return null
    const resolved = await this.resolve(source, importer, { ...extra, skipSelf: true })
    if (resolved && !resolved.external && isSource(resolved.id)) return resolved
    return { id: source, external: true }
  },
}
