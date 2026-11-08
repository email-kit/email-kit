import { EmailKitError } from "../shared/errors.ts"
import { globalSlot } from "../shared/global-slot.ts"
import type { FontStackName, ThemeRole, TypeStep, TypeStyle } from "./theme.ts"

export interface ThemeContext {
  readonly roles: Readonly<Record<ThemeRole, string>>
  readonly typography: {
    readonly stacks: Readonly<
      Record<FontStackName, { readonly families: readonly string[]; readonly msoFallback: string }>
    >
    readonly scale: Readonly<Record<TypeStep, TypeStyle>>
  }
  
  readonly space: {
    readonly gutterMobile: number
    readonly gutterDesktop: number
    readonly stack: { readonly sm: number; readonly md: number; readonly lg: number }
    readonly section: number
  }
  
  readonly radius: Readonly<
    Record<
      "none" | "sm" | "md" | "lg" | "xl" | "full" | "button" | "card" | "badge" | "code" | "image",
      number
    >
  >
  
  readonly borderWidth: { readonly hairline: number; readonly strong: number }
  readonly layout: { readonly container: number }
  
  readonly components: {
    readonly button: Readonly<
      Record<
        "sm" | "md" | "lg",
        {
          readonly minHeight: number
          readonly padX: number
          readonly padY: number
          readonly font: TypeStep
        }
      >
    >
    
    readonly link: { readonly underline: boolean }
    readonly otp: { readonly font: TypeStep; readonly surface: "codeSurface" }
  }
}

const theme = globalSlot<ThemeContext>("email-kit.theme")
const direction = globalSlot<"ltr" | "rtl">("email-kit.direction")

export function withTheme<T>(value: ThemeContext | undefined, run: () => T): T {
  return theme.run(value, run)
}

export function useTheme(): ThemeContext {
  const value = theme.get()
  if (!value) {
    throw new EmailKitError("no-theme", "useTheme() only works while email-kit compiles a template")
  }
  return value
}

export function withDirection<T>(dir: "ltr" | "rtl", run: () => T): T {
  return direction.run(dir, run)
}

export function useDirection(): "ltr" | "rtl" {
  return direction.get() ?? "ltr"
}
