import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

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

/** The decoded double-quoted string literals of a generated module (.ts or oxc-printed .mjs). */
function literals(module: string): Set<string> {
  const out = new Set<string>()
  for (const match of module.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
    try {
      out.add(JSON.parse(asJson(match[0])) as string)
    } catch {}
  }
  return out
}

/** The escapes JavaScript has and JSON lacks, as JSON writes them. */
const JSON_ESCAPES: Readonly<Record<string, string>> = {
  "'": "'",
  v: "\\u000b",
  "0": "\\u0000",
}

/**
 * A JavaScript string literal as JSON: oxc writes `\\xA0`, `\\'`, `\\v` and `\\0`, which JSON
 * lacks.
 */
function asJson(literal: string): string {
  return literal.replace(/\\(x[0-9a-fA-F]{2}|['v]|0(?![0-9])|[\s\S])/g, (sequence, code: string) =>
    code[0] === "x" ? `\\u00${code.slice(1)}` : (JSON_ESCAPES[code] ?? sequence),
  )
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
      if (onDisk(context, "manifest.json") === undefined) {
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
    },
  },
  {
    id: "output.manifest",
    level: "error",
    rule: "The manifest lists exactly the compiled templates and locales, and its hashes match the files.",
    fix: "Don't edit compiled files by hand: change the template or messages and run `email-kit compile`.",
    run: (context, report) => {
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
    id: "output.module-matches",
    level: "error",
    rule: "The templates inside the generated module equal the .html and .txt files beside it.",
    fix: "Run `email-kit compile`: the module and the files must come from the same compile.",
    run: (context, report) => {
      const module = onDisk(context, "index.ts") ?? onDisk(context, "index.mjs")
      if (module === undefined) return
      const strings = literals(module)
      for (const expected of context.output.expected) {
        if (!/\/[^/]+\.(html|txt)$/.test(expected.path)) continue
        const actual = onDisk(context, expected.path)
        if (actual !== undefined && !strings.has(actual)) {
          report({
            message: `The module's copy of ${expected.path} differs from the file`,
            subject: { file: `${context.output.dir}/${expected.path}` },
          })
        }
      }
    },
  },
  {
    id: "output.no-orphans",
    level: "error",
    rule: "Every compiled template in the output folder has a source template.",
    fix: "Delete the folder, or restore its template: the module may still export a template that no longer exists.",
    run: (context, report) => {
      const dir = context.output.absolute
      if (!existsSync(dir)) return
      const ids = new Set(context.templates.map((t) => t.id))
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (
          statSync(path).isDirectory() &&
          !ids.has(name) &&
          existsSync(join(path, "schema.json"))
        ) {
          report({
            message: `${name}/ is compiled output with no template`,
            subject: { file: `${context.output.dir}/${name}` },
          })
        }
      }
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
