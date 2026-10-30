// What `email-kit init` learns about the project before it changes anything (INIT-02): the
// package manager, tsconfig, the code root (in the order the scope doc gives), the host (which
// decides the import strategy, ADR 0004), the schema library and a shadcn theme.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import { EmailKitError } from "@email-kit/core/internal"
import { parse as parseJsonc } from "jsonc-parser"

import { relativePath, toPosix } from "../paths.ts"

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun"

/**
 * - `bundler`: Next.js, Bun, Vite, tsup, esbuild, Wrangler, tsx: tsconfig paths work at runtime
 * - `tsc`: a tsc build run with `node dist`
 * - `node-strip`: Node's type stripping, no build
 * - `unknown`: none of these
 */
export type Host = "bundler" | "tsc" | "node-strip" | "unknown"

export interface Project {
  /** The folder with the nearest package.json */
  readonly dir: string
  readonly packageJson: Record<string, unknown>
  readonly packageManager: PackageManager
  /** tsconfig.json, when there is one */
  readonly tsconfig:
    | { readonly file: string; readonly text: string; readonly json: TsConfig }
    | undefined
  /** Relative to `dir`: "src" or "" for the project root */
  readonly codeRoot: string
  /** Which rule found the code root, for the summary */
  readonly codeRootReason: string
  readonly host: Host
  readonly hostReason: string
  /** zod, valibot or arktype, if the project already uses one */
  readonly schemaLibrary: "zod" | "valibot" | "arktype" | undefined
  /** A shadcn CSS file with theme variables, relative to `dir` */
  readonly shadcnCss: string | undefined
}

export interface TsConfig {
  readonly compilerOptions?: {
    readonly rootDir?: string
    readonly jsx?: string
    readonly paths?: Readonly<Record<string, readonly string[]>>
  }
  readonly include?: readonly string[]
}

const BUNDLERS = [
  "next",
  "vite",
  "tsup",
  "esbuild",
  "wrangler",
  "tsx",
  "@remix-run/dev",
  "astro",
  "nuxt",
]

/** The nearest folder with a package.json, from `cwd` up. */
export function findProject(cwd: string): string {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir
    if (dirname(dir) === dir) {
      throw new EmailKitError(
        "no-package-json",
        `No package.json in ${cwd} or above it. Run init inside the project that sends email.`,
      )
    }
  }
}

export function detectProject(dir: string, override?: string): Project {
  const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<
    string,
    unknown
  >
  const deps = {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined),
  }
  const scripts = Object.values(
    (packageJson.scripts as Record<string, string> | undefined) ?? {},
  ).join("\n")

  const packageManager: PackageManager =
    (String(packageJson.packageManager ?? "").match(
      /^(pnpm|npm|yarn|bun)@/,
    )?.[1] as PackageManager) ??
    (existsSync(join(dir, "pnpm-lock.yaml"))
      ? "pnpm"
      : existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))
        ? "bun"
        : existsSync(join(dir, "yarn.lock"))
          ? "yarn"
          : "npm")

  const tsconfigFile = join(dir, "tsconfig.json")
  const tsconfig = existsSync(tsconfigFile)
    ? (() => {
        const text = readFileSync(tsconfigFile, "utf8")
        return { file: tsconfigFile, text, json: (parseJsonc(text) ?? {}) as TsConfig }
      })()
    : undefined

  const [codeRoot, codeRootReason] =
    override !== undefined ? [normalise(override), "--dir"] : findCodeRoot(dir, tsconfig?.json)

  const bundler = BUNDLERS.find((name) => deps[name] !== undefined)
  const [host, hostReason]: [Host, string] =
    packageManager === "bun"
      ? ["bundler", "Bun runs TypeScript with tsconfig paths"]
      : bundler
        ? ["bundler", `${bundler} resolves tsconfig paths`]
        : /node\s+(--experimental-strip-types\s+)?\S+\.m?ts\b/.test(scripts)
          ? ["node-strip", "Node runs the TypeScript sources directly"]
          : /\btsc\b/.test(scripts)
            ? ["tsc", "tsc builds it and node runs the output"]
            : ["unknown", "no bundler, tsc build or Node type stripping found"]

  const schemaLibrary = (["zod", "valibot", "arktype"] as const).find(
    (name) => deps[name] !== undefined,
  )

  return {
    dir,
    packageJson,
    packageManager,
    tsconfig,
    codeRoot,
    codeRootReason,
    host,
    hostReason,
    schemaLibrary,
    shadcnCss: findShadcnCss(dir),
  }
}

// INIT-02, in order: rootDir or a single include; the @/* (or ~/*) alias; the framework layout;
// a src/ folder with code; the project root.
function findCodeRoot(dir: string, tsconfig: TsConfig | undefined): [string, string] {
  const options = tsconfig?.compilerOptions
  if (options?.rootDir) return [normalise(options.rootDir), "tsconfig rootDir"]
  const include = tsconfig?.include ?? []
  if (include.length === 1) {
    // "src", "./src" and "src/**/*.ts" all mean src/: the segments before the first glob.
    const segments: string[] = []
    for (const segment of normalise(include[0] as string).split("/")) {
      if (segment.includes("*") || /\.\w+$/.test(segment)) break
      segments.push(segment)
    }
    const folder = segments.join("/")
    if (folder && isDirectory(join(dir, folder))) return [folder, "tsconfig include"]
  }
  for (const alias of ["@/*", "~/*"]) {
    const target = options?.paths?.[alias]?.[0]
    if (target) return [normalise(target.replace(/\/?\*$/, "")), `the ${alias} path alias`]
  }
  if (isDirectory(join(dir, "src/app")) || isDirectory(join(dir, "src/pages")))
    return ["src", "the src/app layout"]
  if (isDirectory(join(dir, "app")) || isDirectory(join(dir, "pages")))
    return ["", "the app/ layout at the root"]
  if (isDirectory(join(dir, "src")) && hasCode(join(dir, "src"))) return ["src", "the src/ folder"]
  return ["", "the project root"]
}

function findShadcnCss(dir: string): string | undefined {
  const components = join(dir, "components.json")
  const candidates: string[] = []
  if (existsSync(components)) {
    try {
      const css = (JSON.parse(readFileSync(components, "utf8")) as { tailwind?: { css?: string } })
        .tailwind?.css
      if (css) candidates.push(css)
    } catch {}
  }
  candidates.push(
    "src/app/globals.css",
    "app/globals.css",
    "src/styles/globals.css",
    "styles/globals.css",
    "src/index.css",
  )
  for (const candidate of candidates) {
    const file = join(dir, candidate)
    if (existsSync(file) && /:root\s*\{[^}]*--primary\s*:/s.test(readFileSync(file, "utf8"))) {
      return relativePath(dir, file)
    }
  }
  return undefined
}

function normalise(path: string): string {
  return toPosix(path)
    .replace(/^\.\/?/, "")
    .replace(/\/+$/, "")
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

function hasCode(folder: string): boolean {
  return readdirSync(folder, { recursive: true }).some((file) =>
    /\.(m?[jt]sx?|cts|cjs)$/.test(String(file)),
  )
}
