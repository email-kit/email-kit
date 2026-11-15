import {
  Button,
  Callout,
  DataTable,
  Footer,
  Heading,
  KeyValue,
  Link,
  Text,
} from "@email-kit/components"
import { defineEmail, url } from "@email-kit/core"
import { z } from "zod"

import fixtures from "./fixtures.json" with { type: "json" }

// A new sign-in alert (research 05 §9): what happened, when (with the time zone), where
// (labelled approximate), on what device, and what to do if it wasn't you.
export default defineEmail({
  id: "security-alert",
  purpose: "transactional",
  schema: z.object({
    time: z.string().min(1),
    location: z.string().min(1),
    device: z.string().min(1),
    reviewUrl: z.string().meta(url),
    recent: z.array(z.object({ time: z.string(), location: z.string(), device: z.string() })),
  }),
  subject: (_data, t, sender) => t("subject", { product: sender.productName }),
  preheader: (data, t) => t("preheader", { device: data.device }),
  fixtures,
  component: ({ data, t, sender }) => (
    <>
      <Heading>{t("heading")}</Heading>
      <Callout tone="warning" title={t("calloutTitle")}>
        {t("callout")}
      </Callout>
      <KeyValue
        layout="stacked"
        items={[
          { label: t("time"), value: data.time },
          { label: t("location"), value: data.location },
          { label: t("device"), value: data.device },
        ]}
      />
      <Button href={data.reviewUrl} variant="destructive">
        {t("review")}
      </Button>
      <DataTable
        caption={t("recentCaption")}
        rows={data.recent}
        columns={[
          { header: t("time"), cell: (row) => row.time },
          { header: t("location"), cell: (row) => row.location },
          { header: t("device"), cell: (row) => row.device },
        ]}
      />
      <Text size="caption" tone="muted">
        {t("help")} <Link href="https://help.playground.example/security">{t("helpLink")}</Link>
      </Text>
      <Footer
        reason={t("footer", { product: sender.productName })}
        sender={sender.legalName}
        address={sender.postalAddress}
        links={[
          { href: sender.helpUrl, label: t("helpCentre") },
          { href: sender.privacyUrl, label: t("privacy") },
        ]}
      />
    </>
  ),
})
