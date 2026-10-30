// Platform values (CFG-07, RUN-04): facts about the sender that templates show, such as the
// product name, postal address and site URL. A value set in the config is a compile-time constant
// and is written into the output as text (R1). A key marked `{ runtime: true }` is supplied by
// the backend at send time through `createEmails({ … })`, and renders as `{{_ek.context.<key>}}`.
// The generated render() sets `_ek` after projecting data onto the schema, so data can never
// override or shadow a context value.

import { EmailKitError } from "./errors.ts"
import { createPlaceholder, type Placeholder } from "./placeholder.ts"

export const PLATFORM_KEYS = [
  "productName",
  "senderName",
  "legalName",
  "postalAddress",
  "privacyUrl",
  "helpUrl",
  "supportEmail",
  "siteUrl",
] as const

export type PlatformKey = (typeof PLATFORM_KEYS)[number]

/** A platform value in a template: text, or a placeholder filled at send time. */
export type PlatformText = string | Placeholder<string>

export type Platform = { readonly [K in PlatformKey]: PlatformText }

/** The root key reserved for values render() adds (context now, plurals per ADR 0003). */
export const RESERVED_KEY = "_ek"

export interface PlatformValues {
  /** Compile-time constants */
  readonly constants: Readonly<Partial<Record<PlatformKey, string>>>
  /** Keys the backend passes to createEmails() */
  readonly runtime: readonly PlatformKey[]
}

/** The `platform` object a template receives. Reading an unconfigured key is an error. */
export function createPlatform(values: PlatformValues): Platform {
  const platform: Partial<Record<PlatformKey, PlatformText>> = {}
  for (const key of PLATFORM_KEYS) {
    Object.defineProperty(platform, key, {
      enumerable: true,
      get() {
        const constant = values.constants[key]
        if (constant !== undefined) return constant
        if (values.runtime.includes(key))
          return createPlaceholder(0, [RESERVED_KEY, "context", key])
        throw new EmailKitError(
          "platform-value-missing",
          `The template uses platform.${key}, but email-kit.config.ts doesn't set it. Add ` +
            `\`platform: { ${key}: "…" }\`, or \`{ ${key}: { runtime: true } }\` to pass it at send time`,
        )
      },
    })
  }
  return platform as Platform
}
