import { type Child, type IrNode, role, type ThemeRole, useTheme } from "@email-kit/core"

import { PRESENTATION } from "./style.ts"

export interface SectionProps {
  readonly children?: Child
  /** Default: `md` (the section spacing and desktop gutter) */
  readonly padding?: "none" | "sm" | "md"
  /** A surface role for the background. Default: none (the canvas shows through) */
  readonly surface?: "canvas" | "card" | "muted"
}

const SURFACES: Readonly<Record<NonNullable<SectionProps["surface"]>, ThemeRole>> = {
  canvas: "canvas",
  card: "card",
  muted: "muted",
}

/** A block of content (UI-05). Spacing is cell padding, which Word honours, never margins. */
export function Section(props: SectionProps): IrNode {
  const space = useTheme().space
  const padding = {
    none: "0",
    sm: `${space.stack.md}px ${space.gutterMobile}px`,
    md: `${space.section}px ${space.gutterDesktop}px`,
  }[props.padding ?? "md"]
  return (
    <table {...PRESENTATION}>
      <tbody>
        <tr>
          <td
            style={{
              padding,
              ...(props.surface && { backgroundColor: role(SURFACES[props.surface]) }),
            }}
          >
            {props.children}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
