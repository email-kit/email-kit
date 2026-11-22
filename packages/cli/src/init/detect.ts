import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import { EmailKitError } from "@email-kit/core/internal"
import { parse as parseJsonc } from "jsonc-parser"

import { isDirectory, relativePath, toPosix } from "../paths.ts"

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun"

export type SchemaLibrary = "zod" | "valibot" | "arktype"

/**
 * How the app runs its TypeScript, which decides how it can import the emails:
 * - `bundler`: Next.js, Bun, Vite, tsup, esbuild, Wrangler, tsx: tsconfig paths work at runtime;
 * - `tsc`: a tsc build run with `node dist`;
 * - `node-strip`: Node's type stripping, no build;
 * - `unknown`: none of these.
 */
export type Host = "bundler" | "tsc" | "node-strip" | "unknown"

/** What `init` learns about a project before it changes anything. */
export interface Project {
  /** The folder with the nearest package.json. */
  readonly dir: string
  readonly packageJson: Record<string, unknown>
  readonly packageManager: PackageManager
  /** tsconfig.json, when there is one. */
  readonly tsconfig: { readonly file: string; readonly json: TsConfig } | undefined
  /** The folder the code lives in, relative to `dir`: such as `src`, or `""` for `dir` itself. */
  readonly codeRoot: string
  /** Which rule found the code root, for the summary. */
  readonly codeRootReason: string
  readonly host: Host
  /** Why it's that host, for the summary. */
  readonly hostReason: string
  /** The schema library the project already uses. */
  readonly schemaLibrary: SchemaLibrary | undefined
  /** A shadcn CSS file with theme variables, relative to `dir`. */
  readonly shadcnCss: string | undefined
}

/** The parts of a tsconfig that `init` reads. */
export interface TsConfig {
  readonly compilerOptions?: {
    readonly rootDir?: string
    readonly jsx?: string
    readonly jsxImportSource?: string
    readonly paths?: Readonly<Record<string, readonly string[]>>
  }
  readonly include?: readonly string[]
  /** Set in a solution-style tsconfig, whose files belong to the configs it references. */
  readonly references?: readonly unknown[]
}

/** Tools whose runtime resolves tsconfig paths, so an `@/…` alias works in the app. */
const BUNDLERS = [
  ...["next", "vite", "tsup", "esbuild", "wrangler", "tsx"],
  ...["@remix-run/dev", "astro", "nuxt"],
]

/** The schema libraries email-kit reads, in the order it prefers them. */
const SCHEMA_LIBRARIES: readonly SchemaLibrary[] = ["zod", "valibot", "arktype"]

/** The files shadcn/ui's theme usually lives in, after the one `components.json` names. */
const SHADCN_CSS = [
  ...["src/app/globals.css", "app/globals.css", "src/styles/globals.css", "styles/globals.css"],
  "src/index.css",
]

/** A package.json's dependencies and devDependencies together, name → version. */
export function dependenciesOf(packageJson: Record<string, unknown>): Record<string, string> {
  return {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined),
  }
}

/** The schema library a package.json depends on: Zod first when it has several. */
export function schemaLibraryOf(packageJson: Record<string, unknown>): SchemaLibrary | undefined {
  const deps = dependenciesOf(packageJson)
  return SCHEMA_LIBRARIES.find((name) => deps[name] !== undefined)
}

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

/**
 * What `email-kit init` learns about the project before it changes anything: the package manager,
 * the tsconfig, the code root, the host (which decides how the app imports the emails), the schema
 * library and a shadcn theme. `override` is the code root from `--dir`.
 */
export function detectProject(dir: string, override?: string): Project {
  const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<
    string,
    unknown
  >
  const packageManager = packageManagerOf(dir, packageJson)
  const tsconfig = readTsconfig(dir)
  const [codeRoot, codeRootReason] =
    override !== undefined ? [normalise(override), "--dir"] : findCodeRoot(dir, tsconfig?.json)
  const [host, hostReason] = hostOf(packageJson, packageManager)
  return {
    dir,
    packageJson,
    packageManager,
    tsconfig,
    codeRoot,
    codeRootReason,
    host,
    hostReason,
    schemaLibrary: schemaLibraryOf(packageJson),
    shadcnCss: findShadcnCss(dir),
  }
}

