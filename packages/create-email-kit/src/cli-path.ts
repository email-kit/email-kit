// Where @email-kit/cli's `email-kit` command is, from this package's own dependencies.

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

export function cliPath(): string {
  const manifest = createRequire(import.meta.url).resolve("@email-kit/cli/package.json")
  const { bin } = JSON.parse(readFileSync(manifest, "utf8")) as { bin: Record<string, string> }
  return join(dirname(manifest), bin["email-kit"] as string)
}
