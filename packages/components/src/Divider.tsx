import { type IrNode, role, useTheme } from "@email-kit/core"

import { NBSP, PRESENTATION } from "./style.ts"

/**
 * A horizontal line between blocks, in the theme's `divider` colour, with space above and below.
 * It's a thin filled cell rather than `<hr>`, which clients draw differently.
 *
 * @example
 * ```tsx
 * <Text>Thanks for your order.</Text>
 * <Divider />
 * <Text>Questions? Reply to this email.</Text>
 * ```
 */
export function Divider(): IrNode {
  const theme = useTheme()
  const line = `${theme.borderWidth.hairline}px`
  return (
    <table {...PRESENTATION}>
      <tbody>
        <tr>
          <td style={{ padding: `${theme.space.stack.md}px 0` }}>
            <table {...PRESENTATION}>
              <tbody>
                <tr>
                  <td
                    style={{
                      height: line,
                      lineHeight: line,
                      fontSize: "1px",
                      msoLineHeightRule: "exactly",
                      backgroundColor: role("divider"),
                    }}
                  >
                    {NBSP}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
