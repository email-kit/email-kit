// Field markers (AUTH-04) as schema metadata, readable after JSON Schema conversion. One object
// works with each library's metadata API:
//   z.string().meta(secret)   type.string.configure(secret)   v.pipe(v.string(), v.metadata(secret))
// Prototype (P0-10): type-level url fields for `href` (AUTH-12) are still open.

/** A code or token: never in the preheader, query strings, metadata or logs (SEC-03). */
export const secret: { readonly "x-email-kit": { readonly secret: true } } = {
  "x-email-kit": { secret: true },
}

/** A URL: HTTPS and allow-listed hosts only; the only fields allowed in `href`/`src`. */
export const url: { readonly "x-email-kit": { readonly url: true } } = {
  "x-email-kit": { url: true },
}

/** What a caller-formatted value is (I18N-07, R5): the backend formats it for the recipient. */
export type FormattedKind = "date" | "time" | "date-time" | "money" | "number" | "percent"

/**
 * A value the backend formats for the recipient, such as a date or an amount (I18N-07, R5).
 * Templates don't format at send time, so output is identical in every runtime language:
 * `z.string().meta(formatted("money"))`.
 */
export function formatted<Kind extends FormattedKind>(
  kind: Kind,
): { readonly "x-email-kit": { readonly formatted: Kind } } {
  return { "x-email-kit": { formatted: kind } }
}

/** A URL carrying a token, such as a magic link. */
export const secretUrl: { readonly "x-email-kit": { readonly secret: true; readonly url: true } } =
  {
    "x-email-kit": { secret: true, url: true },
  }
