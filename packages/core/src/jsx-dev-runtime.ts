import { jsx } from "./jsx-runtime.ts"

export { Fragment, type JSX } from "./jsx-runtime.ts"
/**
 * The same as `jsx()`, for development builds such as Vite's and Vitest's. The extra debugging
 * arguments they pass are ignored.
 */
export const jsxDEV: typeof jsx = jsx
