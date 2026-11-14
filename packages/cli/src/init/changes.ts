import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { VERSION } from "../version.ts"
import { dependenciesOf, type Project } from "./detect.ts"
import { type ImportStrategy, SUBPATH } from "./imports.ts"
import { insertProperty } from "./jsonc.ts"
import { schemaDependencies } from "./scaffold.ts"

/** A change `init` proposes to a file the project already has, applied only if the user agrees. */
export interface Change {
  /** What kind of change it is, so `init` knows which were applied. */
  readonly id: "dependencies" | "scripts" | "imports" | "jsx" | "paths" | "ignore"
  /** The file it changes, relative to the project. */
  readonly file: string
  /** What it does, for the plan and the question. */
  readonly summary: string
  apply(): void
}

/** The changes `init` proposes, and the prefix its scripts use, when it adds them. */
export interface PlannedChanges {
  readonly changes: readonly Change[]
  /** The prefix of the scripts, such as `email-kit` for `email-kit:compile`. */
  readonly scriptPrefix: string | undefined
}

/** The prefixes `init` tries for its scripts, in order. */
const SCRIPT_PREFIXES = ["email-kit", "emails", "ek"]

/**
 * The changes `init` makes to existing files:
 * - the devDependencies the project lacks, with the schema library it already uses (Zod when it
 *   has none);
 * - `compile` and `check` scripts, under the first prefix that's free or already email-kit's;
 * - the `#email-kit` subpath import, for an app that imports through one;
 * - tsconfig's `jsx`, and the `@/email-kit` path for an alias;
 * - lines marking the compiled folder as generated, in `.gitattributes` and the ignore files the
 *   project has.
 *
 * Each package.json edit keeps the file's indentation and final newline. Each tsconfig edit adds
 * one property in the file's own style, keeping its comments and every other line.
 */
export function plannedChanges(
  project: Project,
  folder: string,
  strategy: ImportStrategy,
): PlannedChanges {
  const changes: Change[] = []
  const editPackage = packageEditor(project.dir)
  const pkg = project.packageJson

  const installed = dependenciesOf(pkg)
  const versions: Record<string, string> = {
    "@email-kit/cli": `^${VERSION}`,
    "@email-kit/core": `^${VERSION}`,
    "@email-kit/components": `^${VERSION}`,
    ...schemaDependencies(project.schemaLibrary ?? "zod"),
  }
  const missing = Object.keys(versions).filter((name) => !(name in installed))
  if (missing.length > 0) {
    changes.push({
      id: "dependencies",
      file: "package.json",
      summary: `add the devDependencies ${missing.join(", ")}`,
      apply: editPackage((json) => {
        const dev = { ...(json.devDependencies as Record<string, string> | undefined) }
        for (const name of missing) dev[name] = versions[name] as string
        json.devDependencies = Object.fromEntries(
          Object.entries(dev).sort(([a], [b]) => a.localeCompare(b, "en")),
        )
      }),
    })
  }

  const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
  const wanted = (prefix: string): [string, string][] => [
    [`${prefix}:compile`, "email-kit compile"],
    [`${prefix}:check`, "email-kit check"],
  ]
  const scriptPrefix = SCRIPT_PREFIXES.find((prefix) =>
    wanted(prefix).every(([name, command]) => [undefined, command].includes(scripts[name])),
  )
  if (scriptPrefix && wanted(scriptPrefix).some(([name]) => !scripts[name])) {
    changes.push({
      id: "scripts",
      file: "package.json",
      summary: `add the scripts ${scriptPrefix}:compile and ${scriptPrefix}:check`,
      apply: editPackage((json) => {
        json.scripts = {
          ...(json.scripts as object | undefined),
          ...Object.fromEntries(wanted(scriptPrefix)),
        }
      }),
    })
  }

  if (strategy.kind === "subpath") {
    changes.push({
      id: "imports",
      file: "package.json",
      summary: `add "imports": { "${SUBPATH}": "${strategy.target}" } so the app imports ${SUBPATH}`,
      apply: editPackage((json) => {
        json.imports = { ...(json.imports as object | undefined), [SUBPATH]: strategy.target }
      }),
    })
  }

  const tsconfig = project.tsconfig
  if (tsconfig) {
    const editTsconfig = (path: string[], value: unknown) => () => {
      writeFileSync(tsconfig.file, insertProperty(readFileSync(tsconfig.file, "utf8"), path, value))
    }
    if (tsconfig.json.compilerOptions?.jsx === undefined) {
      changes.push({
        id: "jsx",
        file: "tsconfig.json",
        summary: 'add "jsx": "react-jsx" (templates name their JSX runtime themselves)',
        apply: editTsconfig(["compilerOptions", "jsx"], "react-jsx"),
      })
    }
    if (strategy.kind === "alias" && strategy.addPath) {
      changes.push({
        id: "paths",
        file: "tsconfig.json",
        summary: `add the path "@/email-kit": ["./${folder}"]`,
        apply: editTsconfig(["compilerOptions", "paths", "@/email-kit"], [`./${folder}`]),
      })
    }
  }

  const compiled = `${folder}/compiled`
  const lines: [file: string, line: string, summary: string, create: boolean][] = [
    [
      ".gitattributes",
      `${compiled}/** linguist-generated=true`,
      `mark ${compiled}/ as generated`,
      true,
    ],
    [".prettierignore", `${compiled}/`, `ignore ${compiled}/`, false],
    [".eslintignore", `${compiled}/`, `ignore ${compiled}/`, false],
  ]
  for (const [file, line, summary, create] of lines) {
    const change = appendLine(project.dir, file, line, summary, create)
    if (change) changes.push(change)
  }
  return { changes, scriptPrefix }
}

/**
 * Makes package.json edits: each reads the file when it's applied, changes the parsed JSON, and
 * writes it back with the file's own indentation and final newline.
 */
function packageEditor(dir: string) {
  return (edit: (json: Record<string, unknown>) => void) => () => {
    const file = join(dir, "package.json")
    const text = readFileSync(file, "utf8")
    const json = JSON.parse(text) as Record<string, unknown>
    edit(json)
    const indent = /^(\s+)"/m.exec(text)?.[1] ?? "  "
    writeFileSync(file, `${JSON.stringify(json, null, indent)}${text.endsWith("\n") ? "\n" : ""}`)
  }
}

/**
 * A change that adds a line to a file, unless the file has it already. A missing file is created
 * only when `create` is set: `.gitattributes`, but not the ignore files of tools the project
 * doesn't use.
 */
function appendLine(
  dir: string,
  file: string,
  line: string,
  summary: string,
  create: boolean,
): Change | undefined {
  const path = join(dir, file)
  const text = existsSync(path) ? readFileSync(path, "utf8") : undefined
  if ((text === undefined && !create) || text?.split("\n").includes(line)) return undefined
  const separator = text && !text.endsWith("\n") ? "\n" : ""
  return {
    id: "ignore",
    file,
    summary,
    apply: () => writeFileSync(path, `${text ?? ""}${separator}${line}\n`),
  }
}
