import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { isDirectory, relativePath, toPosix } from "../paths.ts"
import { VERSION } from "../version.ts"

/** The skill's name, and its folder's name in `.agents/skills/` and `.claude/skills/`. */
export const SKILL_NAME = "email-kit"

/** A skill's files, by `/`-separated path relative to its folder. */
export type SkillFiles = ReadonlyMap<string, string>

/**
 * The documentation pages the CLI ships for agents, in `dist/docs/`, by their path on the site and
 * under `docs/` in the repository. The skill links to them instead of carrying copies, so a project
 * holds only `SKILL.md` and the pages always match the installed version.
 */
export const DOC_PAGES: readonly string[] = [
  ...["templates", "components", "messages", "theme", "checks-and-ci", "sending", "formatting"].map(
    (page) => `guide/${page}`,
  ),
  ...["cli", "configuration", "checks", "errors", "mustache-core"].map(
    (page) => `reference/${page}`,
  ),
]

/** The documentation site, which the skill in the repository links to. */
export const SITE = "https://email-kit.dev"

/** Where the CLI's docs are inside its package. */
const PACKAGE_DOCS = "node_modules/@email-kit/cli/dist/docs"

/**
 * The paragraph of the repository's `SKILL.md` that says where its links go. The copy `email-kit
 * agents` writes says {@link localNote} instead.
 */
export const SITE_NOTE = `Read the page the task needs. Each is a page of the documentation at ${SITE}, which
describes the latest version; ${SITE}/llms-full.txt has all of it in one file. When
the project has email-kit installed, the same pages for its version are in
\`${PACKAGE_DOCS}/\`, such as \`reference/errors.md\`: read those instead.`

/** The same paragraph, in a copy whose links go to the installed CLI's docs in `docs`. */
const localNote = (docs: string) =>
  [
    "Read the page the task needs. The links go to the documentation of the installed email-kit",
    "version, which comes with the CLI. From the repository root, it's in:",
    "",
    `    ${docs}/`,
    "",
    `If that folder isn't there (before an install), read the same page at ${SITE}, such as`,
    `${SITE}/reference/errors for \`reference/errors.md\`, or all of it at`,
    `${SITE}/llms-full.txt.`,
  ].join("\n")

/**
 * How a link in a skill folder reaches the repository root. Both `.agents/skills/email-kit/` and
 * `.claude/skills/email-kit/` are three folders down, so their copies are the same.
 */
const TO_ROOT = "../../../"

/**
 * The folder of the skill this CLI ships: `dist/skill/email-kit/` in the published package, which
 * the build copies from the repository's `skills/email-kit/`, or that folder itself when the CLI
 * runs from its sources.
 */
function bundledSkillDir(): string {
  const candidates = [
    new URL("./skill/email-kit/", import.meta.url),
    new URL("../../../../skills/email-kit/", import.meta.url),
  ]
  for (const url of candidates) {
    const dir = fileURLToPath(url)
    if (existsSync(join(dir, "SKILL.md"))) return dir
  }
  throw new Error("This copy of @email-kit/cli has no email-kit skill in it. Reinstall it.")
}

/** Every file in a folder, by `/`-separated relative path, skipping names that start with `.`. */
function readTree(dir: string): Map<string, string> {
  const files = new Map<string, string>()
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const path = toPosix(relative(dir, join(entry.parentPath, entry.name)))
    if (path.split("/").some((part) => part.startsWith("."))) continue
    files.set(path, readFileSync(join(dir, path), "utf8"))
  }
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)))
}

let bundled: SkillFiles | undefined

/** The skill's files as this CLI ships them, with their links to the site. */
export function bundledSkill(): SkillFiles {
  bundled ??= readTree(bundledSkillDir())
  return bundled
}

/** The line that records which version of email-kit wrote a copy of the skill. */
const STAMP = /\nmetadata:\n {2}email-kit-version: "([^"\n]*)"/

/**
 * `SKILL.md` with the version that writes it as `metadata.email-kit-version`, at the end of the
 * frontmatter, so `check` and `email-kit agents` can tell which version a copy came from.
 */
