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
└── dialect/             @email-kit/dialect (private): mustache-core reference renderer
conformance/             language-neutral golden cases every runtime must pass
docs/                    PRD, backlog, research, ADRs, specs
```

Every package is ESM-only, built with tsdown, and supports Node `>=22.12`. Shared tool versions
live in the `catalog:` section of `pnpm-workspace.yaml`.

## Changes and releases

- Add a changeset for any change that affects a published package: `pnpm changeset`.
- All four packages share one version (a Changesets `fixed` group).
- A change to compiled HTML output is at least a **minor** release with a changelog line. A
  change to which checks fail is minor and names the check id (PRD PKG-09).
- Releases are published from CI only, through npm trusted publishing (no tokens). See
  [docs/setup/reserve-names.md](docs/setup/reserve-names.md).

## Supply-chain rules

- No `install`/`postinstall` scripts in our packages.
- Keep runtime dependencies at zero where possible; justify every new dependency in the PR.
- pnpm refuses versions published less than a day ago (`minimumReleaseAge`).
- GitHub Actions are pinned to commit SHAs.
