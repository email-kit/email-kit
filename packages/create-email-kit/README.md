# create-email-kit

Sets up [email-kit](https://github.com/email-kit/email-kit) in an existing project: runs
`email-kit init` from `@email-kit/cli` in the folder you're in.

```sh
npm create email-kit            # asks before each change
npm create email-kit -- --yes   # accepts the defaults (CI)
```

It detects your package manager, TypeScript setup and framework (Next.js, Bun, a `tsc` build,
Node type stripping), adds a config and a welcome template, and compiles once.

> **1.0.** Stable for transactional email. Not yet: marketing email
> (unsubscribe links, multi-column layouts), testing in real email clients (classic Outlook
> especially), and the preview studio. See [what 1.0
> covers](https://github.com/email-kit/email-kit#status).

MIT licensed.
