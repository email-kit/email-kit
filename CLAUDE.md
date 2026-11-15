# CLAUDE.md

## ⚠️ GitHub Actions is DISABLED (since 2026-11-16)

Actions was turned off on **both** org repos on 2026-11-16 to avoid paid usage:

- `email-kit/email-kit` (this repo)
- `email-kit/docs-site`

The org had used 1,801 of its 2,000 free minutes for the billing cycle.
Free minutes reset on **2026-12-01**.

While it is off, no workflow runs: no CI on PRs, no scheduled jobs, and
no docs-site deploy. The workflow files in `.github/workflows/` are unchanged.

### Re-enable

```bash
gh api -X PUT repos/email-kit/email-kit/actions/permissions -F enabled=true
gh api -X PUT repos/email-kit/docs-site/actions/permissions -F enabled=true

# verify (expect "enabled": true)
gh api repos/email-kit/email-kit/actions/permissions
gh api repos/email-kit/docs-site/actions/permissions
```

Or in the browser: each repo → Settings → Actions → General → "Allow all actions".

To disable again, run the same commands with `enabled=false`.

Once Actions is back on, delete this section.
