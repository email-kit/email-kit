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
  useDirection,
  useTheme,
} from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font } from "./style.ts"

export interface DataTableColumn<Item> {
  readonly header: Child
  /** The cell for one row, such as `(row) => row.qty` */
  readonly cell: (row: Data<Item>) => Child
  /** `end` for numbers and amounts. Default: `start` */
  readonly align?: "start" | "end"
  /** px */
  readonly width?: number
}

/** A row under the data rows, such as a subtotal, tax or total. */
export interface SummaryRow {
  readonly label: Child
  readonly amount: Child
  /** The grand total: bold, with a strong rule above */
  readonly emphasis?: boolean
}

/** A summary row shown only when an optional field is present; made by optionalRow(). */
export interface OptionalRow {
  readonly when: MaybePlaceholder<unknown>
  readonly row: (value: never) => SummaryRow
}

/**
 * A summary row for an optional field, built from its value inside the condition, so the
 * field is present wherever it is used:
 * `optionalRow(data.discount, (discount) => ({ label: t("discount"), amount: discount }))`.
 */
export function optionalRow<T>(
  when: MaybePlaceholder<T>,
  row: (value: Data<T>) => SummaryRow,
): OptionalRow {
  return { when, row: row as (value: never) => SummaryRow }
}

export interface DataTableProps<Item> {
  /** Names the table for screen readers and everyone else (research 02 A23) */
  readonly caption: Child
  readonly rows: ListPlaceholder<Item>
  /** At least two, so NVDA in classic Outlook keeps treating it as a table (02 A6) */
  readonly columns: readonly DataTableColumn<Item>[]
  /** The first column heads its row (`<th scope="row">`). Default: true */
  readonly rowHeaders?: boolean
  /** Rows in `<tfoot>`: the label spans the leading columns, the amount sits in the last */
  readonly summary?: readonly (SummaryRow | OptionalRow)[]
}

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

/**
 * Tabular data (UI-17): a real table, never `role="presentation"`, with a caption and
 * `<th scope>` headers; amounts end-aligned on the physical side Word understands. The text part
 * lists each row as `Header: value` lines, then `Label: amount` for the summary. Stacking below
 * 320 px needs head CSS and comes later.
 */
export function DataTable<Item>(props: DataTableProps<Item>): IrNode {
  const theme = useTheme()
  const dir = useDirection()
  if (props.columns.length < 2) {
    throw new EmailKitError(
      "invalid-table",
      "<DataTable> needs at least two columns; use KeyValue or List for a single column",
    )
  }
  const side = (align: "start" | "end" = "start") =>
    (align === "start") === (dir === "ltr") ? "left" : "right"
  const pad = `${theme.space.stack.sm}px`
  const rowHeaders = props.rowHeaders ?? true
  const cellStyle = (column: DataTableColumn<Item>, border: "strongBorder" | "hairline") => ({
    padding: `${pad} ${pad} ${pad} 0`,
    textAlign: side(column.align),
    verticalAlign: "top",
    borderBottomStyle: "solid",
    borderBottomWidth: `${theme.borderWidth.hairline}px`,
    borderBottomColor: role(border),
  })
  const summaryStyle = (row: SummaryRow) => ({
    padding: `${pad} ${pad} ${pad} 0`,
    textAlign: side("end"),
    ...font(row.emphasis ? "body" : "bodySm", theme),
    ...(row.emphasis && {
      fontWeight: 700,
      borderTopStyle: "solid",
      borderTopWidth: `${theme.borderWidth.hairline}px`,
      borderTopColor: role("strongBorder"),
    }),
    color: role("ink"),
  })
  return (
    <>
      <Conditional when="htmlOnly">
        <Block bottom={theme.space.stack.md}>
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style={{ borderCollapse: "collapse" }}
          >
            <caption
              style={{
                padding: `0 0 ${pad}`,
                textAlign: side(),
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
                    scope="col"
                    width={column.width === undefined ? undefined : String(column.width)}
                    style={{
                      ...cellStyle(column, "strongBorder"),
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
                          scope={Cell === "th" ? "row" : undefined}
                          style={{
                            ...cellStyle(column, "hairline"),
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
                      scope="row"
                      colspan={String(props.columns.length - 1)}
                      style={summaryStyle(row)}
                    >
                      {row.label}
                    </th>
                    <td style={summaryStyle(row)}>{row.amount}</td>
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </Block>
      </Conditional>
      <Conditional when="textOnly">
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
      </Conditional>
    </>
  )
}
