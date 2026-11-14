/**
 * What the email-kit CLI needs from core. It isn't for templates, and it can change in any
 * release.
 *
 * @packageDocumentation
 */

export {
  RESERVED_KEY,
  SENDER_KEYS,
  type SenderKey,
  type SenderValues,
} from "./config/sender.ts"
export { isEmailDefinition } from "./definition/define.ts"
export { type EvaluatedEmail, type EvaluateOptions, evaluate } from "./definition/evaluate.ts"
export { messageArguments } from "./i18n/message-format.ts"
export { pseudoMessage } from "./i18n/pseudo.ts"
export type { Messages, PluralSupport } from "./i18n/translate.ts"
export { EmailKitError, isEmailKitError } from "./shared/errors.ts"
export type { ThemeContext } from "./theme/context.ts"
export { familyList, fontClass, fontStack } from "./theme/font-stack.ts"
export { parseRoleClass, roleClass } from "./theme/role.ts"
export type {
  IrAttr,
  IrConditional,
  IrElement,
  IrFragment,
  IrNode,
  IrPlaceholder,
  IrSection,
  IrText,
} from "./tree/ir.ts"
export { toNodes } from "./tree/nodes.ts"
