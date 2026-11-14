import type { CheckEmail, CustomCheck } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { text } from "./catalogue/util.ts"
import type { Check, CheckedEmail } from "./types.ts"

/**
 * An email as a team check sees it: plain data from the public `CheckEmail` type, with its
 * elements' names, attributes and text, so a check needs none of email-kit's parsers.
 */
function publicEmail(email: CheckedEmail): CheckEmail {
  const elements = email.parsed.elements.map(({ node, offset, mso }) => ({
    name: node.name,
    attributes: { ...node.attribs },
    text: text(node),
    offset,
    mso,
  }))
  return {
    template: email.template,
    locale: email.locale,
    ...(email.fixture !== undefined && { fixture: email.fixture }),
    subject: email.subject,
    preheader: email.preheader,
    html: email.html,
    text: email.text,
    elements: (name) => (name === undefined ? elements : elements.filter((e) => e.name === name)),
  }
}

/**
 * Wraps a project's own check, from `defineCheck()`, so it runs like a built-in one. It sees plain
 * data (`CheckEmail`), and the problems it reports map back to the engine's emails, so its
 * findings get the same subject, location, levels and reporters. It has no entry on email-kit's
 * docs page, so its `docs` link is its own or none.
 */
export function fromCustom(custom: CustomCheck): Check {
  return {
    id: custom.id as Check["id"],
    level: custom.level,
    rule: custom.rule,
    fix: custom.fix,
    ...(custom.on && { on: custom.on }),
    docs: custom.docs ?? "",
    run(context, report) {
      const originals = new Map<CheckEmail, CheckedEmail>()
      const emails = context.emails.map((email) => {
        const shown = publicEmail(email)
        originals.set(shown, email)
        return shown
      })
      try {
        custom.run({ emails }, (problem) => {
          const email = problem.email && originals.get(problem.email)
          report({
            message: problem.message,
            ...(email && { email }),
            ...(problem.at !== undefined && { at: problem.at }),
            ...(problem.fix !== undefined && { fix: problem.fix }),
          })
        })
      } catch (error) {
        throw new EmailKitError(
          "check-failed",
          `The team check ${custom.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    },
  }
}
