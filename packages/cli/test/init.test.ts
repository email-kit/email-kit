// P1-200 to P1-210, TST-05: `email-kit init` in temp projects of each layout, with --yes and
// --no-install (the packages resolve from this repository).

import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import type { Prompter } from "../src/init/index.ts"
import { run } from "../src/run.ts"

const TMP = fileURLToPath(new URL(".tmp/init-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

function project(files: Record<string, string | object>): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(
      join(dir, path),
      typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    )
  }
  return dir
}

async function init(dir: string, args: string[] = ["--yes", "--no-install"], prompter?: Prompter) {
  const out: string[] = []
  const err: string[] = []
  const code = await run(["init", ...args], {
    cwd: dir,
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    ...(prompter && { prompter }),
  })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

const read = (dir: string, path: string) => readFileSync(join(dir, path), "utf8")
const json = (dir: string, path: string) => JSON.parse(read(dir, path))
const tree = (dir: string) =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((p) => !p.includes("compiled") && !p.startsWith("node_modules"))
    .sort()

describe("Next.js with src/", () => {
  const files = {
    "package.json": {
      name: "shop-web",
      dependencies: { next: "16.4.2" },
      scripts: { build: "next build" },
    },
    "tsconfig.json":
      '{\n  "compilerOptions": {\n    "jsx": "react-jsx",\n    "paths": { "@/*": ["./src/*"] }\n  }\n}\n',
    "src/app/page.tsx": "export default function Page() { return null }\n",
  }

  it("creates the folder in src/, imports through @/*, and touches nothing else", async () => {
    const dir = project(files)
    const before = tree(dir)
    const { code, out } = await init(dir)
    expect(code).toBe(0)
    expect(tree(dir).filter((p) => !before.includes(p))).toEqual([
      ".gitattributes",
      "email-kit.config.ts",
      "src/email-kit",
      "src/email-kit/index.ts",
      "src/email-kit/messages",
      "src/email-kit/messages/en",
      "src/email-kit/messages/en/welcome.json",
      "src/email-kit/templates",
      "src/email-kit/templates/welcome.tsx",
    ])
    expect(read(dir, "email-kit.config.ts")).toBe(
      'import { defineConfig } from "@email-kit/core"\n\nexport default defineConfig({\n  locales: { default: "en" },\n  importPath: "@/email-kit",\n  platform: { productName: "Shop Web" },\n})\n',
    )
    expect(read(dir, "src/email-kit/index.ts")).toContain('export * from "./compiled"')
    // tsconfig already has jsx and an @/* alias that covers src/email-kit: unchanged.
    expect(read(dir, "tsconfig.json")).toBe(files["tsconfig.json"])
    expect(json(dir, "package.json")).toMatchObject({
      scripts: {
        build: "next build",
        "email-kit:compile": "email-kit compile",
        "email-kit:check": "email-kit check",
      },
      devDependencies: {
        "@email-kit/cli": expect.any(String),
        "@email-kit/core": expect.any(String),
        zod: "^4",
      },
    })
    expect(read(dir, ".gitattributes")).toBe("src/email-kit/compiled/** linguist-generated=true\n")
    // INIT-11: compiled once, then the next steps.
    expect(existsSync(join(dir, "src/email-kit/compiled/index.ts"))).toBe(true)
    expect(out).toContain("Compiled 1 template × 1 locale into src/email-kit/compiled")
    expect(out).toContain('  import { emails } from "@/email-kit"')
    expect(out).toContain("  npm run email-kit:compile   after changing a template or message")
    expect(out).toContain("  npm run email-kit:check     the checks, for CI")
  })

  it("says so when run again, and changes nothing", async () => {
    const dir = project(files)
    await init(dir)
    const config = read(dir, "email-kit.config.ts")
    const second = await init(dir)
    expect([second.code, second.out]).toEqual([
      0,
      "email-kit is already set up here (email-kit.config.ts). Add a template with `email-kit new <id>`.",
    ])
    expect(read(dir, "email-kit.config.ts")).toBe(config)
  })
})

describe("Next.js without src/", () => {
  it("puts the folder at the root, with the exact @/email-kit path when @/* points elsewhere", async () => {
    const dir = project({
      "package.json": { name: "web", dependencies: { next: "16.4.2" } },
      "tsconfig.json":
        '{\n  // Next.js settings\n  "compilerOptions": {\n    "jsx": "preserve",\n    "paths": { "@/lib/*": ["./lib/*"] }\n  }\n}\n',
      "app/page.tsx": "export default function Page() { return null }\n",
    })
    const { code } = await init(dir)
    expect(code).toBe(0)
    expect(existsSync(join(dir, "email-kit/templates/welcome.tsx"))).toBe(true)
    // The comment and the existing path stay; one exact path is added.
    expect(read(dir, "tsconfig.json")).toContain("// Next.js settings")
    expect(read(dir, "tsconfig.json")).toBe(
      '{\n  // Next.js settings\n  "compilerOptions": {\n    "jsx": "preserve",\n    "paths": { "@/lib/*": ["./lib/*"], "@/email-kit": ["./email-kit"] }\n  }\n}\n',
    )
  })
})

describe("a tsc project run with node", () => {
  it("imports #email-kit from the .mjs output (ADR 0004 G), and node runs it", async () => {
    const dir = project({
      "package.json": {
        name: "api",
        type: "module",
        scripts: { build: "tsc", start: "node dist/index.js" },
      },
      "tsconfig.json":
        '{\n  "compilerOptions": { "outDir": "dist", "module": "nodenext", "strict": true },\n  "include": ["src"]\n}\n',
      "src/index.ts": "export {}\n",
    })
    const { code, out } = await init(dir)
    expect(code).toBe(0)
    expect(read(dir, "email-kit.config.ts")).toContain('module: "mjs"')
    expect(read(dir, "email-kit.config.ts")).toContain('importPath: "#email-kit"')
    expect(json(dir, "package.json").imports).toEqual({
      "#email-kit": "./src/email-kit/compiled/index.mjs",
    })
    expect(json(dir, "tsconfig.json").compilerOptions.jsx).toBe("react-jsx")
    expect(out).toContain('  import { emails } from "#email-kit"')
    writeFileSync(
      join(dir, "dist.mjs"),
      'import { emails } from "#email-kit"\nconsole.log(emails.welcome.render({ name: "Ada", startUrl: "https://x.test" }).subject)\n',
    )
    expect(execFileSync("node", ["dist.mjs"], { cwd: dir, encoding: "utf8" })).toBe(
      "Welcome to Api, Ada\n",
    )
  })
})

describe("Node type stripping, no build", () => {
  it("imports #email-kit through a .ts re-export (ADR 0004 C), and node runs it", async () => {
    const dir = project({
      "package.json": { name: "worker", type: "module", scripts: { start: "node src/server.ts" } },
      "src/server.ts": "export {}\n",
    })
    const { code } = await init(dir)
    expect(code).toBe(0)
    expect(json(dir, "package.json").imports).toEqual({ "#email-kit": "./src/email-kit/index.ts" })
    expect(read(dir, "src/email-kit/index.ts")).toContain('export * from "./compiled/index.ts"')
    writeFileSync(
      join(dir, "src/send.ts"),
      'import { emails } from "#email-kit"\nconsole.log(emails.welcome.render({ name: "Ada", startUrl: "https://x.test" }).subject)\n',
    )
    expect(execFileSync("node", ["src/send.ts"], { cwd: dir, encoding: "utf8" })).toBe(
      "Welcome to Worker, Ada\n",
    )
  })
})

describe("names that are taken (INIT-06)", () => {
  it("stops at a config of the same name that isn't ours", async () => {
    const dir = project({
      "package.json": { name: "x" },
      "email-kit.config.ts": "export default {}\n",
    })
    const { code, err } = await init(dir)
    expect(code).toBe(1)
    expect(err).toContain("email-kit.config.ts exists and isn't an email-kit config")
  })

  it("never writes into a folder that isn't ours, and records the name it chose", async () => {
    const dir = project({
      "package.json": { name: "x", scripts: { "email-kit:compile": "something else" } },
      "src/index.ts": "export {}\n",
      "src/email-kit/README.md": "someone else's\n",
    })
    const { code } = await init(dir)
    expect(code).toBe(0)
    expect(readdirSync(join(dir, "src/email-kit"))).toEqual(["README.md"])
    expect(read(dir, "email-kit.config.ts")).toContain('root: "src/email-templates"')
    expect(json(dir, "package.json").scripts).toMatchObject({
      "email-kit:compile": "something else",
      "emails:compile": "email-kit compile",
    })
  })

  it("recognises its own folder by the manifest", async () => {
    const dir = project({
      "package.json": { name: "x" },
      "src/index.ts": "export {}\n",
      "src/email-kit/compiled/manifest.json": { emailKit: "0.0.0", dialect: "mustache-core@1" },
    })
    expect((await init(dir)).out).toContain("already set up here (src/email-kit/)")
  })
})

describe("asking first (INIT-04)", () => {
  it("applies only the changes the user accepts", async () => {
    const dir = project({
      "package.json": { name: "x" },
      "tsconfig.json": '{ "compilerOptions": {} }\n',
      "src/index.ts": "",
    })
    const asked: string[] = []
    const prompter: Prompter = {
      confirm: async (message) => {
        asked.push(message)
        return !message.startsWith("package.json")
      },
      text: async (_m, initial) => initial,
    }
    await init(dir, ["--no-install"], prompter)
    expect(asked).toEqual([
      "Create these files?",
      "package.json: add the devDependencies @email-kit/cli, @email-kit/core, @email-kit/components, zod?",
      "package.json: add the scripts email-kit:compile and email-kit:check?",
      'tsconfig.json: add "jsx": "react-jsx" (templates name their JSX runtime themselves)?',
      ".gitattributes: mark src/email-kit/compiled/ as generated?",
    ])
    expect(json(dir, "package.json")).toEqual({ name: "x" })
    expect(json(dir, "tsconfig.json").compilerOptions.jsx).toBe("react-jsx")
  })

  it("won't guess without a terminal: it asks for --yes", async () => {
    const dir = project({ "package.json": { name: "x" } })
    const { code, err } = await init(dir, ["--no-install"])
    expect(code).toBe(1)
    expect(err).toContain("Run it with --yes to accept the defaults")
    expect(existsSync(join(dir, "email-kit.config.ts"))).toBe(false)
  })

  it("offers a shadcn theme it finds", async () => {
    const dir = project({
      "package.json": { name: "x", dependencies: { next: "16.4.2" } },
      "src/app/globals.css": ":root {\n  --primary: oklch(0.2 0 0);\n}\n",
    })
    await init(dir)
    expect(read(dir, "email-kit.config.ts")).toContain('theme: { source: "src/app/globals.css" }')
  })
})

describe("finding the project", () => {
  it("works from a subfolder, on the nearest package.json, and takes --dir", async () => {
    const dir = project({ "package.json": { name: "x" }, "lib/server/index.ts": "" })
    const { code } = await init(join(dir, "lib/server"), ["--yes", "--no-install", "--dir", "lib"])
    expect(code).toBe(0)
    expect(existsSync(join(dir, "lib/email-kit/templates/welcome.tsx"))).toBe(true)
    expect(read(dir, "email-kit.config.ts")).toContain('root: "lib/email-kit"')
  })
})

describe("the project's schema library", () => {
  const base = (deps: Record<string, string>) =>
    project({
      "package.json": { name: "shop", dependencies: { next: "16.4.2", ...deps } },
      "tsconfig.json": { compilerOptions: { jsx: "react-jsx", paths: { "@/*": ["./src/*"] } } },
      "src/app/page.tsx": "",
    })

  it.each([
    {
      library: "valibot",
      deps: { valibot: "^1" },
      line: 'import * as v from "valibot"',
      schema: "startUrl: v.pipe(v.string(), v.metadata(url)),",
      added: { "@valibot/to-json-schema": "^1" },
    },
    {
      library: "arktype",
      deps: { arktype: "^2" },
      line: 'import { type } from "arktype"',
      schema: "startUrl: type.string.configure(url),",
      added: {},
    },
  ])("writes $library templates for a $library project", async ({ deps, line, schema, added }) => {
    const dir = base(deps)
    const { code, out } = await init(dir)
    expect(code).toBe(0)
    const welcome = read(dir, "src/email-kit/templates/welcome.tsx")
    expect(welcome).toContain(line)
    expect(welcome).toContain(schema)
    expect(welcome).not.toContain("zod")
    const devDependencies = json(dir, "package.json").devDependencies
    expect(devDependencies).toMatchObject(added)
    expect(devDependencies).not.toHaveProperty("zod")
    // The first compile read the schema: the url field is marked in schema.json.
    expect(out).toContain("Compiled 1 template × 1 locale")
    expect(
      json(dir, "src/email-kit/compiled/welcome/schema.json").properties.startUrl,
    ).toMatchObject({ "x-email-kit": { url: true } })

    // `new` writes the same library's schema, and it compiles.
    const result = await run(["new", "order-shipped"], { cwd: dir, out: () => {}, err: () => {} })
    expect(result).toBe(0)
    expect(read(dir, "src/email-kit/templates/order-shipped.tsx")).toContain(line)
    expect(await run(["compile", "--quiet"], { cwd: dir, out: () => {}, err: () => {} })).toBe(0)
  })
})

describe("email-kit new (P1-211)", () => {
  const cli = async (dir: string, args: string[]) => {
    const out: string[] = []
    const err: string[] = []
    const code = await run(args, { cwd: dir, out: (t) => out.push(t), err: (t) => err.push(t) })
    return { code, out: out.join("\n"), err: err.join("\n") }
  }
  const setUp = async () => {
    const dir = project({
      "package.json": { name: "shop", dependencies: { next: "16.4.2" } },
      "tsconfig.json": { compilerOptions: { jsx: "react-jsx", paths: { "@/*": ["./src/*"] } } },
      "src/app/page.tsx": "",
    })
    await init(dir)
    writeFileSync(
      join(dir, "email-kit.config.ts"),
      read(dir, "email-kit.config.ts").replace(
        'locales: { default: "en" }',
        'locales: { default: "en", list: ["en", "de"] }',
      ),
    )
    mkdirSync(join(dir, "src/email-kit/messages/de"), { recursive: true })
    writeFileSync(
      join(dir, "src/email-kit/messages/de/welcome.json"),
      read(dir, "src/email-kit/messages/en/welcome.json"),
    )
    return dir
  }

  it("scaffolds a template that compiles in every locale, and prints the import", async () => {
    const dir = await setUp()
    const { code, out } = await cli(dir, ["new", "password-reset"])
    expect(code).toBe(0)
    expect(out).toBe(
      [
        "Created src/email-kit/templates/password-reset.tsx",
        "   and src/email-kit/messages/en/password-reset.json",
        "   and src/email-kit/messages/de/password-reset.json (translate it)",
        "",
        "Compile, then render it:",
        "",
        '  import { emails } from "@/email-kit"',
        "",
        '  emails.passwordReset.render({ name: "Ada" })',
      ].join("\n"),
    )
    expect(await cli(dir, ["compile", "--quiet"])).toMatchObject({ code: 0 })
    expect(existsSync(join(dir, "src/email-kit/compiled/password-reset/de.html"))).toBe(true)
    // With its footer, the new template passes every check, the legal.* ones included.
    const checked = await cli(dir, ["check", "--json"])
    const errors = JSON.parse(checked.out).findings.filter(
      (f: { level: string }) => f.level === "error",
    )
    expect(errors).toEqual([])
  })

  it("refuses an invalid id and one that exists, and writes nothing", async () => {
    const dir = await setUp()
    const before = tree(dir)
    const bad = await cli(dir, ["new", "Password_Reset"])
    expect([bad.code, bad.err]).toEqual([
      1,
      expect.stringContaining('"Password_Reset" isn\'t a template id'),
    ])
    const taken = await cli(dir, ["new", "welcome"])
    expect([taken.code, taken.err]).toEqual([
      1,
      expect.stringContaining(
        'The template "welcome" exists (src/email-kit/templates/welcome.tsx)',
      ),
    ])
    expect(tree(dir)).toEqual(before)
  })
})
