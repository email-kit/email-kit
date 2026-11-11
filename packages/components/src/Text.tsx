import { type Child, type IrNode, type ThemeRole, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { textBlock } from "./style.ts"

export interface TextProps {
  /** The paragraph's text, which can hold links and data. */
  readonly children?: Child
  /**
   * The size, from the theme's type scale: `lead` for an introduction, `body`, `bodySm` for
   * secondary text, or `caption` for fine print. Defaults to `body`.
   */
  readonly size?: "lead" | "body" | "bodySm" | "caption"
  /**
   * The colour: `default` for body text, `muted` for secondary text, or `subtle` for the least
   * important text. Defaults to `default`.
   */
  readonly tone?: "default" | "muted" | "subtle"
  /**
   * The alignment. Leave it out to align with the language: left, or right in right-to-left
   * emails. Long text is easiest to read that way, so keep `center` for short lines.
   */
  readonly align?: "left" | "center" | "right"
}

const TONES: Readonly<Record<NonNullable<TextProps["tone"]>, ThemeRole>> = {
  default: "ink",
  muted: "mutedInk",
  subtle: "subtleInk",
}

/**
 * A paragraph, styled from the theme, with the theme's gap below it.
 *
 * @param props - The text, and its size, colour and alignment.
 *
 * @example
 * ```tsx
 * <Text>{t("intro")}</Text>
 * <Text size="caption" tone="muted">
 *   You're receiving this email because you have an account.
 * </Text>
 * ```
 */
export function Text(props: TextProps): IrNode {
  const text = textBlock(props.size ?? "body", TONES[props.tone ?? "default"])
  return (
    <Block bottom={useTheme().space.stack.md}>
      <p {...text.attrs} style={{ ...text.style, ...(props.align && { textAlign: props.align }) }}>
        {props.children}
      </p>
    </Block>
  )
}
