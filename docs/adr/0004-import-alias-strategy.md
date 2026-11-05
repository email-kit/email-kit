# ADR 0004: Import alias strategy

**Status:** Accepted (2026-10-30).
**Task:** P0-08 (SPK-06). **Evidence:** `spikes/import-alias/run.ts`, removed after phase 0
(recover it from git history before commit `0151249`). `packages/cli/test/host.test.ts` now
covers the chosen strategy.

## Context

Backends import the compiled emails with one line. The scope doc wants `@/email-kit`, through a
tsconfig `paths` alias. That works where something reads tsconfig at runtime:
- Next.js and Bun;
- tsx;
- bundlers: esbuild, tsup, Vite, Wrangler.

It fails in two common setups:
- **a plain `tsc` build** run as `node dist/…`: `tsc` doesn't rewrite aliases;
- **Node type stripping** (`node src/server.ts`): Node ignores tsconfig.

The alternative there is a Node subpath import (`#email-kit`, from `package.json` `imports`).
The open question: in a `tsc` project, the alias must reach the **source** for type-checking and
dev runs, but the **compiled** file in production.

## Options tested

The spike builds a throwaway project per option and runs each step with real tools: TypeScript
5.9.3 and 7.0.2, tsx 4.23, tsc-alias 1.9, Node 24.13. Each run step must print the rendered
subject. The type-check fails if the import resolves to `any`. **Every result was identical on
TS 5.9 and 7.0.**

| | Option | Type-check | Dev: `node src` | Dev: tsx | Build + prod | Notes |
|---|---|---|---|---|---|---|
| A | `#email-kit`: `{types → src, default → dist}` | ✓ | ✗ | ✗ | ✓ | Dev resolves `dist`: missing before the first build, **stale** after it |
| B | `#email-kit`: `{"email-kit" → src, default → dist}`, tsconfig `customConditions` + `rewriteRelativeImportExtensions` | ✓ | ✓¹ | ✓¹ | ✓ | Works when only `dist/` is deployed. A dev run **without** the flag is **silently stale** (tested) |
| B2 | B with a `.js` re-export, no `rewriteRelativeImportExtensions` | ✓ | ✗ | ✓¹ | ✓ | For projects whose own imports use `.js` |
| G | `#email-kit` → generated `compiled/index.mjs` + `index.d.mts`, no condition | ✓ | ✓ | ✓ | ✓ | Also works in CommonJS projects (`require(esm)`). **Fails loudly at boot** if `src/email-kit/compiled/` isn't deployed (tested) |
| C | No build (type stripping): `#email-kit` → `./src/email-kit/index.ts` | ✓ | ✓ | — | — | The re-export must use a `.ts` extension |
| D | `@/email-kit` + tsc-alias in the build | ✓ | ✗ | ✓ | ✓² | ² fails without the extra `tsc-alias` step |
| E | Relative import | ✓ | ✗³ | ✓ | ✓ | ³ the `.js` extension; the same as the project's own imports |
| F | A, in a CommonJS project | ✓ | — | — | ✓ | — |

¹ with `--conditions=email-kit` on the dev command.

Findings:

1. **The dev-time trade-off.** Any mapping whose default target is `dist` (A, or B without the
   flag) runs the **last build's emails in dev, with no error.** That is the worst failure mode
   here: a template edit seems to do nothing.
2. **The deployment trade-off.** A mapping straight to the generated file (G) has no stale state
   and needs one `package.json` change. But production then loads a file from `src/`, so a
   deployment that copies only `dist/` fails, loudly, at boot.
3. **Generated JS must be `.mjs` + `.d.mts`.** In a CommonJS package a `.js` file is CommonJS, so
   a `.js` module failed with `Unexpected token 'export'`. With `.mjs` it works in ESM and
   CommonJS projects (Node 22.12+ `require(esm)`).
4. **Use a unique condition name.** TypeScript's `customConditions` applies to every package. A
   generic name like `source` would also switch any dependency that publishes a `source`
   condition to its raw sources.
5. **The re-export line follows the project's own import style.** `./compiled` suits bundlers;
   `./compiled/index.js` suits `tsc` with nodenext; `./compiled/index.ts` suits type stripping or
   `rewriteRelativeImportExtensions`. `init` has to pick it; one fixed line can't serve every host.

## Decision

`init` picks one strategy per host and records it (CFG-09):

| Host (detected by `init`) | Import | Setup |
|---|---|---|
| Next.js, Bun, tsx-run servers, bundled builds (esbuild, tsup, Vite, Wrangler) | `@/email-kit` | The existing `@/*` alias, or one exact tsconfig `paths` entry (as in the scope doc) |
| Node type stripping, no build | `#email-kit` | `"imports": { "#email-kit": "./src/email-kit/index.ts" }`; `.ts` re-export (C) |
| `tsc` build → `node dist`, deploying the repository | `#email-kit` | `"imports": { "#email-kit": "./src/email-kit/compiled/index.mjs" }`; `compile` also writes `index.mjs` + `index.d.mts` (G) |
| `tsc` build → `node dist`, deploying only the build output | `#email-kit` | Option B with the `email-kit` condition: `customConditions`, `--conditions=email-kit` on dev scripts, and `rewriteRelativeImportExtensions` only if dev runs plain `node` |
| Anything else, or when the user declines config changes | relative import | — |

- **G is the default for `tsc` projects.** It needs a single config change, and it fails loudly
  rather than silently.
- `init` chooses B when it sees a build-output-only deployment (a Dockerfile that copies only the
  build folder, or `files: ["dist"]`), or when the user picks it.
- tsc-alias (D) is offered only when the project already uses it.
- A is rejected.

## Consequences

- **OUT-07** (JS + declaration output) becomes required for G hosts, as `index.mjs` +
  `index.d.mts`.
- **INIT-02 / INIT-08** get detection rules for:
  - the build tool and the dev runner (tsx or plain `node`);
  - the project's relative-import extension style;
  - the deployment shape.
- **For B,** `check` (or `doctor`) warns when a script that runs `src/` lacks
  `--conditions=email-kit`, the one silent failure left.
- **TST-08** host tests build on this harness (see `packages/cli/test/host.test.ts`).
- **Not covered by this spike:**
  - Windows;
  - Node 22.x (type stripping is on by default from 22.18; `require(esm)` from 22.12);
  - TypeScript `moduleResolution: "bundler"` with `#` imports (documented as supported);
  - Deno.
