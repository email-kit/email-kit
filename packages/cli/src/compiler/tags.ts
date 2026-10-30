// Writes mustache-core tags for IR placeholders and sections, shared by the HTML and text
// serialisers. `scopes` lists the contexts the open sections pushed, innermost last.

import { EmailKitError, type IrPlaceholder, type IrSection } from "@email-kit/core/internal"

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export function placeholderTag(node: IrPlaceholder, scopes: readonly number[]): string {
  return `{{${name(node, scopes)}}}`
}

export function sectionTags(node: IrSection, scopes: readonly number[]): [string, string] {
  const path = name(node, scopes)
  return [`{{${node.inverted ? "^" : "#"}${path}}}`, `{{/${path}}}`]
}

function name(node: IrPlaceholder | IrSection, scopes: readonly number[]): string {
  if (node.path.length === 0) {
    if (node.scope === 0) {
      throw new EmailKitError(
        "non-scalar-placeholder",
        "`data` itself can't be rendered; render one of its fields",
      )
    }
    // `{{.}}` means the innermost context, so it only names this item if no inner section has
    // pushed another one.
    if (scopes.at(-1) !== node.scope) {
      throw new EmailKitError(
        "shadowed-item",
        "A list item ({{.}}) from an outer <Each> is used inside a nested <Each> or <If>, where " +
          "{{.}} means something else. Use a field of the item, or a list of objects instead.",
      )
    }
    return "."
  }
  for (const segment of node.path) {
    if (!NAME.test(segment)) {
      throw new EmailKitError(
        "invalid-field-name",
        `The field name "${segment}" can't be a placeholder: use letters, digits and _ only`,
      )
    }
  }
  return node.path.join(".")
}
