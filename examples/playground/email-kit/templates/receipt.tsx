import {
  Button,
  Divider,
  Heading,
  Image,
  KeyValue,
  LineItems,
  Link,
  optionalRow,
  Text,
} from "@email-kit/components"
import { defineEmail, If, url } from "@email-kit/core"
import { z } from "zod"

import fixtures from "../fixtures/receipt.json" with { type: "json" }

// A receipt (research 05 §9): order facts, itemised lines and totals in a real data table, a link
// to the full receipt, and help. Amounts arrive formatted (Intl.NumberFormat in the backend).
export default defineEmail({
  id: "receipt",
  purpose: "transactional",
  schema: z.object({
    customerName: z.string().min(1),
    orderNumber: z.string().min(1),
    date: z.string().min(1),
    payment: z.string().min(1),
    receiptUrl: z.string().meta(url),
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          variant: z.string().min(1).optional(),
          qty: z.string(),
          total: z.string(),
        }),
      )
      .min(1),
    subtotal: z.string(),
    discount: z.string().optional(),
    shipping: z.string(),
    vat: z.string(),
    total: z.string(),
  }),
  subject: (data, t) => t("subject", { order: data.orderNumber }),
  preheader: (data, t) => t("preheader", { total: data.total }),
  fixtures,
  component: ({ data, t }) => (
    <>
      <Image
        kind="decorative"
        src="https://placehold.co/1200x300.png"
        width={536}
        height={134}
        fluid
        rounded
      />
      <Heading>{t("heading", { name: data.customerName })}</Heading>
      <Text>{t("intro")}</Text>
      <KeyValue
        items={[
          { label: t("orderNumber"), value: data.orderNumber, copyable: true },
          { label: t("date"), value: data.date },
          { label: t("payment"), value: data.payment },
        ]}
      />
      <LineItems
        caption={t("caption", { order: data.orderNumber })}
        items={data.items}
        headers={{ item: t("item"), qty: t("qty"), lineTotal: t("lineTotal") }}
        cells={{
          name: (item) => item.name,
          meta: (item) => <If when={item.variant}>{(variant) => variant}</If>,
          qty: (item) => item.qty,
          lineTotal: (item) => item.total,
        }}
        subtotal={{ label: t("subtotal"), amount: data.subtotal }}
        discounts={[
          optionalRow(data.discount, (discount) => ({ label: t("discount"), amount: discount })),
        ]}
        shipping={{ label: t("shipping"), amount: data.shipping }}
        taxes={[{ label: t("vat"), amount: data.vat }]}
        total={{ label: t("total"), amount: data.total }}
      />
      <Button href={data.receiptUrl}>{t("view")}</Button>
      <Divider />
      <Text size="caption" tone="muted">
        {t("help")} <Link href="https://help.playground.example">{t("helpLink")}</Link>
      </Text>
    </>
  ),
})
