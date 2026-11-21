---
"@email-kit/cli": minor
---

Templates no longer need `/** @jsxImportSource @email-kit/core */` when the tsconfig makes
email-kit's JSX the default. `init` sets `"jsxImportSource": "@email-kit/core"` next to
`"jsx": "react-jsx"` in a project with no JSX of its own, and leaves it out of the welcome
template. `email-kit new` writes the line only when the nearest tsconfig doesn't set it. Projects
with their own JSX, such as Next.js or Hono apps, keep the line.

The new check `source.jsx-pragma` warns about a template or user component that has JSX without
the line, where its tsconfig doesn't set email-kit's JSX, and about a pragma that names another
runtime. The compile is right either way. The check is there because, without the line,
TypeScript and the editor check the file against another framework's JSX types.
