// P0-05 spike: type-check an email-kit template with the per-file pragma inside host projects
// with different JSX settings, next to the host's own JSX files, with tsc 5.9 and 7.0.
// Run with `pnpm --filter @email-kit/spike-jsx-pragma run` (Node 24).

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const TSC = {
  "5.9": join(here, "node_modules/typescript5/bin/tsc"),
  "7.0": join(here, "node_modules/typescript/bin/tsc"),
}

// The expect-error only holds if email-kit's JSX and data types are the ones in effect.
const template = (
  pragma: boolean,
) => `${pragma ? "/** @jsxImportSource @email-kit/core */\n" : ""}import { defineEmail, Each } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "welcome",
  purpose: "transactional",
  schema: z.object({ name: z.string(), items: z.array(z.object({ label: z.string() })) }),
  subject: (data) => data.name,
  fixtures: { default: { name: "Ada", items: [] } },
  component: ({ data }) => [
    <p>{data.name}</p>,
    <Each of={data.items}>{(item) => <p>{item.label}</p>}</Each>,
    // @ts-expect-error: a misspelt field, caught by email-kit's types
    <p>{data.nmae}</p>,
  ],
})
`

// Host files that only compile under their own framework's JSX types.
const HONO_PAGE = `import type { FC } from "hono/jsx"

export const Page: FC<{ title: string }> = (props) => <h1>{props.title}</h1>
export const page = <Page title="Home" />
`
const REACT_PAGE = (
  classic: boolean,
) => `${classic ? 'import React from "react"\n' : ""}import type { ReactElement } from "react"

export function Page(props: { title: string }): ReactElement {
  return <h1 className="title">{props.title}</h1>
}
export const page: ReactElement = <Page title="Home" />
`
const PLAIN_TS = "export const port: number = 3000\n"

interface Scenario {
  readonly name: string
  readonly compilerOptions: Record<string, unknown>
  readonly packageType?: "module" | "commonjs"
  readonly pragma: boolean
  readonly host?: "hono" | "react" | "react-classic"
}

const BUNDLER = { module: "esnext", moduleResolution: "bundler", target: "es2022" }
const SCENARIOS: readonly Scenario[] = [
  { name: "Plain Node API, `jsx` unset", compilerOptions: BUNDLER, pragma: true },
  {
    name: 'Plain Node API + the one line init adds: `"jsx": "react-jsx"`',
    compilerOptions: { ...BUNDLER, jsx: "react-jsx" },
    pragma: true,
  },
  {
    name: "Plain Node API, `module: nodenext` (tsc-built) + `react-jsx`",
    compilerOptions: { module: "nodenext", target: "es2022", jsx: "react-jsx" },
    packageType: "module",
    pragma: true,
  },
  {
    name: "Hono: `react-jsx` + `jsxImportSource: hono/jsx`, Hono views alongside",
    compilerOptions: { ...BUNDLER, jsx: "react-jsx", jsxImportSource: "hono/jsx" },
    pragma: true,
    host: "hono",
  },
  {
    name: "Hono, template **without** the pragma",
    compilerOptions: { ...BUNDLER, jsx: "react-jsx", jsxImportSource: "hono/jsx" },
    pragma: false,
    host: "hono",
  },
  {
    name: "Next.js ≤ 15: `jsx: preserve`, React pages alongside",
    compilerOptions: { ...BUNDLER, jsx: "preserve", lib: ["dom", "esnext"] },
    pragma: true,
    host: "react",
  },
  {
    name: "Next.js 16: `jsx: react-jsx`, React pages alongside",
    compilerOptions: { ...BUNDLER, jsx: "react-jsx", lib: ["dom", "esnext"] },
    pragma: true,
    host: "react",
  },
  {
    name: "Classic runtime: `jsx: react`, React pages alongside",
    compilerOptions: { ...BUNDLER, jsx: "react", lib: ["dom", "esnext"] },
    pragma: true,
    host: "react-classic",
  },
  {
    name: "Legacy `moduleResolution: node` (node10) + `react-jsx`",
    compilerOptions: {
      module: "commonjs",
      moduleResolution: "node",
      target: "es2022",
      jsx: "react-jsx",
    },
    packageType: "commonjs",
    pragma: true,
  },
]

function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

function typecheck(root: string, tsc: string): string {
  try {
    execFileSync(process.execPath, [tsc, "--noEmit", "-p", "tsconfig.json"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 120_000,
    })
    return "✓"
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string }
    const errors = `${stdout}\n${stderr}`.split("\n").filter((line) => /error TS\d+/.test(line))
    const first = (errors[0] ?? "failed")
      .replace(/^src\//, "")
      .replace(/\s+/g, " ")
      .slice(0, 150)
    return `✗ ${errors.length} error(s): ${first}`
  }
}

const rows = ["| Host setup | TS 5.9 | TS 7.0 |", "|---|---|---|"]
for (const scenario of SCENARIOS) {
  const cells: string[] = []
  for (const tsc of Object.values(TSC)) {
    // Inside the spike folder, so packages resolve from its node_modules.
    const root = mkdtempSync(join(here, ".work-"))
    try {
      write(
        root,
        "package.json",
        JSON.stringify({ name: "host", private: true, type: scenario.packageType ?? "module" }),
      )
      write(
        root,
        "tsconfig.json",
        JSON.stringify({
          compilerOptions: { strict: true, skipLibCheck: true, ...scenario.compilerOptions },
          include: ["src"],
        }),
      )
      write(root, "src/server.ts", PLAIN_TS)
      write(root, "src/email-kit/templates/welcome.tsx", template(scenario.pragma))
      if (scenario.host === "hono") write(root, "src/views/page.tsx", HONO_PAGE)
      if (scenario.host?.startsWith("react")) {
        write(root, "src/app/page.tsx", REACT_PAGE(scenario.host === "react-classic"))
      }
      cells.push(typecheck(root, tsc))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
  rows.push(`| ${scenario.name} | ${cells.join(" | ")} |`)
}
console.log(`Node ${process.version}; tsc --noEmit on a template + the host's own files\n`)
console.log(rows.join("\n"))
