# Releasing

The four public packages (`@email-kit/core`, `@email-kit/components`, `@email-kit/cli`,
`create-email-kit`) are versioned together with Changesets (`fixed` in `.changeset/config.json`).
`@email-kit/dialect` is private: it's bundled into the CLI and the generated modules.

## Current state: preview mode

The repository is in Changesets prerelease mode with the tag `preview` (`.changeset/pre.json`), and
the packages are versioned `0.1.0-preview.0`. Publishing in this mode puts them on the npm dist-tag
`preview`, not `latest`: people get them only by asking (`npm create email-kit@preview`,
`npm i -D @email-kit/cli@preview`).

## One-time setup (the maintainer)

1. Create the npm organisation `email-kit` (the `@email-kit` scope), and turn on 2FA for publishing.
2. Make sure `repository`, `homepage` and `bugs` in each `package.json`, and the docs links the CLI
   prints (`DOCS_URL`, `CHECKS_DOCS_URL`), point at the public repository.
3. `npm login` on the machine that publishes, or an automation token in CI.

## Publishing a preview

```sh
pnpm install
pnpm turbo run build typecheck test check:package --force   # everything green
pnpm release                                                # build, then changeset publish
git push --follow-tags
```

`changeset publish` publishes only versions that aren't on npm yet, with the `preview` tag, and
creates the git tags.

## The next preview

```sh
pnpm changeset            # describe the change; choose the bump
pnpm changeset version    # → 0.1.0-preview.1, CHANGELOG.md updated
```

## Leaving preview mode

When a version should become `latest`:

```sh
pnpm changeset pre exit
pnpm changeset version    # → 0.1.0
pnpm release
```

## Before any release: the smoke test

Pack the four packages (`pnpm pack` in each), create a fresh `create-next-app`, point the
package names at the tarballs with `overrides` in its `pnpm-workspace.yaml`, run
`pnpm exec create-email-kit --yes`, then `next build` and a request to a route that renders an
email. `examples/nextjs/README.md` has the route.
