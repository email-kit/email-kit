/** @jsxImportSource @email-kit/core */
import { Button, Footer, Heading, Text } from "@email-kit/components"
import { defineEmail, url } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "welcome",
  purpose: "transactional",
  schema: z.object({
    name: z.string().min(1),
    trialDays: z.number().int().min(1),
    startUrl: z.string().meta(url),
  }),
  subject: (data, t, platform) => t("subject", { name: data.name, product: platform.productName }),
  preheader: (_data, t) => t("preheader"),
  fixtures: {
    default: { name: "Ada", trialDays: 14, startUrl: "https://shop.example/start" },
  },
  component: ({ data, t, platform }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body", { product: platform.productName, days: data.trialDays })}</Text>
      <Button href={data.startUrl}>{t("cta")}</Button>
      <Footer
        reason={t("footer", { product: platform.productName })}
        sender={platform.productName}
      />
    </>
  ),
})
