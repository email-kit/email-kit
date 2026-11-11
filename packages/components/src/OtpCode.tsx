import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { PRESENTATION, textBlock } from "./style.ts"

export interface OtpCodeProps {
  /** The code, such as `482913`. Give it with no spaces or hyphens: the gaps are added by style. */
  readonly code: Child
  /**
   * The text above the code, saying what it's for, such as "Your code to sign in to Acme". Screen
   * readers read it before the code.
   */
  readonly label: Child
}

/**
 * A one-time code, such as a sign-in or verification code, in large spaced-out type under a label.
 * The code stays one piece of text, so copy and paste, Gmail's "Copy code" and Apple's code
 * AutoFill get it whole. It reads left to right in right-to-left emails too.
 *
 * @param props - The code, and the label above it.
 *
 * @example
 * ```tsx
 * <OtpCode label={t("label", { product: sender.productName })} code={data.code} />
 * ```
 */
export function OtpCode(props: OtpCodeProps): IrNode {
  const theme = useTheme()
  const { stack } = theme.space
  const otp = theme.components.otp
  const label = textBlock("body", "ink")
  const code = textBlock(otp.font, "ink", "ltr")
  return (
    <>
      <Block bottom={stack.sm}>
        <p {...label.attrs} style={label.style}>
          {props.label}
        </p>
      </Block>
      <Block bottom={stack.md}>
        <table {...PRESENTATION}>
          <tbody>
            <tr>
              <td
                bgcolor={theme.roles[otp.surface]}
                style={{
                  padding: `${stack.md}px ${stack.lg}px`,
                  backgroundColor: role(otp.surface),
                  borderRadius: `${theme.radius.code}px`,
                }}
              >
                <p
                  {...code.attrs}
                  style={{ ...code.style, WebkitUserSelect: "all", userSelect: "all" }}
                >
                  {props.code}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </Block>
    </>
  )
}
