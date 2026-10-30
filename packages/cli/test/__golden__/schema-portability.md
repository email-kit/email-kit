| Construct | Zod 4.6 | ArkType 2.2 | Valibot 1.5 |
|---|---|---|---|
| string, number, integer, boolean | ✓ portable | ✓ portable | ✓ portable |
| string enum | ✓ portable | ✓ portable | ✓ portable |
| optional, nullable, both | ✓ portable | ✓ portable | ✓ portable |
| nullable enum | ✓ portable | ✓ portable | ✓ portable |
| list of objects, nested object | ✓ portable | ✓ portable | ✓ portable |
| length and range constraints | ✓ portable | ✓ portable | ✓ portable |
| format hint, secret and url markers | ✓ portable | ✓ portable | ✓ portable |
| union of types | ✗ `id`: Unions aren't portable: use one type, optionally nullable | ✗ `id`: Unions aren't portable: use one type, optionally nullable | ✗ `id`: Unions aren't portable: use one type, optionally nullable |
| record (dynamic keys) | ✗ `labels`: Maps with dynamic keys (records) aren't portable: list the keys as properties | ✗ `labels`: Maps with dynamic keys (records) aren't portable: list the keys as properties | ✗ `labels`: Maps with dynamic keys (records) aren't portable: list the keys as properties |
| tuple | ✗ `pair`: Tuples (prefixItems) aren't portable: use an object with named fields | ✗ `pair`: Tuples (prefixItems) aren't portable: use an object with named fields | ✗ `pair`: Tuples (prefixItems) aren't portable: use an object with named fields |
| Date object | ✗ JSON Schema conversion failed: Date cannot be represented in JSON Schema | ✗ `at`: A field with no JSON type isn't portable (any, unknown, or a type JSON Schema can't express, such as Date or bigint) | ✗ JSON Schema conversion failed: The "date" schema cannot be converted to JSON Schema. |
| bigint | ✗ JSON Schema conversion failed: BigInt cannot be represented in JSON Schema | ✗ `n`: A field with no JSON type isn't portable (any, unknown, or a type JSON Schema can't express, such as Date or bigint) | ✗ JSON Schema conversion failed: The "bigint" schema cannot be converted to JSON Schema. |
| unknown / any | ✗ `x`: A field with no JSON type isn't portable (any, unknown, or a type JSON Schema can't express, such as Date or bigint) | ✗ `x`: A field with no JSON type isn't portable (any, unknown, or a type JSON Schema can't express, such as Date or bigint) | ✗ `x`: A field with no JSON type isn't portable (any, unknown, or a type JSON Schema can't express, such as Date or bigint) |
| numeric literals | ✗ `level`: Only string enums and literals are portable | ✗ `level`: Only string enums and literals are portable | ✗ `level`: Only string enums and literals are portable |
| default value | ✗ `greeting`: Default values aren't portable: the backend sends every value (other runtimes can't fill it) | ✗ The schema's input and output types differ (defaults, transforms or coercions). Data reaches the template as sent, so the schema must not change it | ✗ `greeting`: Default values aren't portable: the backend sends every value (other runtimes can't fill it) |
| transform | ✗ JSON Schema conversion failed: Transforms cannot be represented in JSON Schema | ✗ The schema's input and output types differ (defaults, transforms or coercions). Data reaches the template as sent, so the schema must not change it | ✗ JSON Schema conversion failed: The "transform" action cannot be converted to JSON Schema. |
| intersection | ✓ portable | ✓ portable | ✗ Intersections that don't merge into one object (allOf) aren't portable |
| recursive schema | ✗ Recursive or shared definitions ($defs) aren't portable | — | — |
| field name with a hyphen | ✗ `first-name`: The field name "first-name" isn't portable: use letters, digits and _ | ✗ `first-name`: The field name "first-name" isn't portable: use letters, digits and _ | ✗ `first-name`: The field name "first-name" isn't portable: use letters, digits and _ |
| root is not an object | ✗ The schema must be an object (z.object, type({…}), v.object) | ✗ The schema must be an object (z.object, type({…}), v.object) | ✗ The schema must be an object (z.object, type({…}), v.object) |
| custom refinement (allowed; runs in the TS validator only) | ✓ portable | ✓ portable | ✓ portable |
