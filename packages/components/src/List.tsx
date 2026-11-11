import { type Child, type IrNode, role, useTheme } from "@email-kit/core"

import { font, textCell } from "./style.ts"

export interface ListProps {
  /** The items: `ListItem`s, or an `<Each>` that makes one for each item in a data list. */
  readonly children?: Child
  /** Whether to number the items. Defaults to `false`, for bullets. */
  readonly ordered?: boolean
}

/**
 * A bulleted or numbered list. It's a real `<ul>` or `<ol>`, so screen readers announce it as a
 * list and count its items. The indent is the same on both sides, which keeps the bullets or
 * numbers in view in right-to-left emails too.
 *
 * @param props - The items, and whether to number them.
 *
 * @example
 * ```tsx
 * <List>
 *   <Each of={data.items}>
 *     {(item) => (
 *       <ListItem>
 *         {item.name} × {item.qty}
 *       </ListItem>
 *     )}
 *   </Each>
 * </List>
 * ```
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

export interface ListItemProps {
  /** The item's text, which can hold links and data. */
  readonly children?: Child
}

/**
 * One item of a `List`, in the theme's body text style.
 *
 * @param props - The item's text.
 *
 * @example
 * ```tsx
 * <List ordered>
 *   <ListItem>Open the app.</ListItem>
 *   <ListItem>Enter your code.</ListItem>
 * </List>
 * ```
 */
export function ListItem(props: ListItemProps): IrNode {
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
