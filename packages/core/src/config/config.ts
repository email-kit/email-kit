import type { ThemeConfig } from "../theme/theme.ts"
import type { CustomCheck } from "./checks.ts"
import type { Sender } from "./sender.ts"

/** The settings in email-kit.config.ts. Everything is optional; paths are relative to the file. */
export interface EmailKitConfig {
  /**
   * The email-kit folder. Each template is a folder in it, named by the template id, holding
   * `template.tsx` and its messages as `messages.<locale>.json`. Folders starting with `_` are
   * never templates, so shared components can go in `_shared/`. Default: `src/email-kit` when the
   * project has a `src/` folder, otherwise `email-kit`.
   */
  readonly root?: string
  /**
   * The output folder. The compiler owns it: each compile removes what it didn't write. Default:
   * `<root>/_generated`.
   */
  readonly out?: string
  /**
   * Also write each template's parts as plain files, for backends that don't run the generated
   * TypeScript module, such as another language or your own template engine:
   * `<out>/<id>/<locale>.html` and `.txt` with `{{placeholders}}`, `<out>/<id>/schema.json`
   * (JSON Schema 2020-12), and `<out>/manifest.json`, which lists them with each subject and
   * preheader. Default: `false`.
   */
  readonly contract?: boolean
  /**
   * The generated module's format. `"ts"` writes `index.ts`. `"mjs"` writes
   * `index.mjs` + `index.d.mts`, for projects built with plain `tsc`. Default: `"ts"`.
   */
  readonly module?: "ts" | "mjs"
  /**
   * Also write one self-contained module per template, `<out>/<id>/index.ts`, so a
   * Worker or Lambda that sends one email bundles only that email. Default: `false`.
   */
  readonly perTemplateEntries?: boolean
  /**
   * `render()` validates data against the template's schema before rendering, so data
   * from a queue or webhook fails with field paths. `validate()` is there either way.
   * Default: `true`.
   */
  readonly validate?: boolean
  /**
   * Facts about who sends the email, which templates read as `sender`. Set each one to fixed
   * text, or to `{ runtime: true }` when your backend passes it at send time:
   * `createEmails({ siteUrl })`.
   */
  readonly sender?: { readonly [K in keyof Sender]?: string | { readonly runtime: true } }
  /**
   * Colours, fonts, corner radius and layout, from a shadcn CSS file, design tokens or values
   * written here. Default: a neutral built-in theme.
   */
  readonly theme?: ThemeConfig
  /**
   * Changes the level of a built-in check or one of your own, by its id, with the reason reviewers
   * will read: `{ "img.fluid-width": { level: "off", reason: "Hero images are fixed width" } }`.
   */
  readonly checks?: Readonly<Record<string, CheckSetting>>
  /**
   * How your app imports the emails, recorded by `email-kit init`: `@/email-kit`,
   * `#email-kit` or a relative path. `email-kit new` prints its examples with it.
   */
  readonly importPath?: string
  /** Checks of your own, made with `defineCheck()`, which `email-kit check` runs beside its own. */
  readonly customChecks?: readonly CustomCheck[]
  /** The languages to compile. Default: English only. */
  readonly locales?: {
    /**
     * The main locale. `render()` falls back to it, and the typed `t()` keys and the test locales
     * come from its messages. Default: `"en"`.
     */
    readonly default: string
    /** Every locale to compile, including the default. Default: only the default locale. */
    readonly list?: readonly string[]
    /**
     * Where a requested locale goes when no compiled one matches it, before its parent language
     * and the default: `{ pt: "pt-BR" }` sends `pt` and `pt-AO` to Brazilian Portuguese.
     */
    readonly fallback?: Readonly<Record<string, string>>
    /**
     * Also compile and ship the test locales, generated from the default locale: `en-XA`
     * (accented, bracketed, longer) and `ar-XB` (right to left), for QA on staging. `true` ships
     * both; a list ships only those. `email-kit check` builds them either way. Default: `false`.
     */
    readonly pseudo?: boolean | readonly ("en-XA" | "ar-XB")[]
  }
}

/** A check's level for this project, and why it differs from the default. */
export interface CheckSetting {
  /** The new level. `off` turns the check off; `error` fails `email-kit check`. */
  readonly level: "off" | "info" | "warn" | "error"
  /** Why the level differs from the default, for reviewers. It can't be empty. */
  readonly reason: string
}

/**
 * Defines the project's settings. It returns the config unchanged; it only adds types and
 * autocomplete. Use it as the default export of email-kit.config.ts.
 *
 * @example
 * ```ts
 * export default defineConfig({
 *   sender: { productName: "Acme", siteUrl: "https://acme.com" },
 *   locales: { default: "en", list: ["en", "fr"] },
 * })
 * ```
 */
export function defineConfig(config: EmailKitConfig): EmailKitConfig {
  return config
}
