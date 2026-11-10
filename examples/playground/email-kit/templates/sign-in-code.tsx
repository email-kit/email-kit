import { Callout, Footer, Heading, OtpCode, Text } from "@email-kit/components"
import { defineEmail, If } from "@email-kit/core"
import { z } from "zod"

import fixtures from "../fixtures/sign-in-code.json" with { type: "json" }

// A one-time code (research 05 §9): the code once, as plain digits, next to words naming it;
// its expiry; and what to do if you didn't ask for it. The code is never in the preheader.
export default defineEmail({
  id: "sign-in-code",
  purpose: "transactional",
  schema: z.object({
    code: z.string().regex(/^\d{6}$/),
    minutes: z.number().int().min(1).max(30),
    device: z.string().min(1).optional(),
  }),
  subject: (_data, t, sender) => t("subject", { product: sender.productName }),
  preheader: (_data, t) => t("preheader"),
  fixtures,
  component: ({ data, t, sender }) => (
    <>
      <Heading>{t("heading")}</Heading>
      <OtpCode label={t("label", { product: sender.productName })} code={data.code} />
      <Text>{t("expiry", { minutes: data.minutes })}</Text>
      <If when={data.device}>{(device) => <Text tone="muted">{t("device", { device })}</Text>}</If>
      <Callout tone="info" title={t("notYouTitle")}>
        {t("notYou")}
      </Callout>
      <Footer
        reason={t("footer", { product: sender.productName })}
        sender={sender.legalName}
        links={[
          { href: sender.helpUrl, label: t("helpCentre") },
          { href: sender.privacyUrl, label: t("privacy") },
        ]}
      />
    </>
  ),
})
