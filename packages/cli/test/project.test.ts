// M1.1 end to end: `email-kit compile` on a fixture project shaped like a user's, compared with
// the committed output in fixtures/project/src/email-kit/compiled/, then rendered through the
// generated module.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import { compile, summarize } from "../src/compiler/build.ts"
import { resolveConfig } from "../src/compiler/config.ts"
import { CompileError } from "../src/compiler/project.ts"

const FIXTURE = fileURLToPath(new URL("fixtures/project/", import.meta.url))
const COMMITTED = join(FIXTURE, "src", "email-kit", "compiled")
// Inside the package, so the copies resolve @email-kit/core and zod from its node_modules.
const TMP = fileURLToPath(new URL(".tmp/project-test/", import.meta.url))

function copyProject(): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
  return dir
}

const compiledDir = (dir: string) => join(dir, "src", "email-kit", "compiled")
const read = (dir: string, path: string) => readFileSync(join(compiledDir(dir), path), "utf8")

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

interface GeneratedModule {
  emails: {
    orderConfirmation: {
      render(
        data: unknown,
        options?: { locale?: string },
      ): {
        subject: string
        preheader: string
        html: string
        text: string
        meta: { id: string; locale: string; purpose: string }
      }
      templates: Record<string, { html: string }>
    }
  }
  locales: readonly string[]
}

const order = {
  customerName: "Ada",
  orderNumber: "A-1042",
  orderUrl: "https://shop.example/orders/A-1042?ref=email&lang=en",
  items: [
    { name: "Tea", qty: 2 },
    { name: "Cake", qty: 1 },
  ],
}

describe("email-kit compile", () => {
  it("writes the committed output for the fixture project", async () => {
    const dir = copyProject()
    const result = await compile({ cwd: dir })
    expect(summarize(result)).toBe(
      "Compiled 1 template × 2 locales into src/email-kit/compiled (7 files: 7 written, 0 unchanged, 0 removed)",
    )
    const manifest = JSON.parse(read(dir, "manifest.json")) as { files: string[] }
    expect(manifest.files).toEqual([
      "index.ts",
      "manifest.json",
      "order-confirmation/de.html",
      "order-confirmation/de.txt",
      "order-confirmation/en.html",
      "order-confirmation/en.txt",
      "order-confirmation/schema.json",
    ])
    for (const path of manifest.files) {
      await expect(read(dir, path)).toMatchFileSnapshot(join(COMMITTED, ...path.split("/")))
    }
  })

  it("generates a module that renders every locale with fallback", async () => {
    const dir = copyProject()
    await compile({ cwd: dir })
    const { emails, locales } = (await import(
      pathToFileURL(join(compiledDir(dir), "index.ts")).href
    )) as GeneratedModule
    expect(locales).toEqual(["en", "de"])

    const en = emails.orderConfirmation.render({ ...order, discount: "10%" })
    expect(en.subject).toBe("Order A-1042 confirmed")
    expect(en.meta).toEqual({ id: "order-confirmation", locale: "en", purpose: "transactional" })
    expect(en.html).toContain("You saved 10%.")
    expect(en.html).toContain('href="https://shop.example/orders/A-1042?ref=email&amp;lang=en"')
    expect(en.text).toContain(
      "View your order: https://shop.example/orders/A-1042?ref=email&lang=en",
    )

    const de = emails.orderConfirmation.render(order, { locale: "de-AT" })
    expect(de.meta.locale).toBe("de")
    expect(de.subject).toBe("Bestellung A-1042 bestätigt")
    expect(de.html).toContain("Diesmal kein Rabatt.")

    expect(emails.orderConfirmation.render(order, { locale: "fr" }).meta.locale).toBe("en")
  })

  it("projects data onto the schema before rendering", async () => {
    const dir = copyProject()
    await compile({ cwd: dir })
    const { emails } = (await import(
      pathToFileURL(join(compiledDir(dir), "index.ts")).href
    )) as GeneratedModule
    // An unknown top-level key named like an item field must not leak into the items.
    const html = emails.orderConfirmation.render({ ...order, name: "LEAK", unknown: 1 }).html
    expect(html).toContain("<li>Tea × 2</li>")
    expect(html).not.toContain("LEAK")
    expect(() => emails.orderConfirmation.render({ ...order, orderNumber: "A\nB" })).toThrow(
      expect.objectContaining({ code: "subject-line-break" }),
    )
  })

  it("is deterministic: a second compile changes nothing", async () => {
    const dir = copyProject()
    await compile({ cwd: dir })
    const first = read(dir, "index.ts")
    const second = await compile({ cwd: dir })
    expect(second.files.written).toEqual([])
    expect(second.files.unchanged).toHaveLength(7)
    expect(read(dir, "index.ts")).toBe(first)
  })

  it("removes only files it owns", async () => {
    const dir = copyProject()
    await compile({ cwd: dir })
    writeFileSync(join(compiledDir(dir), "NOTES.md"), "mine")
    writeFileSync(
      join(dir, "email-kit.config.ts"),
      'import { defineConfig } from "@email-kit/core"\nexport default defineConfig({ locales: { default: "en" } })\n',
    )
    const result = await compile({ cwd: dir })
    expect(result.files.deleted).toEqual([
      "order-confirmation/de.html",
      "order-confirmation/de.txt",
    ])
    expect(existsSync(join(compiledDir(dir), "order-confirmation", "de.html"))).toBe(false)
    expect(read(dir, "NOTES.md")).toBe("mine")
  })
})

