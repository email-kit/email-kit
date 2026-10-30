// @email-kit/core: defineEmail, control flow and the types for writing templates.
// Prototype (P0-03): the API shape is not final.

export {
  type CheckElement,
  type CheckEmail,
  type CheckProblem,
  type CustomCheck,
  defineCheck,
} from "./checks.ts"
export { type CheckSetting, defineConfig, type EmailKitConfig } from "./config.ts"
export { Conditional, Each, If, Unless } from "./control.ts"
export {
  defineEmail,
  type EmailDefinition,
  type EmailDefinitionInput,
  type EmailProps,
  type Purpose,
} from "./define.ts"
export { EmailKitError } from "./errors.ts"
export type {
  Message,
  MessageParam,
  MessageRegistry,
  Translate,
  TypedTranslate,
} from "./i18n.ts"
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
export type { Platform, PlatformKey, PlatformText } from "./platform.ts"
export type { StandardSchemaV1 } from "./standard-schema.ts"
export type {
  FontStackName,
  ThemeConfig,
  ThemeRole,
  ThemeVariables,
  TypeStep,
  TypeStyle,
} from "./theme.ts"
export {
  type RoleColour,
  role,
  type ThemeContext,
  useDirection,
  useTheme,
} from "./theme-context.ts"
