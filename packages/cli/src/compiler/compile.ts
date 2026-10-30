// One template × one locale → the four parts of an email, as mustache-core templates (P0-03).

import type { EmailDefinition } from "@email-kit/core"
import { EmailKitError, evaluate, type Messages } from "@email-kit/core/internal"
import { parse } from "@email-kit/dialect"

import { renderDocument } from "./document.ts"
import { renderLine, renderTextPart } from "./text.ts"

export interface CompiledEmail {
  readonly id: string
  readonly locale: string
  /** `text` profile */
  readonly subject: string
  /** `text` profile */
  readonly preheader: string
  /** `html` profile */
  readonly html: string
  /** `text` profile */
  readonly text: string
}

export interface CompileOptions {
  readonly locale: string
  readonly messages: Messages
}

const RTL = new Set(["ar", "dv", "fa", "he", "ps", "ur", "yi"])

export function compileEmail<T>(
  definition: EmailDefinition<T>,
  options: CompileOptions,
): CompiledEmail {
  const ir = evaluate(definition, options)
  const subject = renderLine(ir.subject, "subject")
  const preheader = ir.preheader ? renderLine(ir.preheader, "preheader") : ""
  const language = options.locale.split("-")[0] ?? ""
  const html = renderDocument({
    lang: options.locale,
    dir: RTL.has(language) ? "rtl" : "ltr",
    subject: ir.subject,
    preheader: ir.preheader,
    body: ir.body,
    // Classic Outlook stays a target by default until the targets config (CFG-05, M1.2).
    outlookClassic: true,
  })
  const text = renderTextPart(ir.body, preheader)

  const compiled = { id: definition.id, locale: options.locale, subject, preheader, html, text }
  for (const part of ["subject", "preheader", "html", "text"] as const) {
    try {
      parse(compiled[part])
    } catch (error) {
      throw new EmailKitError(
        "invalid-output",
        `Bug: the ${part} of ${definition.id} (${options.locale}) isn't valid mustache-core: ` +
          (error as Error).message,
      )
    }
  }
  return compiled
}
