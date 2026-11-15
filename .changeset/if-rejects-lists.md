---
"@email-kit/core": minor
"@email-kit/cli": minor
---

**Breaking:** `<If>` no longer takes a list. A list section repeats its content once per item, so
`<If when={data.items}>` showed its content as many times as the list had items. The types now
refuse it, and the compile fails with `list-condition`. Use `<Each>` for the items and `<Unless>`
for the empty case. For content around the items, such as a heading or a `<List>`, wrap the list
in an optional object and test that with `<If>`, or pass a boolean field.

`<Each>` now takes an optional list as well, and renders nothing when it's missing.
