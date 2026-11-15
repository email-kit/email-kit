import { existsSync, type FSWatcher, watch } from "node:fs"
import { dirname, join, resolve } from "node:path"

import { isWithin } from "../paths.ts"
import { type CompileOptions, type CompileResult, compileWithConfig } from "./build.ts"
import { CONFIG_FILES, loadConfig } from "./config/index.ts"

export interface WatchOptions extends CompileOptions {
  /** Called after every compile: the result, or the error that stopped it. */
  readonly onCompile: (outcome: { result: CompileResult } | { error: unknown }) => void
  /** How long to wait for more changes before compiling, in milliseconds. Defaults to 80. */
  readonly debounceMs?: number
}

/** A running watch. */
export interface Watcher {
  /** Stops watching. A compile already running finishes, but no other starts. */
  close(): void
}

/** What a watch looks at, as the last compile left it. */
interface Watched {
  /** The email-kit folder, watched with everything inside it. */
  readonly folders: readonly string[]
  /** The other files a compile read: the config, theme files, and modules templates import. */
  readonly files: ReadonlySet<string>
  /** The output folder. The compile writes there, so its changes never start another. */
  readonly out: string
}

/**
 * `email-kit compile --watch`: recompiles when a template, a component it imports, a message file
 * or the config changes. Each run is a full compile.
 *
 * The email-kit folder is watched recursively, and every other source file through its folder.
 * Folders are watched rather than files, because editors often save by renaming over a
 * file, which ends a watch on it. The config is loaded first, so its folders are watched even when
 * a template fails. Until a compile succeeds, the project folder is watched for the config.
 *
 * Changes arriving within `debounceMs` of each other start one compile, and a change during a
 * compile starts one more after it.
 *
 * On macOS a recursive watch goes live a moment after it's created, so a change made within
 * milliseconds of starting can be missed.
 */
export async function watchProject(options: WatchOptions): Promise<Watcher> {
  const cwd = resolve(options.cwd)
  const configPaths = CONFIG_FILES.map((name) => join(cwd, name))
  const watchers = new Map<string, FSWatcher>()
  let watched: Watched = { folders: [], files: new Set(), out: "" }
  let closed = false
  let running = false
  let again = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const run = async () => {
    if (running) {
      again = true
      return
    }
    running = true
    try {
      const config = await loadConfig(options)
      const folders = [config.root]
      watched = { folders, files: new Set([...watched.files, config.file]), out: config.out }
      const result = await compileWithConfig(config)
      const sources = result.templates.flatMap((template) => template.sources)
      watched = {
        folders,
        files: new Set([config.file, ...result.theme.files, ...sources]),
        out: config.out,
      }
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

  const onChange = (path: string) => {
    if (configPaths.includes(path) || isRelevant(watched, path)) schedule()
  }

  /** Starts and stops folder watches to match what the last compile read. */
  const refresh = () => {
    const wanted = foldersToWatch(watched, cwd)
    for (const [folder, watcher] of watchers) {
      if (wanted.has(folder)) continue
      watcher.close()
      watchers.delete(folder)
    }
    for (const [folder, recursive] of wanted) {
      if (watchers.has(folder)) continue
      const watcher = watch(folder, { recursive }, (_event, name) => {
        onChange(name ? join(folder, name.toString()) : folder)
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

/**
 * The folders to watch, each with whether to watch it recursively: the email-kit folder, if it
 * exists, recursively, then the folder of each other file, on its own. With nothing to watch yet,
 * the project folder is watched for a config to appear.
 */
function foldersToWatch(watched: Watched, cwd: string): Map<string, boolean> {
  const wanted = new Map<string, boolean>()
  for (const folder of watched.folders) if (existsSync(folder)) wanted.set(folder, true)
  for (const file of watched.files) {
    const folder = dirname(file)
    const covered = watched.folders.some((f) => isWithin(f, folder)) || wanted.has(folder)
    if (!covered) wanted.set(folder, false)
  }
  if (wanted.size === 0) wanted.set(cwd, false)
  return wanted
}

/**
 * Whether a change should start a compile: anything in the email-kit folder, or a file the last
 * compile read. The output folder and `node_modules`, where bundles are cached, are
 * written by the compile itself, so they never count.
 */
function isRelevant(watched: Watched, path: string): boolean {
  if (watched.out && isWithin(watched.out, path)) return false
  if (path.includes("node_modules")) return false
  return watched.folders.some((folder) => isWithin(folder, path)) || watched.files.has(path)
}
