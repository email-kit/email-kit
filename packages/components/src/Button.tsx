import { type Child, type IrNode, role, type TextValue, useTheme } from "@email-kit/core"

import { font, PRESENTATION } from "./style.ts"

export interface ButtonProps {
  /** Where the button goes: a URL, or a URL field from data. */
  readonly href: TextValue
  /** The label: a short action that starts with a verb, such as "View order". */
  readonly children?: Child
  /**
   * The colours, from the theme: `primary` for the main action, `secondary` for others, or
   * `destructive` for one that deletes or cancels something. Use one `primary` button per email.
   * Defaults to `primary`.
   */
  readonly variant?: "primary" | "secondary" | "destructive"
  /**
   * The height and padding, from the theme. `md` and `lg` are at least 44px tall, big enough to tap
   * easily. `sm` is smaller, so keep it for secondary actions. Defaults to `md`.
   */
  readonly size?: "sm" | "md" | "lg"
  /** Whether the button fills the content width. Defaults to `false`. */
  readonly fullWidth?: boolean
  /**
   * A tooltip, shown on hover in some clients. Screen readers may skip it, so make the label clear
   * on its own.
   */
  readonly title?: Child
}

/**
 * A link styled as a button, which works in every client: the whole button is clickable, and
 * classic Outlook still gets its colour and padding. Classic Outlook draws it with square corners.
 *
 * @param props - The URL, the label, and the button's style.
 *
 * @example
 * ```tsx
 * <Button href={data.orderUrl}>{t("viewOrder")}</Button>
 * <Button href={data.cancelUrl} variant="destructive" size="sm">
 *   {t("cancelOrder")}
 * </Button>
 * ```
 */
export function Button(props: ButtonProps): IrNode {
  const theme = useTheme()
  const variant = props.variant ?? "primary"
  const size = theme.components.button[props.size ?? "md"]
  const padding = `${size.padY}px ${size.padX}px`
  const radius = `${theme.radius.button}px`
  return (
    <table
      {...PRESENTATION}
      width={props.fullWidth ? "100%" : undefined}
      style={{ borderCollapse: "separate" }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            bgcolor={theme.roles[`action.${variant}.fill`]}
            style={{
              backgroundColor: role(`action.${variant}.fill`),
              borderStyle: "solid",
              borderWidth: `${theme.borderWidth.hairline}px`,
              borderColor: role(`action.${variant}.border`),
              borderRadius: radius,
              msoPaddingAlt: padding,
            }}
          >
            <a
              href={props.href}
              target="_blank"
              rel="noopener"
              title={props.title}
              style={{
                display: props.fullWidth ? "block" : "inline-block",
                padding,
                ...font(size.font, theme),
                color: role(`action.${variant}.label`),
                textDecoration: "none",
                borderRadius: radius,
              }}
            >
              {props.children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
