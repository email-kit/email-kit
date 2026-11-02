# Release readiness: the first npm version

A review of what stands between the repository and a first public version on npm, as of
2026-10-30. The packages are versioned `0.1.0-preview.0` and a dry-run publish includes exactly the
four public packages, so packaging itself is ready. What follows is everything else, ordered by
what blocks a release. Steps for publishing are in [releasing.md](releasing.md).

Owner: **maintainer** means a decision or an account only the maintainer can make; **code** means
work in this repository.

## Status (2026-10-30)

The code items are done; what remains needs the maintainer.

| # | Item | Status |
|---|---|---|
| 1 | Public repository, CI | **Maintainer.** CI is switched back on for pushes and pull requests and gains a smoke-test job (Linux and Windows); the package URLs wait for the repository's address |
| 2 | Windows paths | **Done.** Paths in findings, reporters, the config and imports always use `/` (`src/paths.ts`); `init` joins project paths with `posix.join`; installs run through a shell on Windows. Unverified until CI runs on Windows |
| 3 | Page container | **Done in code.** Every email is centred in a `max-width` div of the theme's `layout.container` width inside a same-width MSO ghost table; `layout.ghost-table` checks it. ADR 0001 is still the maintainer's to accept |
| 4 | Real email clients | **Maintainer** |
| 5 | User guide | **Done:** [guide/](guide/README.md) |
| 6 | `Footer` | **Done.** Reason, sender, address and links in muted type under a hairline; used by the welcome template `init` writes and the playground |
| 7 | Link checks | **Done:** `link.dangerous-schemes`, `link.url-fields` |
| 8 | Accessibility checks | **Done:** `a11y.one-h1`, `a11y.link-text`, `a11y.font-size`, `a11y.viewport` |
| 9 | Decisions (Q5, ADRs 0002, 0006) | **Maintainer** |
| 10 | Smoke test | **Done.** `pnpm smoke` (Node) and `pnpm smoke --next`; in CI and in the release workflow |

The smoke test found one more bug, now fixed: in CI (`CI=1`), pnpm and Yarn freeze the lockfile,
so `create-email-kit --yes` couldn't install what it had just added. `init` now installs with
`--no-frozen-lockfile` (pnpm) and `YARN_ENABLE_IMMUTABLE_INSTALLS=false` (Yarn).

Writing and testing the guide found more, also fixed:
- `output.module-matches` failed on any `.mjs` module with a non-breaking space (from `Spacer`
  or `Divider`): oxc writes `\xA0`, which JSON can't parse.
- A template from `email-kit new` failed `check` (too little copy, no preheader), and
  `text.preheader-first` warned on preheaders long enough to wrap in the text part.
- Docs and READMEs promising what doesn't exist: allow-listed hosts for `url` fields, a
  `copy.receipt.reconciles` check, the studio, a `dev` command, edge runtimes; and the install
  commands now carry the `@preview` tag. `font()` is exported, as three check fixes recommend.

Left open for after the preview, and done since (2026-11-02):
- `init` and `new` write Valibot or ArkType templates for projects that use them, and add
  `@valibot/to-json-schema` for Valibot.
- `@email-kit/core` declares its metadata key on ArkType's `ArkEnv`, so `.configure(secret)`
  type-checks without a declaration.
- `siteUrl`, `helpUrl` and `privacyUrl` are held to https and `supportEmail` to an email address,
  in the config and in `createEmails()` (`invalid-context`).
- `purpose` is required (`legal.purpose-declared`), and `legal.reason`, `legal.sender-identity`
  and `legal.postal-address` check the footer (111 of 175 checks).
- Found on the way: the plural test required Node's CLDR version to equal cldr-core's, which fails
  on Node 22.23 (CLDR 48); it now compares the rules on any Node.

The review as written, before the work:

## Blockers: must be fixed before publishing

