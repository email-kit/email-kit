// ADR 0009: the email-kit skill for AI coding agents. It links to a copy of the docs the CLI
// ships, generated from docs/, and `init` and `email-kit agents` write it, with a section in each
// agent's instructions file.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, posix } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

import {
  bundledSkill,
  DOC_PAGES,
  localize,
  SITE,
  SITE_NOTE,
  skillForProject,
  skillState,
  stamp,
} from "../src/agents/skill.ts"
import { parseAgents } from "../src/agents/targets.ts"
import { AGENTS } from "../src/checks/catalogue/agents.ts"
import type { CheckContext, Finding } from "../src/checks/types.ts"
import type { Prompter } from "../src/init/index.ts"
import { run } from "../src/run.ts"
import { VERSION } from "../src/version.ts"

const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const DOCS = fileURLToPath(new URL("../docs/", import.meta.url))
const TMP = fileURLToPath(new URL(".tmp/agents-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

const BLOB = "https://github.com/email-kit/email-kit/blob/main"

/** Where a written skill's links go when the CLI is installed at the repository root. */
const ROOT_DOCS = "node_modules/@email-kit/cli/dist/docs"

/** A page of docs/guide or docs/reference on the site: `docs/guide/README.md` is `/guide`. */
const siteRoute = (file: string) => file.replace(/^docs\//, "").replace(/(\/README)?\.md$/, "")

/**
 * A doc page as the CLI ships it: links to the other shipped pages stay as they are, links to the
 * rest of the docs go to the site, and links to anything else in the repository to GitHub, since
 * the copy is read in a project's node_modules.
 */
function shipped(page: string): string {
  const from = `docs/${page}.md`
  let fence: string | null = null
  const lines = readFileSync(join(REPO, from), "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)
      if (marker) {
        if (fence === null) fence = marker[1] as string
        else if (marker[1]?.startsWith(fence)) fence = null
        return line
      }
      if (fence !== null) return line
      return line
        .split(/(`[^`]*`)/)
        .map((part, i) =>
          i % 2 === 1
            ? part
            : part.replace(/\]\(([^)\s]+)\)/g, (_, target: string) => {
                if (/^([a-z][a-z0-9+.-]*:|#)/i.test(target)) return `](${target})`
                const [path = "", hash] = target.split("#")
                const file = posix.normalize(posix.join(posix.dirname(from), path))
                const route = siteRoute(file)
                if (DOC_PAGES.includes(route)) return `](${target})`
                const href = /^docs\/(guide|reference)\//.test(file)
                  ? `${SITE}/${route}`
                  : `${BLOB}/${file}`
                return `](${href}${hash ? `#${hash}` : ""})`
              }),
        )
        .join("")
    })
  return [
    `<!-- Generated from ${from} for AI coding agents: run \`pnpm --filter @email-kit/cli test -u\` after changing the docs. -->`,
    "",
    ...lines,
  ].join("\n")
}

/** Every file under a folder, by `/`-separated relative path. */
const filesIn = (dir: string) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => posix.join(posix.relative(dir, entry.parentPath), entry.name))
    .sort()

