import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, sep } from "node:path"

import type { OutputFile } from "./index.ts"

/** What writing the output changed, as paths relative to the output folder. */
export interface WriteResult {
  readonly written: readonly string[]
  readonly unchanged: readonly string[]
  readonly deleted: readonly string[]
}

/**
 * Writes the files, skipping unchanged ones, and deletes files the compiler wrote before that are
 * no longer output. Those are the previous manifest.json's `files`, so a file someone else put in
 * the folder is never deleted.
 */
export function writeOutput(out: string, files: readonly OutputFile[]): WriteResult {
  const next = new Set(files.map((file) => file.path))
  const deleted: string[] = []
  for (const path of ownedFiles(out)) {
    if (next.has(path)) continue
    const target = resolveIn(out, path)
    rmSync(target, { force: true })
    removeEmptyParents(out, dirname(target))
    deleted.push(path)
  }

  const written: string[] = []
  const unchanged: string[] = []
  for (const file of files) {
    const target = resolveIn(out, file.path)
    if (existsSync(target) && readFileSync(target, "utf8") === file.content) {
      unchanged.push(file.path)
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content)
    written.push(file.path)
  }
  return { written, unchanged, deleted }
}

/**
 * The previous manifest.json's `files`. Only relative paths that stay inside the folder are kept,
 * so a hand-edited manifest can't make a compile delete files elsewhere.
 */
function ownedFiles(out: string): string[] {
  const manifest = join(out, "manifest.json")
  if (!existsSync(manifest)) return []
  try {
    const { files } = JSON.parse(readFileSync(manifest, "utf8")) as { files?: unknown }
    if (!Array.isArray(files)) return []
    return files.filter(
      (path): path is string =>
        typeof path === "string" &&
        path !== "" &&
        !path.startsWith("/") &&
        !path.includes("\\") &&
        !path.split("/").includes(".."),
    )
  } catch {
    return []
  }
}

/** A `/`-separated path inside the output folder, with the platform's separators. */
function resolveIn(out: string, path: string): string {
  return join(out, ...path.split("/"))
}

/** Removes `dir` and the folders above it while they're empty, stopping at the output folder. */
function removeEmptyParents(out: string, dir: string): void {
  for (let current = dir; current.startsWith(out + sep); current = dirname(current)) {
    if (readdirSync(current).length > 0) return
    rmdirSync(current)
  }
}
