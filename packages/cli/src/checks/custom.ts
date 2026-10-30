// Team checks (P1-166, CHK-08): a defineCheck() from the config runs like a built-in check. It
// sees plain data (CheckEmail), and its problems map back to the engine's emails, so findings
// get the same subject, location, levels and reporters.

import type { CheckEmail, CustomCheck } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { text } from "./catalogue/util.ts"
import type { Check, CheckedEmail } from "./types.ts"

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

export function fromCustom(custom: CustomCheck): Check {
  return {
    id: custom.id as Check["id"],
    level: custom.level,
    rule: custom.rule,
    fix: custom.fix,
    ...(custom.on && { on: custom.on }),
    // Never email-kit's docs page: it has no entry for a team's check.
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
