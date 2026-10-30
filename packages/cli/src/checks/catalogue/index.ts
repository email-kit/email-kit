import type { Check } from "../types.ts"
import { A11Y } from "./a11y.ts"
import { CSS } from "./css.ts"
import { DARK } from "./dark.ts"
import { HTML } from "./html.ts"
import { I18N } from "./i18n.ts"
import { IMG } from "./img.ts"
import { RENDER } from "./render.ts"
import { SOURCE } from "./source.ts"

/** The built-in checks over compiled output (Appendix A, phase 1, in progress). */
export const CATALOGUE: readonly Check[] = [
  ...SOURCE,
  ...HTML,
  ...CSS,
  ...IMG,
  ...DARK,
  ...A11Y,
  ...I18N,
  ...RENDER,
]
