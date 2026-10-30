// P1-155, I18N-05: pseudo-locales en-XA and ar-XB, built by `check` and shipped on request.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import type { Finding } from "../src/checks/types.ts"
import { compile } from "../src/compiler/build.ts"
import { resolveConfig } from "../src/compiler/config.ts"
import { run } from "../src/run.ts"

const FIXTURE = fileURLToPath(new URL("fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL(".tmp/pseudo-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

function project(edit: { config?: (s: string) => string; template?: (s: string) => string } = {}) {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
  const config = join(dir, "email-kit.config.ts")
  const template = join(dir, "src/email-kit/templates/order-confirmation.tsx")
  writeFileSync(config, (edit.config ?? ((s) => s))(readFileSync(config, "utf8")))
  writeFileSync(template, (edit.template ?? ((s) => s))(readFileSync(template, "utf8")))
  return dir
}

async function check(dir: string): Promise<{ code: number; findings: Finding[] }> {
  const out: string[] = []
  const code = await run(["check", "--json"], { cwd: dir, out: (t) => out.push(t), err: () => {} })
  return { code, findings: JSON.parse(out.join("\n")).findings as Finding[] }
}

describe("email-kit check builds the pseudo-locales", () => {
  it("adds nothing for a template that's fine in them, and writes nothing", async () => {
    const dir = project()
    const { code, findings } = await check(dir)
    expect(code).toBe(0)
    expect(
      findings.filter((f) => f.subject.locale === "en-XA" || f.subject.locale === "ar-XB"),
    ).toEqual([])
  })

  it("reports what breaks only in a pseudo-locale", async () => {
    // A template that misbehaves only for one locale: the pseudo pass sees it, the real ones don't.
    const dir = project({
      template: (s) =>
        s
          .replace(
            "component: ({ data, t, platform }) => (",
            "component: ({ data, t, platform, locale }) => (",
          )
          .replace(
            "<Card>",
            '<Card>\n      {locale === "en-XA" && <form action="https://x.test" />}',
          ),
    })
    const { code, findings } = await check(dir)
    expect(code).toBe(1)
    expect(
      findings.filter((f) => f.id === "html.no-forms-embeds").map((f) => f.subject.locale),
    ).toEqual(["en-XA"])
  })

  it("i18n.expansion: a template that doesn't compile in a pseudo-locale", async () => {
    const dir = project({
      template: (s) =>
        s
          .replace(
            "component: ({ data, t, platform }) => (",
            "component: ({ data, t, platform, locale }) => (",
          )
          .replace("<Card>", '<Card>\n      {locale === "ar-XB" && t("missingKey")}'),
    })
    const { findings } = await check(dir)
    const expansion = findings.filter((f) => f.id === "i18n.expansion")
    expect(expansion.map((f) => [f.subject.locale, f.message])).toEqual([
      [
        "ar-XB",
        'order-confirmation doesn\'t compile in ar-XB: Locale "ar-XB" has no message "missingKey"',
      ],
    ])
  })
})

describe("locales.pseudo ships them", () => {
  it("compiles en-XA and ar-XB from the default locale, right to left for ar-XB", async () => {
    const dir = project({
      config: (s) => s.replace('list: ["en", "de"]', 'list: ["en", "de"], pseudo: true'),
    })
    await compile({ cwd: dir })
    const out = join(dir, "src/email-kit/compiled")
    const xa = readFileSync(join(out, "order-confirmation/en-XA.html"), "utf8")
    expect(xa).toContain('<html lang="en-XA" dir="ltr"')
    expect(xa).toContain("[Ţĥáñķš, {{customerName}}! ")
    const xb = readFileSync(join(out, "order-confirmation/ar-XB.html"), "utf8")
    expect(xb).toContain('<html lang="ar-XB" dir="rtl"')
    const { createEmails } = (await import(pathToFileURL(join(out, "index.ts")).href)) as {
      createEmails(context: object): {
        orderConfirmation: {
          render(
            data: object,
            options: { locale: string },
          ): { subject: string; meta: { locale: string } }
        }
      }
    }
    const email = createEmails({ siteUrl: "https://shop.example" }).orderConfirmation.render(
      {
        customerName: "Ada",
        orderNumber: "A-1",
        orderUrl: "https://shop.example/o",
        items: [{ name: "Tea", qty: 1 }],
      },
      { locale: "en-XA" },
    )
    expect(email.meta.locale).toBe("en-XA")
    expect(email.subject).toMatch(/^\[Öŕðéŕ A-1 çöñƒîŕɱéð one two/)
  })

  it("validates the option", () => {
    const file = join(FIXTURE, "email-kit.config.ts")
    const resolve = (pseudo: unknown, list = ["en"]) =>
      resolveConfig({ locales: { default: "en", list, pseudo } }, { file, cacheDir: TMP })
    expect(resolve(["ar-XB"]).locales).toEqual(["en", "ar-XB"])
    expect(resolve(false).locales).toEqual(["en"])
    expect(() => resolve(["en-XB"])).toThrow(
      'locales.pseudo: must be true, or a list of "en-XA" and "ar-XB"',
    )
    expect(() => resolve(true, ["en", "en-XA"])).toThrow(
      'locales.pseudo: "en-XA" is also in locales.list',
    )
  })
})
