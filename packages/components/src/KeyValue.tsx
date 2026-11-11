import { type Child, Conditional, type IrNode, role, useTheme } from "@email-kit/core"

import { font, PRESENTATION, textCell } from "./style.ts"

/** One row of a `KeyValue`. */
export interface KeyValueItem {
  /** What the value is, such as "Order number". */
  readonly label: Child
  /** The value, such as `data.orderNumber`. */
  readonly value: Child
  /**
   * Whether one click selects the whole value, for something the reader may copy, such as an
   * order number. Not every client supports it. Defaults to `false`.
   */
  readonly copyable?: boolean
}

export interface KeyValueProps {
  /** The rows, in order. */
  readonly items: readonly KeyValueItem[]
  /**
   * `inline` puts "Label: value" on one line, which wraps when it's long. `stacked` puts the
   * label in small muted type above the value. Neither uses columns, so both fit a phone screen.
   * Defaults to `inline`.
   */
  readonly layout?: "inline" | "stacked"
}

const COPYABLE = { WebkitUserSelect: "all", userSelect: "all" } as const

/**
 * Labelled facts, one to a row, such as an order number, a date and a payment method. The
 * plain-text part of the email gets `Label: value` lines.
 *
 * @param props - The rows, and how to lay them out.
 *
 * @example
 * ```tsx
 * <KeyValue
 *   items={[
 *     { label: t("orderNumber"), value: data.orderNumber, copyable: true },
 *     { label: t("date"), value: data.date },
 *   ]}
 * />
 * ```
 */
export function KeyValue(props: KeyValueProps): IrNode {
  const { stack } = useTheme().space
  const stacked = props.layout === "stacked"
  const Row = stacked ? StackedRow : InlineRow
  const last = props.items.length - 1
  return (
    <table {...PRESENTATION}>
      <tbody>
        {props.items.map((item, i) => (
          <tr>
            <td style={{ padding: `0 0 ${stacked || i === last ? stack.md : stack.sm}px` }}>
              <Row item={item} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface RowProps {
  readonly item: KeyValueItem
}

function InlineRow({ item }: RowProps): IrNode {
  const theme = useTheme()
  const cell = textCell()
  return (
    <p
      {...cell.attrs}
      style={{ margin: "0", ...cell.style, ...font("body", theme), color: role("ink") }}
    >
      <span style={{ color: role("mutedInk") }}>{item.label}:</span> {value(item)}
    </p>
  )
}

/** The label above the value in HTML, and `Label: value` on one line in the plain-text part. */
function StackedRow({ item }: RowProps): IrNode {
  const theme = useTheme()
  const cell = textCell()
  return (
    <>
      <Conditional when="htmlOnly">
        <p
          {...cell.attrs}
          style={{ margin: "0", ...cell.style, ...font("caption", theme), color: role("mutedInk") }}
        >
          {item.label}
        </p>
        <p
          {...cell.attrs}
          style={{ margin: "0", ...cell.style, ...font("body", theme), color: role("ink") }}
        >
          {value(item)}
        </p>
      </Conditional>
      <Conditional when="textOnly">
        <p>
          {item.label}: {item.value}
        </p>
      </Conditional>
    </>
  )
}

function value(item: KeyValueItem): Child {
  return item.copyable ? <span style={COPYABLE}>{item.value}</span> : item.value
}
