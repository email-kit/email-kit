# ADR 0006: Package split and the JSX transform

**Status:** Proposed (2026-10-30). **Tasks:** P0-11 (SPK-11), P0-12 (SPK-12).
**Evidence** (spike notes removed in commit `23d757a`; in git history):
- `docs/spikes/p0-11-jsx-transform.md`;
- `docs/spikes/p0-03-compiler.md` (finding 4);
- `docs/spikes/p0-05-jsx-pragma.md`.

## Context

Templates import authoring code (`defineEmail`, `<Each>`, the JSX runtime). The CLI holds the
toolchain (a bundler, and later HTML parsing, colour maths and the studio). Two questions:

1. **The JSX transform:** what loads `.tsx` templates with email-kit's JSX settings, whatever
   the host tsconfig says?
2. **The package split:** do authoring and toolchain ship as one package or two (PRD Q4)?

## Options

**JSX transform.** Tested with a pragma-less component and a hostile host tsconfig
(`jsxImportSource: hono/jsx`, `paths` aliases):

| Option | Result |
|---|---|
| esbuild | Fast. Lets the host tsconfig's `jsxImportSource` override its own option once the tsconfig is loaded for `paths`. Has an install script |
| **rolldown** | Resolves `paths` aliases and keeps the forced JSX settings. No install scripts. The bundler under tsdown and Vite 8. 35 MB |
| oxc-transform, swc | Transform only: they need Node module hooks (Node 22.15+, process-wide), custom resolution, and cache-busting for watch mode |

**Package split:**

| Option | For | Against |
|---|---|---|
| **A. Two packages:** `@email-kit/core` (authoring, no dependencies) and `@email-kit/cli` (toolchain) | Templates import a small package with a readable name (`@jsxImportSource @email-kit/core`). Toolchain weight stays out of authoring types | Users install two packages. Two installed copies can disagree (seen in P0-03 under Vitest) |
| B. One package (authoring + bin) | One install; no version skew | Either templates import from `@email-kit/cli`, or core carries rolldown and the rest. The pragma and imports read worse |
| C. CLI depends on core; users install only the CLI | One install | Under pnpm, templates can't import `@email-kit/core` unless it is a direct dependency (phantom dependency) |

## Decision (proposed)

**rolldown, as the CLI's template loader:**
- JSX is always forced to automatic with `importSource: "@email-kit/core"`;
- the host tsconfig is read only for `paths`;
- source files are bundled and compiled packages kept external;
- the bundle is imported from `<project>/node_modules/.cache/email-kit/`;
- `moduleIds` drive `--watch`.

**Two packages (A),** made safe:
- **Versions:** `init` installs `@email-kit/cli` and `@email-kit/core` as devDependencies at the
  same version (they are already a Changesets `fixed` group). `@email-kit/components` declares
  `@email-kit/core` as a peer dependency.
- **A version check:** the CLI resolves `@email-kit/core` from each template and compares it with
  its own. On a mismatch it fails with the exact install command.
- **Shared state:** evaluation state crosses copies through `Symbol.for` slots, as the prototype
  already does, so a mismatch is reported rather than causing odd behaviour.
- **Old resolvers:** core keeps `types` + `typesVersions` for TypeScript's node10 resolution
  (P0-05).

## Consequences

- **`@email-kit/cli` depends on `rolldown`** (pinned in the catalog). Watch mode should evaluate
  in a recycled worker, so module copies don't accumulate (P1-087).
- **The compiler is a library inside the CLI** (`packages/cli/src/compiler/`), not a third
  package. That can change if the studio needs it separately.
- **Template evaluation imports user code,** which must therefore run in Node. Templates can't
  depend on browser-only or edge-only modules. Documented in authoring.
