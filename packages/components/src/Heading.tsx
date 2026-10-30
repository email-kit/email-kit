import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font, textCell } from "./style.ts"

export interface HeadingProps {
  readonly children?: Child
  /** One h1 per email, then h2 and h3 without skipping (research 05 §1). Default: 1 */
  readonly level?: 1 | 2 | 3
  readonly align?: "left" | "center" | "right"
}

/** A heading (UI-07): the h1–h3 steps of the type scale. */
export function Heading(props: HeadingProps): IrNode {
  const theme = useTheme()
  const cell = textCell()
  const level = props.level ?? 1
  const Tag = `h${level}` as const
  return (
    <Block bottom={theme.space.stack.md}>
      <Tag
        {...cell.attrs}
        style={{
          margin: "0",
          ...cell.style,
          ...font(Tag, theme),
          color: role("ink"),
          ...(props.align && { textAlign: props.align }),
        }}
      >
        {props.children}
      </Tag>
    </Block>
  )
}