describe("the docs the CLI ships for agents", () => {
  it("are the guide and reference pages the skill links to, generated from docs/", async () => {
    for (const page of DOC_PAGES) {
      await expect(shipped(page)).toMatchFileSnapshot(join(DOCS, `${page}.md`))
    }
    expect(filesIn(DOCS)).toEqual(DOC_PAGES.map((page) => `${page}.md`).sort())
  })

  it("link only to pages they have, the site, or GitHub", () => {
    for (const path of filesIn(DOCS)) {
      const text = readFileSync(join(DOCS, path), "utf8")
      for (const [, target] of text.matchAll(/\]\(((?!https?:|mailto:|#)[^)\s#]+)(#[^)\s]*)?\)/g)) {
        const file = posix.normalize(posix.join(posix.dirname(path), target as string))
        expect(existsSync(join(DOCS, file)), `${path} links to ${target}`).toBe(true)
      }
    }
  })
})

describe("skills/email-kit", () => {
  it("is SKILL.md alone, linking to pages on the site", () => {
    const skillMd = bundledSkill().get("SKILL.md") ?? ""
    expect([...bundledSkill().keys()]).toEqual(["SKILL.md"])
    expect(skillMd).toContain(SITE_NOTE)
    expect(skillMd).not.toMatch(/\]\((?!https:|#)/)
    const sitePages = new Set([...DOC_PAGES, "guide", "guide/getting-started", "guide/first-email"])
    for (const [, page] of skillMd.matchAll(/\]\(https:\/\/email-kit\.dev\/([^)#\s]*)/g)) {
      expect(sitePages.has(page as string), `SKILL.md links to ${page}`).toBe(true)
    }
  })

  it("links to the installed CLI's docs in the copy email-kit agents writes", () => {
    const local = localize(bundledSkill().get("SKILL.md") ?? "", `apps/web/${ROOT_DOCS}`)
    expect(local).toContain(
      `[the error reference](../../../apps/web/${ROOT_DOCS}/reference/errors.md)`,
    )
    expect(local).toContain(
      `[Components](../../../apps/web/${ROOT_DOCS}/guide/components.md#your-own-components)`,
    )
    expect(local).toContain(`From the repository root, it's in:\n\n    apps/web/${ROOT_DOCS}/\n`)
    expect(local).not.toContain(SITE_NOTE)
    // Pages the CLI doesn't ship stay on the site.
    expect(local).toContain(`(${SITE}/guide/getting-started)`)
    for (const page of DOC_PAGES) expect(local).not.toContain(`(${SITE}/${page})`)
  })

  it("has the frontmatter the Agent Skills format asks for", () => {
    const skillMd = bundledSkill().get("SKILL.md") ?? ""
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skillMd)?.[1] ?? ""
    expect(frontmatter).toMatch(/^name: email-kit$/m)
    const description = /^description: (.+)$/m.exec(frontmatter)?.[1] ?? ""
    expect(description.length).toBeGreaterThan(100)
    expect(description.length).toBeLessThanOrEqual(1024)
    expect(frontmatter).not.toMatch(/^metadata:/m)
  })

  it("records the version that wrote a copy at the end of the frontmatter", () => {
    expect(stamp("---\nname: email-kit\n---\n\n# Body\n", "1.2.3")).toBe(
      '---\nname: email-kit\nmetadata:\n  email-kit-version: "1.2.3"\n---\n\n# Body\n',
    )
  })
})

/** A temp project with a config, in a repository of its own unless `git` is false. */
function project(files: Record<string, string | object>, options: { git?: boolean } = {}): string {
  mkdirSync(TMP, { recursive: true })
  const dir = mkdtempSync(join(TMP, "project-"))
  if (options.git !== false) mkdirSync(join(dir, ".git"))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(
      join(dir, path),
      typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    )
  }
  return dir
}

const CONFIG =
  'import { defineConfig } from "@email-kit/core"\n\nexport default defineConfig({ importPath: "@/email-kit" })\n'

/** An app with email-kit set up: a package.json, a config and the email-kit folder. */
const app = (extra: Record<string, string | object> = {}) => ({
  "package.json": { name: "app", packageManager: "pnpm@10.0.0" },
  "email-kit.config.ts": CONFIG,
  "src/index.ts": "export {}\n",
  "src/email-kit/index.ts": 'export * from "./_generated"\n',
  ...extra,
})

/** A prompter that picks `agents` and answers every confirmation with `yes`. */
function answers(agents: readonly string[], yes = true) {
  const asked: string[] = []
  const prompter: Prompter = {
    confirm: async (message) => {
      asked.push(message)
      return yes
    },
    text: async (_message, initial) => initial,
    multiselect: async <Value extends string>(
      message: string,
      _options: readonly { value: Value }[],
      initial: readonly Value[],
    ) => {
      asked.push(`${message} [${initial.join(",")}]`)
      return agents as Value[]
    },
  }
  return { prompter, asked }
}

async function agents(dir: string, args: string[], prompter?: Prompter) {
  const out: string[] = []
  const err: string[] = []
  const code = await run(["agents", ...args], {
    cwd: dir,
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    ...(prompter && { prompter }),
  })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

const read = (dir: string, path: string) => readFileSync(join(dir, path), "utf8")

describe("email-kit agents", () => {
  it("writes the skill for Claude Code and the shared folder, and one AGENTS.md section", async () => {
    const dir = project(app())
    const { code, out } = await agents(dir, ["--agents", "claude,codex"])
    expect(code).toBe(0)
    for (const folder of [".agents/skills/email-kit", ".claude/skills/email-kit"]) {
      const skillMd = read(dir, `${folder}/SKILL.md`)
      expect(skillMd).toContain(`email-kit-version: "${VERSION}"`)
      expect(skillMd).toContain(`(../../../${ROOT_DOCS}/guide/templates.md)`)
      expect(readdirSync(join(dir, folder))).toEqual(["SKILL.md"])
    }
    expect(out).toContain(`Docs     ${ROOT_DOCS}/`)
    // No CLAUDE.md, so Claude Code reads AGENTS.md: creating CLAUDE.md would hide it.
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(false)
    expect(read(dir, "AGENTS.md")).toBe(
      [
        "<!-- email-kit:start -->",
        "## Emails (email-kit)",
        "",
        "The emails this project sends are email-kit templates in `src/email-kit/`, one folder per email. Before you add or change an email, its copy or translations, or the code that sends it, read the email-kit skill: `.agents/skills/email-kit/SKILL.md`.",
        "",
        "- `pnpm exec email-kit new <id>` adds an email. After each change, run `pnpm exec email-kit compile`, then `pnpm exec email-kit check`, and fix what they report.",
        "- Never edit `src/email-kit/_generated/`: it's compiled output.",
        "- The app imports the emails from `@/email-kit`, as `emails.<id>.render(data, { locale })`.",
        "<!-- email-kit:end -->",
        "",
      ].join("\n"),
    )
    expect(out).toContain("Set up the email-kit skill for Claude Code and Codex.")
  })

  it("adds a section to an existing CLAUDE.md, asking first, and keeps what's there", async () => {
    const dir = project(app({ "CLAUDE.md": "# House rules\n\nUse tabs.\n" }))
    const { prompter, asked } = answers(["claude"])
    expect((await agents(dir, [], prompter)).code).toBe(0)
    expect(asked).toEqual([
      "Which AI coding agents should learn to write email-kit emails? (none to skip) [claude]",
      "CLAUDE.md: add a section that points agents to the email-kit skill?",
    ])
    const claude = read(dir, "CLAUDE.md")
    expect(claude).toMatch(/^# House rules\n\nUse tabs\.\n\n<!-- email-kit:start -->\n/)
    expect(claude).toContain("read the email-kit skill: `.claude/skills/email-kit/SKILL.md`")
    expect(existsSync(join(dir, ".agents"))).toBe(false)
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(false)
  })

  it("keeps AGENTS.md on the shared skill when Claude Code is added later", async () => {
    const dir = project(app())
    await agents(dir, ["--agents", "codex", "--yes"])
    const before = read(dir, "AGENTS.md")
    const added = await agents(dir, ["--agents", "claude", "--yes"])
    expect(added.code).toBe(0)
    expect(read(dir, "AGENTS.md")).toBe(before)
    expect(before).toContain("read the email-kit skill: `.agents/skills/email-kit/SKILL.md`")
    expect(existsSync(join(dir, ".claude/skills/email-kit/SKILL.md"))).toBe(true)
    expect(added.out).not.toContain("Change, if you agree")
  })

  it("leaves an existing file alone when the change is declined", async () => {
    const dir = project(app({ "AGENTS.md": "# Agents\n" }))
    const { prompter } = answers(["codex"], false)
    await agents(dir, [], prompter)
    expect(read(dir, "AGENTS.md")).toBe("# Agents\n")
    expect(existsSync(join(dir, ".agents/skills/email-kit/SKILL.md"))).toBe(true)
  })

  it("finds the agents a repository uses, and is up to date when run again", async () => {
    const dir = project(app({ ".cursor/rules/style.mdc": "", "GEMINI.md": "# Gemini\n" }))
    const first = await agents(dir, ["--yes"])
    expect(first.out).toContain("Agents   Cursor and Gemini CLI")
    expect(read(dir, "GEMINI.md")).toMatch(/^# Gemini\n\n<!-- email-kit:start -->\n/)
    const agentsMd = read(dir, "AGENTS.md")
    // AGENTS.md now exists, which `--yes` takes as a sign of an agent that reads it.
    const again = await agents(dir, ["--yes"])
    expect(again.out).toContain("is up to date")
    expect(read(dir, "AGENTS.md")).toBe(agentsMd)
    expect(read(dir, "GEMINI.md").match(/email-kit:start/g)).toHaveLength(1)
  })

  it("updates an older copy and removes the files it no longer has", async () => {
    const dir = project(app())
    await agents(dir, ["--agents", "codex"])
    const skill = join(dir, ".agents/skills/email-kit")
    // An older version carried copies of the docs in references/.
    writeFileSync(
      join(skill, "SKILL.md"),
      skillForProject(ROOT_DOCS, "0.0.1").get("SKILL.md") ?? "",
    )
    mkdirSync(join(skill, "references"))
    writeFileSync(join(skill, "references/old.md"), "# Gone\n")
    expect(skillState(skill)).toEqual({ kind: "ours", version: "0.0.1", current: false })
    const { out } = await agents(dir, ["--agents", "codex"])
    expect(out).toContain("(update)")
    expect(existsSync(join(skill, "references"))).toBe(false)
    expect(skillState(skill)).toEqual({ kind: "ours", version: VERSION, current: true })
  })

  it("never writes into a skill folder that isn't email-kit's", async () => {
    const dir = project(app({ ".claude/skills/email-kit/SKILL.md": "---\nname: mine\n---\n" }))
    const { out } = await agents(dir, ["--agents", "claude"])
    expect(out).toContain(".claude/skills/email-kit/ is a folder email-kit didn't write")
    expect(read(dir, ".claude/skills/email-kit/SKILL.md")).toBe("---\nname: mine\n---\n")
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(false)
  })

  it("puts the files at the repository root in a monorepo, with a section per app", async () => {
    const root = project({
      "package.json": { name: "repo", private: true },
      "pnpm-lock.yaml": "",
      ...Object.fromEntries(
        Object.entries(app()).map(([path, content]) => [`apps/api/${path}`, content]),
      ),
    })
    const api = join(root, "apps/api")
    const { code, out } = await agents(api, ["--agents", "codex"])
    expect(code).toBe(0)
    expect(out).toContain("Where    the repository root, ../..")
    expect(existsSync(join(root, ".agents/skills/email-kit/SKILL.md"))).toBe(true)
    const section = read(root, "AGENTS.md")
    expect(section).toMatch(
      /^<!-- email-kit:start apps\/api -->\n## Emails in apps\/api \(email-kit\)\n/,
    )
    expect(section).toContain("templates in `apps/api/src/email-kit/`")
    expect(section).toContain("- Run email-kit commands in `apps/api`.")
    expect(section).toContain("Never edit `apps/api/src/email-kit/_generated/`")
    // No install yet: the skill links to where the app's own will be.
    expect(read(root, ".agents/skills/email-kit/SKILL.md")).toContain(
      `(../../../apps/api/${ROOT_DOCS}/reference/errors.md)`,
    )
  })

  it("links to the CLI where it's installed, such as hoisted to the root of a monorepo", async () => {
    const root = project({
      "package.json": { name: "repo", private: true },
      "node_modules/@email-kit/cli/package.json": { name: "@email-kit/cli" },
      ...Object.fromEntries(
        Object.entries(app()).map(([path, content]) => [`apps/api/${path}`, content]),
      ),
    })
    const web = project({ ...app(), "node_modules/@email-kit/cli/package.json": {} })
    await agents(join(root, "apps/api"), ["--agents", "codex"])
    await agents(web, ["--agents", "codex"])
    for (const dir of [root, web]) {
      expect(read(dir, ".agents/skills/email-kit/SKILL.md")).toContain(
        `(../../../${ROOT_DOCS}/reference/errors.md)`,
      )
    }
  })

  it("counts a copy linking to another app's CLI as current, and a site copy too", () => {
    const dir = project(app())
    const skill = join(dir, ".agents/skills/email-kit")
    mkdirSync(skill, { recursive: true })
    writeFileSync(
      join(skill, "SKILL.md"),
      skillForProject(`apps/other/${ROOT_DOCS}`).get("SKILL.md") ?? "",
    )
    expect(skillState(skill)).toEqual({ kind: "ours", version: VERSION, current: true })
    // As `npx skills add` or the zip leave it: no stamp, links to the site.
    writeFileSync(join(skill, "SKILL.md"), bundledSkill().get("SKILL.md") ?? "")
    expect(skillState(skill)).toEqual({ kind: "ours", version: undefined, current: true })
  })

  it("asks for --agents when --yes finds no agent", async () => {
    const dir = project(app())
    const { code, err } = await agents(dir, ["--yes"])
    expect(code).toBe(1)
    expect(err).toContain("Name them with --agents")
  })

  it("refuses an agent it doesn't know", async () => {
    const dir = project(app())
    const { code, err } = await agents(dir, ["--agents", "claude,clippy"])
    expect(code).toBe(1)
    expect(err).toContain('Unknown agent "clippy"')
    expect(parseAgents("all")).toHaveLength(8)
    expect(parseAgents("none")).toEqual([])
  })
})

describe("email-kit init", () => {
  async function init(dir: string, args: string[]) {
    const out: string[] = []
    const code = await run(["init", "--no-install", ...args], {
      cwd: dir,
      out: (t) => out.push(t),
      err: (t) => out.push(t),
    })
    return { code, out: out.join("\n") }
  }

  it("sets up the agents a repository shows with --yes", async () => {
    const dir = project({ "package.json": { name: "x" }, "src/index.ts": "" })
    mkdirSync(join(dir, ".claude"))
    const { code, out } = await init(dir, ["--yes"])
    expect(code).toBe(0)
    expect(out).toContain("Set up the email-kit skill for Claude Code.")
    expect(existsSync(join(dir, ".claude/skills/email-kit/SKILL.md"))).toBe(true)
    expect(read(dir, "AGENTS.md")).toContain("`.claude/skills/email-kit/SKILL.md`")
    expect(out).toContain("npx email-kit agents")
  })

  it("sets up none with --yes when the repository shows none, or with --no-agents", async () => {
    const none = project({ "package.json": { name: "x" }, "src/index.ts": "" })
    const declined = project({ "package.json": { name: "x" }, "src/index.ts": "", "AGENTS.md": "" })
    for (const [dir, args] of [
      [none, ["--yes"]],
      [declined, ["--yes", "--no-agents"]],
    ] as const) {
      expect((await init(dir, [...args])).code).toBe(0)
      expect(existsSync(join(dir, ".agents"))).toBe(false)
      expect(existsSync(join(dir, ".claude"))).toBe(false)
    }
  })
})

describe("agents.skill-outdated", () => {
  const [check] = AGENTS
  const findings = (skills: CheckContext["agentSkills"]) => {
    const found: string[] = []
    check?.run({ agentSkills: skills } as CheckContext, (problem: Partial<Finding>) =>
      found.push(problem.message ?? ""),
    )
    return found
  }

  it("warns about a copy that differs from this version's skill", () => {
    expect(check?.level).toBe("warn")
    expect(
      findings([
        { file: ".agents/skills/email-kit", version: VERSION, current: true },
        { file: ".claude/skills/email-kit", version: "0.0.1", current: false },
        { file: "../../.agents/skills/email-kit", version: undefined, current: false },
      ]),
    ).toEqual([
      `.claude/skills/email-kit is the skill from email-kit 0.0.1; this is ${VERSION}`,
      `../../.agents/skills/email-kit differs from the skill email-kit ${VERSION} ships`,
    ])
  })

  it("doesn't count the version alone as a difference", async () => {
    const dir = project(app())
    await agents(dir, ["--agents", "codex"])
    const skill = join(dir, ".agents/skills/email-kit")
    writeFileSync(
      join(skill, "SKILL.md"),
      skillForProject(ROOT_DOCS, "0.0.1").get("SKILL.md") ?? "",
    )
    expect(skillState(skill)).toEqual({ kind: "ours", version: "0.0.1", current: true })
  })
})
