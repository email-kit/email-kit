# Reserving names and setting up publishing (backlog P0-02)

These steps need the maintainer's own npm and GitHub accounts, so a person runs them once. The
repo already contains everything they publish.

**Already done (2026-10-27):** npm org `@email-kit` and GitHub org `email-kit` created.

## 1. Push this repo to the org

```sh
gh repo create email-kit/email-kit --public --source . --remote origin --push
```

Then, in the repository settings:
- protect `main`: require pull requests, the **CI** checks and a CODEOWNERS review;
- create the environment **`npm-publish`** with required reviewers (the release workflow uses it);
- turn on **private vulnerability reporting**.

## 2. Create the registry repo (used in phase 2)

```sh
gh repo create email-kit/registry --public --description "email-kit shadcn-compatible registry"
```

## 3. Publish the placeholder packages (first publish only)

npm can't configure a trusted publisher for a package that doesn't exist yet, so the first
`0.0.0` placeholder of each package is published by hand. Use an account with 2FA.

```sh
npm login
pnpm install && pnpm build && pnpm check:packages
for p in core components cli create-email-kit; do
  (cd packages/$p && npm publish --access public)
done
```

Check:
- `npm view @email-kit/cli version` shows `0.0.0`;
- `npm view create-email-kit version` shows `0.0.0`;
- `npx create-email-kit` prints the placeholder message.

## 4. Configure trusted publishing (every later release)

For each of the 4 packages on npmjs.com, open **Settings → Trusted publishing → GitHub Actions**
and enter:

| Field | Value |
|---|---|
| Organization or user | `email-kit` |
| Repository | `email-kit` |
| Workflow filename | `release.yml` |
| Environment | `npm-publish` |

Then:
- under **Settings → Publishing access**, choose "Require two-factor authentication and disallow
  tokens";
- don't create any npm automation tokens. CI publishes through OIDC only.

## 5. Verify with the first CI release

Merge a PR containing a changeset. The release workflow opens a "Version packages" PR; merging
that publishes through OIDC with provenance.

> **To verify on the first run:** that `changeset publish` (which calls `pnpm publish`) completes
> through OIDC. If pnpm doesn't pick up the OIDC token, change the workflow's publish step to run
> `npm publish --provenance` in each package. npm ≥ 11.5.1 supports OIDC natively, and the
> workflow already installs the latest npm.
