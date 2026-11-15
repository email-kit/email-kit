# Contributing to email-kit

## Setup

Requirements: Node 22.12 or later (24 recommended; see `.node-version`) and pnpm. The repo pins
pnpm 12.15.0 through `packageManager`, and pnpm downloads it automatically.

```sh
pnpm install
pnpm build          # build every package (Turborepo)
pnpm typecheck      # TypeScript, per package
pnpm test           # Vitest, per package
pnpm lint           # Biome (format + lint); `pnpm lint:fix` to apply fixes
pnpm check:packages # publint + are-the-types-wrong on the built packages
```

CI runs the same commands on Node 22, 24 and 26, on Linux, macOS and Windows.

## Layout

```
packages/
├── cli/                 @email-kit/cli: the `email-kit` command
├── core/                @email-kit/core: defineEmail, JSX runtime, types
├── components/          @email-kit/components: email-safe components
├── create-email-kit/    create-email-kit: `npm create email-kit`
├── runtime/             @email-kit/runtime: the renderer generated modules import
└── dialect/             @email-kit/dialect (private): mustache-core reference renderer
conformance/             language-neutral golden cases every runtime must pass
docs/
├── guide/               the user guide (published on the docs site)
├── reference/           checks, errors and the mustache-core spec (published on the docs site)
└── adr/                 architecture decision records
```

Every package is ESM-only, built with tsdown, and supports Node `>=22.12`. Shared tool versions
live in the `catalog:` section of `pnpm-workspace.yaml`.

## Changes

- Add a changeset for any change that affects a published package: `pnpm changeset`.
- All five public packages share one version (a Changesets `fixed` group).
- A change to compiled HTML output is at least a **minor** release with a changelog line. A
  change to which checks fail is minor and names the check id.
- A significant design decision gets an ADR in `docs/adr/` (see its README).

## Releasing

Releases are published from CI only, through npm trusted publishing (no tokens): each package
must have this repository, `.github/workflows/release.yml` and the `npm-publish` environment
configured as a trusted publisher on npmjs.com.

The five public packages (`@email-kit/core`, `@email-kit/components`, `@email-kit/cli`,
`@email-kit/runtime`, `create-email-kit`) are versioned together with Changesets (`fixed` in
`.changeset/config.json`).
`@email-kit/dialect` is private: it's bundled into the CLI and the generated modules.

### Current state: preview mode

The repository is in Changesets prerelease mode with the tag `preview` (`.changeset/pre.json`), and
the packages are versioned `0.1.0-preview.0`. Publishing in this mode puts them on the npm dist-tag
`preview`, not `latest`: people get them only by asking (`npm create email-kit@preview`,
`npm i -D @email-kit/cli@preview`).

### One-time setup (the maintainer)

1. Create the npm organisation `email-kit` (the `@email-kit` scope), and turn on 2FA for publishing.
2. Make sure `repository`, `homepage` and `bugs` in each `package.json`, and the docs links the CLI
   prints (`DOCS_URL`, `CHECKS_DOCS_URL`), point at the public repository.
3. `npm login` on the machine that publishes, or an automation token in CI.

### Publishing a preview

```sh
pnpm install
pnpm turbo run build typecheck test check:package --force   # everything green
pnpm release                                                # build, then changeset publish
git push --follow-tags
```

`changeset publish` publishes only versions that aren't on npm yet, with the `preview` tag, and
creates the git tags.

### The next preview

```sh
pnpm changeset            # describe the change; choose the bump
pnpm changeset version    # → 0.1.0-preview.1, CHANGELOG.md updated
```

### Leaving preview mode

When a version should become `latest`:

```sh
pnpm changeset pre exit
pnpm changeset version    # → 0.1.0
pnpm release
```

### Before any release: the smoke test

```sh
pnpm build
pnpm smoke            # a Node project that runs TypeScript directly
pnpm smoke --next     # a fresh create-next-app, built and served
```

`scripts/smoke-test.mjs` packs the five public packages as npm would publish them, points the
package names at the tarballs with `overrides`, runs `create-email-kit --yes`, renders the welcome email
from server code, then runs `check`, `new` and `compile`. `--keep` leaves the temporary folder.
CI runs it on Linux and Windows, and the release workflow runs it before publishing.

## Docs site

The user docs are published at [email-kit/docs-site](https://github.com/email-kit/docs-site), an
Astro Starlight site that copies `docs/guide/` and `docs/reference/` from this repository when it
builds. Write and change them here, in the same pull request as the code. A new page also needs an entry in the site's `scripts/sync-docs.mjs`. When
these files change on `main`, `.github/workflows/docs-site.yml` asks the site to rebuild; it needs
the `DOCS_SITE_TOKEN` secret (a fine-grained token for `email-kit/docs-site` with read and write
access to its contents).

## Supply-chain rules

- No `install`/`postinstall` scripts in our packages.
- Keep runtime dependencies at zero where possible; justify every new dependency in the PR.
- pnpm refuses versions published less than a day ago (`minimumReleaseAge`).
- GitHub Actions are pinned to commit SHAs.
