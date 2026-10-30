import type { Child, IrNode } from "@email-kit/core"

import { PRESENTATION } from "./style.ts"

/**
 * Space below a block, as cell padding: margins are partial in Word, Gmail, OWA and Yahoo, and
 * Word bleeds backgrounds into them (research 01 §10). Not exported: components space themselves.
 */
export function Block(props: { readonly bottom: number; readonly children?: Child }): IrNode {
  return (
    <table {...PRESENTATION}>
      <tbody>
        <tr>
          <td style={{ padding: `0 0 ${props.bottom}px` }}>{props.children}</td>
        </tr>
      </tbody>
    </table>
  )
}
