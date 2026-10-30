# Architecture decision records

One file per decision: `NNNN-short-title.md`, with the sections **Context**, **Options**,
**Decision** and **Consequences**. Decisions are never edited after acceptance; a new ADR
supersedes an old one.

## Proposed

Drafted in P0-12 from the phase-0 spikes, for the maintainer to accept, change or reject.

| ADR | Decision | Evidence |
|---|---|---|
| 0001 | Authoring primitives: own tables vs MJML | _Waiting for P0-04 (real-client screenshots)_ |
| [0002](0002-mustache-core-dialect.md) | `mustache-core@1`: a strict Mustache subset with fixed truthiness, numbers, missing-value errors and a 5-character escaping table | Spec, 142 conformance cases |
| [0006](0006-package-split-and-jsx-transform.md) | Two packages (`core` for authoring, `cli` for the toolchain) with a version check; rolldown loads templates | Transform bench, pragma matrix |

## Accepted

| ADR | Decision | Accepted |
|---|---|---|
| [0003](0003-runtime-plurals.md) | Runtime plurals: generated CLDR category functions select branches in the data-preparation step | 2026-10-30 |
| [0004](0004-import-alias-strategy.md) | Import alias per host: `@/email-kit`; `#email-kit` to the source (type stripping) or to generated `.mjs` (`tsc` default); an `email-kit`-condition mapping for build-output-only deployments; relative otherwise | 2026-10-30 |
| [0005](0005-css-inlining.md) | No HTML inliner: inline styles written at the IR level; juice + `data-embed` only if stylesheets are ever authored | 2026-10-30 |
