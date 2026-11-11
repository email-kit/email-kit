import { type Child, type IrNode, role, type TextValue, useTheme } from "@email-kit/core"

import { Block } from "./Block.tsx"
import { Link } from "./Link.tsx"
import { font, PRESENTATION, textCell } from "./style.ts"

/** A link in a `Footer`. */
export interface FooterLink {
  /** Where the link goes: a URL, or a URL field from data. */
  readonly href: TextValue
  /** The link text, such as "Help centre". */
  readonly label: Child
}

export interface FooterProps {
  /** Who sent the email: the company's legal name or brand, such as `sender.legalName`. */
  readonly sender: Child
  /**
   * Why the reader got the email, naming their account or relationship, such as "You're receiving
   * this email because you placed an order with Acme."
   */
  readonly reason: Child
  /** The sender's postal address, such as `sender.postalAddress`. Shown under the sender. */
  readonly address?: Child
  /**
   * Links on one line, separated by dots. Put help or contact first, then privacy, such as
   * `{ href: sender.helpUrl, label: t("help") }`.
   */
  readonly links?: readonly FooterLink[]
}

/**
 * The footer of a transactional email, in small muted type under a thin line: why the reader got
 * the email, who sent it and from where, and links to help and privacy.
 *
 * `email-kit check` finds the parts each kind of email must have by their classes:
 * `ek-footer-reason`, `ek-footer-sender` and `ek-footer-address`. Give a footer you build yourself
 * the same classes.
 *
 * @param props - The reason, the sender, and an optional address and links.
 *
 * @example
 * ```tsx
 * <Footer
 *   reason={t("footer", { product: sender.productName })}
 *   sender={sender.legalName}
 *   address={sender.postalAddress}
 *   links={[
 *     { href: sender.helpUrl, label: t("helpCentre") },
 *     { href: sender.privacyUrl, label: t("privacy") },
 *   ]}
 * />
 * ```
 */
export function Footer(props: FooterProps): IrNode {
  const theme = useTheme()
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
            <FooterLine part="reason">{props.reason}</FooterLine>
            <FooterLine part="sender" last={links.length === 0}>
              {props.sender}
              {props.address !== undefined && (
                <>
                  <br />
                  <span class="ek-footer-address">{props.address}</span>
                </>
              )}
            </FooterLine>
            {links.length > 0 && (
              <FooterLine part="links" last>
                {links.map((link, i) => (
                  <>
                    {i > 0 && " · "}
                    <Link href={link.href}>{link.label}</Link>
                  </>
                ))}
              </FooterLine>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

interface FooterLineProps {
  /** The part's name, for its `ek-footer-<part>` class. */
  readonly part: "reason" | "sender" | "links"
  /** Whether it's the footer's last line, which has no gap below it. */
  readonly last?: boolean
  readonly children?: Child
}

/** One part of the footer: a paragraph in footer type, with the class `email-kit check` finds. */
function FooterLine(props: FooterLineProps): IrNode {
  const theme = useTheme()
  const cell = textCell()
  return (
    <Block bottom={props.last ? 0 : theme.space.stack.sm}>
      <p
        {...cell.attrs}
        class={`ek-footer-${props.part}`}
        style={{ margin: "0", ...cell.style, ...font("footer", theme), color: role("mutedInk") }}
      >
        {props.children}
      </p>
    </Block>
  )
}
