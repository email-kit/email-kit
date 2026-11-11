import { EmailKitError } from "../shared/errors.ts"
import { globalSlot } from "../shared/global-slot.ts"
import type { FontStackName, ThemeRole, TypeStep, TypeStyle } from "./theme.ts"

/**
 * The project's theme with every value filled in: colours, fonts, spacing, corner radius and
 * component settings. Read it with `useTheme()`. All sizes are in pixels.
 */
export interface ThemeContext {
  /** The light colour of each role, as a CSS colour. To colour a style, use `role()` instead. */
  readonly roles: Readonly<Record<ThemeRole, string>>

  readonly typography: {
    /**
     * The font families of each stack, and `msoFallback`: its last named family. Classic Outlook
     * can't fall back through a list, so all its text uses the `msoFallback` of the `body` step's
     * stack.
     */
    readonly stacks: Readonly<
      Record<FontStackName, { readonly families: readonly string[]; readonly msoFallback: string }>
    >

    /** The style of each step of the type scale. */
    readonly scale: Readonly<Record<TypeStep, TypeStyle>>
  }

  readonly space: {
    /** Side padding on small screens. */
    readonly gutterMobile: number

    /** Side padding on large screens. */
    readonly gutterDesktop: number

    /** Gaps between stacked blocks, such as paragraphs and headings. */
    readonly stack: { readonly sm: number; readonly md: number; readonly lg: number }

    /** The gap between sections. */
    readonly section: number
  }

  /**
   * Corner radii: a scale from `none` to `xl`, `full` for pill shapes, and the radius for each
   * kind of element (`button`, `card`, `badge`, `code`, `image`).
   */
  readonly radius: Readonly<
    Record<
      "none" | "sm" | "md" | "lg" | "xl" | "full" | "button" | "card" | "badge" | "code" | "image",
      number
    >
  >

  readonly borderWidth: { readonly hairline: number; readonly strong: number }

  readonly layout: {
    /** The email's content width. */
    readonly container: number
  }

  readonly components: {
    /**
     * Each button size's minimum height, side padding (`padX`), top and bottom padding (`padY`)
     * and text style.
     */
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

    /** Whether links are underlined. */
    readonly link: { readonly underline: boolean }

    /** The text style and background of one-time codes. */
    readonly otp: { readonly font: TypeStep; readonly surface: "codeSurface" }
  }
}

const theme = globalSlot<ThemeContext>("email-kit.theme")
const direction = globalSlot<"ltr" | "rtl">("email-kit.direction")

/** Makes `value` the theme `useTheme()` returns while `run` runs. */
export function withTheme<T>(value: ThemeContext | undefined, run: () => T): T {
  return theme.run(value, run)
}

/**
 * Returns the project's theme: colours, fonts, spacing, corner radius and component settings,
 * with defaults for anything email-kit.config.ts leaves out. Use it to build components that
 * match the theme.
 *
 * Works only inside a template or a component, while the template compiles.
 *
 * @throws {EmailKitError} If called outside a template.
 *
 * @example
 * ```tsx
 * function Spacer() {
 *   const { space } = useTheme()
 *   return <div style={{ height: `${space.section}px` }} />
 * }
 * ```
 */
export function useTheme(): ThemeContext {
  const value = theme.get()
  if (!value) {
    throw new EmailKitError("no-theme", "useTheme() only works while email-kit compiles a template")
  }
  return value
}

/** Makes `dir` the direction `useDirection()` returns while `run` runs. */
export function withDirection<T>(dir: "ltr" | "rtl", run: () => T): T {
  return direction.run(dir, run)
}

/**
 * Returns the writing direction of the locale being compiled: `"rtl"` for right-to-left
 * languages such as Arabic and Hebrew, otherwise `"ltr"`. Use it to mirror layouts, such as
 * which side an icon or border goes on.
 *
 * @example
 * ```tsx
 * const side = useDirection() === "rtl" ? "right" : "left"
 * ```
 */
export function useDirection(): "ltr" | "rtl" {
  return direction.get() ?? "ltr"
}
