import { type Child, type IrNode, type PlatformText, role, useTheme } from "@email-kit/core"

import { font, PRESENTATION } from "./style.ts"

export interface ButtonProps {
  readonly href: PlatformText
  /** A verb-first label of three words or fewer (research 05 §6) */
  readonly children?: Child
  /** One primary action per email. Default: `primary` */
  readonly variant?: "primary" | "secondary" | "destructive"
  /** `sm` is for secondary actions only: it is under 44 px. Default: `md` */
  readonly size?: "sm" | "md" | "lg"
  readonly fullWidth?: boolean
  /** Advisory text: a tooltip, never the only description of the action */
  readonly title?: Child
}

/**
 * A bulletproof link button (UI-10). Outlook's Word engine ignores padding on links, so the cell
 * carries it there (`mso-padding-alt`, `bgcolor`); everywhere else the padded link fills the cell
 * and the whole button is clickable. Word draws square corners. The height is the label's line
 * height plus the padding, at least 44 px for `md` and `lg` (`tokens.button-height`).
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
