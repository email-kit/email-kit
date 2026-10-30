/** @jsxImportSource @email-kit/core */
import { Button, Heading, Link, List, ListItem, Text } from "@email-kit/components"
import { defineEmail, Each, If, Unless, url } from "@email-kit/core"
import { z } from "zod"

import { Card } from "../components/Card"

export default defineEmail({
  id: "order-confirmation",
  purpose: "transactional",
  schema: z.object({
    customerName: z.string(),
    orderNumber: z.string(),
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
  component: ({ data, t, platform }) => (
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
        {t("footer", { product: platform.productName })}{" "}
        <Link href={platform.siteUrl}>{t("visit")}</Link>
      </Text>
    </Card>
  ),
})
