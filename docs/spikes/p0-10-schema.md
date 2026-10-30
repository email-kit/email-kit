# P0-10: Standard Schema → JSON Schema, and the portable subset

**Status:** done. **Done when:** "all three emit draft 2020-12; non-portable constructs
detected".
**Code:** [`packages/cli/src/compiler/schema.ts`](../../packages/cli/src/compiler/schema.ts).
**Evidence:** [`schema.test.ts`](../../packages/cli/test/schema.test.ts), with the
[portability matrix](../../packages/cli/test/__golden__/schema-portability.md) and the
[canonical output](../../packages/cli/test/__golden__/schema.json) as golden files.

## Results

- **All three emit draft 2020-12.**
  - Zod 4.6 and ArkType 2.2 do it through `~standard.jsonSchema.input/output()`.
  - Valibot 1.5 still has no `~standard.jsonSchema`. It needs `@valibot/to-json-schema` 1.8, which
    supports `typeMode: "input" | "output"`. The compiler resolves it from the user's project and
    gives a clear error when it isn't installed.
- **Their output differs for the same shape:**

  | | Zod | ArkType | Valibot |
  |---|---|---|---|
  | Nullable | `type: [t, "null"]` | `anyOf` with `{type: "null"}` | `anyOf` |
  | Nullable enum | `type` + `enum` | `anyOf` of `const`s + null | `anyOf` |
  | Integer | ±2⁵³ bounds added | plain | plain |
  | Objects | `additionalProperties: false` | open | open |
  | Property order | declared | **alphabetical** | declared |
  | `Date`, `bigint` | throws | **`{}`, silently** | throws |

- **So the compiler doesn't pass library output through.** It reads it into a small **portable
  field model** and writes its own canonical `schema.json`. The same shape written in all three
  libraries gives byte-identical JSON Schema (tested). That model is also the input for
  generated TS types now, and for Python and Go types later.
- **Markers survive in every library.** `secret`, `url` and `secretUrl` from `@email-kit/core` are
  plain metadata objects (`{"x-email-kit": {…}}`). They work with `z.….meta(secret)`,
  `type.string.configure(secret)` and `v.metadata(secret)`. Format hints (`format: "date-time"`)
  pass through the same way.

## The portable subset (R4), as implemented

**Allowed:**
- string, number, integer, boolean;
- string enums and literals;
- arrays with one item schema;
- objects with fixed properties, nested;
- optional and nullable fields;
- length, range and count constraints;
- `format` hints on strings;
- annotations (`title`, `description`, …);
- `x-email-kit` markers.

Field names must match `[A-Za-z_][A-Za-z0-9_]*`, the mustache-core name grammar. The root must be a
non-nullable object.

**Rejected, each with a path and a fix:**
- unions of different types;
- records and maps;
- tuples;
- `Date`, `bigint`, `any`, `unknown`;
- numeric literals;
- defaults;
- transforms and coercions (detected by comparing the input and output schemas);
- intersections that don't merge into one object;
- recursive and shared definitions;
- conditional schemas;
- any JSON Schema keyword outside a whitelist.

Every rejected construct is caught in every library (see the matrix). The checker uses a
whitelist, so a keyword nobody anticipated is reported rather than dropped.

## Findings

1. **Refinements are invisible in JSON Schema.**
   - Zod's `.refine()` and ArkType's `.narrow()` are dropped silently.
   - Valibot's converter refuses `v.check()` outright.

   A refinement would run in the TS validator but not in a Python or Go runtime. **Decision
   needed:**
   - (a) allow refinements, documented as "TS-only, advisory", and pass Valibot
     `ignoreActions: ["check"]`;
   - (b) forbid them, which Zod and ArkType can only enforce by reading library internals.

   I recommend (a).
2. **ArkType loses the declared property order.** Its JSON Schema is alphabetical, so the
   generated types for ArkType users list fields alphabetically. The output is still deterministic.
3. **ArkType doesn't fail on `Date` or `bigint`.** It writes `{}`. The "no JSON type" rule catches
   it, but the message can't name the cause.
4. **Valibot defaults look the same for input and output** (optional plus `default`). The
   input/output comparison misses them, so the `default` keyword is rejected on its own.
5. **`schema.json` leaves objects open** (no `additionalProperties`). Callers may send extra keys.
   - **Recommendation:** the generated `render()`, and every runtime, *projects* data onto the
     schema before rendering: drop unknown keys and fill missing optional keys with `null`.
   - That removes two P0-03 name-shadowing hazards: extra keys shadowing outer names, and missing
     optional keys falling through to outer values.
   - The remaining hazard is a schema that itself declares colliding names. A compile-time check
     over this model can catch it (P1-016).
6. **Type-level `url` fields are still open (P1-020).** The runtime markers work everywhere. But
   restricting `href` to `url` fields *at the type level* needs a marker in the TypeScript type.
   Each library has brands (`z.…brand()`, `v.brand()`, ArkType brands), with different type
   representations. Options:
   - per-library brand detection in `Data<T>`;
   - a `url()` field helper per library;
   - a typed `urls: ["orderUrl"]` list in `defineEmail`.

## Next steps this unblocks

- P1-013 (Standard Schema input and markers);
- P1-073 (`schema.json` per template);
- P1-074 (types emitted from the model);
- P1-077 (the dependency-free validator from the same model);
- the `source.schema-portable` check (P1-C30).
