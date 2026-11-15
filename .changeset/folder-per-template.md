---
"@email-kit/cli": minor
"@email-kit/core": minor
---

**Breaking:** each template is now a folder named by its id, holding `template.tsx` and its
messages as `messages.<locale>.json`, and the output folder is `_generated/` instead of
`compiled/` (ADR 0007). The `templates` and `messages` config options are removed. To move a
project: put `templates/<id>.tsx` at `<id>/template.tsx`, `messages/<locale>/<id>.json` at
`<id>/messages.<locale>.json`, change `./compiled` to `./_generated` in the email-kit folder's
`index.ts`, and compile. Folders starting with `_`, such as `_shared/`, are never templates. A
template whose `id` isn't its folder's name fails with `id-mismatch`, and the old layout is
reported with these steps (`old-layout`). Delete the old `compiled/` folder.

The output folder now holds only what an app imports: the module and `messages.d.ts`. The
per-template `.html`, `.txt` and `schema.json` files and `manifest.json` are written only with the
new `contract: true` option, for backends that don't run the module. The compiler owns the output
folder: each compile removes anything it didn't write (names starting with `.` stay), and it
refuses a non-empty folder that email-kit didn't write (`out-not-owned`). Locale fallback data in
the module keeps only the parents that change a resolution, so an English-only project carries
none.
