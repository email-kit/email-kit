import type { Field } from "../../compiler/schema/index.ts"
import type { Check } from "../types.ts"
import { eachEmail, ownFixture, templateOf, withoutTags } from "./util.ts"

/** Subjects that say nothing about the email. */
const GENERIC = new Set([
  ...["update", "updates", "an update", "important", "important update", "notification"],
  ...["information", "hello", "hi", "newsletter", "reminder", "message", "news"],
  ...["your account", "account update", "no subject", "test"],
])

/** Reply and forward prefixes, in English and the languages whose clients write their own. */
const REPLY_PREFIX = /^\s*(re|fw|fwd|aw|wg|sv|vs|tr)\s*:/i

/** The most characters a subject should have. */
const MAX_LENGTH = 60

/** The dotted paths of every secret field in the schema, such as `login.code`. */
function secretPaths(field: Field, prefix = ""): string[] {
  return (field.properties ?? []).flatMap((p) => {
    const path = prefix ? `${prefix}.${p.name}` : p.name
    return [
      ...(p.field.secret ? [path] : []),
      ...(p.field.type === "object" ? secretPaths(p.field, path) : []),
    ]
  })
}

/** The `subject.*` checks: the subject is short, honest, specific and safe to show. */
export const SUBJECT: readonly Check[] = [
  {
    id: "subject.length",
    level: "warn",
    on: "render",
    rule: "The subject is at most 60 characters.",
    fix: "Phones show about 30–40 characters: put the key words first and cut the rest.",
    run: (context, report) => {
      for (const email of context.emails.filter(ownFixture)) {
        const length = [...email.subject].length
        if (length > MAX_LENGTH) report({ message: `The subject is ${length} characters`, email })
      }
    },
  },
  {
    id: "subject.no-fake-reply",
    level: "error",
    rule: "The subject doesn't start with Re: or Fwd:.",
    fix: "A fake reply prefix is deceptive and a spam signal: describe the email instead.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        if (REPLY_PREFIX.test(email.subject)) {
          problem(`The subject starts "${email.subject.slice(0, 10)}"`)
        }
      }),
  },
  {
    id: "subject.no-secret",
    level: "error",
    rule: "No secret field (a code or token) in the subject or the preheader.",
    fix: "Subjects show on lock screens and in provider logs: put the code in the body only.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const model = templateOf(context, email)?.model
        if (!model) return
        const secrets = new Set(secretPaths(model))
        for (const [part, value] of [
          ["subject", email.subject],
          ["preheader", email.preheader],
        ] as const) {
          for (const match of value.matchAll(/\{\{\{?\s*([\w.]+)\s*\}?\}\}/g)) {
            if (secrets.has(match[1] as string)) {
              problem(`The ${part} shows the secret field ${match[1]}`)
            }
          }
        }
      }),
  },
  {
    id: "subject.generic",
    level: "warn",
    rule: 'The subject isn\'t generic ("Update", "Notification", "Important").',
    fix: "Say what happened: generic subjects get ignored and look like spam.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const plain = withoutTags(email.subject)
          .toLowerCase()
          .replace(/[^\p{L}\s]/gu, "")
          .trim()
        if (GENERIC.has(plain)) problem(`The subject is "${email.subject}"`)
      }),
  },
]
