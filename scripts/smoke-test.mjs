//   node scripts/smoke-test.mjs          a Node project that runs TypeScript directly (fast)
//   --next                               a fresh create-next-app, built and served (slower)
//   --keep                               leave the temporary folder for a look around

import { execFileSync, spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const REPO = fileURLToPath(new URL("..", import.meta.url))
const PACKAGES = ["core", "components", "cli", "create-email-kit"]
const NEXT_VERSION = "16.4.2"
const next = process.argv.includes("--next")
const keep = process.argv.includes("--keep")

const work = mkdtempSync(join(tmpdir(), "email-kit-smoke-"))
const tarballs = join(work, "tarballs")
const app = join(work, "app")
const shell = process.platform === "win32"

function run(command, args, cwd, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`)
  return execFileSync(command, args, {
    cwd,
    shell,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
  })
}

function expect(condition, message) {
  if (!condition) throw new Error(`Smoke test failed: ${message}`)
  console.log(`✓ ${message}`)
}

try {
  mkdirSync(tarballs)
  const names = {}
  for (const dir of PACKAGES) {
    const manifest = JSON.parse(readFileSync(join(REPO, "packages", dir, "package.json"), "utf8"))
    run("pnpm", ["pack", "--pack-destination", tarballs], join(REPO, "packages", dir), {
      capture: true,
    })
    const file = `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`
    names[manifest.name] = `file:${join(tarballs, file).replaceAll("\\", "/")}`
  }

  if (next) {
    run(
      "pnpm",
      [
        "dlx",
        `create-next-app@${NEXT_VERSION}`,
        "app",
        "--ts",
        "--app",
        "--src-dir",
        "--no-tailwind",
        "--no-eslint",
        "--import-alias",
        "@/*",
        "--use-pnpm",
        "--yes",
        "--disable-git",
      ],
      work,
    )
  } else {
    mkdirSync(join(app, "src"), { recursive: true })
    writeFileSync(
      join(app, "package.json"),
      `${JSON.stringify(
        {
          name: "smoke-app",
          private: true,
          type: "module",
          scripts: { start: "node src/send.ts" },
        },
        null,
        2,
      )}\n`,
    )
    writeFileSync(join(app, "src/send.ts"), "// Replaced once email-kit is set up.\n")
  }
  const overrides = Object.entries(names)
    .map(([name, spec]) => `  "${name}": "${spec}"`)
    .join("\n")
  writeFileSync(
    join(app, "pnpm-workspace.yaml"),
    `${next ? readFileSync(join(app, "pnpm-workspace.yaml"), "utf8") : ""}\noverrides:\n${overrides}\n`,
  )

  run("pnpm", ["add", "-D", `create-email-kit@${names["create-email-kit"]}`], app)
  run("pnpm", ["exec", "create-email-kit", "--yes"], app)
  const manifest = JSON.parse(readFileSync(join(app, "package.json"), "utf8"))
  const version = JSON.parse(readFileSync(join(REPO, "packages/cli/package.json"), "utf8")).version
  expect(
    manifest.devDependencies["@email-kit/cli"] === `^${version}`,
    `init added @email-kit/cli ^${version}`,
  )
  if (next) {
    const route = join(app, "src/app/api/email/welcome")
    mkdirSync(route, { recursive: true })
    writeFileSync(
      join(route, "route.ts"),
      `import { emails } from "@/email-kit"
      export async function GET() {
        const email = emails.welcome.render({ name: "Grace", startUrl: "https://shop.example/start" })
        return new Response(email.html, { headers: { "content-type": "text/html; charset=utf-8" } })
      }`,
    )
    run("pnpm", ["build"], app)
    const html = await serve(app, "/api/email/welcome")
    expect(html.includes("Welcome, Grace!"), "a Next.js route renders the welcome email")
  } else {
    writeFileSync(
      join(app, "src/send.ts"),
      `import { emails } from "#email-kit"
      const email = emails.welcome.render({ name: "Grace", startUrl: "https://shop.example/start" })
      console.log(JSON.stringify({ subject: email.subject, html: email.html, text: email.text }))`,
    )
    const output = run("node", ["src/send.ts"], app, { capture: true })
    const email = JSON.parse(output.trim().split("\n").at(-1))
    expect(email.html.includes("Welcome, Grace!"), "Node renders the welcome email's HTML")
    expect(email.text.includes("https://shop.example/start"), "and its text part")
  }

  run("pnpm", ["exec", "email-kit", "check"], app)
  expect(true, "email-kit check passes")
  run("pnpm", ["exec", "email-kit", "new", "password-reset"], app)
  run("pnpm", ["exec", "email-kit", "compile"], app)
  run("pnpm", ["exec", "email-kit", "check"], app)
  expect(true, "a template from email-kit new compiles and passes check")
  console.log(`\nSmoke test passed (${next ? "Next.js" : "Node"}).`)
} finally {
  if (keep) console.log(`\nKept ${work}`)
  else rmSync(work, { recursive: true, force: true })
}

async function serve(cwd, path) {
  const port = 14232 + Math.floor(Math.random() * 90)
  const server = spawn("pnpm", ["exec", "next", "start", "--port", String(port)], {
    cwd,
    shell,
    stdio: "ignore",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  })
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const response = await fetch(`http://localhost:${port}${path}`)
        if (response.ok) return await response.text()
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`next start didn't answer on port ${port}`)
  } finally {
    server.kill()
  }
}
