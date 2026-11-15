# @email-kit/core

What templates are written with in [email-kit](https://github.com/email-kit/email-kit):
`defineEmail`, the JSX runtime, `If`/`Each`/`Unless`, field markers (`url`, `secret`,
`formatted`), `defineConfig` and `defineCheck`.

> **Preview (0.1).** Usable for transactional email, and changing. Not yet: marketing email
> (unsubscribe links, multi-column layouts), testing in real email clients (classic Outlook
> especially), and the preview studio. See [what's in the
> preview](https://github.com/email-kit/email-kit#status).

```tsx
/** @jsxImportSource @email-kit/core */
import { Button, Heading, Text } from "@email-kit/components"
import { defineEmail, url } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "welcome",
  purpose: "transactional",
  schema: z.object({ name: z.string().min(1), startUrl: z.string().meta(url) }),
  subject: (data, t) => t("subject", { name: data.name }),
  fixtures: { default: { name: "Ada", startUrl: "https://example.com/start" } },
  component: ({ data, t }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body")}</Text>
      <Button href={data.startUrl}>{t("cta")}</Button>
    </>
  ),
})
```

Templates run at compile time only: your server imports the module `email-kit compile` writes, which
needs only [`@email-kit/runtime`](../runtime/README.md) when it runs. MIT licensed.
