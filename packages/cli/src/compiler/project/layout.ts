import { existsSync, readdirSync } from "node:fs"
import { basename, dirname, join } from "node:path"

import { EmailKitError } from "@email-kit/core/internal"

import { isDirectory, isWithin, relativePath } from "../../paths.ts"
import type { ResolvedConfig } from "../config/index.ts"
import type { Problem } from "../problems/index.ts"

/** The file in a template's folder that defines it. */
export const TEMPLATE_FILE = "template.tsx"

/** A template's folder: `<root>/<id>`. */
export function templateFolder(root: string, id: string): string {
  return join(root, id)
}

/** A template's messages in one locale: `<folder>/messages.<locale>.json`. */
export function messagesFile(folder: string, locale: string): string {
  return join(folder, `messages.${locale}.json`)
}

/** The id a template file declares by its place: the name of its folder. */
export function idOfTemplateFile(file: string): string {
  return basename(dirname(file))
}

/** The templates in the root folder, and the folders that look like templates but aren't. */
export interface Layout {
  /** Each `<root>/<id>/template.tsx`, sorted by folder. */
  readonly templates: readonly string[]
  /** Folders that can't compile as laid out, as problems for the compile to report. */
  readonly problems: readonly Problem[]
}

/** `messages.<locale>.json`. */
const MESSAGES_FILE = /^messages\.[^/\\]+\.json$/

/**
 * Finds the templates: each folder directly in `root` that holds `template.tsx`. Folders whose
 * names start with `_` or `.`, and the output folder, are never templates. Any other folder
 * without `template.tsx` is ignored, so components or fixtures can live beside the templates,
 * unless it holds messages: then its `template.tsx` is almost certainly missing or misnamed. The
 * old layout, `<root>/templates/*.tsx`, is reported with how to move.
 */
export function readLayout(config: Pick<ResolvedConfig, "root" | "out" | "dir" | "file">): Layout {
  if (!isDirectory(config.root)) {
    throw new EmailKitError(
      "no-templates-folder",
      `The email-kit folder ${relativePath(config.dir, config.root)} doesn't exist. ` +
        `Create it, or set "root" in ${basename(config.file)}`,
    )
  }
  const templates: string[] = []
  const problems: Problem[] = []
  const folders = readdirSync(config.root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !/^[_.]/.test(entry.name))
    .map((entry) => join(config.root, entry.name))
    .filter((folder) => !isWithin(config.out, folder) && !isWithin(folder, config.out))
    .sort()
  for (const folder of folders) {
    const rel = relativePath(config.dir, folder)
    if (existsSync(join(folder, TEMPLATE_FILE))) {
      templates.push(join(folder, TEMPLATE_FILE))
    } else if (
      basename(folder) === "templates" &&
      hasFile(folder, (name) => name.endsWith(".tsx"))
    ) {
      problems.push({
        code: "old-layout",
        file: rel,
        message:
          `${rel}/ uses the old layout. Move each template to <root>/<id>/${TEMPLATE_FILE}, ` +
          "and its messages from messages/<locale>/<id>.json to <root>/<id>/messages.<locale>.json",
      })
    } else if (hasFile(folder, (name) => MESSAGES_FILE.test(name))) {
      problems.push({
        code: "missing-template",
        file: rel,
        message:
          `${rel}/ has messages but no ${TEMPLATE_FILE}. Add it, or start the folder's name ` +
          "with _ if it isn't a template",
      })
    }
  }
  return { templates, problems }
}

/** Whether a folder directly holds a file whose name passes `test`. */
function hasFile(folder: string, test: (name: string) => boolean): boolean {
  return readdirSync(folder, { withFileTypes: true }).some(
    (entry) => entry.isFile() && test(entry.name),
  )
}
