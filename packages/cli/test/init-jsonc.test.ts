// init's tsconfig edits (INIT-04): one property added, in the file's style; nothing else moves.

import { parse } from "jsonc-parser"
import { describe, expect, it } from "vitest"

import { insertProperty } from "../src/init/jsonc.ts"

const add = (text: string) =>
  insertProperty(text, ["compilerOptions", "paths", "@/email-kit"], ["./email-kit"])

describe("insertProperty", () => {
  it.each([
    [
      "a multi-line object: on its own line, with the comment and the other entry untouched",
      '{\n  "compilerOptions": {\n    "strict": true, // keep me\n    "paths": {\n      "@/lib/*": ["./lib/*"] // and me\n    }\n  }\n}\n',
      '{\n  "compilerOptions": {\n    "strict": true, // keep me\n    "paths": {\n      "@/lib/*": ["./lib/*"], // and me\n      "@/email-kit": ["./email-kit"]\n    }\n  }\n}\n',
    ],
    [
      "a one-line object: inline",
      '{ "compilerOptions": { "paths": { "@/lib/*": ["./lib/*"] } } }',
      '{ "compilerOptions": { "paths": { "@/lib/*": ["./lib/*"], "@/email-kit": ["./email-kit"] } } }',
    ],
    [
      "an empty object",
      '{ "compilerOptions": {} }',
      '{ "compilerOptions": { "paths": { "@/email-kit": ["./email-kit"] } } }',
    ],
    [
      "trailing commas stay trailing",
      '{\n  "compilerOptions": {\n    "strict": true, // trailing\n  },\n}\n',
      '{\n  "compilerOptions": {\n    "strict": true, // trailing\n    "paths": { "@/email-kit": ["./email-kit"] },\n  },\n}\n',
    ],
    [
      "missing parents are created",
      '{\n  "include": ["src"]\n}\n',
      '{\n  "include": ["src"],\n  "compilerOptions": { "paths": { "@/email-kit": ["./email-kit"] } }\n}\n',
    ],
  ])("%s", (_, before, after) => {
    expect(add(before)).toBe(after)
    expect(parse(add(before)).compilerOptions.paths["@/email-kit"]).toEqual(["./email-kit"])
  })
})
