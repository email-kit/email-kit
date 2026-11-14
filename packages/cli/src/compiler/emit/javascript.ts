import { EmailKitError } from "@email-kit/core/internal"
import { isolatedDeclarationSync } from "rolldown/experimental"
import { transformSync } from "rolldown/utils"

/** The generated module as JavaScript, with its types beside it. */
export interface JavaScriptModule {
  /** `index.mjs`: the code, without types. */
  readonly js: string
  /** `index.d.mts`: the types, without the code. */
  readonly dts: string
}

/**
 * Converts the generated module to `index.mjs` and `index.d.mts`, for `module: "mjs"`. oxc, through
 * rolldown, strips the types and writes the declarations: the module already meets
 * `isolatedDeclarations`, so both steps are mechanical. `.mjs` keeps it ESM even in a CommonJS
 * package. The header is added back to both, since oxc drops it with the type-only declarations
 * it precedes.
 */
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
  return { js: `${header}\n${js.code}`, dts: `${header}\n${dts.code}` }
}
