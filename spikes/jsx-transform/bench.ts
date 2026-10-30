// P0-11 spike: load one TSX template (plus a pragma-less component and a hostile host tsconfig)
// with each candidate transform, check they all produce the same IR, and time them.
// Run with `pnpm bench` (Node 24; Node 22 needs --experimental-strip-types).

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { dirname, isAbsolute, join } from "node:path"
import { performance } from "node:perf_hooks"
import { fileURLToPath, pathToFileURL } from "node:url"

import { evaluate } from "@email-kit/core/internal"

const here = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(here, "fixture")
const entry = join(fixtureDir, "order-confirmation.tsx")
const cacheDir = join(here, "node_modules/.cache/email-kit")
const store = join(here, "../../node_modules/.pnpm")
const IMPORT_SOURCE = "@email-kit/core"
const RUNS = 20
const messages = {
  subject: "Order {order} confirmed",
  preheader: "Thanks for your order",
  heading: "Thanks, {name}!",
  orderLine: "Your order {order} is confirmed.",
  discount: "You saved {discount}.",
  noDiscount: "No discount this time.",
  viewTitle: "Order {order}",
  view: "View your order",
}

type Load = (file: string, generation: number) => Promise<unknown>

interface Candidate {
  name: string
  kind: "bundle" | "transform + module hooks"
  packages: string[]
  setup: () => Promise<Load>
}

// Bundles are written under node_modules/.cache so bare imports resolve from the project.
async function importCode(code: string): Promise<unknown> {
  mkdirSync(cacheDir, { recursive: true })
  const file = join(cacheDir, `${createHash("sha256").update(code).digest("hex").slice(0, 16)}.mjs`)
  writeFileSync(file, code)
  return (await import(pathToFileURL(file).href)).default
}

// Transform-only tools need a loader: Node module hooks that transform fixture files on import.
// Each generation gets a fresh URL, which is how watch mode would bypass the module cache.
let hookTransform: ((file: string, source: string) => string) | undefined
let hookGeneration = 0
registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL ?? pathToFileURL(`${here}/`).href
    if (hookTransform && (specifier.startsWith(".") || specifier.startsWith("file:"))) {
      const base = new URL(specifier, parent).href.split("?")[0] as string
      for (const extension of ["", ".tsx", ".ts"]) {
        const candidate = fileURLToPath(base + extension)
        if (
          candidate.startsWith(fixtureDir) &&
          existsSync(candidate) &&
          statSync(candidate).isFile()
        ) {
          return { url: `${pathToFileURL(candidate).href}?v=${hookGeneration}`, shortCircuit: true }
        }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    const file = url.startsWith("file:") ? fileURLToPath(url.split("?")[0] as string) : ""
    if (hookTransform && file.startsWith(fixtureDir) && /\.tsx?$/.test(file)) {
      return {
        format: "module",
        source: hookTransform(file, readFileSync(file, "utf8")),
        shortCircuit: true,
      }
    }
    return next(url, context)
  },
})

function viaHooks(transform: (file: string, source: string) => string): Load {
  return async (file, generation) => {
    hookTransform = transform
    hookGeneration = generation
    try {
      return (await import(`${pathToFileURL(file).href}?v=${generation}`)).default
    } finally {
      hookTransform = undefined
    }
  }
}

const isBare = (id: string) => !id.startsWith(".") && !isAbsolute(id)

const candidates: Candidate[] = [
  {
    name: "esbuild",
    kind: "bundle",
    packages: ["esbuild@", "@esbuild+"],
    async setup() {
      const esbuild = await import("esbuild")
      return async (file) => {
        const result = await esbuild.build({
          entryPoints: [file],
          bundle: true,
          write: false,
          format: "esm",
          platform: "node",
          target: "node22",
          jsx: "automatic",
          jsxImportSource: IMPORT_SOURCE,
          tsconfigRaw: {},
          packages: "external",
          logLevel: "silent",
        })
        return importCode(result.outputFiles[0]?.text ?? "")
      }
    },
  },
  {
    name: "rolldown",
    kind: "bundle",
    packages: ["rolldown@", "@rolldown+", "@oxc-project+types@"],
    async setup() {
      const { rolldown } = await import("rolldown")
      return async (file) => {
        const bundle = await rolldown({
          input: file,
          platform: "node",
          tsconfig: false,
          external: isBare,
          transform: { jsx: { runtime: "automatic", importSource: IMPORT_SOURCE } },
          logLevel: "silent",
        })
        const { output } = await bundle.generate({ format: "esm" })
        await bundle.close()
        return importCode(output[0].code)
      }
    },
  },
  {
    name: "oxc-transform",
    kind: "transform + module hooks",
    packages: ["oxc-transform@", "@oxc-transform+"],
    async setup() {
      const { transformSync } = await import("oxc-transform")
      return viaHooks((file, source) => {
        const result = transformSync(file, source, {
          lang: "tsx",
          sourceType: "module",
          jsx: { runtime: "automatic", importSource: IMPORT_SOURCE },
        })
        if (result.errors.length > 0) throw new Error(result.errors[0]?.message)
        return result.code
      })
    },
  },
  {
    name: "@swc/core",
    kind: "transform + module hooks",
    packages: ["@swc+core@", "@swc+core-", "@swc+types@", "@swc+counter@"],
    async setup() {
      const swc = await import("@swc/core")
      return viaHooks(
        (file, source) =>
          swc.transformSync(source, {
            filename: file,
            swcrc: false,
            configFile: false,
            jsc: {
              parser: { syntax: "typescript", tsx: true },
              transform: { react: { runtime: "automatic", importSource: IMPORT_SOURCE } },
              target: "es2022",
            },
            module: { type: "es6" },
          }).code,
      )
    },
  },
]

