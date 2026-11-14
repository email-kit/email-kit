import { EmailKitError, type IrPlaceholder, type IrSection } from "@email-kit/core/internal"

import { FIELD_NAME } from "./schema/index.ts"

/**
 * The mustache-core tag for a placeholder, for the HTML and text renderers. `scopes` lists the
 * contexts the open sections pushed, innermost last.
 */
export function placeholderTag(node: IrPlaceholder, scopes: readonly number[]): string {
  return `{{${name(node, scopes)}}}`
}

/** The opening and closing tags of a section, such as `{{#items}}` and `{{/items}}`. */
export function sectionTags(node: IrSection, scopes: readonly number[]): [string, string] {
  const path = name(node, scopes)
  return [`{{${node.inverted ? "^" : "#"}${path}}}`, `{{/${path}}}`]
}

/**
 * The name in a tag: the field's path, or `.` for a list item's own value. `.` always means the
 * innermost context, so an item's value can't be used inside a nested `<Each>` or `<If>`.
 */
function name(node: IrPlaceholder | IrSection, scopes: readonly number[]): string {
  if (node.path.length === 0) {
    if (node.scope === 0) {
      throw new EmailKitError(
        "non-scalar-placeholder",
        "`data` itself can't be rendered; render one of its fields",
      )
    }
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
    if (!FIELD_NAME.test(segment)) {
      throw new EmailKitError(
        "invalid-field-name",
        `The field name "${segment}" can't be a placeholder: use letters, digits and _ only`,
      )
    }
  }
  return node.path.join(".")
}
