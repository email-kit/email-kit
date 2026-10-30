// @email-kit/core: defineEmail, control flow and the types for writing templates.
// Prototype (P0-03): the API shape is not final.

export { defineConfig, type EmailKitConfig } from "./config.ts"
export { Each, If, Unless } from "./control.ts"
export {
  defineEmail,
  type EmailDefinition,
  type EmailDefinitionInput,
  type EmailProps,
  type Purpose,
} from "./define.ts"
export { EmailKitError } from "./errors.ts"
export type { Message, MessageParam, Translate } from "./i18n.ts"
export type { IrNode } from "./ir.ts"
export { type Child, Fragment } from "./jsx-runtime.ts"
export { secret, secretUrl, url } from "./markers.ts"
export type {
  Data,
  ListPlaceholder,
  MaybePlaceholder,
  Placeholder,
  Scalar,
} from "./placeholder.ts"
export type { StandardSchemaV1 } from "./standard-schema.ts"
