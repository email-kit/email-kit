export {
  type CheckElement,
  type CheckEmail,
  type CheckProblem,
  type CustomCheck,
  defineCheck,
} from "./config/checks.ts"
export { type CheckSetting, defineConfig, type EmailKitConfig } from "./config/config.ts"
export type { Sender, SenderKey } from "./config/sender.ts"
export type {
  Data,
  ListPlaceholder,
  MaybePlaceholder,
  Placeholder,
  Scalar,
  TextValue,
} from "./data/placeholder.ts"
export {
  defineEmail,
  type EmailDefinition,
  type EmailDefinitionInput,
  type EmailProps,
  type Purpose,
} from "./definition/define.ts"
export {
  type EmailKitMeta,
  type FormattedKind,
  formatted,
  secret,
  secretUrl,
  url,
} from "./definition/markers.ts"
export type { StandardSchemaV1 } from "./definition/standard-schema.ts"
export type {
  Message,
  MessageParam,
  MessageRegistry,
  Translate,
  TypedTranslate,
} from "./i18n/translate.ts"
export { Fragment } from "./jsx-runtime.ts"
export { EmailKitError } from "./shared/errors.ts"
export { type ThemeContext, useDirection, useTheme } from "./theme/context.ts"
export type { FontStackValue } from "./theme/font-stack.ts"
export { type RoleColour, role } from "./theme/role.ts"
export type {
  FontStackName,
  ThemeConfig,
  ThemeRole,
  ThemeVariables,
  TypeStep,
  TypeStyle,
} from "./theme/theme.ts"
export { Conditional, Each, If, Unless } from "./tree/control.ts"
export type { IrNode } from "./tree/ir.ts"
export type { Child } from "./tree/nodes.ts"
