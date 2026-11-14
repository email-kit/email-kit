// P1-154, I18N-04: a requested locale resolves by RFC 4647 lookup over CLDR's parents, with the
// script a region implies and CFG-03's configured fallbacks, then the default.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { resolveLocale } from "@email-kit/dialect/module"
import { afterAll, describe, expect, it } from "vitest"

import { compile } from "../src/compiler/build.ts"
import { resolveConfig } from "../src/compiler/config/index.ts"
import { localeData } from "../src/i18n/locales.ts"

const TMP = fileURLToPath(new URL(".tmp/locales-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

describe("resolving a requested locale", () => {
  const resolve = (
    available: string[],
    requested: string | undefined,
    fallback?: Record<string, string>,
  ) => resolveLocale(requested, available, localeData(available, fallback))

  it.each([
    // [compiled, requested, expected]
    [["en", "de"], "de-AT", "de"],
    [["en", "de"], "DE_at", "de"],
    [["en", "de"], "fr", "en"],
    [["en", "de"], undefined, "en"],
    [["en", "de"], "de-CH-x-internal", "de"],
    [["en", "de"], "de-CH-u-ca-buddhist", "de"],
    // CLDR parents: Latin American Spanish, European Portuguese, and English outside the US.
    [["en", "es", "es-419"], "es-AR", "es-419"],
    [["en", "es", "es-419"], "es-ES", "es"],
    [["en", "pt", "pt-PT"], "pt-AO", "pt-PT"],
    [["en", "pt", "pt-PT"], "pt-BR", "pt"],
    [["en-US", "en-GB", "en-001"], "en-AU", "en-001"],
    [["de", "en"], "en-AU", "en"],
    // A region that implies another script, and scripts that don't fall back to the language.
    [["en", "zh"], "zh-TW", "en"],
    [["en", "zh"], "zh-Hant-TW", "en"],
    [["en", "zh"], "zh-CN", "zh"],
    [["en", "zh"], "zh-Hans-CN", "zh"],
    [["en", "zh", "zh-TW"], "zh-Hant-TW", "zh-TW"],
    [["en", "zh-Hant"], "zh-HK", "zh-Hant"],
    [["en", "sr"], "sr-Latn-RS", "en"],
    [["en", "sr"], "sr-ME", "en"],
    [["en", "sr"], "sr-Cyrl-RS", "sr"],
  ])("%j: %s → %s", (available, requested, expected) => {
    expect(resolve(available, requested)).toBe(expected)
  })

  it("follows the configured fallbacks before CLDR's parents", () => {
    // Without it, `pt` (Brazilian by CLDR's default) never reaches the compiled pt-BR.
    expect(resolve(["en", "pt-BR"], "pt")).toBe("en")
    expect(resolve(["en", "pt-BR"], "pt", { pt: "pt-BR" })).toBe("pt-BR")
    // pt-AO → pt-PT (CLDR) → pt → pt-BR (configured).
    expect(resolve(["en", "pt-BR"], "pt-AO", { pt: "pt-BR" })).toBe("pt-BR")
  })

  it("keeps only the project's languages", () => {
    const data = localeData(["en", "de"])
    expect(Object.keys(data.parents).every((tag) => /^(en|de)-/.test(tag))).toBe(true)
    expect(data.scripts).toEqual({ de: "latn", en: "latn" })
    expect(localeData(["zh"]).regions).toMatchObject({ "zh-tw": "hant", "zh-hk": "hant" })
  })
})

describe("locales.fallback in the config", () => {
  const file = fileURLToPath(new URL("fixtures/project/email-kit.config.ts", import.meta.url))
  const resolve = (fallback: unknown) =>
    resolveConfig(
      { locales: { default: "en", list: ["en", "pt-BR"], fallback } },
      { file, cacheDir: TMP },
    )

  it("maps a tag to a compiled locale, in its compiled spelling", () => {
    expect(resolve({ pt: "PT-br" }).localeFallback).toEqual({ pt: "pt-BR" })
  })

  it("rejects a target that isn't compiled, a compiled source, and a bad tag", () => {
    expect(() => resolve({ "pt-PT": "pt-PT", "pt-BR": "en", "no good": "en" })).toThrow(
      [
        "  • locales.fallback.pt-PT: must be one of the compiled locales (en, pt-BR)",
        '  • locales.fallback.pt-BR: "pt-BR" is compiled, so it never falls back',
        '  • locales.fallback: "no good": ',
      ].join("\n"),
    )
  })
})

describe("in a generated module", () => {
  it("renders the resolved locale", async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "project-"))
    const locales = ["en", "es", "es-419", "pt-BR"]
    writeFileSync(
      join(dir, "email-kit.config.ts"),
      `import { defineConfig } from "@email-kit/core"
export default defineConfig({ locales: { default: "en", list: ${JSON.stringify(locales)}, fallback: { pt: "pt-BR", "pt-PT": "pt-BR" } } })
`,
    )
    mkdirSync(join(dir, "src/email-kit/templates"), { recursive: true })
    writeFileSync(
      join(dir, "src/email-kit/templates/hello.tsx"),
      `/** @jsxImportSource @email-kit/core */
import { defineEmail } from "@email-kit/core"
import { z } from "zod"
export default defineEmail({
  id: "hello",
  purpose: "transactional",
  schema: z.object({}),
  subject: (_data, t) => t("subject"),
  fixtures: { default: {} },
  component: ({ t }) => <p>{t("subject")}</p>,
})
`,
    )
    for (const locale of locales) {
      mkdirSync(join(dir, "src/email-kit/messages", locale), { recursive: true })
      writeFileSync(
        join(dir, "src/email-kit/messages", locale, "hello.json"),
        JSON.stringify({ subject: `Hello ${locale}` }),
      )
    }
    await compile({ cwd: dir })
    const { emails } = (await import(
      pathToFileURL(join(dir, "src/email-kit/compiled/index.ts")).href
    )) as {
      emails: {
        hello: {
          render(
            data: object,
            options: { locale: string },
          ): { subject: string; meta: { locale: string } }
        }
      }
    }
    const subject = (locale: string) => emails.hello.render({}, { locale }).subject
    expect(["es-MX", "es-ES", "pt-AO", "pt", "fr-CA"].map(subject)).toEqual([
      "Hello es-419",
      "Hello es",
      "Hello pt-BR",
      "Hello pt-BR",
      "Hello en",
    ])
    expect(emails.hello.render({}, { locale: "es-MX" }).meta.locale).toBe("es-419")
  })
})
