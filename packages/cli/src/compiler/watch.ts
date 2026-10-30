// `email-kit compile --watch` (P1-087, BLD-12): recompile when a template, a component it
// imports, a message file or the config changes. Folders are watched rather than files, because
// editors often save by renaming over the file, which ends a file watch. Every run is a full
// compile for now; incremental compile is P1-091. On macOS a recursive watch (FSEvents) goes live
// a moment after it is created, so a change made within milliseconds of starting can be missed.

import { existsSync, type FSWatcher, watch } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"

import { type CompileOptions, type CompileResult, compileWithConfig } from "./build.ts"
import { CONFIG_FILES, loadConfig } from "./config.ts"

export interface WatchOptions extends CompileOptions {
  /** Called after every compile: the result, or the error that stopped it. */
  readonly onCompile: (outcome: { result: CompileResult } | { error: unknown }) => void
  /** How long to wait for more changes before compiling. Default 80 ms. */
  readonly debounceMs?: number
}

export interface Watcher {
  close(): void
}

export async function watchProject(options: WatchOptions): Promise<Watcher> {
  const watchers = new Map<string, FSWatcher>()
  let closed = false
  let running = false
  let again = false
  let timer: ReturnType<typeof setTimeout> | undefined
  // What triggers a compile: folders watched recursively, and single files in other folders.
  let folders: string[] = []
  let files = new Set<string>()
  let out = ""

  const run = async () => {
    if (running) {
      again = true
      return
    }
    running = true
    try {
      // The config first, so its folders are watched even when a template fails to compile.
      const config = await loadConfig(options)
      out = config.out
      folders = [config.templates, config.messages]
      files.add(config.file)
      const result = await compileWithConfig(config)
      files = new Set([
        config.file,
        ...result.theme.files,
        ...result.templates.flatMap((t) => t.sources),
      ])
      options.onCompile({ result })
    } catch (error) {
      options.onCompile({ error })
    } finally {
      running = false
      if (!closed) {
        refresh()
        if (again) {
          again = false
          schedule()
        }
      }
    }
  }

  const schedule = () => {
    if (closed) return
    clearTimeout(timer)
    timer = setTimeout(run, options.debounceMs ?? 80)
  }

  const relevant = (path: string) =>
    !(out && within(out, path)) &&
    !path.includes("node_modules") &&
    (folders.some((folder) => within(folder, path)) || files.has(path))

  // Watch each recursive folder, and the folder of every other file (non-recursively).
  const refresh = () => {
    const wanted = new Map<string, boolean>()
    for (const folder of folders) if (existsSync(folder)) wanted.set(folder, true)
    for (const file of files) {
      const folder = dirname(file)
      if (!folders.some((f) => within(f, folder)) && !wanted.has(folder)) {
        wanted.set(folder, false)
      }
    }
    // Before the first successful compile, watch for the config file to appear or change.
    if (wanted.size === 0) wanted.set(resolve(options.cwd), false)
    for (const [folder, watcher] of watchers) {
      if (!wanted.has(folder)) {
        watcher.close()
        watchers.delete(folder)
      }
    }
    for (const [folder, recursive] of wanted) {
      if (watchers.has(folder)) continue
      const watcher = watch(folder, { recursive }, (_event, name) => {
        const path = name ? join(folder, name.toString()) : folder
        const isConfig = CONFIG_FILES.some((config) => path === join(resolve(options.cwd), config))
        if (relevant(path) || isConfig) schedule()
      })
      watcher.on("error", () => {
        watcher.close()
        watchers.delete(folder)
      })
      watchers.set(folder, watcher)
    }
  }

  await run()
  return {
    close() {
      closed = true
      clearTimeout(timer)
      for (const watcher of watchers.values()) watcher.close()
      watchers.clear()
    },
  }
}

function within(folder: string, path: string): boolean {
  const rel = relative(folder, path)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}
