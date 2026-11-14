import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

/**
 * Where @email-kit/cli's `email-kit` command is: the file its package.json's `bin` names,
 * resolved from this package's own dependencies, so it's always the CLI version this package was
 * installed with. `bin` may be a single path or an object of commands.
 */
export function cliPath(): string {
  const manifest = createRequire(import.meta.url).resolve("@email-kit/cli/package.json")
  const { bin } = JSON.parse(readFileSync(manifest, "utf8")) as {
    bin?: string | Record<string, string>
  }
  const command = typeof bin === "string" ? bin : bin?.["email-kit"]
  if (!command) {
    throw new Error(
      `@email-kit/cli in ${dirname(manifest)} has no email-kit command; reinstall create-email-kit`,
    )
  }
  return join(dirname(manifest), command)
}
