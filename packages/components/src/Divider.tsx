import { type IrNode, role, useTheme } from "@email-kit/core"

import { NBSP, PRESENTATION } from "./style.ts"

/** A horizontal rule (UI-13): a 1 px filled cell, which every client draws the same. */
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
