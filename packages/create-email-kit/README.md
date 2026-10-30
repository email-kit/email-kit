# create-email-kit

Sets up [email-kit](https://github.com/email-kit/email-kit) in an existing project: runs
`email-kit init` from `@email-kit/cli` in the folder you're in.

```sh
npm create email-kit            # asks before each change
npm create email-kit -- --yes   # accepts the defaults (CI)
```

It detects your package manager, TypeScript setup and framework (Next.js, Bun, a `tsc` build,
Node type stripping), adds a config and a welcome template, and compiles once.

> **Preview (0.1).** Usable for transactional email, and changing. Not yet: a page layout with a
> centred fixed-width container and footers (so no marketing email), testing in real email
> clients (classic Outlook especially), and the preview studio. See [what's in the
> preview](https://github.com/email-kit/email-kit#status).

MIT licensed.
