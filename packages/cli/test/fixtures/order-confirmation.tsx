/** @jsxImportSource @email-kit/core */
import { defineEmail, Each, If, Unless } from "@email-kit/core"
import { z } from "zod"

import { Card } from "./components/Card"

export default defineEmail({
  id: "order-confirmation",
  purpose: "transactional",
  schema: z.object({
    customerName: z.string(),
    orderNumber: z.string(),
    orderUrl: z.string(),
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
  component: ({ data, t }) => (
    <Card>
      <h1>{t("heading", { name: data.customerName })}</h1>
      <p>{t("orderLine", { order: data.orderNumber })}</p>
      <ul>
        <Each of={data.items}>
          {(item) => (
            <li>
              {item.name} × {item.qty}
            </li>
          )}
        </Each>
      </ul>
      <If when={data.discount}>{(discount) => <p>{t("discount", { discount })}</p>}</If>
      <Unless when={data.discount}>
        <p>{t("noDiscount")}</p>
      </Unless>
      <p>
        <a href={data.orderUrl} title={t("viewTitle", { order: data.orderNumber })}>
          {t("view")}
        </a>
      </p>
    </Card>
  ),
})