export function stamp(skillMd: string, version: string): string {
  const end = skillMd.indexOf("\n---", 3)
  return `${skillMd.slice(0, end)}\nmetadata:\n  email-kit-version: "${version}"${skillMd.slice(end)}`
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** A link to one of {@link DOC_PAGES} on the site: the page, and an optional `#` part. */
const SITE_LINK = new RegExp(
  `\\]\\(${escapeRegExp(SITE)}/(${DOC_PAGES.map(escapeRegExp).join("|")})(#[^)\\s]*)?\\)`,
  "g",
)

/**
 * `SKILL.md` with its links to the shipped pages going to the installed CLI's copy instead, in
 * `docs`, relative to the repository root. Links to other pages stay on the site.
 */
export function localize(skillMd: string, docs: string): string {
  return skillMd
    .replace(SITE_LINK, (_, page: string, hash = "") => `](${TO_ROOT}${docs}/${page}.md${hash})`)
    .replace(SITE_NOTE, () => localNote(docs))
}

/**
 * The installed CLI's docs, relative to the repository root `root`: the nearest
 * `node_modules/@email-kit/cli` from the project's folder up to the root, as npm, pnpm and Yarn
 * link it, or the project's own when there's none yet, as before an install.
 */
export function docsFolder(root: string, project: string): string {
  for (let at = project; ; at = dirname(at)) {
    if (existsSync(join(at, "node_modules/@email-kit/cli/package.json"))) {
      return toPosix(join(relativePath(root, at), PACKAGE_DOCS))
    }
    if (at === root || dirname(at) === at) break
  }
  return toPosix(join(relativePath(root, project), PACKAGE_DOCS))
}

/** The skill's files as `email-kit agents` writes them, linking to the docs in `docs`. */
export function skillForProject(docs: string, version: string = VERSION): SkillFiles {
  const files = new Map(bundledSkill())
  files.set("SKILL.md", stamp(localize(files.get("SKILL.md") ?? "", docs), version))
  return files
}

/** What's in a project's skill folder. */
export type SkillState =
  /** There's no folder. */
  | { readonly kind: "missing" }
  /** A folder that isn't email-kit's skill: never written to. */
  | { readonly kind: "foreign" }
  /** email-kit's skill, written by `version` (`undefined` when another tool copied it). */
  | {
      readonly kind: "ours"
      readonly version: string | undefined
      /**
       * Whether its content matches this CLI's skill, whichever version is recorded and wherever
       * its links go, so one app of a monorepo doesn't count another's copy as different.
       */
      readonly current: boolean
    }

/** Whether a `SKILL.md` is email-kit's: its frontmatter names the skill `email-kit`. */
function isOurs(skillMd: string): boolean {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skillMd.replaceAll("\r\n", "\n"))?.[1] ?? ""
  return /^name:\s*["']?email-kit["']?\s*$/m.test(frontmatter)
}

/** The skill files with their version stamp taken out, so copies compare by content. */
const unstamped = (files: SkillFiles) =>
  JSON.stringify(
    [...files].map(([path, text]) => [path, path === "SKILL.md" ? text.replace(STAMP, "") : text]),
  )

/** The docs folder a written copy's links go to, or `undefined` for one that links to the site. */
const LINKED_DOCS = new RegExp(
  `\\]\\(${escapeRegExp(TO_ROOT)}([^)\\s]*?${escapeRegExp(PACKAGE_DOCS)})/`,
)

/** What's in the skill folder `dir`, such as `<repo>/.agents/skills/email-kit`. */
export function skillState(dir: string): SkillState {
  if (!existsSync(dir)) return { kind: "missing" }
  const skillMd = join(dir, "SKILL.md")
  if (!isDirectory(dir) || !existsSync(skillMd)) return { kind: "foreign" }
  const text = readFileSync(skillMd, "utf8")
  if (!isOurs(text)) return { kind: "foreign" }
  const docs = LINKED_DOCS.exec(text)?.[1]
  const expected = docs === undefined ? bundledSkill() : skillForProject(docs)
  return {
    kind: "ours",
    version: STAMP.exec(text)?.[1],
    current: unstamped(readTree(dir)) === unstamped(expected),
  }
}

/** Whether the skill folder `dir` holds exactly `files`. */
export function hasExactly(dir: string, files: SkillFiles): boolean {
  return JSON.stringify([...readTree(dir)]) === JSON.stringify([...files])
}

/**
 * Writes the skill into `dir`, which is missing or email-kit's own, and removes the files an older
 * version had that this one doesn't.
 */
export function writeSkill(dir: string, files: SkillFiles): void {
  if (existsSync(dir)) {
    for (const path of readTree(dir).keys()) if (!files.has(path)) rmSync(join(dir, path))
    removeEmptyFolders(dir)
  }
  for (const [path, text] of files) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
}

/** Removes the folders under `dir` that are left empty, such as an older version's `references/`. */
function removeEmptyFolders(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const folder = join(dir, entry.name)
    removeEmptyFolders(folder)
    if (readdirSync(folder).length === 0) rmSync(folder, { recursive: true })
  }
}
