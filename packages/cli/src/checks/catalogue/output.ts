import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { toPosix } from "../../paths.ts"

import type { Check, CheckContext } from "../types.ts"

/** A file's SHA-256, as the manifest records it. */
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")

/**
 * A file's committed content, or `undefined` for a gitignored output folder: that's a local build,
 * where drift is expected, and `output.gitignored` reports it instead.
 */
function onDisk(context: CheckContext, path: string): string | undefined {
  if (context.output.gitignored) return undefined
  const file = join(context.output.absolute, ...path.split("/"))
  return existsSync(file) ? readFileSync(file, "utf8") : undefined
}

/** Every file in a folder, as `/`-separated relative paths, except those under a `.` name. */
function filesIn(folder: string): string[] {
  if (!existsSync(folder)) return []
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => toPosix(relative(folder, join(entry.parentPath, entry.name))))
    .filter((path) => !path.split("/").some((part) => part.startsWith(".")))
    .sort()
}

/**
 * Whether a file sits in a folder named like no template: `output.no-orphans` reports that
 * folder once, so `output.drift` leaves its files out.
 */
function isTemplateFolderFile(context: CheckContext, path: string): boolean {
  const [folder, ...rest] = path.split("/")
  return rest.length > 0 && !context.templates.some((t) => t.id === folder)
}

/** The `output.*` checks: the committed output folder matches what a compile writes now. */
export const OUTPUT: readonly Check[] = [
  {
    id: "output.drift",
    level: "error",
    rule: "The committed output equals a fresh compile.",
    fix: "Run `email-kit compile` and commit the result: the module your app imports is out of date.",
    run: (context, report) => {
      const { output } = context
      const file = (path: string) => `${output.dir}/${path}`
      if (onDisk(context, "index.ts") === undefined && onDisk(context, "index.mjs") === undefined) {
        if (!output.gitignored) {
          report({ message: `${output.dir} hasn't been compiled`, subject: { file: output.dir } })
        }
        return
      }
      for (const expected of output.expected) {
        const actual = onDisk(context, expected.path)
        if (actual === undefined)
          report({ message: `${expected.path} is missing`, subject: { file: file(expected.path) } })
        else if (actual !== expected.content) {
          report({
            message: `${expected.path} differs from a fresh compile`,
            subject: { file: file(expected.path) },
          })
        }
      }
      const expected = new Set(output.expected.map((e) => e.path))
      for (const path of filesIn(output.absolute)) {
        if (!expected.has(path) && !isTemplateFolderFile(context, path)) {
          report({
            message: `${path} isn't written by a fresh compile`,
            subject: { file: file(path) },
          })
        }
      }
    },
  },
  {
    id: "output.manifest",
    level: "error",
    rule: "With `contract: true`, the manifest lists exactly the compiled templates and locales, and its hashes match the files.",
    fix: "Don't edit compiled files by hand: change the template or messages and run `email-kit compile`.",
    run: (context, report) => {
      // Without contract a compile writes no manifest, and output.drift reports a stray one.
      if (!context.output.expected.some((file) => file.path === "manifest.json")) return
      const text = onDisk(context, "manifest.json")
      if (text === undefined) return
      const subject = { file: `${context.output.dir}/manifest.json` }
      let manifest: {
        templates?: {
          id: string
          locales: Record<string, Record<string, { file: string; sha256: string }>>
        }[]
      }
      try {
        manifest = JSON.parse(text)
      } catch {
        report({ message: "manifest.json isn't valid JSON", subject })
        return
      }
      const expected = context.templates.map((t) => t.id).sort()
      const listed = (manifest.templates ?? []).map((t) => t.id).sort()
      if (expected.join() !== listed.join()) {
        report({
          message: `The manifest lists ${listed.join(", ") || "nothing"}; the project has ${expected.join(", ")}`,
          subject,
        })
      }
      for (const template of manifest.templates ?? []) {
        for (const parts of Object.values(template.locales ?? {})) {
          for (const part of ["html", "text"]) {
            const entry = parts[part]
            const content = entry && onDisk(context, entry.file)
            if (entry && content !== undefined && sha256(content) !== entry.sha256) {
              report({ message: `${entry.file} was changed after it was compiled`, subject })
            }
          }
        }
      }
    },
  },
  {
    id: "output.no-orphans",
    level: "error",
    rule: "Every template folder in the output folder has a source template.",
    fix: "Delete the folder, or restore its template: the module may still export a template that no longer exists.",
    run: (context, report) => {
      const dir = context.output.absolute
      if (!existsSync(dir)) return
      const ids = new Set(context.templates.map((t) => t.id))
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory() && !name.startsWith(".") && !ids.has(name)) {
          report({
            message: `${name}/ is compiled output with no template`,
            subject: { file: `${context.output.dir}/${name}` },
          })
        }
      }
    },
  },
  {
    id: "output.runtime-dependency",
    level: "error",
    rule: "`@email-kit/runtime` is in the app's dependencies, not its devDependencies: the generated module imports it when the app runs.",
    fix: "Install it as a dependency: `npm install @email-kit/runtime` (or your package manager's equivalent). Production installs leave devDependencies out.",
    run: (context, report) => {
      const runtime = context.output.runtime
      if (!runtime || runtime.section === "dependencies") return
      report({
        message:
          runtime.section === "missing"
            ? `${runtime.file} doesn't list @email-kit/runtime, which the generated module imports`
            : `${runtime.file} lists @email-kit/runtime in devDependencies: a production install leaves it out`,
        subject: { file: runtime.file },
      })
    },
  },
  {
    id: "output.gitignored",
    level: "warn",
    rule: "The output folder is committed, not gitignored.",
    fix: "Commit the output so deploys don't need a compile step, or compile in your build and set this check off with that reason.",
    run: (context, report) => {
      if (context.output.gitignored)
        report({
          message: `git ignores ${context.output.dir}`,
          subject: { file: context.output.dir },
        })
    },
  },
]
