import {
  type Child,
  Conditional,
  type Data,
  Each,
  EmailKitError,
  If,
  type IrNode,
  type ListPlaceholder,
  type MaybePlaceholder,
  role,
  type ThemeContext,
  useDirection,
  useTheme,
} from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font, textCell } from "./style.ts"

/** A column of a `DataTable`. */
export interface DataTableColumn<Item> {
  /** The column's header. */
  readonly header: Child
  /** The column's cell for one row, such as `(row) => row.qty`. */
  readonly cell: (row: Data<Item>) => Child
  /**
   * `end` to line the column up on the end side, for numbers and amounts: right, or left in
   * right-to-left emails. Defaults to `start`.
   */
  readonly align?: "start" | "end"
  /** The column's width, in pixels. Leave it out to let the table size it. */
  readonly width?: number
}

/** A row under the data rows, such as a subtotal, a tax or the total. */
export interface SummaryRow {
  /** What the amount is, such as "Subtotal". */
  readonly label: Child
  /** The amount, already formatted, such as `data.subtotal`. */
  readonly amount: Child
  /** Whether it's the grand total: bold, with a darker line above. Defaults to `false`. */
  readonly emphasis?: boolean
}

/** A summary row shown only when an optional field has a value. Make one with `optionalRow()`. */
export interface OptionalRow {
  readonly when: MaybePlaceholder<unknown>
  readonly row: (value: never) => SummaryRow
}

/**
 * A summary row for an optional field, shown only when the field has a value.
 *
 * @param when - The optional field, such as `data.discount`.
 * @param row - Makes the row from the field's value.
 *
 * @example
 * ```tsx
 * optionalRow(data.discount, (discount) => ({ label: t("discount"), amount: discount }))
 * ```
 */
export function optionalRow<T>(
  when: MaybePlaceholder<T>,
  row: (value: Data<T>) => SummaryRow,
): OptionalRow {
  return { when, row: row as (value: never) => SummaryRow }
}

export interface DataTableProps<Item> {
  /** The table's title, shown above it, which also names it for screen readers. */
  readonly caption: Child
  /** The list from data with one row for each item, such as `data.items`. */
  readonly rows: ListPlaceholder<Item>
  /**
   * The columns, in order. Give at least two: some screen readers stop treating a one-column
   * table as a table. For one column, use `KeyValue` or `List`.
   */
  readonly columns: readonly DataTableColumn<Item>[]
  /**
   * Whether the first column names its row, so screen readers read it with each cell. Defaults to
   * `true`.
   */
  readonly rowHeaders?: boolean
  /**
   * Rows under the data, such as totals. The label spans every column but the last, and the
   * amount goes in the last.
   */
  readonly summary?: readonly (SummaryRow | OptionalRow)[]
}

/**
 * A table of data, one row for each item in a list, with a caption, headers and optional summary
 * rows. It's a real table, so screen readers read each cell with its headers. The plain-text part
 * of the email gets `Header: value` lines for each row, then `Label: amount` for the summary.
 *
 * @param props - The caption, the rows, the columns and the summary.
 *
 * @throws {EmailKitError} If there are fewer than two columns.
 *
 * @example
 * ```tsx
 * <DataTable
 *   caption={t("recentCaption")}
 *   rows={data.recent}
 *   columns={[
 *     { header: t("time"), cell: (row) => row.time },
 *     { header: t("location"), cell: (row) => row.location },
 *   ]}
 * />
 * ```
 */
export function DataTable<Item>(props: DataTableProps<Item>): IrNode {
  if (props.columns.length < 2) {
    throw new EmailKitError(
      "invalid-table",
      "<DataTable> needs at least two columns; use KeyValue or List for a single column",
    )
  }
  return (
    <>
      <Conditional when="htmlOnly">{htmlTable(props)}</Conditional>
      <Conditional when="textOnly">{textTable(props)}</Conditional>
    </>
  )
}

