// Size budgets for what an app bundles (RUN-01, NFR-02). The generated module imports only the
// entry points the project uses, so each is measured as an app bundler would: minified, gzipped.
// A budget is a ceiling, set a little above today's size, so growth is a deliberate decision.

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

import { rolldown } from "rolldown"
import { afterAll, describe, expect, it } from "vitest"

const TMP = fileURLToPath(new URL(".tmp/size/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

/** Bytes of the minified, gzipped bundle of an entry that imports `source`. */
async function gzipped(name: string, source: string): Promise<number> {
  mkdirSync(TMP, { recursive: true })
  const input = `${TMP}${name}.ts`
  writeFileSync(input, source)
  const bundle = await rolldown({ input, logLevel: "silent" })
  try {
    const { output } = await bundle.generate({ format: "esm", minify: true })
    return gzipSync(output[0].code, { level: 9 }).length
  } finally {
    await bundle.close()
  }
}

const SRC = fileURLToPath(new URL("../src/", import.meta.url))
const use = (imports: Record<string, string>) =>
  Object.entries(imports)
    .map(([file, names]) => `export { ${names} } from "${SRC}${file}.ts"`)
    .join("\n")

/** [what, imports, budget in bytes] */
const CASES: readonly [string, Record<string, string>, number][] = [
  ["the core: render and project (every project)", { index: "createTemplate" }, 1500],
  ["validate", { validate: "validate" }, 1200],
  ["plural", { plural: "prepare" }, 600],
  ["locale", { locale: "resolveLocale" }, 520],
  ["context", { context: "readContext" }, 600],
  [
    "everything",
    {
      index: "createTemplate",
      validate: "validate",
      plural: "prepare",
      locale: "resolveLocale",
      context: "readContext",
    },
    3200,
  ],
]

describe("bundle size, minified and gzipped", () => {
  it.each(CASES)("%s", async (name, imports, budget) => {
    const size = await gzipped(name.replace(/\W+/g, "-"), use(imports))
    expect(size).toBeLessThanOrEqual(budget)
  })
})