/** The package manager: the one package.json's `packageManager` names, else by the lockfile. */
export function packageManagerOf(
  dir: string,
  packageJson: Record<string, unknown>,
): PackageManager {
  const named = /^(pnpm|npm|yarn|bun)@/.exec(String(packageJson.packageManager ?? ""))?.[1]
  if (named) return named as PackageManager
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm"
  if (existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))) return "bun"
  if (existsSync(join(dir, "yarn.lock"))) return "yarn"
  return "npm"
}

/** The project's tsconfig.json, which may have comments and trailing commas. */
function readTsconfig(dir: string): Project["tsconfig"] {
  const file = join(dir, "tsconfig.json")
  if (!existsSync(file)) return undefined
  return { file, json: (parseJsonc(readFileSync(file, "utf8")) ?? {}) as TsConfig }
}

/** How the app runs, from its package manager, dependencies and scripts, and why. */
function hostOf(
  packageJson: Record<string, unknown>,
  packageManager: PackageManager,
): [Host, string] {
  if (packageManager === "bun") return ["bundler", "Bun runs TypeScript with tsconfig paths"]
  const deps = dependenciesOf(packageJson)
  const bundler = BUNDLERS.find((name) => deps[name] !== undefined)
  if (bundler) return ["bundler", `${bundler} resolves tsconfig paths`]
  const scripts = Object.values(
    (packageJson.scripts as Record<string, string> | undefined) ?? {},
  ).join("\n")
  if (/node\s+(--experimental-strip-types\s+)?\S+\.m?ts\b/.test(scripts)) {
    return ["node-strip", "Node runs the TypeScript sources directly"]
  }
  if (/\btsc\b/.test(scripts)) return ["tsc", "tsc builds it and node runs the output"]
  return ["unknown", "no bundler, tsc build or Node type stripping found"]
}

/**
 * The folder the project's code lives in, and how it was found. In order: tsconfig's `rootDir` or
 * single `include`; the `@/*` or `~/*` alias; the framework's layout; a `src/` folder with code;
 * the project root. An include of `src`, `./src` or `src/**\/*.ts` all mean `src/`: the segments
 * before the first glob.
 */
function findCodeRoot(dir: string, tsconfig: TsConfig | undefined): [string, string] {
  const options = tsconfig?.compilerOptions
  if (options?.rootDir) return [normalise(options.rootDir), "tsconfig rootDir"]
  const include = tsconfig?.include ?? []
  if (include.length === 1) {
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
  if (isDirectory(join(dir, "src/app")) || isDirectory(join(dir, "src/pages"))) {
    return ["src", "the src/app layout"]
  }
  if (isDirectory(join(dir, "app")) || isDirectory(join(dir, "pages"))) {
    return ["", "the app/ layout at the root"]
  }
  if (isDirectory(join(dir, "src")) && hasCode(join(dir, "src"))) return ["src", "the src/ folder"]
  return ["", "the project root"]
}

/**
 * The project's shadcn/ui theme, relative to `dir`: the CSS file `components.json` names, else
 * the usual places, whichever first has `:root { --primary: … }`.
 */
function findShadcnCss(dir: string): string | undefined {
  const candidates: string[] = []
  try {
    const components = JSON.parse(readFileSync(join(dir, "components.json"), "utf8")) as {
      tailwind?: { css?: string }
    }
    if (components.tailwind?.css) candidates.push(components.tailwind.css)
  } catch {}
  for (const candidate of [...candidates, ...SHADCN_CSS]) {
    const file = join(dir, candidate)
    if (existsSync(file) && /:root\s*\{[^}]*--primary\s*:/s.test(readFileSync(file, "utf8"))) {
      return relativePath(dir, file)
    }
  }
  return undefined
}

/** A relative path with `/` separators, and without a leading `./` or a trailing `/`. */
function normalise(path: string): string {
  return toPosix(path)
    .replace(/^\.\/?/, "")
    .replace(/\/+$/, "")
}

/** Whether a folder has any JavaScript or TypeScript file, at any depth. */
function hasCode(folder: string): boolean {
  return readdirSync(folder, { recursive: true }).some((file) =>
    /\.(m?[jt]sx?|cts|cjs)$/.test(String(file)),
  )
}
