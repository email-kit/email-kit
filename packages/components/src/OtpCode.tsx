import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font, PRESENTATION, textCell } from "./style.ts"

export interface OtpCodeProps {
  /** The code: contiguous digits or letters, with no spaces or hyphens inside it */
  readonly code: Child
  /** Words naming it as a code and its purpose, such as "Your code to sign in to Acme" */
  readonly label: Child
}

/**
 * A one-time code (UI-19): the label, then the code once, as plain contiguous text in a large
 * monospaced display. Spacing comes from letter-spacing, never from splitting the digits, so
 * copy and paste, Gmail's "Copy code" and Apple Mail's AutoFill read it whole (research 04 §5.1,
 * 05 §9). No `aria-label`: the label is real text next to the code (05 ⚠6).
 */
export function OtpCode(props: OtpCodeProps): IrNode {
  const theme = useTheme()
  const { stack } = theme.space
  const otp = theme.components.otp
  const cell = textCell()
  // A code reads left to right, whatever the language around it.
  const code = textCell("ltr")
  return (
    <>
      <Block bottom={stack.sm}>
        <p
          {...cell.attrs}
          style={{ margin: "0", ...cell.style, ...font("body", theme), color: role("ink") }}
        >
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
                  style={{
                    margin: "0",
                    ...code.style,
                    ...font(otp.font, theme),
                    color: role("ink"),
                    WebkitUserSelect: "all",
                    userSelect: "all",
                  }}
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
