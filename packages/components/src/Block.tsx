import type { Child, IrNode } from "@email-kit/core"

import { PRESENTATION } from "./style.ts"

export interface BlockProps {
  /** The space below the content, in pixels. Take it from the theme, such as `space.stack.md`. */
  readonly bottom: number
  /** The component's content. */
  readonly children?: Child
}

/**
 * Wraps a component in a one-cell table with space below it. The space is cell padding, not a
 * margin: classic Outlook, Gmail and Yahoo support margins only in part, and classic Outlook
 * spreads backgrounds into them. Only for this package's components, which each set their own
 * spacing, so it isn't exported.
 *
 * @param props - The space below, and the content.
 *
 * @example
 * ```tsx
 * export function Text(props: TextProps): IrNode {
 *   const theme = useTheme()
 *   return (
 *     <Block bottom={theme.space.stack.md}>
 *       <p style={font("body", theme)}>{props.children}</p>
 *     </Block>
 *   )
 * }
 * ```
 */
export function Block(props: BlockProps): IrNode {
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