describe("compile errors", () => {
  async function problems(dir: string) {
    try {
      await compile({ cwd: dir })
    } catch (error) {
      if (error instanceof CompileError) return error.problems
      throw error
    }
    throw new Error("expected the compile to fail")
  }

  it("reports a duplicate template id", async () => {
    const dir = copyProject()
    const templates = join(dir, "src", "email-kit", "templates")
    cpSync(join(templates, "order-confirmation.tsx"), join(templates, "order-copy.tsx"))
    expect(await problems(dir)).toEqual([
      expect.objectContaining({
        file: join("src", "email-kit", "templates", "order-copy.tsx"),
        code: "duplicate-id",
      }),
    ])
  })

  it("points a missing message at the file to add it to", async () => {
    const dir = copyProject()
    rmSync(join(dir, "src", "email-kit", "messages", "de", "order-confirmation.json"))
    const [problem] = await problems(dir)
    expect(problem?.code).toBe("missing-message")
    expect(problem?.message).toContain(
      join("src", "email-kit", "messages", "de", "order-confirmation.json"),
    )
  })

  it("reports a non-portable schema with the field path", async () => {
    const dir = copyProject()
    const file = join(dir, "src", "email-kit", "templates", "order-confirmation.tsx")
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(
        "qty: z.number()",
        "qty: z.union([z.number(), z.string()])",
      ),
    )
    const [problem] = await problems(dir)
    expect(problem?.code).toBe("schema-not-portable")
    expect(problem?.message).toContain("items[].qty: Unions aren't portable")
  })

  it("explains a missing config", async () => {
    mkdirSync(TMP, { recursive: true })
    const empty = mkdtempSync(join(TMP, "empty-"))
    await expect(compile({ cwd: empty })).rejects.toThrow(
      expect.objectContaining({ code: "config-not-found" }),
    )
  })
})

describe("config validation", () => {
  const file = join(FIXTURE, "email-kit.config.ts")
  const resolve = (config: unknown) => () => resolveConfig(config, { file, cacheDir: TMP })

  it("resolves the defaults relative to the config file", () => {
    const config = resolveConfig({}, { file, cacheDir: TMP })
    expect(config.root).toBe(join(FIXTURE, "src", "email-kit"))
    expect(config.out).toBe(join(FIXTURE, "src", "email-kit", "compiled"))
    expect(config.locales).toEqual(["en"])
  })

  it("puts the default locale first", () => {
    const config = resolveConfig(
      { locales: { default: "de", list: ["en", "de", "pt-BR"] } },
      { file, cacheDir: TMP },
    )
    expect(config.locales).toEqual(["de", "en", "pt-BR"])
  })

  it("lists every problem with its path", () => {
    expect(
      resolve({
        templets: "x",
        out: "src/email-kit/templates/out",
        locales: { default: "en", list: ["en_US", "pt-br", "de", "de"] },
      }),
    ).toThrow(
      [
        "has 6 problems:",
        "  • templets: unknown option (known: root, templates, messages, out, module, locales)",
        "  • out: must not overlap the templates folder (src/email-kit/templates)",
        '  • locales.list[0]: "en_US" isn\'t a BCP 47 locale tag, such as "en" or "pt-BR"',
        '  • locales.list[1]: write "pt-br" as "pt-BR"',
        '  • locales.list[3]: "de" is listed twice',
        '  • locales.list: must include the default locale "en"',
      ].join("\n"),
    )
  })
})
