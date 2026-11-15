# @email-kit/components

Email-safe components for [email-kit](https://github.com/email-kit/email-kit) templates, themed from
your design tokens (shadcn CSS or DTCG): `Text`, `Heading`, `Link`, `Button`, `Image`, `Divider`,
`Spacer`, `Section`, `List`, `KeyValue`, `Callout`, `OtpCode`, `DataTable`, `LineItems` and
`Footer`. The compiler centres every email in a fluid container of the theme's width.

> **Preview (0.1).** Usable for transactional email, and changing. Not yet: marketing email
> (unsubscribe links, multi-column layouts), testing in real email clients (classic Outlook
> especially), and the preview studio. See [what's in the
> preview](https://github.com/email-kit/email-kit#status).

They follow what email clients are known to support (tables for layout, cell padding instead of
margins, Outlook's line-height rule, dark-mode classes, right-to-left markup), and the checks
verify their output. They haven't been tested in real clients yet. MIT licensed.
