import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font, PRESENTATION, textCell } from "./style.ts"

export interface CalloutProps {
  /** The kind of notice, which sets its colours from the theme. */
  readonly tone: "info" | "success" | "warning" | "error"
  /**
   * The title, in bold. Say what kind of notice it is in words, such as "Payment failed", so the
   * meaning doesn't rely on colour.
   */
  readonly title: Child
  /** The text under the title, which can hold links and data. */
  readonly children?: Child
}

/**
 * A notice in a coloured box, such as a warning or a confirmation, with a bold title and optional
 * text under it. Its colours come from the theme, which checks them for contrast.
 *
 * @param props - The kind of notice, its title and its text.
 *
 * @example
 * ```tsx
 * <Callout tone="warning" title={t("notYouTitle")}>
 *   {t("notYou")}
 * </Callout>
 * ```
 */
export function Callout(props: CalloutProps): IrNode {
  const theme = useTheme()
  const { stack } = theme.space
  const status = `status.${props.tone}` as const
  const hasBody = props.children !== undefined
  const cell = textCell()
  return (
    <Block bottom={stack.md}>
      <table {...PRESENTATION}>
        <tbody>
          <tr>
            <td
              bgcolor={theme.roles[`${status}.surface`]}
              style={{
                padding: `${stack.md}px`,
                backgroundColor: role(`${status}.surface`),
                borderStyle: "solid",
                borderWidth: `${theme.borderWidth.hairline}px`,
                borderColor: role(`${status}.border`),
                borderRadius: `${theme.radius.card}px`,
              }}
            >
              <p
                {...cell.attrs}
                style={{
                  margin: "0",
                  ...cell.style,
                  ...(hasBody && { paddingBottom: `${stack.sm}px` }),
                  ...font("body", theme),
                  fontWeight: 700,
                  color: role(`${status}.ink`),
                }}
              >
                {props.title}
              </p>
              {hasBody && (
                <p
                  {...cell.attrs}
                  style={{
                    margin: "0",
                    ...cell.style,
                    ...font("bodySm", theme),
                    color: role(`${status}.ink`),
                  }}
                >
                  {props.children}
                </p>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </Block>
  )
}
