import { type Child, type Data, type IrNode, type ListPlaceholder, role } from "@email-kit/core"

import { DataTable, type DataTableColumn, type OptionalRow, type SummaryRow } from "./DataTable.tsx"
import { font } from "./style.ts"

export interface LineItemsProps<Item> {
  /** The table's title, such as "Order A-1042". */
  readonly caption: Child
  /** The list from data with one row for each item, such as `data.items`. */
  readonly items: ListPlaceholder<Item>
  /** The column headers. The unit price column appears only when it has a header and a cell. */
  readonly headers: {
    readonly item: Child
    readonly qty: Child
    readonly unitPrice?: Child
    readonly lineTotal: Child
  }
  /**
   * The cells for one item. Give amounts already formatted, such as with `Intl.NumberFormat` in
   * your backend.
   */
  readonly cells: {
    readonly name: (item: Data<Item>) => Child
    /**
     * A second line under the name, such as a size or a colour. For an optional field, wrap the
     * value in `<If>`. The line is left empty when the field is missing.
     */
    readonly meta?: (item: Data<Item>) => Child
    readonly qty: (item: Data<Item>) => Child
    readonly unitPrice?: (item: Data<Item>) => Child
    readonly lineTotal: (item: Data<Item>) => Child
  }
  /** The total before discounts, shipping and taxes. */
  readonly subtotal?: SummaryRow
  /**
   * The discounts. Amounts are shown as given, so write them as negative amounts. Use
   * `optionalRow()` for one that's only sometimes there.
   */
  readonly discounts?: readonly (SummaryRow | OptionalRow)[]
  /** The shipping cost. Use `optionalRow()` if it's only sometimes there. */
  readonly shipping?: SummaryRow | OptionalRow
  /**
   * The taxes. Name the rate in each label, and say whether it's included, such as
   * "VAT 20% (included)".
   */
  readonly taxes?: readonly (SummaryRow | OptionalRow)[]
  /** The total the reader pays, shown in bold. */
  readonly total: SummaryRow
}

/**
 * The items and totals of an order, for receipts and invoices: a table of the items, then the
 * subtotal, discounts, shipping, taxes and total, in that order. It shows the amounts as given and
 * doesn't add them up, so make sure they match.
 *
 * @param props - The caption, the items, how to show each one, and the totals.
 *
 * @example
 * ```tsx
 * <LineItems
 *   caption={t("caption", { order: data.orderNumber })}
 *   items={data.items}
 *   headers={{ item: t("item"), qty: t("qty"), lineTotal: t("lineTotal") }}
 *   cells={{
 *     name: (item) => item.name,
 *     qty: (item) => item.qty,
 *     lineTotal: (item) => item.total,
 *   }}
 *   subtotal={{ label: t("subtotal"), amount: data.subtotal }}
 *   discounts={[
 *     optionalRow(data.discount, (discount) => ({ label: t("discount"), amount: discount })),
 *   ]}
 *   total={{ label: t("total"), amount: data.total }}
 * />
 * ```
 */
export function LineItems<Item>(props: LineItemsProps<Item>): IrNode {
  const { headers, cells } = props
  const columns: DataTableColumn<Item>[] = [
    { header: headers.item, cell: itemCell(cells) },
    { header: headers.qty, cell: cells.qty, align: "end" },
    ...(headers.unitPrice !== undefined && cells.unitPrice
      ? [{ header: headers.unitPrice, cell: cells.unitPrice, align: "end" as const }]
      : []),
    { header: headers.lineTotal, cell: cells.lineTotal, align: "end" },
  ]
  return (
    <DataTable
      caption={props.caption}
      rows={props.items}
      columns={columns}
      summary={[
        ...(props.subtotal ? [props.subtotal] : []),
        ...(props.discounts ?? []),
        ...(props.shipping ? [props.shipping] : []),
        ...(props.taxes ?? []),
        { ...props.total, emphasis: true },
      ]}
    />
  )
}

/** The item column's cell: the name, with the meta line under it when there is one. */
function itemCell<Item>(cells: LineItemsProps<Item>["cells"]): (item: Data<Item>) => Child {
  const { name, meta } = cells
  if (!meta) return name
  return (item) => (
    <>
      {name(item)}
      <br />
      <span style={{ ...font("caption"), fontWeight: 400, color: role("mutedInk") }}>
        {meta(item)}
      </span>
    </>
  )
}
