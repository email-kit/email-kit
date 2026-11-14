import { type Element, isTag } from "domhandler"

import type { Check, CheckedEmail } from "../types.ts"
import { eachEmail, templateOf, text } from "./util.ts"

/** Whether the element has the class. */
const hasClass = (node: Element, name: string) =>
  (node.attribs.class ?? "").split(/\s+/).includes(name)

/** The first element with the class, and its offset. */
function part(email: CheckedEmail, name: string): { node: Element; offset: number } | undefined {
  return email.parsed.elements.find(({ node }) => hasClass(node, name))
}

/** Words or a placeholder: a part a reader sees, not an empty element. `\s` covers `&nbsp;`. */
const filled = (value: string) => /\S/.test(value)

/** The sender line without the address that follows it. */
function senderText(node: Element): string {
  const address = node.children.find(
    (child): child is Element => isTag(child) && hasClass(child, "ek-footer-address"),
  )
  return address ? text(node).replace(text(address), "") : text(node)
}

/**
 * The `legal.*` checks: the footer parts each purpose of email requires. `Footer` marks its parts
 * with `ek-footer-*` classes, and a footer built by hand can have the same classes.
 * `legal.purpose-declared` is enforced by the compiler.
 */
export const LEGAL: readonly Check[] = [
  {
    id: "legal.reason",
    level: "error",
    rule: 'Every email says why the reader got it ("why you got this"), naming the account or subscription.',
    fix: 'Add `<Footer reason={t("footer")} …>`, with a line like "You\'re receiving this because you have an account with Acme."',
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const reason = part(email, "ek-footer-reason")
        if (!reason) problem("no reason line: the email doesn't say why the reader got it")
        else if (!filled(text(reason.node))) problem("the reason line is empty", reason.offset)
      }),
  },
  {
    id: "legal.sender-identity",
    level: "error",
    rule: "Every email names who sends it: the legal name or brand.",
    fix: "Add `<Footer sender={sender.legalName} …>`, with `legalName` (or `productName`) set in the config's `sender`.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const sender = part(email, "ek-footer-sender")
        if (!sender) problem("no sender line: the email doesn't say who sends it")
        else if (!filled(senderText(sender.node)))
          problem("the sender line is empty", sender.offset)
      }),
  },
  {
    id: "legal.postal-address",
    level: "error",
    rule: "Marketing and consent-request emails show the sender's postal address.",
    fix: "Pass `address={sender.postalAddress}` to `Footer`, with `postalAddress` set in the config's `sender`.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const purpose = templateOf(context, email)?.purpose
        if (purpose !== "marketing" && purpose !== "consent-request") return
        const address = part(email, "ek-footer-address")
        if (!address) problem(`no postal address, which a ${purpose} email must show`)
        else if (!filled(text(address.node))) problem("the postal address is empty", address.offset)
      }),
  },
]
