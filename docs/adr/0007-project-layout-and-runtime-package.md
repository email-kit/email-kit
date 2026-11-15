# ADR 0007: Folder per template, a small `_generated` folder, and a runtime package

**Status:** Accepted (2026-11-15). Supersedes the "self-contained module" parts of
[architecture-direction.md](../architecture-direction.md), PRD PKG-02, OUT-01, OUT-02, OUT-05,
G5 and NFR-01, as listed under Consequences.

## Context

`email-kit compile` writes more into the user's project than an app needs. Measured on a Next.js
app with 2 templates in 1 locale, `compiled/` held 9 files and 73 KB:

| Part | Size | Used by the app? |
|---|---|---|
| Inlined runtime in `index.ts` (renderer, parser, validator, locale fallback, errors) | 25.6 KB | Yes, but it's identical in every project |
| Email strings in `index.ts` | 16.7 KB | Yes: the product |
| `LOCALE_DATA` in `index.ts` | 3.3 KB | No: with only `en` compiled, every `en-*` tag resolves to `en` by truncation |
| Types and `createEmails` | 4 KB | Yes |
| `<id>/<locale>.html`, `<id>/<locale>.txt` | 15.8 KB | No: copies of the strings in `index.ts` |
| `<id>/schema.json`, `manifest.json` | 2.9 KB | No: for future non-TS emitters, and owned-file tracking |
| `messages.d.ts` | 2 KB | Yes: typed `t()` |

`perTemplateEntries` repeats the 25 KB runtime in every per-template module.

The sources are also split by kind: `templates/<id>.tsx` and `messages/<locale>/<id>.json`. One
email's files sit in two trees.

## Decision

### 1. One folder per template

```
email-kit/
  index.ts              export * from "./_generated"
  _generated/           owned by the compiler
  _shared/              optional: components the templates import
  welcome/
    template.tsx
    messages.en.json
    messages.si.json
```

- A template is a direct subfolder of `root` that holds `template.tsx`. Its messages sit beside it
  as `messages.<locale>.json`.
- Folders starting with `_` or `.` are never templates, and neither is the output folder. Other
  folders without `template.tsx` are ignored, so `components/` or `fixtures/` can live there too.
  A folder with `messages.*.json` but no `template.tsx` is reported, since it is almost always a
  misnamed template file.
- The folder name is the template id. `defineEmail({ id })` stays, because it types `t()`, and it
  must match the folder name (`id-mismatch`).
- The `templates` and `messages` config options are removed; `root` is the one folder setting.

### 2. `_generated` holds only what the app imports

- `out` defaults to `<root>/_generated`, the name Convex uses for the same job.
- The default output is `index.ts` (or `index.mjs` + `index.d.mts`) and `messages.d.ts`.
- `<id>/<locale>.html`, `<id>/<locale>.txt` and `<id>/schema.json` become opt-in, for backends in
  other languages (the language-neutral contract of architecture-direction R1–R9).
- The compiler owns the whole folder, so `manifest.json` is no longer needed to track its files.
- `LOCALE_DATA` keeps only entries that change a resolution, and the preheader padding is one
  constant in the module.

### 3. `@email-kit/runtime`: the only runtime dependency, kept minimal

The runtime moves out of the generated module into `@email-kit/runtime`, installed in
`dependencies`. Everything else (`core`, `components`, `cli`) stays in `devDependencies`. The
package has zero dependencies and holds only code that runs when an email is sent. Measured
min+gzip, from the code inlined today (3.5 KB in all):

| Piece | Size | Decision |
|---|---|---|
| Parser and its 6 syntax errors | ~0.8 KB | Moves to compile time: the module carries parsed templates |
| Renderer and HTML escaping | ~0.75 KB | Always |
| Projection to schema fields | ~0.3 KB | Always: stops a tag finding an outer field |
| Validator | ~1.1 KB | `@email-kit/runtime/validate`, imported only with `validate: true` |
| Plural and select flags | ~0.55 KB | `@email-kit/runtime/plural`, imported only when a template uses them |
| Locale fallback | ~0.45 KB | `@email-kit/runtime/locale`, imported only with several locales or `locales.fallback` |
| Send-time sender values | ~0.55 KB | Imported only when the config has runtime sender values |
| `MustacheCoreError` | ~0.15 KB | Merged into `EmailRenderError` |

The generated module imports only the subpaths the project uses, which also keeps unbundled Node
loading small. The generated code passes a format version, and the runtime refuses one it
doesn't know, with "run `email-kit compile`". CI enforces a size limit per entry.

## Consequences

- **Breaking for preview users:** the folder layout and config keys change, and
  `emails.<name>.templates` (the raw `{{placeholder}}` strings) leaves the runtime API; the opt-in
  contract files carry them.
- **`@email-kit/runtime` must be a production dependency.** A production install without dev
  packages would otherwise fail at boot. `init` installs it in `dependencies`; `check` fails when
  it's missing or in `devDependencies`. It joins the Changesets `fixed` group.
- **The parser stays in the toolchain,** and the conformance suite runs compile-time parse plus
  runtime render.
- **Docs to update when each step lands:** PRD PKG-02, OUT-01, OUT-02, OUT-05, G5, NFR-01;
  phase-1-scope ("installed as a devDependency"); architecture-direction ("self-contained");
  the guides.
- **Order:** (1) layout and `_generated`; (2) opt-in contract files and no manifest; (3) the
  runtime package.
