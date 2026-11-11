import { createPlaceholder, type TextValue } from "../data/placeholder.ts"
import { EmailKitError } from "../shared/errors.ts"

/**
 * Facts about who sends the email, set under `sender` in email-kit.config.ts. Each one is fixed
 * text, or a placeholder when the config marks it `{ runtime: true }` and your backend passes it
 * to `createEmails()`.
 */
export interface Sender {
  /** Your product's name, such as `"Acme"`. */
  readonly productName: TextValue
  /** The name your emails come from, such as `"Acme Support"`. */
  readonly name: TextValue
  /** Your organisation's registered name, such as `"Acme Inc."`. */
  readonly legalName: TextValue
  /** Your postal address. Marketing and consent-request emails must show it. */
  readonly postalAddress: TextValue
  /** The https URL of your privacy policy. */
  readonly privacyUrl: TextValue
  /** The https URL of your help centre. */
  readonly helpUrl: TextValue
  /** The email address recipients can write to for help. */
  readonly supportEmail: TextValue
  /** The https URL of your website. */
  readonly siteUrl: TextValue
}

/** The name of one sender value, such as `"productName"`. */
export type SenderKey = keyof Sender

const KEYS: Readonly<Record<SenderKey, true>> = {
  productName: true,
  name: true,
  legalName: true,
  postalAddress: true,
  privacyUrl: true,
  helpUrl: true,
  supportEmail: true,
  siteUrl: true,
}

/** Every sender key. */
export const SENDER_KEYS: readonly SenderKey[] = Object.keys(KEYS) as SenderKey[]

/** The top-level data key for the values `render()` adds, such as runtime sender values. */
export const RESERVED_KEY = "_ek"

/** The sender values from the config. */
export interface SenderValues {
  /** The values set as fixed text. */
  readonly constants: Readonly<Partial<Record<SenderKey, string>>>
  /** The keys set to `{ runtime: true }`, which the backend passes when it sends. */
  readonly runtime: readonly SenderKey[]
}

/**
 * Makes the `sender` a template gets. Each value is its fixed text or a placeholder; reading one
 * the config doesn't set throws.
 */
export function createSender(values: SenderValues): Sender {
  const sender: Partial<Record<SenderKey, TextValue>> = {}
  for (const key of SENDER_KEYS) {
    Object.defineProperty(sender, key, {
      enumerable: true,
      get() {
        const constant = values.constants[key]
        if (constant !== undefined) return constant
        if (values.runtime.includes(key)) {
          return createPlaceholder(0, [RESERVED_KEY, "context", key])
        }
        throw new EmailKitError(
          "sender-value-missing",
          `The template uses sender.${key}, but email-kit.config.ts doesn't set it. Add ` +
            `\`sender: { ${key}: "…" }\`, or \`sender: { ${key}: { runtime: true } }\` to pass it at send time`,
        )
      },
    })
  }
  return sender as Sender
}
