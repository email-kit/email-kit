import {
  type Child,
  type Data,
  type IrNode,
  type ListPlaceholder,
  role,
  useTheme,
} from "@email-kit/core"

import { DataTable, type DataTableColumn, type OptionalRow, type SummaryRow } from "./DataTable.tsx"
import { font } from "./style.ts"

export interface LineItemsProps<Item> {
  /** Such as "Order A-1042" */
  readonly caption: Child
  readonly items: ListPlaceholder<Item>
  /** Column headers. A unit price column appears when both its header and cell are given */
  readonly headers: {
    readonly item: Child
    readonly qty: Child
    readonly unitPrice?: Child
    readonly lineTotal: Child
  }
  /** Cells for one item. Amounts are strings formatted by the caller (Intl.NumberFormat) */
  readonly cells: {
    readonly name: (item: Data<Item>) => Child
    /**
     * A second line under the name, such as a size or a variant. For an optional field, wrap the
     * value in `<If>`; the line stays, empty, when the field is missing
     */
    readonly meta?: (item: Data<Item>) => Child
    readonly qty: (item: Data<Item>) => Child
    readonly unitPrice?: (item: Data<Item>) => Child
    readonly lineTotal: (item: Data<Item>) => Child
  }
  readonly subtotal?: SummaryRow
  /** Shown as given, so write them as negative amounts; optionalRow() for optional ones */
  readonly discounts?: readonly (SummaryRow | OptionalRow)[]
  readonly shipping?: SummaryRow | OptionalRow
  /** Each label names the rate and whether it is included, such as "VAT 20% (included)" */
  readonly taxes?: readonly (SummaryRow | OptionalRow)[]
  readonly total: SummaryRow
}

/**
 * Itemised totals for receipts and invoices (UI-18): a `DataTable` with the items, then the
 * subtotal, discounts, shipping, taxes and the total, in that order (research 05 §9). The amounts
 * are data: email-kit doesn't add them up, so the caller makes sure they reconcile.
 */
export function LineItems<Item>(props: LineItemsProps<Item>): IrNode {
  const theme = useTheme()
  const { headers, cells } = props
  const name = (item: Data<Item>): Child => {
    const meta = cells.meta
    if (!meta) return cells.name(item)
    return (
      <>
        {cells.name(item)}
        <br />
        <span style={{ ...font("caption", theme), fontWeight: 400, color: role("mutedInk") }}>
          {meta(item)}
        </span>
      </>
    )
  }
  const columns: DataTableColumn<Item>[] = [
    { header: headers.item, cell: name },
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
