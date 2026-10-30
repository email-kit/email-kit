// The typed project config in email-kit.config.ts (CFG-01). Paths are relative to the config
// file. M1.1 covers paths and locales; theme, targets, checks and platform values arrive with
// their milestones.

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
