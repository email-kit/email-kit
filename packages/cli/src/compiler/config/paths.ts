import { dirname, join, relative, resolve } from "node:path"
import { isDirectory, isWithin } from "../../paths.ts"
import type { ResolvedConfig } from "./index.ts"

import type { Problems } from "./shared.ts"

/** The folders in a resolved config. */
export type ConfigPaths = Pick<ResolvedConfig, "root" | "templates" | "messages" | "out">

/**
 * Reads the folders. `root` defaults by project layout and the others sit inside it. The compiler
 * writes and removes files in `out`, so it must not overlap the source folders or hold the project.
 */
export function readPaths(
  config: Record<string, unknown>,
  dir: string,
  problems: Problems,
): ConfigPaths {
  const path = (key: string): string | undefined => {
    const option = config[key]
    if (option === undefined) return undefined
    if (typeof option !== "string" || option.trim() === "") {
      problems.push(`${key}: must be a non-empty path relative to the config file`)
      return undefined
    }
    return resolve(dir, option)
  }

  const root =
    path("root") ??
    (isDirectory(join(dir, "src")) ? join(dir, "src", "email-kit") : join(dir, "email-kit"))
  const templates = path("templates") ?? join(root, "templates")
  const messages = path("messages") ?? join(root, "messages")
  const out = path("out") ?? join(root, "compiled")

  for (const [name, folder] of [
    ["templates", templates],
    ["messages", messages],
  ] as const) {
    if (isWithin(folder, out) || isWithin(out, folder)) {
      problems.push(`out: must not overlap the ${name} folder (${relative(dir, folder)})`)
    }
  }

  if (isWithin(out, dir)) {
    problems.push(
      "out: must not contain the project; use its own folder, such as src/email-kit/compiled",
    )
  }
  return { root, templates, messages, out }
}

/**
 * The closest `node_modules` at or above `from`. Bundled modules are cached inside it so their
 * imports resolve to the project's packages.
 */
export function nearestNodeModules(from: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    if (isDirectory(join(dir, "node_modules"))) return join(dir, "node_modules")
    if (dirname(dir) === dir) return undefined
  }
}
