// The generated module as `index.mjs` + `index.d.mts` (OUT-07, ADR 0004): oxc (through rolldown)
// strips the types and writes the declarations. The TS module already satisfies
// isolatedDeclarations, so both are mechanical. `.mjs` keeps it ESM in CommonJS packages too.

import { EmailKitError } from "@email-kit/core/internal"
import { isolatedDeclarationSync } from "rolldown/experimental"
import { transformSync } from "rolldown/utils"

export interface JavaScriptModule {
  readonly js: string
  readonly dts: string
}

export function toJavaScript(typescript: string, header: string): JavaScriptModule {
  const js = transformSync("index.ts", typescript, { lang: "ts" })
  const dts = isolatedDeclarationSync("index.ts", typescript)
  const errors = [...js.errors, ...dts.errors]
  if (errors.length > 0) {
    throw new EmailKitError(
      "invalid-output",
      `Bug: the generated module couldn't be converted to JavaScript: ${errors[0]?.message}`,
    )
  }
  // oxc drops the leading comments with the type-only declarations they precede.
  return { js: `${header}\n${js.code}`, dts: `${header}\n${dts.code}` }
}
