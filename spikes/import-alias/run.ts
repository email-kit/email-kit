// P0-08 spike: build throwaway backend projects that import email-kit output through each alias
// strategy, then type-check, build and run them with real tsc (5.9 and 7), tsx and Node.
// Run with `pnpm --filter @email-kit/spike-import-alias run` (Node 24).

import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const bin = (path: string) => join(here, "node_modules", path)
const TSC = { "5.9": bin("typescript5/bin/tsc"), "7.0": bin("typescript/bin/tsc") }
const TSX = bin(".bin/tsx")
const TSC_ALIAS = bin(".bin/tsc-alias")
const EXPECTED = "Welcome, Ada"

// A stand-in for the generated module: erasable syntax only, like the real one must be.
const COMPILED = `export interface WelcomeData {
  name: string
}
export const emails = {
  welcome: {
    render(data: WelcomeData): { subject: string } {
      return { subject: \`Welcome, \${data.name}\` }
    },
  },
}
`

// The app's import. The expect-error fails the type-check if the alias resolves to `any`.
const server = (specifier: string) => `import { emails } from "${specifier}"

const subject: string = emails.welcome.render({ name: "Ada" }).subject
// @ts-expect-error: typed from the generated module
emails.welcome.render({ nme: "Ada" })
console.log(subject)
`

type Step =
  | "typecheck"
  | "dev: node"
  | "dev: tsx"
  | "build"
  | "prod"
  | "prod without tsc-alias"
  | "edit, then dev: tsx without --conditions"
  | "prod with only dist/ deployed"

interface Scenario {
  readonly name: string
  readonly packageJson: Record<string, unknown>
  readonly compilerOptions: Record<string, unknown>
  readonly specifier: string
  /** The one line in email-kit/index.ts */
  readonly reexport: string
  readonly steps: readonly Step[]
  readonly devConditions?: string
  /** Emit the generated module as JS + .d.ts instead of TS (OUT-07) */
  readonly jsOutput?: boolean
}

const COMPILED_JS = `export const emails = {
  welcome: {
    render(data) {
      return { subject: \`Welcome, \${data.name}\` }
    },
  },
}
`
const COMPILED_DTS = `export interface WelcomeData {
  name: string
}
export declare const emails: {
  welcome: { render(data: WelcomeData): { subject: string } }
}
`

