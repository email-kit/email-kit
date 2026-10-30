// P1-156, ADR 0003: ICU plural and select in messages, CLDR rules compiled into the generated
// module, data preparation at render time, and the compile-time checks.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import plurals from "cldr-core/supplemental/plurals.json" with { type: "json" }
import { afterAll, describe, expect, it } from "vitest"

import { compile } from "../src/compiler/build.ts"
import { CLDR_VERSION, pluralRules } from "../src/i18n/plurals.ts"

const TMP = fileURLToPath(new URL(".tmp/plurals-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe("CLDR rules compiled to functions", () => {
  it("match Intl.PluralRules (same CLDR) for every locale both know", () => {
    expect(CLDR_VERSION).toBe(process.versions.cldr?.split(".")[0])
    const numbers = [
      ...Array.from({ length: 251 }, (_, i) => i),
      1000,
      1001,
      1e6,
      2e6,
      0.5,
      1.5,
      2.5,
      1.1,
      1.25,
      0.1,
      10.5,
      21.3,
    ]
    const mismatches: string[] = []
    let checked = 0
    for (const locale of Object.keys(plurals.supplemental["plurals-type-cardinal"])) {
      const intl = new Intl.PluralRules(locale)
      if (intl.resolvedOptions().locale.split("-")[0] !== locale.split("-")[0]) continue
      checked++
      for (const n of numbers) {
        const ours = pluralRules(locale).category(n)
        if (ours !== intl.select(n))
          mismatches.push(`${locale} ${n}: ${ours}, Intl ${intl.select(n)}`)
      }
    }
    expect(checked).toBeGreaterThan(150)
    expect(mismatches).toEqual([])
  })

  it("know the traps ADR 0003 lists", () => {
    expect(pluralRules("si").category(0)).toBe("one")
    expect(pluralRules("fr").category(1.5)).toBe("one")
    expect(pluralRules("ar").category(11)).toBe("many")
    expect(pluralRules("ru").category(21)).toBe("one")
    expect(pluralRules("de-AT")).toMatchObject({ locale: "de", categories: ["one", "other"] })
    expect(pluralRules("tlh").categories).toEqual(["other"])
  })
})

const SCHEMA = `z.object({
    count: z.number(),
    plan: z.enum(["free", "pro-plus"]),
    label: z.string(),
    items: z.array(z.object({ name: z.string(), qty: z.number() })),
  })`

const TEMPLATE = (schema: string, body: string) => `/** @jsxImportSource @email-kit/core */
import { defineEmail, Each } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "cart",
  purpose: "transactional",
  schema: ${schema},
  subject: (data, t) => t("subject", { count: data.count }),
  fixtures: { default: { count: 2, plan: "free", label: "x", items: [{ name: "Tea", qty: 1 }] } },
  component: ({ data, t }) => (
    ${body}
  ),
})
`

const BODY = `<div>
      <p>{t("plan", { plan: data.plan })}</p>
      <p>{t("fixed", { n: 1 })}</p>
      <ul>
        <Each of={data.items}>{(item) => <li>{t("line", { name: item.name, qty: item.qty, count: data.count })}</li>}</Each>
      </ul>
    </div>`

const EN = {
  subject:
    "{count, plural, =0 {Your cart is empty} one {# item in your cart} other {# items in your cart}}",
  plan: "{plan, select, free {Free plan} pro-plus {Pro Plus plan} other {Your plan}}",
  fixed: "It''s {n, plural, one {'#' # thing} other {# things}}",
  line: "{name}: {qty, plural, one {# cup} other {# cups}} of {count, plural, one {# order} other {# orders}}",
}

function project(
  messages: Record<string, Record<string, string>>,
  options: { schema?: string; body?: string } = {},
) {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  const locales = Object.keys(messages)
  writeFileSync(
    join(dir, "email-kit.config.ts"),
    `import { defineConfig } from "@email-kit/core"\nexport default defineConfig({ locales: { default: "${locales[0]}", list: ${JSON.stringify(locales)} } })\n`,
  )
  mkdirSync(join(dir, "src/email-kit/templates"), { recursive: true })
  writeFileSync(
    join(dir, "src/email-kit/templates/cart.tsx"),
    TEMPLATE(options.schema ?? SCHEMA, options.body ?? BODY),
  )
  for (const [locale, entries] of Object.entries(messages)) {
    mkdirSync(join(dir, "src/email-kit/messages", locale), { recursive: true })
    writeFileSync(join(dir, "src/email-kit/messages", locale, "cart.json"), JSON.stringify(entries))
  }
  return dir
}

