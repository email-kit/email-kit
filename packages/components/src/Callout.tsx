import { type Child, type IrNode, role, useTheme } from "@email-kit/core"
import { toNodes } from "@email-kit/core/internal"

import { Block } from "./Block.tsx"
import { PRESENTATION, textBlock } from "./style.ts"

export interface CalloutProps {
  /** The kind of notice, which sets its colours from the theme. */
  readonly tone: "info" | "success" | "warning" | "error"
  /**
   * The title, in bold. Say what kind of notice it is in words, such as "Payment failed", so the
   * meaning doesn't rely on colour.
   */
  readonly title: Child
  /**
   * The text under the title, which can hold links and data. Leave it out for a title on its own.
   * For text that's only sometimes there, wrap the whole `Callout` in `<If>`: an `<If>` inside it
   * still leaves the gap under the title.
   */
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
  const hasBody = !isEmpty(props.children)
  const title = textBlock("body", `${status}.ink`)
  const body = textBlock("bodySm", `${status}.ink`)
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
                {...title.attrs}
                style={{
                  ...title.style,
                  fontWeight: 700,
                  ...(hasBody && { paddingBottom: `${stack.sm}px` }),
                }}
              >
                {props.title}
              </p>
              {hasBody && (
                <p {...body.attrs} style={body.style}>
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

/** Whether a child renders nothing, such as `null`, `false`, `""` or an empty fragment. */
function isEmpty(child: Child): boolean {
  return toNodes(child).every(
    (node) => node.kind === "fragment" && node.children.every((inner) => isEmpty(inner)),
  )
}
