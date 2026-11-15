// The i18n.* checks, and values the caller formats.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import type { Finding } from "../../src/checks/types.ts"
import { compile } from "../../src/compiler/build.ts"
import { run } from "../../src/run.ts"

const FIXTURE = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL("../.tmp/i18n-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

const TEMPLATE = "src/email-kit/order-confirmation/template.tsx"

function project(edits: Record<string, (s: string) => string>): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}_generated`) })
  for (const [file, edit] of Object.entries(edits)) {
    writeFileSync(join(dir, file), edit(readFileSync(join(dir, file), "utf8")))
  }
  return dir
}

/** Adds or changes messages in one locale's file (one edit per file). */
const messages = (locale: string, entries: Record<string, string>) => ({
  [`src/email-kit/order-confirmation/messages.${locale}.json`]: (s: string) =>
    JSON.stringify({ ...JSON.parse(s), ...entries }),
})

async function findings(dir: string, id: string): Promise<Finding[]> {
  const out: string[] = []
  await run(["check", "--json"], { cwd: dir, out: (t) => out.push(t), err: () => {} })
  return (JSON.parse(out.join("\n")).findings as Finding[]).filter((f) => f.id === id)
}

describe("i18n.intl-format", () => {
  it("flags currency symbols next to arguments and dates built from parts, in messages", async () => {
    const dir = project({
      // biome-ignore lint/suspicious/noTemplateCurlyInString: an ICU message, the pattern under test
      ...messages("en", { discount: "You saved ${discount}." }),
      ...messages("de", {
        discount: "Sie haben {discount} € gespart.",
        shipped: "Versendet am {day}.{month}.{year}",
      }),
    })
    const found = await findings(dir, "i18n.intl-format")
    expect(found.map((f) => [f.subject.locale, f.subject.file, f.message])).toEqual([
      [
        "en",
        "src/email-kit/order-confirmation/messages.en.json",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the ICU message, quoted back
        '"discount" puts a currency symbol next to an argument: You saved ${discount}.',
      ],
      [
        "de",
        "src/email-kit/order-confirmation/messages.de.json",
        '"discount" puts a currency symbol next to an argument: Sie haben {discount} € gespart.',
      ],
      [
        "de",
        "src/email-kit/order-confirmation/messages.de.json",
        '"shipped" builds a date from parts: Versendet am {day}.{month}.{year}',
      ],
    ])
  })

  it("flags a symbol written next to a value in a template", async () => {
    const dir = project({
      // biome-ignore lint/suspicious/noTemplateCurlyInString: JSX source text, the pattern under test
      [TEMPLATE]: (s) => s.replace("<Card>", "<Card>\n      <p>Total: ${data.orderNumber}</p>"),
    })
    const [finding] = await findings(dir, "i18n.intl-format")
    expect(finding?.message).toBe('A currency symbol is written next to a value: "Total: $"')
    expect(finding?.subject).toMatchObject({ file: TEMPLATE, line: expect.any(Number) })
  })
})

describe("i18n.unused-keys", () => {
  it("warns about keys no template uses, per messages file", async () => {
    const dir = project({
      ...messages("en", { oldPromo: "Buy more!" }),
      ...messages("de", { oldPromo: "Mehr kaufen!" }),
    })
    const found = await findings(dir, "i18n.unused-keys")
    expect(found.map((f) => [f.level, f.subject.file, f.message])).toEqual([
      [
        "warn",
        "src/email-kit/order-confirmation/messages.en.json",
        '"oldPromo" isn\'t used by order-confirmation',
      ],
      [
        "warn",
        "src/email-kit/order-confirmation/messages.de.json",
        '"oldPromo" isn\'t used by order-confirmation',
      ],
    ])
  })
})

describe("i18n.rtl-explicit", () => {
  it("passes the components, and flags raw text cells, in the RTL pseudo-locale", async () => {
    expect(await findings(project({}), "i18n.rtl-explicit")).toEqual([])
    const dir = project({
      [TEMPLATE]: (s) => s.replace("<Card>", '<Card>\n      <p>{t("noDiscount")}</p>'),
    })
    const found = await findings(dir, "i18n.rtl-explicit")
    expect(found.map((f) => [f.subject.locale, f.message])).toEqual([
      ["ar-XB", "A <p> with text has no dir or text-align"],
    ])
  })
})

describe("caller-formatted values", () => {
  it("carries the formatted() hint into schema.json and the data types", async () => {
    const dir = project({
      "email-kit.config.ts": (s) => s.replace("locales:", "contract: true,\n  locales:"),
      [TEMPLATE]: (s) =>
        s
          .replace(
            'import { defineEmail, Each, If, Unless, url } from "@email-kit/core"',
            'import { defineEmail, Each, formatted, If, Unless, url } from "@email-kit/core"',
          )
          .replace(
            "discount: z.string().optional(),",
            'discount: z.string().optional(),\n    total: z.string().meta(formatted("money")).optional(),',
          ),
    })
    await compile({ cwd: dir })
    const out = join(dir, "src/email-kit/_generated")
    const schema = JSON.parse(readFileSync(join(out, "order-confirmation/schema.json"), "utf8"))
    expect(schema.properties.total).toEqual({
      type: "string",
      "x-email-kit": { formatted: "money" },
    })
    expect(readFileSync(join(out, "index.ts"), "utf8")).toContain(
      '/** An amount, formatted for the recipient: Intl.NumberFormat(locale, { style: "currency", currency }). */\n  total?: string | undefined',
    )
  })

  it("only on strings", async () => {
    const dir = project({
      [TEMPLATE]: (s) =>
        s
          .replace(
            'import { defineEmail, Each, If, Unless, url } from "@email-kit/core"',
            'import { defineEmail, Each, formatted, If, Unless, url } from "@email-kit/core"',
          )
          .replace(
            "discount: z.string().optional(),",
            'discount: z.string().optional(),\n    total: z.number().meta(formatted("money")),',
          ),
    })
    const error = await compile({ cwd: dir }).catch((e: unknown) => e)
    expect(JSON.stringify(error)).toContain(
      "Only string fields can be formatted: the backend formats them as text",
    )
  })
})
