// No pragma on purpose: the compiler must use @email-kit/core even though the host tsconfig next
// to this file says hono/jsx.
import type { Child } from "@email-kit/core"

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
