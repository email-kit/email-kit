/** @jsxImportSource @email-kit/core */
import type { Child } from "@email-kit/core"

/** A user component (AUTH-13), imported by the template with a relative path. */
export function Card(props: { children?: Child }) {
  return (
    <table role="presentation" width="100%">
      <tbody>
        <tr>
          <td style={{ padding: "24px" }}>{props.children}</td>
        </tr>
      </tbody>
    </table>
  )
}
