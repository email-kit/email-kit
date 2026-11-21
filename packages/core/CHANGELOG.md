# @email-kit/core

## 1.0.0

### Major Changes

- First stable release. The packages leave the `preview` tag and are published as `latest`, so
  `npm create email-kit` and `npm i -D @email-kit/cli` install them without asking for a tag. From
  here, changes follow semver: a breaking change to the config, the template API or the generated
  module is a major release.
  
  What 1.0 covers: TSX email templates with typed data and messages, compiled to a small module that
  renders with `@email-kit/runtime`; `email-kit init`, `new`, `compile`, `check` and `tokens`; themes
  from shadcn CSS or DTCG tokens with dark mode; email-safe components, including a transactional
  `Footer`; ICU plurals, locale fallback and pseudo-locales. Still to come: marketing email
  (unsubscribe, multi-column layouts), testing in real email clients, and the preview studio.

### Minor Changes

- 068d44a: **Breaking:** each template is now a folder named by its id, holding `template.tsx` and its
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
- 3206f9b: **Breaking:** `<If>` no longer takes a list. A list section repeats its content once per item, so
  `<If when={data.items}>` showed its content as many times as the list had items. The types now
  refuse it, and the compile fails with `list-condition`. Use `<Each>` for the items and `<Unless>`
  for the empty case. For content around the items, such as a heading or a `<List>`, wrap the list
  in an optional object and test that with `<If>`, or pass a boolean field.
  
  `<Each>` now takes an optional list as well, and renders nothing when it's missing.

## 0.1.0-preview.0

### Minor Changes

- First preview. TSX email templates with typed data and messages, compiled to HTML, plain text and a
  dependency-free module; `email-kit init`, `new`, `compile`, `check` and `tokens`; themes from shadcn
  CSS or DTCG tokens with dark mode; a centred page container and fifteen components, including a
  transactional `Footer`; ICU plurals, locale fallback and pseudo-locales; 111 of the planned 175
  checks. Not yet: marketing email (unsubscribe, multi-column layouts), testing in real email
  clients, and the preview studio.
