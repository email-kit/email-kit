import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font, PRESENTATION } from "./style.ts"

export interface CalloutProps {
  readonly tone: "info" | "success" | "warning" | "error"
  /** Carries the meaning in words, so colour is never the only signal (`a11y.colour-only`) */
  readonly title: Child
  /** Inline content: text and links */
  readonly children?: Child
}

/**
 * A notice (UI-20): the status surface with its border, and the title and body in the status ink,
 * the pair the theme checks for contrast. Decorative icons arrive with `Image` (P1-130).
 */
export function Callout(props: CalloutProps): IrNode {
  const theme = useTheme()
  const { stack } = theme.space
  const status = `status.${props.tone}` as const
  const hasBody = props.children !== undefined
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
              {/* Inside a coloured cell, a margin would show Word's background bleed. */}
              <p
                style={{
                  margin: "0",
                  ...(hasBody && { paddingBottom: `${stack.sm}px` }),
                  ...font("body", theme),
                  fontWeight: 700,
                  color: role(`${status}.ink`),
                }}
              >
                {props.title}
              </p>
              {hasBody && (
                <p style={{ margin: "0", ...font("bodySm", theme), color: role(`${status}.ink`) }}>
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