// The same bundlers with their defaults, to see whether they pick up the host tsconfig.
const defaults: Record<string, Load> = {
  async esbuild(file) {
    const esbuild = await import("esbuild")
    const result = await esbuild.build({
      entryPoints: [file],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      packages: "external",
      logLevel: "silent",
    })
    return importCode(result.outputFiles[0]?.text ?? "")
  },
  async rolldown(file) {
    const { rolldown } = await import("rolldown")
    const bundle = await rolldown({
      input: file,
      platform: "node",
      external: isBare,
      logLevel: "silent",
    })
    const { output } = await bundle.generate({ format: "esm" })
    await bundle.close()
    return importCode(output[0].code)
  },
}

function sizeOf(path: string): number {
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.size
  return readdirSync(path).reduce((total, name) => total + sizeOf(join(path, name)), 0)
}

function installSize(prefixes: string[]): number {
  const dirs = readdirSync(store).filter((dir) => prefixes.some((prefix) => dir.startsWith(prefix)))
  return dirs.reduce((total, dir) => total + sizeOf(join(store, dir)), 0)
}

const ir = (definition: unknown) =>
  JSON.stringify(evaluate(definition as never, { locale: "en", messages }))

// `node bench.ts <name>` runs one candidate, so cold times aren't skewed by an earlier one.
const only = process.argv[2]
await import("zod") // the template's own dependency, loaded before any timer starts

const rows: string[] = []
let reference: string | undefined
let generation = 0
for (const candidate of candidates.filter((c) => only === undefined || c.name === only)) {
  const start = performance.now()
  const load = await candidate.setup()
  const first = await load(entry, ++generation)
  const cold = performance.now() - start
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now()
    await load(entry, ++generation)
    times.push(performance.now() - t)
  }
  times.sort((a, b) => a - b)
  const result = ir(first)
  reference ??= result
  const median = times[Math.floor(RUNS / 2)] ?? 0
  const mb = (installSize(candidate.packages) / 1e6).toFixed(1)
  rows.push(
    `| ${candidate.name} | ${candidate.kind} | ${result === reference ? "yes" : "**no**"} | ` +
      `${cold.toFixed(0)} ms | ${median.toFixed(1)} ms | ${mb} MB |`,
  )
}

if (only !== undefined) {
  console.log(rows.join("\n"))
  process.exit(0)
}
console.log(`Node ${process.version}, ${process.platform}-${process.arch}, ${RUNS} warm runs\n`)
console.log(
  "| Candidate | Kind | Same IR | Cold (import + first load) | Warm median | Install size |",
)
console.log("|---|---|---|---|---|---|")
console.log(rows.join("\n"))
console.log("\nWith default options next to a tsconfig that says jsxImportSource: hono/jsx:\n")
for (const [name, load] of Object.entries(defaults)) {
  try {
    const result = ir(await load(entry, ++generation))
    console.log(`- ${name}: loads; ${result === reference ? "same IR" : "different IR"}`)
  } catch (error) {
    console.log(`- ${name}: fails: ${(error as Error).message.split("\n")[0]}`)
  }
}
// Host tsconfig loaded for `paths` aliases, with the JSX settings forced by options. The
// fixture-paths copy imports its component as "@/components/Card".
console.log("\nHost tsconfig loaded (for paths), JSX forced by options:\n")
const pathsDir = join(here, "fixture-paths")
const pathsEntry = join(pathsDir, "order-confirmation.tsx")
const tsconfig = join(pathsDir, "tsconfig.json")
const bareImports = (code: string) =>
  [...new Set([...code.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]))].join(", ")
{
  const { rolldown } = await import("rolldown")
  const bundle = await rolldown({
    input: pathsEntry,
    platform: "node",
    tsconfig,
    external: (id) => isBare(id) && !id.startsWith("@/"),
    transform: { jsx: { runtime: "automatic", importSource: IMPORT_SOURCE } },
    logLevel: "silent",
  })
  const { output } = await bundle.generate({ format: "esm" })
  await bundle.close()
  console.log(`- rolldown imports: ${bareImports(output[0].code)}`)
  const esbuild = await import("esbuild")
  const result = await esbuild.build({
    entryPoints: [pathsEntry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    packages: "external",
    tsconfig,
    jsx: "automatic",
    jsxImportSource: IMPORT_SOURCE,
    logLevel: "silent",
  })
  console.log(`- esbuild imports: ${bareImports(result.outputFiles[0]?.text ?? "")}`)
}

console.log(`\nIR of the template:\n\n${reference}`)
