import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { font, textCell } from "./style.ts"

export interface ListProps {
  /** `ListItem`s, or an `<Each>` of them */
  readonly children?: Child
  /** A numbered list. Default: bulleted */
  readonly ordered?: boolean
}

/**
 * A real `<ul>`/`<ol>` (UI-15). Word ignores padding on lists, so the indent is a margin. It is
 * the same on both sides, which keeps the markers clear in right-to-left emails too.
 * UNVERIFIED in classic Outlook until real-client testing (P0-04).
 */
export function List(props: ListProps): IrNode {
  const { space } = useTheme()
  const Tag = props.ordered ? "ol" : "ul"
  return (
    <Tag style={{ margin: `0 ${space.stack.lg}px ${space.stack.md}px`, padding: "0" }}>
      {props.children}
    </Tag>
  )
}

/** One item of a `List`: body text in the ink colour, which Outlook won't inherit from the list. */
export function ListItem(props: { readonly children?: Child }): IrNode {
  const theme = useTheme()
  const cell = textCell()
  return (
    <li
      {...cell.attrs}
      style={{
        margin: `0 0 ${theme.space.stack.sm}px`,
        ...cell.style,
        ...font("body", theme),
        color: role("ink"),
      }}
    >
      {props.children}
    </li>
  )
}