const BUILD = { module: "nodenext", target: "es2022", outDir: "dist", rootDir: "src" }
const SCENARIOS: readonly Scenario[] = [
  {
    name: "A. tsc build · #email-kit {types → src, default → dist}",
    packageJson: {
      type: "module",
      imports: {
        "#email-kit": { types: "./src/email-kit/index.ts", default: "./dist/email-kit/index.js" },
      },
    },
    compilerOptions: BUILD,
    specifier: "#email-kit",
    reexport: 'export * from "./compiled/index.js"',
    steps: ["typecheck", "dev: node", "dev: tsx", "build", "prod"],
  },
  {
    name: "B. tsc build · #email-kit {email-kit → src, default → dist} + customConditions",
    packageJson: {
      type: "module",
      imports: {
        "#email-kit": {
          "email-kit": "./src/email-kit/index.ts",
          default: "./dist/email-kit/index.js",
        },
      },
    },
    compilerOptions: {
      ...BUILD,
      customConditions: ["email-kit"],
      rewriteRelativeImportExtensions: true,
    },
    specifier: "#email-kit",
    reexport: 'export * from "./compiled/index.ts"',
    steps: [
      "typecheck",
      "dev: node",
      "dev: tsx",
      "build",
      "prod",
      "prod with only dist/ deployed",
      "edit, then dev: tsx without --conditions",
    ],
    devConditions: "email-kit",
  },
  {
    name: "B2. like B, but .js re-export and no rewriteRelativeImportExtensions",
    packageJson: {
      type: "module",
      imports: {
        "#email-kit": {
          "email-kit": "./src/email-kit/index.ts",
          default: "./dist/email-kit/index.js",
        },
      },
    },
    compilerOptions: { ...BUILD, customConditions: ["email-kit"] },
    specifier: "#email-kit",
    reexport: 'export * from "./compiled/index.js"',
    steps: ["typecheck", "dev: node", "dev: tsx", "build", "prod"],
    devConditions: "email-kit",
  },
  {
    name: "G. tsc build · #email-kit → generated .mjs + .d.mts, kept in src (no condition)",
    packageJson: {
      type: "module",
      imports: { "#email-kit": "./src/email-kit/compiled/index.mjs" },
    },
    compilerOptions: BUILD,
    specifier: "#email-kit",
    reexport: 'export * from "./compiled/index.mjs"',
    steps: ["typecheck", "dev: node", "dev: tsx", "build", "prod", "prod with only dist/ deployed"],
    jsOutput: true,
  },
  {
    name: "G-CJS. like G, in a CommonJS project (require of the ESM module)",
    packageJson: {
      type: "commonjs",
      imports: { "#email-kit": "./src/email-kit/compiled/index.mjs" },
    },
    compilerOptions: BUILD,
    specifier: "#email-kit",
    reexport: 'export * from "./compiled/index.mjs"',
    steps: ["typecheck", "build", "prod"],
    jsOutput: true,
  },
  {
    name: "C. Node type stripping, no build · #email-kit → src",
    packageJson: { type: "module", imports: { "#email-kit": "./src/email-kit/index.ts" } },
    compilerOptions: {
      module: "nodenext",
      target: "esnext",
      noEmit: true,
      allowImportingTsExtensions: true,
      erasableSyntaxOnly: true,
      verbatimModuleSyntax: true,
    },
    specifier: "#email-kit",
    reexport: 'export * from "./compiled/index.ts"',
    steps: ["typecheck", "prod"],
  },
  {
    name: "D. tsc build · @/email-kit (tsconfig paths) + tsc-alias",
    packageJson: { type: "module" },
    compilerOptions: { ...BUILD, paths: { "@/email-kit": ["./src/email-kit/index.ts"] } },
    specifier: "@/email-kit",
    reexport: 'export * from "./compiled/index.js"',
    steps: ["typecheck", "dev: node", "dev: tsx", "build", "prod without tsc-alias", "prod"],
  },
  {
    name: "E. tsc build · relative import",
    packageJson: { type: "module" },
    compilerOptions: BUILD,
    specifier: "./email-kit/index.js",
    reexport: 'export * from "./compiled/index.js"',
    steps: ["typecheck", "dev: node", "dev: tsx", "build", "prod"],
  },
  {
    name: "F. tsc build to CommonJS · #email-kit {types → src, default → dist}",
    packageJson: {
      type: "commonjs",
      imports: {
        "#email-kit": { types: "./src/email-kit/index.ts", default: "./dist/email-kit/index.js" },
      },
    },
    compilerOptions: BUILD,
    specifier: "#email-kit",
    reexport: 'export * from "./compiled/index.js"',
    steps: ["typecheck", "build", "prod"],
  },
]

function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

function exec(cwd: string, file: string, args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync(file, args, { cwd, encoding: "utf8", stdio: "pipe", timeout: 60_000 })
    return { ok: true, out: out.trim() }
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string }
    const line = `${stdout}\n${stderr}`.split("\n").find((l) => /error|Error|Cannot/.test(l))
    return { ok: false, out: (line ?? "failed").trim().slice(0, 140) }
  }
}

