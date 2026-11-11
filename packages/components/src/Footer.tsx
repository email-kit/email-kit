import { type Child, type IrNode, role, type TextValue, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { Link } from "./Link.tsx"
import { font, PRESENTATION, textCell } from "./style.ts"

export interface FooterLink {
  readonly href: TextValue
  readonly label: Child
}

export interface FooterProps {
  /** Who sends the email: the legal name or brand, such as `sender.legalName` */
  readonly sender: Child
  /** Why the reader got it, naming the account or relationship (research 03, 05 §13) */
  readonly reason: Child
  /** The postal address, such as `sender.postalAddress` */
  readonly address?: Child
  /** Help or contact first, then privacy, such as `{ href: sender.helpUrl, label: t("help") }` */
  readonly links?: readonly FooterLink[]
}

/**
 * The footer of a transactional email (research 05 §13): why the reader got it, who sent it and
 * where, and the help and privacy links, in small muted type under a hairline. Unsubscribe and
 * the other marketing slots come with the page layout.
 */
export function Footer(props: FooterProps): IrNode {
  const theme = useTheme()
  const cell = textCell()
  // The `ek-footer-*` classes mark the parts for the legal.* checks (research 03 §15.5).
  const paragraph = (part: string, children: Child, last = false) => (
    <Block bottom={last ? 0 : theme.space.stack.sm}>
      <p
        {...cell.attrs}
        class={`ek-footer-${part}`}
        style={{ margin: "0", ...cell.style, ...font("footer", theme), color: role("mutedInk") }}
      >
        {children}
      </p>
    </Block>
  )
  const links = props.links ?? []
  return (
    <table {...PRESENTATION}>
      <tbody>
        <tr>
          <td
            style={{
              padding: `${theme.space.stack.lg}px 0 0`,
              borderTopStyle: "solid",
              borderTopWidth: `${theme.borderWidth.hairline}px`,
              borderTopColor: role("hairline"),
            }}
          >
            {paragraph("reason", props.reason)}
            {paragraph(
              "sender",
              <>
                {props.sender}
                {props.address !== undefined && (
                  <>
                    <br />
                    <span class="ek-footer-address">{props.address}</span>
                  </>
                )}
              </>,
              links.length === 0,
            )}
            {links.length > 0 &&
              paragraph(
                "links",
                links.map((link, i) => (
                  <>
                    {i > 0 && " · "}
                    <Link href={link.href}>{link.label}</Link>
                  </>
                )),
                true,
              )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
