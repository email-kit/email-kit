/**
 * `@email-kit/runtime`: renders the emails `email-kit compile` generates. It's the only email-kit
 * package an app needs at runtime, so install it in `dependencies`; everything else is a
 * devDependency. It has no dependencies and uses only web-standard APIs, so it runs in Node, Bun,
 * Deno, Cloudflare Workers, AWS Lambda and Next.js server code.
 *
 * Apps import the generated module, not this package:
 *
 * ```ts
 * import { emails } from "@/email-kit"
 *
 * const { subject, html, text } = emails.welcome.render({ name: "Ada" }, { locale: "de" })
 * ```
 *
 * The optional features live in their own entry points (`/validate`, `/plural`, `/locale`,
 * `/context`), which the generated module imports only when the project uses them.
 *
 * @packageDocumentation
 */

export { EmailRenderError, type RenderErrorCode } from "./errors.ts"
export { escapeHtml, fill, type Node, type Template } from "./render.ts"
export { createTemplate, FORMAT } from "./template.ts"
export type {
  CompiledParts,
  DataIssue,
  EmailParts,
  EmailTemplate,
  Model,
  Purpose,
  RenderedEmail,
  RenderOptions,
  RuntimeTemplate,
  TemplateOptions,
  TemplateSpec,
} from "./types.ts"
