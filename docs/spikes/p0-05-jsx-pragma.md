# P0-05: the JSX pragma in host setups

**Status:** done. **Done when:** "a matrix of results recorded; the init rules confirmed or
changed". **Code:** `spikes/jsx-pragma/run.ts`
(removed after phase 0; in git history before commit `0151249`). It is the starting point for P1-031.

## Question

Templates are `.tsx` files that start with `/** @jsxImportSource @email-kit/core */`. Does that
type-check correctly under the **host's** tsconfig, without disturbing the host's own JSX (Hono or
React)? The init rules in the scope doc to check:
- add `"jsx": "react-jsx"` only when `jsx` is unset;
- change nothing else;
- scaffold the pragma into every template.

## Method

Each scenario is a throwaway project with:
- a template that uses `defineEmail`, `<Each>` and a misspelt field under `@ts-expect-error`;
- a plain `.ts` file;
- where relevant, the host's own JSX file. A Hono `FC` view, or a React page typed as
  `ReactElement`; each compiles only under its own framework's JSX types.

`tsc --noEmit` runs with TypeScript 5.9.3 and 7.0.2, with Hono 4.13 and React 19.3.

✓ means everything type-checks:
- the template's positive lines pass under email-kit's types;
- its expected error fires;
- the host's own JSX file is typed by its own framework.

## Results

| Host setup | TS 5.9 | TS 7.0 |
|---|---|---|
| Plain Node API, `jsx` unset | ✗ TS17004: Cannot use JSX unless the '--jsx' flag is provided | ✗ the same |
| Plain Node API + the one line `init` adds: `"jsx": "react-jsx"` | ✓ | ✓ |
| Plain Node API, `module: nodenext` (tsc-built) + `react-jsx` | ✓ | ✓ |
| Hono: `react-jsx` + `jsxImportSource: hono/jsx`, Hono views alongside | ✓ | ✓ |
| Hono, template **without** the pragma | ✗ TS2322: Type 'Element' is not assignable to type 'Child' | ✗ the same |
| Next.js ≤ 15: `jsx: preserve`, React pages alongside | ✓ | ✓ |
| Next.js 16: `jsx: react-jsx`, React pages alongside | ✓ | ✓ |
| Classic runtime: `jsx: react`, React pages alongside | ✓ | ✓ |
| Legacy `moduleResolution: node` (node10) + `react-jsx` | ✓ after the fix below (was ✗ TS2307) | ✗ TS5108: node10 was removed in TS 7 (the project's own config error) |

## Conclusions

**The init rules are confirmed:**
1. **`jsx` unset is the only case that needs a change,** and the single `"jsx": "react-jsx"` line
   is enough. It doesn't affect the project's `.ts` files.
2. **The per-file pragma wins in every other setting:** `react-jsx` with another import source,
   `preserve` and classic `react`. The host's own Hono or React files keep their types in the
   same project.
3. **The pragma is required.** Without it, the host's JSX types apply to the template (shown here
   with Hono). `init` and `new` must always write it, and a check should flag a template without
   it (proposed id `source.jsx-pragma`, P1-031).

**One change, already made: core now supports node10 resolution.** TypeScript 5's legacy
`moduleResolution: node` is the default with `module: commonjs`, so it is common in older Node
backends. It ignores `exports`, so it found neither `@email-kit/core` nor its `jsx-runtime`.
`packages/core/package.json` now has a top-level `types` field and `typesVersions` for the
subpaths:
- attw reports node10 green for every entry point;
- publint still passes.

`@email-kit/components` needs the same treatment when it gets real entry points.

## Side effect worth knowing

In a `tsc`-built host, the host's own build compiles the templates into `dist/`. For example
`dist/email-kit/templates/welcome.js`, which imports `@email-kit/core/jsx-runtime` (checked).
It is dead code that nothing imports. It only matters if a deploy step bundles *every* file in
`dist/` with devDependencies pruned.

Excluding the templates from the main tsconfig would cost editor type-checking. **Proposal for
INIT-04:** when the project has a separate build config (such as `tsconfig.build.json`), offer to
add the templates folder to *that* file's `exclude` only.

## Not covered

- Editors: VS Code and the TS server use the same resolution, but this wasn't run in an editor.
- Deno and Bun's own type-checkers.
- `jsx: react-native`.
- Projects with `"types": []` and Next.js's automatic `next-env.d.ts`.
