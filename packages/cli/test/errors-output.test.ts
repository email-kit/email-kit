// P1-088: what people see when something goes wrong: `file:line:col [id]`, the message, a code
// frame and the docs link. Snapshots of the real output, plus a check that docs/errors.md covers
// every error id the code can raise.

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { stripVTControlCharacters } from "node:util"

import { EmailKitError } from "@email-kit/core/internal"
import { afterAll, describe, expect, it } from "vitest"

import { compile } from "../src/compiler/build.ts"
import { formatError, toProblem } from "../src/compiler/problems/index.ts"

const FIXTURE = fileURLToPath(new URL("fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL(".tmp/errors-test/", import.meta.url))
const REPO = fileURLToPath(new URL("../../../", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

function project(): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
  return dir
}

function edit(dir: string, path: string, from: string, to: string) {
  const file = join(dir, ...path.split("/"))
  const source = readFileSync(file, "utf8")
  if (!source.includes(from)) throw new Error(`${path} doesn't contain ${from}`)
  writeFileSync(file, source.replace(from, to))
}

async function output(dir: string): Promise<string> {
  try {
    await compile({ cwd: dir })
  } catch (error) {
    // Paths in messages are absolute; make the snapshots machine-independent.
    return formatError(error, { cwd: dir })
      .replaceAll(dir + sep, "")
      .replaceAll(sep, "/")
  }
  throw new Error("expected the compile to fail")
}

const golden = (name: string) => `__golden__/errors/${name}.txt`
const TEMPLATE = "src/email-kit/templates/order-confirmation.tsx"

describe("error output", () => {
  it("points a syntax error at the line, with a code frame", async () => {
    const dir = project()
    edit(dir, TEMPLATE, "<Card>", "<Card")
    await expect(await output(dir)).toMatchFileSnapshot(golden("syntax-error"))
  })

  it("points data used as a value at the expression in the template", async () => {
    const dir = project()
    edit(
      dir,
      TEMPLATE,
      "{item.name} × {item.qty}",
      "{item.name} × {(item.qty as unknown as number) * 2}",
    )
    const text = await output(dir)
    expect(text).toMatch(/order-confirmation\.tsx:\d+:\d+ \[placeholder-misuse\]/)
    await expect(text).toMatchFileSnapshot(golden("placeholder-misuse"))
  })

  it("points a problem in a component at the component, not the template", async () => {
    const dir = project()
    edit(
      dir,
      "src/email-kit/components/Card.tsx",
      "{props.children}",
      "{props.children}{() => null}",
    )
    const text = await output(dir)
    expect(text).toMatch(/^✗ src\/email-kit\/components\/Card\.tsx:\d+:\d+ \[function-child\]/)
    await expect(text).toMatchFileSnapshot(golden("component"))
  })

  it("shows where t() asked for a missing message, and which file to add it to", async () => {
    const dir = project()
    edit(
      dir,
      "src/email-kit/messages/de/order-confirmation.json",
      '"view": "Bestellung ansehen"',
      '"vie": "x"',
    )
    await expect(await output(dir)).toMatchFileSnapshot(golden("missing-message"))
  })

  it("lists every schema issue with its field path", async () => {
    const dir = project()
    edit(
      dir,
      TEMPLATE,
      "qty: z.number()",
      "qty: z.union([z.number(), z.string()]), tags: z.record(z.string(), z.string())",
    )
    await expect(await output(dir)).toMatchFileSnapshot(golden("schema-not-portable"))
  })

  it("reports several problems at once", async () => {
    const dir = project()
    const templates = join(dir, "src", "email-kit", "templates")
    cpSync(join(templates, "order-confirmation.tsx"), join(templates, "receipt.tsx"))
    edit(dir, "src/email-kit/templates/receipt.tsx", '"order-confirmation"', '"Receipt"')
    writeFileSync(join(templates, "welcome.tsx"), "export const notATemplate = true\n")
    await expect(await output(dir)).toMatchFileSnapshot(golden("several"))
  })

  it("explains a config problem", async () => {
    const dir = project()
    edit(dir, "email-kit.config.ts", 'list: ["en", "de"]', 'list: ["en", "de_DE"]')
    await expect(await output(dir)).toMatchFileSnapshot(golden("invalid-config"))
  })

  it("colours only when asked", async () => {
    const dir = project()
    edit(dir, TEMPLATE, "<Card>", "<Card")
    let error: unknown
    try {
      await compile({ cwd: dir })
    } catch (caught) {
      error = caught
    }
    const plain = formatError(error, { cwd: dir })
    expect(stripVTControlCharacters(plain)).toBe(plain)
    expect(formatError(error, { cwd: dir, color: true })).toContain("\u001b[31m✗\u001b[39m")
  })
})

describe("locations", () => {
  it("skips email-kit's own async frames and falls back to the template file", () => {
    const error = new EmailKitError(
      "invalid-fixture",
      "sign-in-code: a fixture doesn't match the schema",
    )
    error.stack = [
      "EmailKitError: sign-in-code: a fixture doesn't match the schema",
      "    at validateFixtures (file:///opt/email-kit/cli/dist/cli.js:4840:11)",
      "    at async file:///opt/email-kit/cli/dist/cli.js:4848:22",
    ].join("\n")
    const problem = toProblem(
      error,
      "/work/shop/email-kit/templates/sign-in-code.tsx",
      "/work/shop",
    )
    expect(problem).toEqual({
      code: "invalid-fixture",
      message: "sign-in-code: a fixture doesn't match the schema",
      file: "email-kit/templates/sign-in-code.tsx",
    })
  })
})

describe("docs/errors.md", () => {
  it("has an entry for every error id the code can raise", () => {
    const docs = readFileSync(join(REPO, "docs", "errors.md"), "utf8")
    const documented = new Set([...docs.matchAll(/^### ([a-z][a-z-]*)$/gm)].map((m) => m[1]))
    const raised = new Set<string>()
    for (const dir of ["packages/core/src", "packages/cli/src", "packages/components/src"]) {
      for (const file of readdirSync(join(REPO, dir), { recursive: true })) {
        if (!/\.tsx?$/.test(String(file))) continue
        const source = readFileSync(join(REPO, dir, String(file)), "utf8")
        const patterns = [
          /(?:EmailKitError|SourceError)\(\s*"([a-z][a-z-]*)"/g,
          /code: "([a-z][a-z-]*)"/g,
          /[A-Z]+_[A-Z]+: "([a-z][a-z-]*)",/g,
          // Error ids always contain a hyphen; this skips defaults such as `?? "ts"`.
          /\?\? "([a-z]+-[a-z-]+)"/g,
        ]
        for (const pattern of patterns)
          for (const m of source.matchAll(pattern)) raised.add(m[1] as string)
      }
    }
    expect(raised.size).toBeGreaterThan(25)
    expect([...raised].filter((id) => !documented.has(id)).sort()).toEqual([])
  })
})
