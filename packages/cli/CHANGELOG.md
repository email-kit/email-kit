# @email-kit/cli

## 1.1.0

### Minor Changes

- 085829a: Teach AI coding agents email-kit. The CLI now ships an Agent Skill (a `SKILL.md` that links to the documentation the CLI now ships, for the installed version) for Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Antigravity, Windsurf and any agent that reads `AGENTS.md`.
  
  - `email-kit init` asks which agents you use, with the ones your repository shows already selected, and writes the skill to `.agents/skills/email-kit/` and `.claude/skills/email-kit/`, with a short section pointing to it in `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`. `--agents <list>` and `--no-agents` decide without asking; `--yes` takes the detected agents.
  - `email-kit agents` adds or updates them later, such as after an upgrade.
  - `email-kit check` warns when a copy of the skill differs from the one the installed CLI ships (`agents.skill-outdated`).

### Patch Changes

- @email-kit/core@1.1.0

## 1.0.1

### Patch Changes

- d986a7a: Every package's npm page now shows the same README: how to start with `npm create email-kit`, a
  template, what each package is for and how they fit together, with links to the docs at
  https://email-kit.dev, which is now each package's homepage.
- Updated dependencies [d986a7a]
  - @email-kit/core@1.0.1

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
- ab7f248: Templates no longer need `/** @jsxImportSource @email-kit/core */` when the tsconfig makes
  email-kit's JSX the default. `init` sets `"jsxImportSource": "@email-kit/core"` next to
  `"jsx": "react-jsx"` in a project with no JSX of its own, and leaves it out of the welcome
  template. `email-kit new` writes the line only when the nearest tsconfig doesn't set it. Projects
  with their own JSX, such as Next.js or Hono apps, keep the line.
  
  The new check `source.jsx-pragma` warns about a template or user component that has JSX without
  the line, where its tsconfig doesn't set email-kit's JSX, and about a pragma that names another
  runtime. The compile is right either way. The check is there because, without the line,
  TypeScript and the editor check the file against another framework's JSX types.
- 068d44a: **Breaking:** the generated module no longer inlines its renderer. It imports the new
  `@email-kit/runtime` (ADR 0007), the only email-kit package an app needs when it runs: install it
  as a **dependency** (`email-kit init` does, and moves it out of devDependencies), at the same
  version as `@email-kit/cli`. It has no dependencies, and the generated module imports only the entry
  points its templates use: about 1.4 KB min+gzip for every project, 3 KB with validation, plurals,
  several locales and send-time sender values.
  
  Templates are now parsed at compile time, and the module is much smaller: the fixture project's
  went from 52 KB to 23 KB. The preheader padding is written once.
  
  Also changed:
  - `emails.<id>.templates`, the raw `{{placeholder}}` strings, is gone; `contract: true` writes them
    as files.
  - `MustacheCoreError` and `DIALECT` are no longer exported. Every send-time error is an
    `EmailRenderError`, including `missing-value`, `non-scalar-value`, `invalid-number` and the new
    `incompatible-module`, for a module compiled for another runtime version.
  - With `validate: false`, the validator is left out of the bundle and templates have no
    `validate()`.
  - New check `output.runtime-dependency`: `@email-kit/runtime` must be in the app's dependencies.
    `output.module-matches` is retired: `output.drift` already compares every committed file with a
    fresh compile.

### Patch Changes

- f2127d6: The welcome template `init` writes now shows each part of a template, not only copy and a button:
  a select on the plan, plurals (with an `=1` case), `If` on an optional number and an optional
  object, `Unless`, and `Each` over a list. Its three fixtures between them take every branch, so
  `email-kit check` renders each one. `render()` for it takes `{ name, plan, startUrl }`, plus the
  optional `trialDays` and `team`.
- Updated dependencies [068d44a]
- Updated dependencies [3206f9b]
- Updated dependencies
  - @email-kit/core@1.0.0

## 0.1.0-preview.0

### Minor Changes

- First preview. TSX email templates with typed data and messages, compiled to HTML, plain text and a
  dependency-free module; `email-kit init`, `new`, `compile`, `check` and `tokens`; themes from shadcn
  CSS or DTCG tokens with dark mode; a centred page container and fifteen components, including a
  transactional `Footer`; ICU plurals, locale fallback and pseudo-locales; 111 of the planned 175
  checks. Not yet: marketing email (unsubscribe, multi-column layouts), testing in real email
  clients, and the preview studio.

### Patch Changes

- Updated dependencies
  - @email-kit/core@0.1.0-preview.0