| # | Issue | Evidence | Owner |
|---|---|---|---|
| 1 | **No public repository, so CI has never run.** `ci.yml` has a Linux, macOS and Windows × Node 22, 24 and 26 matrix, but everything has only run on macOS with Node 24. Every package's `repository`, `homepage` and `bugs`, and every docs link the CLI prints, point at `github.com/email-kit/email-kit`, which doesn't exist. The release workflow (trusted publishing with provenance) needs the repository too. | `.github/workflows/ci.yml`, `release.yml`; `repository` in each `package.json` | Maintainer: create the repository. Code: update the URLs |
| 2 | **Known Windows bugs.** `init` splits paths built with `path.join` on `/`, so it gets the folder name wrong on Windows. Paths in findings, printed output and the generated config's `root` come from `path.relative()` and would contain `\`. | `split("/")` in `src/init/index.ts` and `src/init/new.ts`; `relative()` output used directly in about nine files under `packages/cli/src` | Code |
| 3 | **No page container.** Content is 100% wide, so in desktop Gmail or Outlook a line of text runs across the whole window. Research 01 §10 makes the centred hybrid container (a 600px `max-width`, plus a ghost table for classic Outlook) a MUST. It is held back only by ADR 0001 ("own tables vs MJML"), but all fourteen components are already built on our own tables, so in practice that decision is made. | `docs/research/01-email-client-rendering.md` §10; `docs/adr/README.md` | Maintainer: accept ADR 0001 as "own tables". Code: build `Container`/`EmailRoot` |
| 4 | **Never tested in a real email client** (P0-04, open since phase 0). For an email tool this is the credibility test. A preview needs at least the playground emails checked in Gmail (web and phone), Apple Mail and Outlook.com, plus classic Outlook on Windows if available. | `docs/backlog.md` P0-04 | Maintainer: send the emails and look. Code: fix what turns up |
| 5 | **No user documentation.** `docs/` holds the PRD, research, ADRs and specs: material for building email-kit, not for using it. A first version needs a guide: installing, writing templates, the components and their props, config options, calling `render()` from a server, deploying. | `docs/` | Code |

## Should be fixed before or with the first version

| # | Issue | Why |
|---|---|---|
| 6 | **A simple `Footer`**, built from the platform values that already exist (`legalName`, `postalAddress`, `helpUrl`, `privacyUrl`) | Research 05 makes a footer with sender identity, "why you got this" and a help link a MUST for transactional mail; research 03 has the legal basis. Without it every user hand-builds one. |
| 7 | **Basic link security checks:** `link.dangerous-schemes` (`javascript:`, `data:`) and `link.url-fields` | Security, and cheap. Data fields marked `url` must already be `https`, but a literal `href` in a template isn't checked. |
| 8 | **The core accessibility checks:** `a11y.one-h1`, `a11y.link-text`, `a11y.font-size`, `a11y.viewport` | These catch the mistakes users actually make. The rest of the catalogue can follow. |
| 9 | **Open decisions:** the runtime data validator on by default (PRD Q5); accepting ADRs 0002 and 0006 | They decide behaviour people will depend on from the first version. |
| 10 | **The packed-tarball smoke test as a script and a CI job** | It is the only test of packaging end to end, and today it is a manual recipe in `releasing.md`. |

## Can wait until after the first version

- The preview studio (`email-kit dev`). The READMEs already say it isn't there yet.
- The remaining checks: 111 of the 175 phase-1 checks are done.
- Marketing email: unsubscribe links and the legal slots.
- Workspace `exports`, ADR 0004's option B, Valibot and ArkType welcome templates, CJK font stacks.

## Already done

- Third-party notices in `@email-kit/cli` (Unicode CLDR, shadcn/ui) and a CLDR attribution in
  generated modules.
- READMEs that state what the preview does and doesn't do.
- Changesets prerelease mode (tag `preview`), packages at `0.1.0-preview.0`; the CLI reads its
  version from `package.json`; the components' peer range on core is `^`.
- Smoke-tested from packed tarballs in a fresh Next.js 16.4.2 app: `create-email-kit --yes` with a
  real install, `next build`, a route that renders an email, `check`, `new`.
- All five package names are free on npm (checked 2026-10-30). Whether the npm organisation
  `email-kit` is free couldn't be checked without logging in.

## Suggested order

1. **Maintainer:** create the GitHub repository and the npm organisation `email-kit`; decide ADR
   0001 (own tables) and PRD Q5.
2. **Code:** the Windows fixes; `Container`/`EmailRoot` and `Footer`; the link and accessibility
   checks; the smoke-test script and CI job.
3. **CI runs for the first time** on the public repository; fix what Windows and Node 22 and 26
   turn up.
4. **Maintainer:** test in real email clients. **Code:** fix what turns up.
5. **Code:** the user guide.
6. **Publish** `0.1.0-preview.0`, or `0.1.0` if the client testing goes well.

Items that need no decision can start straight away: the Windows fixes, the smoke-test script, and
the link and accessibility checks.
