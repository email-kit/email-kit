---
"@email-kit/runtime": minor
"@email-kit/cli": minor
---

**Breaking:** the generated module no longer inlines its renderer. It imports the new
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
