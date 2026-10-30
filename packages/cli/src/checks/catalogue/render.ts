// Checks over the renders of the fixture sweep (CHK-06): sizes from the largest render, and copy
// that only breaks with real data (research 01 §8, 05 §8).

import type { Check, CheckedEmail } from "../types.ts"

/** Gmail clips the HTML part past 102 KB; providers add some bytes of their own. */
const CLIP = 102 * 1024
const WARN = 90 * 1024
const ALLOWANCE = 5 * 1024

// Signs a value rendered empty: "Hi ,", "Thanks, !", "Order  confirmed", "()".
const BROKEN: readonly [RegExp, string][] = [
  [/\S ,/, "a space before a comma"],
  [/[,;:]\s*[.!?,;:]/, "punctuation with nothing between"],
  [/\S {2,}\S/, "two spaces in a row"],
  [/\(\s*\)|\[\s*\]/, "empty brackets"],
]

function groups(emails: readonly CheckedEmail[]): Map<string, CheckedEmail[]> {
  const out = new Map<string, CheckedEmail[]>()
  for (const email of emails) {
    const key = `${email.template}|${email.locale}`
    out.set(key, [...(out.get(key) ?? []), email])
  }
  return out
}

export const RENDER: readonly Check[] = [
  {
    id: "size.gmail",
    level: "error",
    on: "render",
    rule: "The HTML part of the largest render, plus 5 KB for the provider, stays under Gmail's 102 KB clip (a warning from 90 KB).",
    fix: "Gmail hides everything past the clip behind “View entire message”, footers and tracking included. Trim the content, or cap long lists.",
    run: (context, report) => {
      for (const list of groups(context.emails).values()) {
        const sized = list.map((email) => ({
          email,
          bytes: Buffer.byteLength(email.html, "utf8") + ALLOWANCE,
        }))
        const largest = sized.reduce((a, b) => (b.bytes > a.bytes ? b : a))
        const kb = (largest.bytes / 1024).toFixed(1)
        if (largest.bytes >= CLIP) {
          report({
            message: `${kb} KB with its largest fixture: Gmail clips it`,
            email: largest.email,
          })
        } else if (largest.bytes >= WARN) {
          report({
            message: `${kb} KB with its largest fixture, close to Gmail's clip`,
            email: largest.email,
            level: "warn",
          })
        }
      }
    },
  },
  {
    id: "copy.placeholder-fallbacks",
    level: "error",
    on: "render",
    rule: "Empty, long and real data render cleanly: no “Hi ,”, doubled spaces or empty brackets in the subject, preheader or text.",
    fix: "Give the value a fallback, restructure the message (“Hi,” rather than “Hi {name},”), or require it in the schema (`z.string().min(1)`).",
    run: (context, report) => {
      for (const email of context.emails) {
        const parts: [string, string][] = [
          ["subject", email.subject],
          ["preheader", email.preheader],
          ...email.text.split("\n").map((line): [string, string] => ["text", line]),
        ]
        for (const [part, line] of parts) {
          for (const [pattern, what] of BROKEN) {
            const match = pattern.exec(line)
            if (!match) continue
            const start = Math.max(0, match.index - 20)
            const excerpt = line.slice(start, match.index + match[0].length + 20).trim()
            report({ message: `The ${part} has ${what}: “${excerpt}”`, email })
            break
          }
        }
      }
    },
  },
]
