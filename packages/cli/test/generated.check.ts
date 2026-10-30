// Type tests for the generated module (TST-02), checked by `pnpm typecheck` under
// generated.tsconfig.json. Every expected error must occur, or tsc reports the directive as unused.

import {
  createEmails,
  type Locale,
  locales,
  type OrderConfirmationData,
  type RenderedEmail,
  type TemplateId,
} from "./fixtures/project/src/email-kit/compiled/index.ts"

const emails = createEmails({ siteUrl: "https://shop.example" })

const data: OrderConfirmationData = {
  customerName: "Ada",
  orderNumber: "A-1042",
  orderUrl: "https://shop.example/orders/A-1042",
  items: [{ name: "Tea", qty: 2 }],
}

const email: RenderedEmail<"order-confirmation"> = emails.orderConfirmation.render(data, {
  locale: "de-AT",
})
const id: TemplateId = email.meta.id
const locale: Locale = email.meta.locale
const raw: string = emails.orderConfirmation.templates.de.html
const withUndefined = emails.orderConfirmation.render({ ...data, discount: undefined })

// @ts-expect-error: a required field is missing
const missing = emails.orderConfirmation.render({ customerName: "Ada" })
// @ts-expect-error: a field has the wrong type
const wrongType = emails.orderConfirmation.render({ ...data, items: [{ name: "Tea", qty: "2" }] })
// @ts-expect-error: no such template
const noTemplate = emails.welcome
// @ts-expect-error: no such locale among the raw templates
const noLocale = emails.orderConfirmation.templates.fr
// @ts-expect-error: TemplateId is a closed union
const unknownId: TemplateId = "welcome"
// @ts-expect-error: the runtime context is required
const noContext = createEmails({})
// @ts-expect-error: with a runtime key, there is no ready-made \`emails\` export
const notExported = (await import("./fixtures/project/src/email-kit/compiled/index.ts")).emails

export const checks: readonly unknown[] = [
  email,
  id,
  locale,
  raw,
  withUndefined,
  locales,
  missing,
  wrongType,
  noTemplate,
  noLocale,
  unknownId,
  noContext,
  notExported,
]
