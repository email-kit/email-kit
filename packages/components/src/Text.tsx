import { type Child, type IrNode, role, type ThemeRole, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font } from "./style.ts"

export interface TextProps {
  readonly children?: Child
  /** A type step. Default: `body` (16/24) */
  readonly size?: "lead" | "body" | "bodySm" | "caption"
  /** Default: `default` (ink) */
  readonly tone?: "default" | "muted" | "subtle"
  /** Physical alignment; start-aligned body copy reads best (research 05 §1) */
  readonly align?: "left" | "center" | "right"
}

const TONES: Readonly<Record<NonNullable<TextProps["tone"]>, ThemeRole>> = {
  default: "ink",
  muted: "mutedInk",
  subtle: "subtleInk",
}

/** A paragraph (UI-08): px line height with Word's exact rule, colour from the theme, no margins. */
export function Text(props: TextProps): IrNode {
  const theme = useTheme()
  return (
    <Block bottom={theme.space.stack.md}>
      <p
        style={{
          margin: "0",
          ...font(props.size ?? "body", theme),
          color: role(TONES[props.tone ?? "default"]),
          ...(props.align && { textAlign: props.align }),
        }}
      >
        {props.children}
      </p>
    </Block>
  )
}
