import { type Child, type IrNode, type PlatformText, role, useTheme } from "@email-kit/core"

export interface LinkProps {
  readonly href: PlatformText
  readonly children?: Child
  /** Advisory text: a tooltip, never the only description of the link */
  readonly title?: Child
}

/** A text link (UI-09): the theme's link colour, underlined so it isn't told by colour alone. */
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
