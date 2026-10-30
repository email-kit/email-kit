// The typed project config in email-kit.config.ts (CFG-01). Paths are relative to the config
// file. M1.1 covers paths, locales, the module format and platform values; theme, targets and
// checks arrive with their milestones.

import type { PlatformKey } from "./platform.ts"

export interface EmailKitConfig {
  /**
   * The email-kit folder. Default: `src/email-kit` when the project has a `src/` folder,
   * otherwise `email-kit`.
   */
  readonly root?: string
  /** Template files (`*.tsx`). Default: `<root>/templates`. */
  readonly templates?: string
  /** Messages, as `<messages>/<locale>/<template id>.json`. Default: `<root>/messages`. */
  readonly messages?: string
  /** The output folder, owned by the compiler. Default: `<root>/compiled`. */
  readonly out?: string
  /**
   * The generated module's format (CFG-08). `"ts"` writes `index.ts`. `"mjs"` writes
   * `index.mjs` + `index.d.mts`, for projects built with plain `tsc` (ADR 0004). Default: `"ts"`.
   */
  readonly module?: "ts" | "mjs"
  /**
   * Also write one self-contained module per template, `<out>/<id>/index.ts` (OUT-06), so a
   * Worker or Lambda that sends one email bundles only that email. Default: `false`.
   */
  readonly perTemplateEntries?: boolean
  /**
   * render() validates data against the template's schema before rendering (OUT-08), so data
   * from a queue or webhook fails with field paths. `validate()` is there either way.
   * Default: `true`.
   */
  readonly validate?: boolean
  /**
   * Platform values (CFG-07). A string is a compile-time constant, written into the output.
   * `{ runtime: true }` means the backend passes it at send time: `createEmails({ siteUrl })`.
   */
  readonly platform?: Readonly<Partial<Record<PlatformKey, string | { readonly runtime: true }>>>
  readonly locales?: {
    /** The locale render() falls back to. Default: `"en"`. */
    readonly default: string
    /** Every locale to compile. Default: only the default locale. */
    readonly list?: readonly string[]
  }
}

/** Declares the email-kit config with types. Use it as the default export of email-kit.config.ts. */
export function defineConfig(config: EmailKitConfig): EmailKitConfig {
  return config
}
