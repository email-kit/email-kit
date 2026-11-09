/**
 * Marks a schema field as secret: a one-time code, token or password. `email-kit check` reports
 * it if it appears in the subject or preheader, which inboxes and lock screens show.
 *
 * @example
 * ```ts
 * code: z.string().meta(secret)                // Zod
 * code: v.pipe(v.string(), v.metadata(secret)) // Valibot
 * code: type.string.configure(secret)          // ArkType
 * ```
 */
export const secret: { readonly "x-email-kit": { readonly secret: true } } = {
  "x-email-kit": { secret: true },
}

/**
 * Marks a schema field as a URL. Only fields marked like this may start an `href` or `src`,
 * and `render()` rejects values that aren't `https://` URLs. Only string fields can be marked.
 *
 * @example
 * ```ts
 * receiptUrl: z.string().meta(url)                // Zod
 * receiptUrl: v.pipe(v.string(), v.metadata(url)) // Valibot
 * receiptUrl: type.string.configure(url)          // ArkType
 * ```
 */
export const url: { readonly "x-email-kit": { readonly url: true } } = {
  "x-email-kit": { url: true },
}

/** The kinds of value `formatted()` can mark. */
export type FormattedKind = "date" | "time" | "date-time" | "money" | "number" | "percent"

/**
 * Marks a string field as a value your backend has already formatted for the recipient, such
 * as a date in their time zone or an amount in their currency. Templates never format values
 * themselves, so format them before sending, for example with `Intl.NumberFormat`.
 *
 * Only string fields can be marked.
 *
 * @param kind - What the value is: `"date"`, `"time"`, `"date-time"`, `"money"`, `"number"` or
 *   `"percent"`.
 *
 * @example
 * ```ts
 * total: z.string().meta(formatted("money"))   // "€42.00"
 * ```
 */
export function formatted<Kind extends FormattedKind>(
  kind: Kind,
): { readonly "x-email-kit": { readonly formatted: Kind } } {
  return { "x-email-kit": { formatted: kind } }
}

/**
 * Marks a schema field as a URL that contains a secret token, such as a magic sign-in link or a
 * password-reset link. It counts as both `url` and `secret`.
 *
 * @example
 * ```ts
 * signInUrl: z.string().meta(secretUrl)
 * ```
 */
export const secretUrl: { readonly "x-email-kit": { readonly secret: true; readonly url: true } } =
  {
    "x-email-kit": { secret: true, url: true },
  }

/** The `x-email-kit` metadata the markers write, as schema libraries see it. */
export interface EmailKitMeta {
  readonly "x-email-kit"?: {
    readonly secret?: true
    readonly url?: true
    readonly formatted?: FormattedKind
  }
}

declare global {
  /** Lets ArkType's `configure()` accept the email-kit markers. */
  interface ArkEnv {
    meta(): EmailKitMeta
  }
}
