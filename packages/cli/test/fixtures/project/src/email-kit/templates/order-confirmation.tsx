/** @jsxImportSource @email-kit/core */
import { Button, Footer, Heading, Link, List, ListItem, Text } from "@email-kit/components"
import { defineEmail, Each, If, Unless, url } from "@email-kit/core"
import { z } from "zod"

import { Card } from "../components/Card"

export default defineEmail({
  id: "order-confirmation",
  purpose: "transactional",
  schema: z.object({
    // Required and non-empty: "Thanks, {name}!" has no fallback (copy.placeholder-fallbacks).
    customerName: z.string().min(1),
    orderNumber: z.string().min(1),
    orderUrl: z.string().meta(url),
    items: z.array(z.object({ name: z.string(), qty: z.number() })),
    discount: z.string().optional(),
  }),
  subject: (data, t) => t("subject", { order: data.orderNumber }),
  preheader: (_data, t) => t("preheader"),
  fixtures: {
    default: {
      customerName: "Ada",
      orderNumber: "A-1042",
      orderUrl: "https://shop.example/orders/A-1042?ref=email&lang=en",
      items: [
        { name: "Tea", qty: 2 },
        { name: "Cake", qty: 1 },
      ],
      discount: "10%",
    },
  },
  component: ({ data, t, sender }) => (
    <Card>
      <Heading>{t("heading", { name: data.customerName })}</Heading>
      <Text>{t("orderLine", { order: data.orderNumber })}</Text>
      <List>
        <Each of={data.items}>
          {(item) => (
            <ListItem>
              {item.name} × {item.qty}
            </ListItem>
          )}
        </Each>
      </List>
      <If when={data.discount}>{(discount) => <Text>{t("discount", { discount })}</Text>}</If>
      <Unless when={data.discount}>
        <Text tone="muted">{t("noDiscount")}</Text>
      </Unless>
      <Button href={data.orderUrl} title={t("viewTitle", { order: data.orderNumber })}>
        {t("view")}
      </Button>
      <Text size="caption" tone="muted">
        {t("footer", { product: sender.productName })}{" "}
        <Link href={sender.siteUrl}>{t("visit")}</Link>
      </Text>
      <Footer reason={t("reason", { product: sender.productName })} sender={sender.productName} />
    </Card>
  ),
})
