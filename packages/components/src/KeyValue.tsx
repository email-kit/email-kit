import { type Child, Conditional, type IrNode, role, useTheme } from "@email-kit/core"

import { font, PRESENTATION } from "./style.ts"

export interface KeyValueItem {
  readonly label: Child
  readonly value: Child
  /** Lets a click select the whole value, in clients that support it */
  readonly copyable?: boolean
}

export interface KeyValueProps {
  readonly items: readonly KeyValueItem[]
  /**
   * `inline`: "Label: value" on one line that wraps. `stacked`: the label above the value.
   * Neither needs columns, so both read well on a phone. Default: `inline`
   */
  readonly layout?: "inline" | "stacked"
}

const COPYABLE = { WebkitUserSelect: "all", userSelect: "all" } as const

/** Fact rows such as an order number and a date (UI-16): a row each; text part `Label: value`. */
export function KeyValue(props: KeyValueProps): IrNode {
  const theme = useTheme()
  const { stack } = theme.space
  const stacked = props.layout === "stacked"
  const value = (item: KeyValueItem) =>
    item.copyable ? <span style={COPYABLE}>{item.value}</span> : item.value
  const row = (item: KeyValueItem) =>
    stacked ? (
      <>
        <Conditional when="htmlOnly">
          <p style={{ margin: "0", ...font("caption", theme), color: role("mutedInk") }}>
            {item.label}
          </p>
          <p style={{ margin: "0", ...font("body", theme), color: role("ink") }}>{value(item)}</p>
        </Conditional>
        <Conditional when="textOnly">
          <p>
            {item.label}: {item.value}
          </p>
        </Conditional>
      </>
    ) : (
      <p style={{ margin: "0", ...font("body", theme), color: role("ink") }}>
        <span style={{ color: role("mutedInk") }}>{item.label}:</span> {value(item)}
      </p>
    )
  return (
    <table {...PRESENTATION}>
      <tbody>
        {props.items.map((item) => (
          <tr>
            <td style={{ padding: `0 0 ${stacked ? stack.md : stack.sm}px` }}>{row(item)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
