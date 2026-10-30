// Used by transforms in development mode. The extra jsxDEV arguments (source, self) are ignored.

import { jsx } from "./jsx-runtime.ts"

export { Fragment, type JSX } from "./jsx-runtime.ts"

export const jsxDEV: typeof jsx = jsx
