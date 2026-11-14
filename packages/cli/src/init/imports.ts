import { posix } from "node:path"

import type { Project } from "./detect.ts"

/** How the app imports the emails. */
export type ImportStrategy =
  /**
   * A tsconfig alias, where paths work at runtime: Next.js, Bun and bundlers. `addPath` is set
   * when tsconfig needs a path for it; an `@/*` alias that already reaches the folder doesn't.
   */
  | { readonly kind: "alias"; readonly path: string; readonly addPath: boolean }
  /**
   * A package.json `imports` entry, `#email-kit`: the `.mjs` output for a tsc build, or the `.ts`
   * module for Node's type stripping.
   */
  | { readonly kind: "subpath"; readonly target: string; readonly module: "mjs" | "ts" }
  /** A relative path, when nothing else works. */
  | { readonly kind: "relative" }

/** The subpath import `init` adds to package.json. */
export const SUBPATH = "#email-kit"

/**
 * How the app should import the emails in `folder`: a tsconfig alias where paths work at runtime
 * (bundlers), using `@/*` when it already reaches the folder and adding one exact path otherwise;
 * a package.json subpath import (`#email-kit`) for tsc and Node, unless the project already has
 * one by that name; else a relative path.
 */
export function importStrategy(project: Project, folder: string): ImportStrategy {
  const imports = project.packageJson.imports as Record<string, unknown> | undefined
  if (project.host === "bundler" && project.tsconfig) {
    const target = project.tsconfig.json.compilerOptions?.paths?.["@/*"]?.[0]
    const covers =
      target !== undefined &&
      target.replace(/^\.\/?/, "").replace(/\/?\*$/, "") === project.codeRoot
    const name = folderName(folder)
    return covers && folder === posix.join(project.codeRoot, name)
      ? { kind: "alias", path: `@/${name}`, addPath: false }
      : { kind: "alias", path: "@/email-kit", addPath: true }
  }
  if ((project.host === "tsc" || project.host === "node-strip") && !imports?.[SUBPATH]) {
    return project.host === "tsc"
      ? { kind: "subpath", target: `./${folder}/compiled/index.mjs`, module: "mjs" }
      : { kind: "subpath", target: `./${folder}/index.ts`, module: "ts" }
  }
  return { kind: "relative" }
}

/** What the app writes after `from` to import the emails in `folder`. */
export function importPathOf(strategy: ImportStrategy, folder: string): string {
  if (strategy.kind === "alias") return strategy.path
  if (strategy.kind === "subpath") return SUBPATH
  return `./${folderName(folder)}`
}

/** The last segment of a folder path: `email-kit` for `src/email-kit`. */
export function folderName(folder: string): string {
  return folder.split("/").at(-1) as string
}