function runStep(root: string, step: Step, scenario: Scenario, tsc: string): string {
  const node = process.execPath
  const conditions = scenario.devConditions ? [`--conditions=${scenario.devConditions}`] : []
  const ran = (result: { ok: boolean; out: string }) =>
    result.ok && result.out === EXPECTED
      ? "✓"
      : `✗ ${result.ok ? `printed "${result.out}"` : result.out}`
  const built = (result: { ok: boolean; out: string }) => (result.ok ? "✓" : `✗ ${result.out}`)
  switch (step) {
    case "typecheck":
      return built(exec(root, node, [tsc, "--noEmit"]))
    case "build":
      return built(exec(root, node, [tsc]))
    case "dev: node":
      return ran(exec(root, node, [...conditions, "src/server.ts"]))
    case "dev: tsx":
      return ran(exec(root, TSX, [...conditions, "src/server.ts"]))
    case "edit, then dev: tsx without --conditions": {
      // Change the email after the build; a dev run that still prints the old subject is stale.
      const file = join(root, "src/email-kit/compiled/index.ts")
      writeFileSync(file, readFileSync(file, "utf8").replace("Welcome, ", "Welcome back, "))
      const result = exec(root, TSX, ["src/server.ts"])
      if (!result.ok) return `✗ ${result.out}`
      return result.out === EXPECTED ? "✗ **silently stale**: printed the old subject" : "✓"
    }
    case "prod with only dist/ deployed": {
      const deployed = mkdtempSync(join(tmpdir(), "email-kit-deploy-"))
      try {
        cpSync(join(root, "dist"), join(deployed, "dist"), { recursive: true })
        cpSync(join(root, "package.json"), join(deployed, "package.json"))
        const result = exec(deployed, node, ["dist/server.js"])
        return result.ok ? "✓" : `✗ fails at boot: ${result.out}`
      } finally {
        rmSync(deployed, { recursive: true, force: true })
      }
    }
    case "prod without tsc-alias":
      return ran(exec(root, node, ["dist/server.js"]))
    case "prod":
      if (scenario.specifier.startsWith("@/")) {
        const alias = exec(root, TSC_ALIAS, ["-p", "tsconfig.json"])
        if (!alias.ok) return `✗ tsc-alias: ${alias.out}`
      }
      return ran(
        exec(root, node, scenario.compilerOptions.noEmit ? ["src/server.ts"] : ["dist/server.js"]),
      )
  }
}

const results: string[] = []
for (const scenario of SCENARIOS) {
  results.push(`\n### ${scenario.name}\n`, `| Step | TS 5.9 | TS 7.0 |`, "|---|---|---|")
  const byVersion: Record<string, Record<string, string>> = {}
  for (const [version, tsc] of Object.entries(TSC)) {
    const root = mkdtempSync(join(tmpdir(), "email-kit-alias-"))
    try {
      write(
        root,
        "package.json",
        JSON.stringify({ name: "app", private: true, ...scenario.packageJson }, null, 2),
      )
      write(
        root,
        "tsconfig.json",
        JSON.stringify(
          {
            compilerOptions: {
              strict: true,
              skipLibCheck: true,
              types: [],
              ...scenario.compilerOptions,
            },
            include: ["src"],
          },
          null,
          2,
        ),
      )
      if (scenario.jsOutput) {
        // .mjs/.d.mts, so the module is ESM whatever the package "type" is.
        write(root, "src/email-kit/compiled/index.mjs", COMPILED_JS)
        write(root, "src/email-kit/compiled/index.d.mts", COMPILED_DTS)
      } else {
        write(root, "src/email-kit/compiled/index.ts", COMPILED)
      }
      write(root, "src/email-kit/index.ts", `${scenario.reexport}\n`)
      write(root, "src/server.ts", server(scenario.specifier))
      byVersion[version] = {}
      for (const step of scenario.steps) {
        ;(byVersion[version] as Record<string, string>)[step] = runStep(root, step, scenario, tsc)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
  for (const step of scenario.steps) {
    results.push(`| ${step} | ${byVersion["5.9"]?.[step]} | ${byVersion["7.0"]?.[step]} |`)
  }
}
console.log(`Node ${process.version}, ${process.platform}-${process.arch}`)
console.log(results.join("\n"))
