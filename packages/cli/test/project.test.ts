// M1.1 end to end: `email-kit compile` on a fixture project shaped like a user's, compared with
// the committed output in fixtures/project/src/email-kit/_generated/, then rendered through the
// generated module.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import { compile, summarize } from "../src/compiler/build.ts"
import { resolveConfig } from "../src/compiler/config/index.ts"
import { CompileError } from "../src/compiler/project/index.ts"

const FIXTURE = fileURLToPath(new URL("fixtures/project/", import.meta.url))
const COMMITTED = join(FIXTURE, "src", "email-kit", "_generated")
// Inside the package, so the copies resolve @email-kit/core and zod from its node_modules.
const TMP = fileURLToPath(new URL(".tmp/project-test/", import.meta.url))

function copyProject(): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}_generated`) })
  return dir
}

/** Turns on `contract`, so the output also has the parts, schemas and manifest as files. */
function withContract(dir: string): string {
  const config = join(dir, "email-kit.config.ts")
  writeFileSync(
    config,
    readFileSync(config, "utf8").replace("locales:", "contract: true,\n  locales:"),
  )
  return dir
}

const compiledDir = (dir: string) => join(dir, "src", "email-kit", "_generated")
const read = (dir: string, path: string) => readFileSync(join(compiledDir(dir), path), "utf8")

afterAll(() => rmSync(TMP, { recursive: true, force: true }))

interface GeneratedModule {
  createEmails(context: { siteUrl: string }): {
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
      validate(data: unknown): readonly { path: string; message: string }[]
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
  it("writes the committed output for the fixture project: the module and t() types", async () => {
    const dir = copyProject()
    const result = await compile({ cwd: dir })
    expect(summarize(result)).toBe(
      "Compiled 1 template × 2 locales into src/email-kit/_generated (2 files: 2 written, 0 unchanged, 0 removed)",
    )
    expect(readdirSync(compiledDir(dir)).sort()).toEqual(["index.ts", "messages.d.ts"])
    for (const path of ["index.ts", "messages.d.ts"]) {
      await expect(read(dir, path)).toMatchFileSnapshot(join(COMMITTED, path))
    }
  })

  it("with contract, also writes the parts, schemas and manifest as files", async () => {
    const dir = withContract(copyProject())
    await compile({ cwd: dir })
    const manifest = JSON.parse(read(dir, "manifest.json")) as { files: string[] }
    expect(manifest.files).toEqual([
      "index.ts",
      "manifest.json",
      "messages.d.ts",
      "order-confirmation/de.html",
      "order-confirmation/de.txt",
      "order-confirmation/en.html",
      "order-confirmation/en.txt",
      "order-confirmation/schema.json",
    ])
    expect(readdirSync(compiledDir(dir), { recursive: true }).length).toBe(9)
    expect(read(dir, "order-confirmation/en.txt")).toContain("Thanks, {{customerName}}!")
    // The files hold the parts as {{placeholder}} templates; the module holds them parsed.
    expect(read(dir, "order-confirmation/de.html")).toContain("{{customerName}}")
    expect(read(dir, "index.ts")).toContain('[0, "customerName"]')
  })

  it("generates a module that renders every locale with fallback", async () => {
    const dir = copyProject()
    await compile({ cwd: dir })
    const { createEmails, locales } = (await import(
      pathToFileURL(join(compiledDir(dir), "index.ts")).href
    )) as GeneratedModule
    const emails = createEmails({ siteUrl: "https://shop.example" })
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
    const { createEmails } = (await import(
      pathToFileURL(join(compiledDir(dir), "index.ts")).href
    )) as GeneratedModule
    const emails = createEmails({ siteUrl: "https://shop.example" })
    // An unknown top-level key named like an item field must not leak into the items.
    const html = emails.orderConfirmation.render({ ...order, name: "LEAK", unknown: 1 }).html
    expect(html).toContain('class="ek-c--ink">Tea × 2</li>')
    expect(html).not.toContain("LEAK")
    expect(() => emails.orderConfirmation.render({ ...order, orderNumber: "A\nB" })).toThrow(
      expect.objectContaining({ code: "subject-line-break" }),
    )
  })

  it("fills sender values: constants at compile time, runtime keys from createEmails()", async () => {
    const dir = withContract(copyProject())
    await compile({ cwd: dir })
    // The constant is text in the compiled template; the runtime key is a placeholder.
    expect(read(dir, "order-confirmation/en.html")).toContain(
      'Sent by Shop Example. <a href="{{_ek.context.siteUrl}}" target="_blank" rel="noopener" style=',
    )
    const manifest = JSON.parse(read(dir, "manifest.json"))
    expect(manifest.sender).toEqual({
      constants: { productName: "Shop Example" },
      runtime: ["siteUrl"],
    })

    const { createEmails } = (await import(
      pathToFileURL(join(compiledDir(dir), "index.ts")).href
    )) as GeneratedModule
    const emails = createEmails({ siteUrl: "https://shop.example" })
    // Data can't override or shadow a context value (P1-053).
    const html = emails.orderConfirmation.render({
      ...order,
      siteUrl: "https://evil.example",
      _ek: { context: { siteUrl: "https://evil.example" } },
      items: [{ name: "Tea", qty: 2, _ek: { context: { siteUrl: "https://evil.example" } } }],
    }).html
    expect(html).toContain('<a href="https://shop.example" target="_blank" rel="noopener" style=')
    expect(html).not.toContain("evil")
    expect(() => createEmails({} as { siteUrl: string })).toThrow(
      expect.objectContaining({ code: "missing-context" }),
    )
  })

  it("exports ready-made emails when nothing is passed at send time", async () => {
    const dir = copyProject()
    writeFileSync(
      join(dir, "email-kit.config.ts"),
      'import { defineConfig } from "@email-kit/core"\nexport default defineConfig({ locales: { default: "en" }, sender: { productName: "Shop Example", siteUrl: "https://shop.example" } })\n',
    )
    await compile({ cwd: dir })
    expect(read(dir, "index.ts")).toContain("export type EmailContext = Record<never, never>")
    const { emails } = (await import(pathToFileURL(join(compiledDir(dir), "index.ts")).href)) as {
      emails: ReturnType<GeneratedModule["createEmails"]>
    }
    expect(emails.orderConfirmation.render(order).html).toContain(
      '<a href="https://shop.example" target="_blank" rel="noopener" style=',
    )
  })

  it("validates data before rendering, with field paths (OUT-08, RUN-05)", async () => {
    const dir = copyProject()
    await compile({ cwd: dir })
    const { createEmails } = (await import(
      pathToFileURL(join(compiledDir(dir), "index.ts")).href
    )) as GeneratedModule
    const emails = createEmails({ siteUrl: "https://shop.example" })
    const bad = {
      ...order,
      orderUrl: "javascript:alert(1)",
      items: [{ name: "Tea", qty: "2" }, { qty: 1 }],
    }
    expect(emails.orderConfirmation.validate(bad)).toEqual([
      { path: "orderUrl", message: 'must be an https URL, got "javascript:alert(1)"' },
      { path: "items[0].qty", message: 'expected a number, got "2"' },
      { path: "items[1].name", message: "is required" },
    ])
    expect(() => emails.orderConfirmation.render(bad)).toThrow(
      expect.objectContaining({ code: "invalid-data", issues: expect.any(Array) }),
    )
    expect(emails.orderConfirmation.validate(order)).toEqual([])
  })

  it("with validate: false, renders without checking and leaves the validator out", async () => {
    const dir = copyProject()
    const config = join(dir, "email-kit.config.ts")
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace("locales:", "validate: false,\n  locales:"),
    )
    await compile({ cwd: dir })
    const { createEmails } = (await import(
      pathToFileURL(join(compiledDir(dir), "index.ts")).href
    )) as GeneratedModule
    const emails = createEmails({ siteUrl: "https://shop.example" })
    const bad = { ...order, items: [{ name: "Tea", qty: "2" }] }
    expect(emails.orderConfirmation.render(bad).html).toContain('class="ek-c--ink">Tea × 2</li>')
    expect("validate" in emails.orderConfirmation).toBe(false)
    const module = read(dir, "index.ts")
    expect(module).not.toContain("@email-kit/runtime/validate")
    expect(module).toContain(
      'Omit<EmailTemplate<"order-confirmation", OrderConfirmationData, Locale>, "validate">',
    )
  })

  it("is deterministic: a second compile changes nothing", async () => {
    const dir = copyProject()
    await compile({ cwd: dir })
    const first = read(dir, "index.ts")
    const second = await compile({ cwd: dir })
    expect(second.files.written).toEqual([])
    expect(second.files.unchanged).toHaveLength(2)
    expect(read(dir, "index.ts")).toBe(first)
  })

  it("owns the output folder: removes what it didn't write, except names starting with .", async () => {
    const dir = withContract(copyProject())
    await compile({ cwd: dir })
    writeFileSync(join(compiledDir(dir), "NOTES.md"), "mine")
    writeFileSync(join(compiledDir(dir), ".gitkeep"), "")
    writeFileSync(
      join(dir, "email-kit.config.ts"),
      'import { defineConfig } from "@email-kit/core"\nexport default defineConfig({ contract: true, locales: { default: "en" }, sender: { productName: "Shop Example", siteUrl: { runtime: true } } })\n',
    )
    const result = await compile({ cwd: dir })
    expect(result.files.deleted).toEqual([
      "NOTES.md",
      "order-confirmation/de.html",
      "order-confirmation/de.txt",
    ])
    expect(existsSync(join(compiledDir(dir), "order-confirmation", "de.html"))).toBe(false)
    expect(existsSync(join(compiledDir(dir), ".gitkeep"))).toBe(true)

    // Turning contract off removes the files it wrote, and their folder.
    writeFileSync(
      join(dir, "email-kit.config.ts"),
      'import { defineConfig } from "@email-kit/core"\nexport default defineConfig({ locales: { default: "en" }, sender: { productName: "Shop Example", siteUrl: { runtime: true } } })\n',
    )
    await compile({ cwd: dir })
    expect(readdirSync(compiledDir(dir)).sort()).toEqual([".gitkeep", "index.ts", "messages.d.ts"])
  })

  it("refuses an output folder holding files it didn't write", async () => {
    const dir = copyProject()
    mkdirSync(join(dir, "lib"))
    writeFileSync(join(dir, "lib", "db.ts"), "export const db = 1\n")
    const config = join(dir, "email-kit.config.ts")
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace("locales:", 'out: "lib",\n  locales:'),
    )
    await expect(compile({ cwd: dir })).rejects.toMatchObject({ code: "out-not-owned" })
    expect(readdirSync(join(dir, "lib"))).toEqual(["db.ts"])
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

  it("reports an id that isn't its folder's name", async () => {
    const dir = copyProject()
    const root = join(dir, "src", "email-kit")
    cpSync(join(root, "order-confirmation"), join(root, "order-copy"), { recursive: true })
    expect(await problems(dir)).toEqual([
      expect.objectContaining({
        file: join("src", "email-kit", "order-copy", "template.tsx"),
        code: "id-mismatch",
        message: expect.stringContaining('doesn\'t match its folder "order-copy"'),
      }),
    ])
  })

  it("compiles only folders with template.tsx, skipping _ folders and the output", async () => {
    const dir = copyProject()
    const root = join(dir, "src", "email-kit")
    // A shared folder, a non-template folder, and stray .tsx files: none of them is a template.
    mkdirSync(join(root, "_shared"))
    writeFileSync(join(root, "_shared", "template.tsx"), "export const notATemplate = true\n")
    mkdirSync(join(root, "fixtures"))
    writeFileSync(join(root, "fixtures", "data.json"), "{}")
    writeFileSync(join(root, "stray.tsx"), "export const notATemplate = true\n")
    const result = await compile({ cwd: dir })
    expect(result.templates.map((template) => template.id)).toEqual(["order-confirmation"])
  })

  it("reports a folder with messages but no template.tsx", async () => {
    const dir = copyProject()
    const folder = join(dir, "src", "email-kit", "order-confirmation")
    renameSync(join(folder, "template.tsx"), join(folder, "templete.tsx"))
    expect(await problems(dir)).toEqual([
      expect.objectContaining({
        file: "src/email-kit/order-confirmation",
        code: "missing-template",
      }),
    ])
  })

  it("explains how to move from the old templates/ and messages/ layout", async () => {
    const dir = copyProject()
    const root = join(dir, "src", "email-kit")
    mkdirSync(join(root, "templates"))
    renameSync(join(root, "order-confirmation", "template.tsx"), join(root, "templates", "x.tsx"))
    const found = await problems(dir)
    expect(found.map((problem) => problem.code)).toEqual(["missing-template", "old-layout"])
    expect(found[1]?.message).toContain("<root>/<id>/template.tsx")
  })

  it("points a missing message at the file to add it to", async () => {
    const dir = copyProject()
    rmSync(join(dir, "src", "email-kit", "order-confirmation", "messages.de.json"))
    const [problem] = await problems(dir)
    expect(problem?.code).toBe("missing-message")
    expect(problem?.message).toContain(
      join("src", "email-kit", "order-confirmation", "messages.de.json"),
    )
  })

  it("reports a non-portable schema with the field path", async () => {
    const dir = copyProject()
    const file = join(dir, "src", "email-kit", "order-confirmation", "template.tsx")
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
    expect(config.out).toBe(join(FIXTURE, "src", "email-kit", "_generated"))
    expect(config.locales).toEqual(["en"])
  })

  it("puts the default locale first", () => {
    const config = resolveConfig(
      { locales: { default: "de", list: ["en", "de", "pt-BR"] } },
      { file, cacheDir: TMP },
    )
    expect(config.locales).toEqual(["de", "en", "pt-BR"])
  })

  it("validates sender values", () => {
    expect(
      resolve({ sender: { productName: "", siteUrl: { runtime: "yes" }, phone: "1" } }),
    ).toThrow(
      [
        "has 3 problems:",
        "  • sender.productName: must be a non-empty string, or { runtime: true } to pass it at send time",
        "  • sender.siteUrl: must be a non-empty string, or { runtime: true } to pass it at send time",
        "  • sender.phone: unknown sender value (known: productName, name, legalName, postalAddress, privacyUrl, helpUrl, supportEmail, siteUrl)",
      ].join("\n"),
    )
    expect(
      resolve({
        sender: {
          siteUrl: "http://shop.example",
          helpUrl: "help.shop.example",
          supportEmail: "help",
        },
      }),
    ).toThrow(
      [
        "has 3 problems:",
        '  • sender.siteUrl: must be an https URL, like "https://example.com/…"',
        '  • sender.helpUrl: must be an https URL, like "https://example.com/…"',
        '  • sender.supportEmail: must be an email address, like "help@example.com"',
      ].join("\n"),
    )
    const config = resolveConfig(
      { sender: { siteUrl: { runtime: true }, helpUrl: { runtime: true }, productName: "Acme" } },
      { file, cacheDir: TMP },
    )
    expect(config.sender).toEqual({
      constants: { productName: "Acme" },
      runtime: ["helpUrl", "siteUrl"],
    })
  })

  it("lists every problem with its path", () => {
    expect(
      resolve({
        templets: "x",
        templates: "src/email-kit/templates",
        out: "src/email-kit",
        locales: { default: "en", list: ["en_US", "pt-br", "de", "de"] },
      }),
    ).toThrow(
      [
        "has 7 problems:",
        "  • templates: removed: each template is a folder in root, <root>/<id>/template.tsx, with its messages beside it as messages.<locale>.json",
        "  • templets: unknown option (known: root, out, contract, module, perTemplateEntries, validate, sender, theme, locales, checks, customChecks, importPath)",
        "  • out: must not be or contain the email-kit folder (src/email-kit); use its own folder, such as src/email-kit/_generated",
        '  • locales.list[0]: "en_US" isn\'t a BCP 47 locale tag, such as "en" or "pt-BR"',
        '  • locales.list[1]: write "pt-br" as "pt-BR"',
        '  • locales.list[3]: "de" is listed twice',
        '  • locales.list: must include the default locale "en"',
      ].join("\n"),
    )
  })
})
