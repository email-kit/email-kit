// P1-075 / OUT-06: with `perTemplateEntries`, a Worker that imports one template's entry bundles
// only that template.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { rolldown } from "rolldown"
import { afterAll, describe, expect, it } from "vitest"

import { compile } from "../src/compiler/build.ts"

const FIXTURE = fileURLToPath(new URL("fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL(".tmp/entries-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

const WELCOME = `/** @jsxImportSource @email-kit/core */
import { defineEmail } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "welcome",
  purpose: "transactional",
  schema: z.object({ name: z.string() }),
  subject: () => "Welcome aboard",
  fixtures: { default: { name: "Ada" } },
  component: ({ data }) => <p>Welcome aboard, {data.name}!</p>,
})
`

async function project(module: "ts" | "mjs" = "ts"): Promise<string> {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, `${module}-`))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}_generated`) })
  mkdirSync(join(dir, "src", "email-kit", "welcome"))
  writeFileSync(join(dir, "src", "email-kit", "welcome", "template.tsx"), WELCOME)
  const config = join(dir, "email-kit.config.ts")
  writeFileSync(
    config,
    readFileSync(config, "utf8").replace(
      "locales:",
      `module: "${module}",\n  perTemplateEntries: true,\n  locales:`,
    ),
  )
  await compile({ cwd: dir })
  return dir
}

// A Cloudflare-Worker-shaped entry that sends the order confirmation.
function worker(importPath: string): string {
  return `import { createEmails } from "${importPath}"

const emails = createEmails({ siteUrl: "https://shop.example" })

export default {
  fetch() {
    const email = emails.orderConfirmation.render({
      customerName: "Ada",
      orderNumber: "A-1042",
      orderUrl: "https://shop.example/orders/A-1042",
      items: [{ name: "Tea", qty: 2 }],
    })
    return new Response(email.html, { headers: { "content-type": "text/html" } })
  },
}
`
}

async function bundle(dir: string, importPath: string): Promise<string> {
  const entry = join(dir, "worker.ts")
  writeFileSync(entry, worker(importPath))
  const build = await rolldown({ input: entry, platform: "browser", logLevel: "silent" })
  const { output } = await build.generate({ format: "esm", minify: true })
  await build.close()
  return output[0].code
}

describe("per-template entry points", () => {
  it("bundles only the imported template, and it runs on web APIs", async () => {
    const dir = await project()
    const single = await bundle(dir, "./src/email-kit/_generated/order-confirmation/index.ts")
    // The parsed template; the minifier may quote its strings with backticks.
    expect(single).toMatch(/Thanks, ["`],\[0,["`]customerName["`]\]/)
    expect(single).not.toContain("Welcome aboard")

    // The control: the all-templates module brings every template along.
    const all = await bundle(dir, "./src/email-kit/_generated/index.ts")
    expect(all).toContain("Welcome aboard")
    expect(single.length).toBeLessThan(all.length)

    const file = join(dir, "worker.mjs")
    writeFileSync(file, single)
    const { default: app } = (await import(pathToFileURL(file).href)) as {
      default: { fetch(): Response }
    }
    expect(await app.fetch().text()).toContain("Thanks, Ada!")
  })

  it("writes an entry per template, owned like every other output file", async () => {
    const dir = await project()
    const compiled = join(dir, "src", "email-kit", "_generated")
    const files = readdirSync(compiled, { recursive: true }).map((f) =>
      String(f).split(sep).join("/"),
    )
    expect(files.filter((file) => file.endsWith("index.ts")).sort()).toEqual([
      "index.ts",
      "order-confirmation/index.ts",
      "welcome/index.ts",
    ])
    const entry = readFileSync(join(compiled, "welcome", "index.ts"), "utf8")
    expect(entry).toContain('export type TemplateId = "welcome"')
    expect(entry).not.toContain("order-confirmation")
  })

  it("follows the module format", async () => {
    const dir = await project("mjs")
    const compiled = join(dir, "src", "email-kit", "_generated")
    for (const file of ["index.mjs", "index.d.mts", "welcome/index.mjs", "welcome/index.d.mts"]) {
      expect(existsSync(join(compiled, ...file.split("/"))), file).toBe(true)
    }
    expect(existsSync(join(compiled, "welcome", "index.ts"))).toBe(false)
  })
})
