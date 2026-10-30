# mustache-core conformance suite

Golden cases for the [mustache-core](../../docs/spec/mustache-core.md) placeholder dialect. Every
email-kit runtime, in any language, must pass every case in every file here (R8).

## Format

Each `*.json` file (except `case-file.schema.json`) is one topic and follows
[`case-file.schema.json`](case-file.schema.json):

```json
{
  "dialect": "mustache-core@1",
  "name": "variables",
  "description": "…",
  "cases": [
    {
      "name": "string value",
      "profile": "html",
      "template": "Hello, {{name}}!",
      "data": { "name": "Ada" },
      "expected": "Hello, Ada!"
    }
  ]
}
```

A case has either `expected` (the exact output string) or `error` (an error code from spec §10).

## Writing a runner

For each case:
1. Load the data with a JSON parser, converting numbers to doubles (spec §3).
2. Render `template` with that data and `profile`.
3. Compare: the output must equal `expected` exactly. For an `error` case, rendering must fail
   with that code.

Don't skip cases. When a case looks wrong, fix the spec and the case together.

The TS runner is [`packages/dialect/test/conformance.test.ts`](../../packages/dialect/test/conformance.test.ts).
