/** @jsxImportSource @email-kit/core */
// Type tests for authoring (AUTH-07): checked by `pnpm typecheck`, never run. Every expected
// error must occur, or tsc reports the directive as unused. Each negative case sits in its own
// element: one erroring child widens its siblings to `any` and would hide their errors.

import { defineEmail, Each, If, Unless } from "@email-kit/core"
import { z } from "zod"

const schema = z.object({
  name: z.string(),
  count: z.number(),
  active: z.boolean(),
  items: z.array(z.object({ label: z.string() })),
  discount: z.string().optional(),
  note: z.string().nullable(),
})

defineEmail({
  id: "type-checks",
  purpose: "transactional",
  schema,
  subject: (data, t) => t("subject", { name: data.name, count: data.count }),
  fixtures: { default: { name: "Ada", count: 1, active: true, items: [], note: null } },
  component: ({ data }) => [
    <div>
      {data.name}
      {data.count}
      <a href={data.name} title={data.name}>
        View your order
      </a>
      <Each of={data.items}>{(item) => <p>{item.label}</p>}</Each>
      <If when={data.discount}>{(discount) => <p>{discount}</p>}</If>
      <If when={data.note}>{(note) => <p>{note}</p>}</If>
      <If when={data.active}>
        <p>active</p>
      </If>
      <Unless when={data.discount}>no discount</Unless>
    </div>,
    // @ts-expect-error: a misspelt field
    <p>{data.nmae}</p>,
    // @ts-expect-error: booleans don't render as text
    <p>{data.active}</p>,
    // @ts-expect-error: lists render only through <Each>
    <p>{data.items}</p>,
    // @ts-expect-error: optional fields render only inside <If>
    <p>{data.discount}</p>,
    // @ts-expect-error: nullable fields too
    <p>{data.note}</p>,
    // @ts-expect-error: no arithmetic on placeholders
    <p>{data.count * 2}</p>,
    // @ts-expect-error: no string methods on placeholders
    <p>{data.name.toUpperCase()}</p>,
    // @ts-expect-error: <Each> needs a list
    <Each of={data.name}>{() => null}</Each>,
    // @ts-expect-error: a misspelt item field
    <Each of={data.items}>{(item) => <p>{item.lable}</p>}</Each>,
    // @ts-expect-error: <If> needs an optional or boolean field
    <If when={data.name}>never</If>,
    // @ts-expect-error: an optional object needs <If> before its fields are reachable
    <p>{data.discount.length}</p>,
  ],
})

defineEmail({
  id: "type-checks-platform",
  purpose: "transactional",
  schema,
  subject: (_data, _t, platform) => platform.productName,
  fixtures: {},
  component: ({ platform }) => [
    <a href={platform.siteUrl}>{platform.productName}</a>,
    // @ts-expect-error: a runtime value is a placeholder, so no string methods
    <p>{platform.siteUrl.toUpperCase()}</p>,
    // @ts-expect-error: only the documented platform keys exist
    <p>{platform.phone}</p>,
  ],
})

defineEmail({
  id: "type-checks-fixtures",
  purpose: "transactional",
  schema,
  subject: () => "Subject",
  // @ts-expect-error: fixtures are typed from the schema
  fixtures: { default: { name: 1 } },
  component: () => null,
})

defineEmail({
  id: "type-checks-purpose",
  // @ts-expect-error: purpose is a closed set
  purpose: "newsletter",
  schema,
  subject: () => "Subject",
  fixtures: {},
  component: () => null,
})
