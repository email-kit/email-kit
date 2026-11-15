---
"@email-kit/cli": patch
---

The welcome template `init` writes now shows each part of a template, not only copy and a button:
a select on the plan, plurals (with an `=1` case), `If` on an optional number and an optional
object, `Unless`, and `Each` over a list. Its three fixtures between them take every branch, so
`email-kit check` renders each one. `render()` for it takes `{ name, plan, startUrl }`, plus the
optional `trialDays` and `team`.