describe("plural and select in a compiled project", () => {
  const AR = {
    ...EN,
    subject:
      "{count, plural, zero {zero:#} one {one:#} two {two:#} few {few:#} many {many:#} other {other:#}}",
    fixed: "{n, plural, zero {z} one {o} two {t} few {f} many {m} other {x}}",
    line: "{name} {qty, plural, zero {z} one {o} two {t} few {f} many {m} other {x}} {count, plural, zero {z} one {o} two {t} few {f} many {m} other {x}}",
  }
  const JA = {
    ...EN,
    subject: "{count, plural, other {#点}}",
    fixed: "{n, plural, other {#}}",
    line: "{name} {qty, plural, other {#}} {count, plural, other {#}}",
  }

  it("selects categories, exact matches and enum cases at render time, in every locale", async () => {
    const dir = project({ en: EN, ar: AR, ja: JA })
    await compile({ cwd: dir })
    const out = join(dir, "src/email-kit/compiled")
    expect(JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")).cldr).toBe(CLDR_VERSION)
    const { emails } = (await import(pathToFileURL(join(out, "index.ts")).href)) as {
      emails: {
        cart: {
          render(
            data: unknown,
            options?: { locale: string },
          ): { subject: string; html: string; text: string }
        }
      }
    }
    const render = (count: number, locale = "en", extra: object = {}) =>
      emails.cart.render(
        {
          count,
          plan: "free",
          label: "x",
          items: [
            { name: "Tea", qty: 1 },
            { name: "Cake", qty: 2 },
          ],
          ...extra,
        },
        { locale },
      )

    expect([0, 1, 3].map((n) => render(n).subject)).toEqual([
      "Your cart is empty",
      "1 item in your cart",
      "3 items in your cart",
    ])
    expect([0, 1, 2, 3, 11, 100].map((n) => render(n, "ar").subject)).toEqual([
      "zero:0",
      "one:1",
      "two:2",
      "few:3",
      "many:11",
      "other:100",
    ])
    expect(render(1, "ja").subject).toBe("1点")

    const text = render(1).text
    // A plural on the item, and one on a root field from inside the list (inherited _ek).
    expect(text).toContain("- Tea: 1 cup of 1 order")
    expect(text).toContain("- Cake: 2 cups of 1 order")
    expect(render(5).text).toContain("- Cake: 2 cups of 5 orders")
    // A literal number is resolved at compile time; quoting keeps ' and #.
    expect(text).toContain("It's # 1 thing")
    // Select, with a value that isn't a valid name on its own.
    expect(text).toContain("Free plan")
    expect(render(1, "en", { plan: "pro-plus" }).text).toContain("Pro Plus plan")
  })

  it("leaves the caller's data alone", async () => {
    const dir = project({ en: EN })
    await compile({ cwd: dir })
    const { emails } = (await import(
      pathToFileURL(join(dir, "src/email-kit/compiled/index.ts")).href
    )) as {
      emails: { cart: { render(data: unknown): unknown } }
    }
    const data = { count: 2, plan: "free", label: "x", items: [{ name: "Tea", qty: 1 }] }
    emails.cart.render(data)
    expect(data).toEqual({ count: 2, plan: "free", label: "x", items: [{ name: "Tea", qty: 1 }] })
  })
})

describe("compile errors", () => {
  const error = async (
    messages: Record<string, Record<string, string>>,
    options: { schema?: string; body?: string } = {},
  ) => {
    const caught = await compile({ cwd: project(messages, options) }).catch((e: unknown) => e)
    const problem = (caught as { problems?: { code: string; message: string }[] }).problems?.[0]
    return `${problem?.code}: ${problem?.message}`
  }

  it.each([
    [
      "a category the locale uses is missing",
      { en: { ...EN, subject: "{count, plural, =1 {# item} other {# items}}" } },
      'invalid-plural: Message "subject" in locale "en": {count, plural} needs one too; "en" uses one, other (=1 only matches exactly 1; "one" covers more numbers in some languages)',
    ],
    [
      "a category the locale never uses",
      { en: { ...EN, subject: "{count, plural, zero {none} one {#} other {#}}" } },
      'invalid-plural: Message "subject" in locale "en": "en" never uses the category "zero" (it uses one, other); use =0 for exactly zero',
    ],
    [
      "Arabic without its categories",
      { en: EN, ar: { ...EN } },
      'invalid-plural: Message "subject" in locale "ar": {count, plural} needs zero, two, few, many too; "ar" uses zero, one, two, few, many, other',
    ],
    [
      "no other case",
      { en: { ...EN, plan: "{plan, select, free {Free}}" } },
      'invalid-message: Message "plan" in locale "en": {plan, select} needs an "other" case',
    ],
    [
      "a select case that isn't a value",
      { en: { ...EN, plan: "{plan, select, free {Free} team {Team} other {Plan}}" } },
      'invalid-select: cart (en): {plan, select} has the case "team", which isn\'t one of its values (free, pro-plus)',
    ],
    [
      "a number type, which the caller formats",
      { en: { ...EN, plan: "{plan, number}" } },
      'unsupported-message: Message "plan" in locale "en" uses {plan, number}. Pass the number formatted by your backend (Intl.NumberFormat, Intl.DateTimeFormat) as a string argument instead.',
    ],
  ])("%s", async (_, messages, expected) => {
    expect(await error(messages)).toBe(expected)
  })

  it("a plural over a string field, and a select over a free string", async () => {
    const body = '<p>{t("subject", { count: data.label })}{t("plan", { plan: data.label })}</p>'
    expect(
      await error({ en: { ...EN, subject: "{count, plural, one {#} other {#}}" } }, { body }),
    ).toBe(
      'invalid-plural: cart (en): {label, plural} needs a number field, but "label" is a string',
    )
    const select = '<p>{t("plan", { plan: data.label })}</p>'
    expect(await error({ en: EN }, { body: select })).toBe(
      'invalid-select: cart (en): {label, select} needs a field with fixed values, such as z.enum([…]); "label" is a free string',
    )
  })
})
