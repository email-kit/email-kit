# Architecture decision records

One file per decision: `NNNN-short-title.md`, with the sections **Context**, **Options**,
**Decision** and **Consequences**. Decisions are never edited after acceptance; a new ADR
supersedes an old one.

## Proposed

Drafted in P0-12 from the phase-0 spikes; each is accepted, changed or rejected by the maintainer.

| ADR | Decision | Evidence |
|---|---|---|
| 0001 | Authoring primitives: own tables vs MJML | _Waiting for P0-04 (real-client screenshots)_ |
| [0002](0002-mustache-core-dialect.md) | `mustache-core@1`: a strict Mustache subset with fixed truthiness, numbers, missing-value errors and a 5-character escaping table | Spec, 142 conformance cases |
| [0003](0003-runtime-plurals.md) | Runtime plurals: **decision needed**; recommends generated CLDR category functions in the data-preparation step | `Intl.PluralRules` checks |
| [0004](0004-import-alias-strategy.md) | Import alias per host: `@/email-kit`, `#email-kit` to the source or to generated `.mjs`, a condition-based mapping, or relative | Tested matrix, tsc 5.9 and 7.0 |
| [0005](0005-css-inlining.md) | No HTML inliner: inline styles written at the IR level; juice + `data-embed` if stylesheets are ever authored | Inliner bench |
| [0006](0006-package-split-and-jsx-transform.md) | Two packages (`core` for authoring, `cli` for the toolchain) with a version check; rolldown loads templates | Transform bench, pragma matrix |

## Accepted

None yet.