function htmlTable<Item>(props: DataTableProps<Item>): IrNode {
  const theme = useTheme()
  const dir = useDirection()
  const cell = textCell()
  const pad = `${theme.space.stack.sm}px`
  const rowHeaders = props.rowHeaders ?? true
  return (
    <Block bottom={theme.space.stack.md}>
      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style={{ borderCollapse: "collapse" }}
      >
        <caption
          {...cell.attrs}
          style={{
            padding: `0 0 ${pad}`,
            textAlign: side("start", dir),
            ...font("body", theme),
            fontWeight: 700,
            color: role("ink"),
          }}
        >
          {props.caption}
        </caption>
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th
                {...cell.attrs}
                scope="col"
                width={column.width === undefined ? undefined : String(column.width)}
                style={{
                  ...cellStyle(theme, dir, column.align, "strongBorder"),
                  ...font("bodySm", theme),
                  fontWeight: 700,
                  color: role("mutedInk"),
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Each of={props.rows}>
            {(row) => (
              <tr>
                {props.columns.map((column, i) => {
                  const Cell = rowHeaders && i === 0 ? "th" : "td"
                  return (
                    <Cell
                      {...cell.attrs}
                      scope={Cell === "th" ? "row" : undefined}
                      style={{
                        ...cellStyle(theme, dir, column.align, "hairline"),
                        ...font("bodySm", theme),
                        color: role("ink"),
                      }}
                    >
                      {column.cell(row)}
                    </Cell>
                  )
                })}
              </tr>
            )}
          </Each>
        </tbody>
        {props.summary && (
          <tfoot>
            {summaryRows(props.summary, (row) => (
              <tr>
                <th
                  {...cell.attrs}
                  scope="row"
                  colspan={String(props.columns.length - 1)}
                  style={summaryStyle(theme, dir, row)}
                >
                  {row.label}
                </th>
                <td {...cell.attrs} style={summaryStyle(theme, dir, row)}>
                  {row.amount}
                </td>
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </Block>
  )
}

/** The plain-text table: the caption, `Header: value` lines for each row, then the summary. */
function textTable<Item>(props: DataTableProps<Item>): IrNode {
  return (
    <>
      <p>{props.caption}</p>
      <Each of={props.rows}>
        {(row) => (
          <p>
            {props.columns.map((column, i) => (
              <>
                {i > 0 && <br />}
                {column.header}: {column.cell(row)}
              </>
            ))}
          </p>
        )}
      </Each>
      {props.summary && (
        <p>
          {summaryRows(props.summary, (row) => (
            <>
              {row.label}: {row.amount}
              <br />
            </>
          ))}
        </p>
      )}
    </>
  )
}

/** Draws each summary row, wrapping an optional one in a condition on its field. */
function summaryRows(
  rows: readonly (SummaryRow | OptionalRow)[],
  draw: (row: SummaryRow) => IrNode,
): IrNode[] {
  return rows.map((row) =>
    "when" in row
      ? If({ when: row.when, children: (value) => draw(row.row(value as never)) })
      : draw(row),
  )
}

/** The physical side of `start` or `end`, which classic Outlook needs in place of logical values. */
function side(align: "start" | "end", dir: "ltr" | "rtl"): "left" | "right" {
  return (align === "start") === (dir === "ltr") ? "left" : "right"
}

/**
 * A cell's padding: none on the start side, so the first column lines up with the text around the
 * table, and a gap on the end side, between it and the next column.
 */
function cellPadding(theme: ThemeContext, dir: "ltr" | "rtl"): string {
  const pad = `${theme.space.stack.sm}px`
  return dir === "ltr" ? `${pad} ${pad} ${pad} 0` : `${pad} 0 ${pad} ${pad}`
}

function cellStyle(
  theme: ThemeContext,
  dir: "ltr" | "rtl",
  align: "start" | "end" = "start",
  border: "strongBorder" | "hairline",
) {
  return {
    padding: cellPadding(theme, dir),
    textAlign: side(align, dir),
    verticalAlign: "top",
    borderBottomStyle: "solid",
    borderBottomWidth: `${theme.borderWidth.hairline}px`,
    borderBottomColor: role(border),
  }
}

function summaryStyle(theme: ThemeContext, dir: "ltr" | "rtl", row: SummaryRow) {
  return {
    padding: cellPadding(theme, dir),
    textAlign: side("end", dir),
    ...font(row.emphasis ? "body" : "bodySm", theme),
    ...(row.emphasis && {
      fontWeight: 700,
      borderTopStyle: "solid",
      borderTopWidth: `${theme.borderWidth.hairline}px`,
      borderTopColor: role("strongBorder"),
    }),
    color: role("ink"),
  }
}
