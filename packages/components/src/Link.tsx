import { type Child, type IrNode, role, type TextValue, useTheme } from "@email-kit/core"

export interface LinkProps {
  /** Where the link goes: a URL, or a URL field from data. */
  readonly href: TextValue
  /** The link text. Say where it goes, such as "View your order", not "click here". */
  readonly children?: Child
  /**
   * A tooltip, shown on hover in some clients. Screen readers may skip it, so make the link text
   * clear on its own.
   */
  readonly title?: Child
}

/**
 * A link inside text, in the theme's link colour. It's underlined unless the theme turns that off,
 * so readers can tell it from text without relying on colour.
 *
 * @param props - The URL, the link text and an optional tooltip.
 *
 * @example
 * ```tsx
 * <Text>
 *   Questions? <Link href="https://help.example.com">Visit the help centre</Link>
 * </Text>
 * ```
 */
export function Link(props: LinkProps): IrNode {
  const { underline } = useTheme().components.link
  return (
    <a
      href={props.href}
      title={props.title}
      style={{ color: role("link"), textDecoration: underline ? "underline" : "none" }}
    >
      {props.children}
    </a>
  )
}
