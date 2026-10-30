import { type IrNode, useTheme } from "@email-kit/core"

import { NBSP, PRESENTATION } from "./style.ts"

export interface SpacerProps {
  /** A step of the spacing scale. Default: `md` */
  readonly size?: "sm" | "md" | "lg" | "section"
}

/** Vertical space (UI-14): an explicit height and line height, which Word respects. */
export function Spacer(props: SpacerProps): IrNode {
  const space = useTheme().space
  const px = props.size === "section" ? space.section : space.stack[props.size ?? "md"]
  return (
    <table {...PRESENTATION}>
      <tbody>
        <tr>
          <td
            style={{
              height: `${px}px`,
              lineHeight: `${px}px`,
              fontSize: "1px",
              msoLineHeightRule: "exactly",
            }}
          >
            {NBSP}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
