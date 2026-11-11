import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { PRESENTATION } from "./style.ts"

export interface SectionProps {
  /** The section's content. */
  readonly children?: Child
  /**
   * The space inside the section, from the theme: `md` for the gap between sections at the top
   * and bottom and the large-screen side padding, `sm` for a smaller gap and the small-screen side
   * padding, or `none`. Defaults to `md`.
   */
  readonly padding?: "none" | "sm" | "md"
  /**
   * The background colour, from the theme: `canvas` for the page, `card` for a raised panel, or
   * `muted` for a quieter one. Leave it out for no background, so the page shows through.
   */
  readonly surface?: "canvas" | "card" | "muted"
}

/**
 * Groups content into a full-width block, with padding and an optional background. The padding is
 * cell padding rather than margins, so it's the same in every client, classic Outlook included.
 *
 * @param props - The content, its padding and its background.
 *
 * @example
 * ```tsx
 * <Section surface="card">
 *   <Heading level={2}>{t("summary")}</Heading>
 *   <Text>{t("summaryBody")}</Text>
 * </Section>
 * ```
 */
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
              ...(props.surface && { backgroundColor: role(props.surface) }),
            }}
          >
            {props.children}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
