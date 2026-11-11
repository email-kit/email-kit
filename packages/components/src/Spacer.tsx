import { type IrNode, useTheme } from "@email-kit/core"

import { NBSP, PRESENTATION } from "./style.ts"

export interface SpacerProps {
  /**
   * How much space: `sm`, `md` or `lg` from the theme's gaps between blocks, or `section` for the
   * gap between sections. Defaults to `md`.
   */
  readonly size?: "sm" | "md" | "lg" | "section"
}

/**
 * Empty vertical space, sized from the theme. Components already space themselves, so use it only
 * for an extra gap. It keeps its height in every client, classic Outlook included.
 *
 * @param props - The size of the space.
 *
 * @example
 * ```tsx
 * <Text>Your code expires in 10 minutes.</Text>
 * <Spacer size="lg" />
 * <Text>If you didn't ask for it, you can ignore this email.</Text>
 * ```
 */
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
