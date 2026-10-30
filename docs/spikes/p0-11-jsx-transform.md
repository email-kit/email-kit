# P0-11: JSX transform for loading templates

**Status:** done; feeds ADR 0006 (P0-12). **Code:** [`spikes/jsx-transform/`](../../spikes/jsx-transform/bench.ts)
(`pnpm --filter @email-kit/spike-jsx-transform bench`).

## Question

`compile`, `check` and `dev` must load `.tsx` templates with email-kit's JSX settings, whatever the
host project's tsconfig says (JSX-03, SPK-11). Which tool should do it?

## What was tested

The fixture has three parts:
- a template with the `@jsxImportSource @email-kit/core` pragma;
- a user component **without** a pragma, imported by a relative path;
- a **hostile** `tsconfig.json` next to them: `jsx: react-jsx`, `jsxImportSource: hono/jsx`.

Each candidate loads the template; core evaluates it to IR; the IR is compared across candidates.

There are two ways to load:
- **Bundlers** (esbuild, rolldown) bundle the template with its local imports, write one `.mjs` file
  under `node_modules/.cache/email-kit/`, and import it.
- **Transform-only tools** (oxc-transform, swc) need a loader. The spike uses Node module hooks
  (`module.registerHooks`) that transform `.ts`/`.tsx` files on import.

## Results

Node 24.13, macOS arm64. Each candidate ran in its own process, three runs. The template's own
dependencies (zod, core) were loaded before timing.

| Candidate | Kind | Same IR | Cold (import tool + first load) | Warm load (median of 20) | Install size | Install scripts |
|---|---|---|---|---|---|---|
| esbuild 0.28.2 | bundle | yes | 20–46 ms | 1.5 ms | 21.3 MB | yes (blocked) |
| rolldown 1.2.15 | bundle | yes | 34–70 ms | 1.4–1.7 ms | 35.3 MB | none |
| oxc-transform 0.156.0 | transform + hooks | yes | 6–14 ms | 0.6 ms | 10.8 MB | none |
| @swc/core 1.16.20 | transform + hooks | yes | 29–54 ms | 0.7 ms | 18.4 MB | yes (blocked) |

**All four are fast enough.** A warm load is 1–2 ms, so 100 template × locale compiles spend well
under a second here (NFR-04: under 10 s for 50 × 2, including checks). Speed doesn't decide this.

**With default options, the hostile tsconfig breaks both bundlers.**
- esbuild reads it: the component imports `hono/jsx/jsx-runtime`, and the load fails with
  `Cannot find package 'hono'`.
- rolldown reads it too (`tsconfig` defaults to `true`), with the same failure.
- With explicit options (esbuild `tsconfigRaw: {}`; rolldown `tsconfig: false` and `transform.jsx`)
  all candidates give identical IR.

**Templates need tsconfig `paths` aliases (`@/lib/…`), and only rolldown handles them safely.**
With the host tsconfig loaded for aliases and JSX forced by options:

| Tool | Imports in the bundle | |
|---|---|---|
| rolldown | `@email-kit/core`, `zod`, `@email-kit/core/jsx-runtime` | Correct: the alias resolved, and the JSX option won |
| esbuild | …, `hono/jsx/jsx-runtime`, `@email-kit/core/jsx-runtime` | Wrong: the tsconfig's `jsxImportSource` beat the build option for the pragma-less component |

With esbuild we would have to parse the host tsconfig ourselves (including `extends` chains) and
pass only `paths`. rolldown does this natively.

**Transform-only tools with module hooks have structural costs:**
- `module.registerHooks` needs Node 22.15+, but `engines` says 22.12.
- Hooks are global to the process: the studio, or any program embedding the compiler, would have
  its own imports transformed.
- We would reimplement resolution: extensions, `paths`, `exports` conditions.
- Watch mode needs a fresh URL per rebuild for every file, which grows the module cache.

## Recommendation (for ADR 0006)

**Use rolldown** (`rolldown()` + `generate()`, in memory) with:
- `transform.jsx: { runtime: "automatic", importSource: "@email-kit/core" }`, always;
- `tsconfig`: the host's (auto-discovered or `--tsconfig`), used only for `paths`;
- an externals rule: bundle source files (`.ts`/`.tsx`, including TS-source workspace packages);
  keep compiled packages external, so `@email-kit/core` is the copy the compiler uses;
- output written to `<project>/node_modules/.cache/email-kit/<hash>.mjs` and imported, so bare
  imports resolve from the project;
- `chunk.moduleIds` as the file list for `--watch` and incremental compile.

Why:
- It is the only candidate that respects aliases while forcing our JSX settings.
- It has no install scripts.
- It is the bundler under tsdown and Vite 8, so many projects already have it installed.

The cost is install size (35 MB, a devDependency) and a pre-1.x-mature API surface.

## Follow-ups

- **Memory in long `--watch` sessions.** Every rebuild imports a new module. Consider evaluating
  in a worker thread that is recycled (P1-087).
- **Two copies of `@email-kit/core`.** If the template resolves a different copy than the CLI's,
  both must agree. The prototype keeps evaluation state in a `Symbol.for` slot on `globalThis`.
  The CLI should also compare versions and fail clearly on a mismatch (P1-032).
- **Lifecycle scripts.** esbuild and @swc/core are listed with `allowBuilds: false` in
  `pnpm-workspace.yaml` for this spike. Drop them when the spike is removed.
