import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it, vi } from "vitest"

import type { CompileResult } from "../src/compiler/build.ts"
import { type Watcher, watchProject } from "../src/compiler/watch.ts"

const FIXTURE = fileURLToPath(new URL("fixtures/project/", import.meta.url))
const TMP = fileURLToPath(new URL(".tmp/watch-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

type Outcome = { result: CompileResult } | { error: unknown }

describe("email-kit compile --watch", () => {
  // Several file-system round trips in a row: more than the default 5 s under a parallel run.
  it("recompiles on changes, reports errors and recovers", { timeout: 30_000 }, async () => {
    mkdirSync(TMP, { recursive: true })
    const dir = mkdtempSync(join(TMP, "project-"))
    cpSync(FIXTURE, dir, { recursive: true, filter: (path) => !path.includes(`${sep}compiled`) })
    const emailKit = join(dir, "src", "email-kit")
    const outcomes: Outcome[] = []
    const subject = () =>
      JSON.parse(readFileSync(join(emailKit, "compiled", "manifest.json"), "utf8")).templates[0]
        .locales.en.subject

    let watcher: Watcher | undefined
    try {
      watcher = await watchProject({ cwd: dir, debounceMs: 20, onCompile: (o) => outcomes.push(o) })
      expect(outcomes).toHaveLength(1)
      expect(subject()).toBe("Order {{orderNumber}} confirmed")
      // FSEvents (macOS) goes live a moment after the watcher is created.
      await new Promise((resolve) => setTimeout(resolve, 300))

      // A message edit recompiles.
      const messages = join(emailKit, "messages", "en", "order-confirmation.json")
      writeFileSync(
        messages,
        readFileSync(messages, "utf8").replace("Order {order} confirmed", "Your order {order}"),
      )
      await vi.waitFor(() => expect(subject()).toBe("Your order {{orderNumber}}"), {
        timeout: 5000,
      })

      // A broken template reports the error and keeps watching.
      const template = join(emailKit, "templates", "order-confirmation.tsx")
      const source = readFileSync(template, "utf8")
      writeFileSync(template, source.replace("<Card>", "<Card"))
      await vi.waitFor(() => expect(outcomes.at(-1)).toHaveProperty("error"), { timeout: 5000 })

      // Fixing it compiles again.
      writeFileSync(template, source)
      await vi.waitFor(() => expect(outcomes.at(-1)).toHaveProperty("result"), { timeout: 5000 })

      // A component outside the templates folder is watched through the template's imports.
      const card = join(emailKit, "components", "Card.tsx")
      writeFileSync(card, readFileSync(card, "utf8").replace('padding: "24px"', 'padding: "32px"'))
      await vi.waitFor(
        () =>
          expect(
            readFileSync(join(emailKit, "compiled", "order-confirmation", "en.html"), "utf8"),
          ).toContain("padding:32px"),
        { timeout: 5000 },
      )
    } finally {
      watcher?.close()
    }
  })
})
