/** @jsxImportSource @email-kit/core */
// Type tests for typed t() (P1-159): the fixture project's compiled messages.d.ts types the
// "order-confirmation" template's keys and parameters. Checked by `pnpm typecheck`, never run.
// Every expected error must occur, or tsc reports the directive as unused.

import { defineEmail } from "@email-kit/core"
import { z } from "zod"

const schema = z.object({ customerName: z.string(), orderNumber: z.string(), qty: z.number() })

defineEmail({
  id: "order-confirmation",
  purpose: "transactional",
  schema,
  subject: (data, t) => t("subject", { order: data.orderNumber }),
  fixtures: {},
  component: ({ data, t }) => [
    <p>
      {t("heading", { name: data.customerName })}
      {t("orderLine", { order: data.orderNumber })}
      {t("noDiscount")}
      {t("heading", { name: "a literal" })}
    </p>,
    // @ts-expect-error a key the default locale doesn't have
    <p>{t("headline", { name: data.customerName })}</p>,
    // @ts-expect-error a parameter is missing
    <p>{t("heading")}</p>,
    // @ts-expect-error a parameter the message doesn't use
    <p>{t("heading", { name: data.customerName, extra: data.orderNumber })}</p>,
    // @ts-expect-error a misspelt parameter
    <p>{t("orderLine", { orderNumber: data.orderNumber })}</p>,
    // @ts-expect-error a message without parameters gets none
    <p>{t("noDiscount", { name: data.customerName })}</p>,
  ],
})

// A template that isn't compiled yet keeps an untyped t().
defineEmail({
  id: "not-compiled-yet",
  purpose: "transactional",
  schema,
  subject: (_data, t) => t("anything", { at: "all" }),
  fixtures: {},
  component: ({ t }) => <p>{t("whatever")}</p>,
})
