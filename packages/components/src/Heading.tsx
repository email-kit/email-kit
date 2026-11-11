import { type Child, type IrNode, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { textBlock } from "./style.ts"

export interface HeadingProps {
  /** The heading's text. */
  readonly children?: Child
  /**
   * The heading level, which sets both the tag (`h1` to `h3`) and the size. Use one level 1
   * heading per email, then 2 and 3 without skipping a level, so screen reader users can follow
   * the outline. Defaults to 1.
   */
  readonly level?: 1 | 2 | 3
  /**
   * The alignment. Leave it out to align with the language: left, or right in right-to-left
   * emails.
   */
  readonly align?: "left" | "center" | "right"
}

/**
 * A heading, styled from the theme's type scale, with the theme's gap below it.
 *
 * @param props - The text, its level and its alignment.
 *
 * @example
 * ```tsx
 * <Heading>{t("heading", { name: data.customerName })}</Heading>
 * <Heading level={2}>Your order</Heading>
 * ```
 */
export function Heading(props: HeadingProps): IrNode {
  const Tag = `h${props.level ?? 1}` as const
  const text = textBlock(Tag, "ink")
  return (
    <Block bottom={useTheme().space.stack.md}>
      <Tag
        {...text.attrs}
        style={{ ...text.style, ...(props.align && { textAlign: props.align }) }}
      >
        {props.children}
      </Tag>
    </Block>
  )
}
