# @email-kit/runtime

## 1.0.1

### Patch Changes

- d986a7a: Every package's npm page now shows the same README: how to start with `npm create email-kit`, a
  template, what each package is for and how they fit together, with links to the docs at
  https://email-kit.dev, which is now each package's homepage.

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
