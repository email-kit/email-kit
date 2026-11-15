# ADR 0001: Authoring primitives: our own tables, not MJML

**Status:** Proposed (2026-11-16). The code already follows this decision. It becomes Accepted once
the output has been checked in real email clients (see "Verification"). Until then MJML remains
the fallback.

## Context

Components such as `Button`, `Divider` and `DataTable`, and the page shell around every email, have
to turn into HTML that email clients render the same way. Classic Outlook for Windows is the hard
case: it lays out with Word's engine, ignores `max-width`, margins on many elements and
`border-radius`, and needs table-based layout, `mso-*` properties and conditional comments
(`<!--[if mso]>`). Classic Outlook is still common in B2B inboxes, so poor output there is a real
risk.

Two ways to produce that HTML were considered when the project began. The plan was to build one
layout (columns, a button, a divider) both ways and compare screenshots in classic Outlook at 100%
and 125% DPI, new Outlook, Gmail and Apple Mail before choosing. That comparison hasn't been run.

## Options

| Option | For | Against |
|---|---|---|
| **A. Our own table primitives.** Components write the tables, cell padding, `mso-*` styles and conditional comments directly into the IR | One pipeline from TSX to HTML. Styles are inline from theme tokens when the IR is built ([ADR 0005](0005-css-inlining.md)). We control every byte, so the checks can reason about the output and mustache-core placeholders pass through untouched. No extra dependency | We own the Outlook knowledge and its bugs. MJML's output has years of testing in real clients behind it |
| **B. MJML underneath.** Components emit MJML markup; MJML compiles it to HTML | Mature, well-tested Outlook output, including columns | A second compiler in the pipeline that has to keep `{{ }}` placeholders, inline styles and our enhancement rules intact. Its output is its own, so the checks and the IR no longer describe what ships. A large dependency in the CLI. Layout is limited to what MJML's components allow |

## Decision (proposed)

**Option A: our own table primitives.**

- Layout is built from `role="presentation"` tables and cell padding, never margins.
- The compiler's page shell centres every email in a `max-width` container of the theme's
  `layout.container` width, wrapped in an MSO ghost table of the same width, and adds Outlook's DPI
  fix and font rules when classic Outlook is a target. The `layout.ghost-table` check enforces the
  ghost table.
- Components set `mso-line-height-rule: exactly` where heights matter (`Spacer`, `Divider`, text),
  and `mso-padding-alt` on buttons.
- `Button` is a padded table cell with a link inside, so the whole button is clickable everywhere.
  Classic Outlook draws it with square corners; there's no VML "bulletproof" button.

## Verification

Before this ADR is accepted:

1. Send the `init` welcome template and one template with every component to classic Outlook (100%
   and 125% DPI), new Outlook, Gmail (web and app), Apple Mail and iOS Mail, in light and dark mode.
   A preview service such as Litmus or Email on Acid covers these.
2. Fix what breaks inside the components or the page shell.
3. If classic Outlook can't be made acceptable with reasonable effort, revisit option B for the
   affected layouts and record that in a new ADR.

## Consequences

- The components and the page shell are where Outlook fixes go. Each fix should come with a check
  where the problem can be detected statically.
- Multi-column layout (`Row`, `Column`) is not built yet. It needs ghost-table columns and should
  be part of the verification above.
- The user guide and `@email-kit/components` README say the components haven't been tested in real
  email clients. Remove that note when this ADR is accepted.
