import type { Check } from "../types.ts"
import { A11Y } from "./a11y.ts"
import { COMPILER } from "./compiler.ts"
import { CSS } from "./css.ts"
import { DARK } from "./dark.ts"
import { HTML } from "./html.ts"
import { I18N } from "./i18n.ts"
import { IMG } from "./img.ts"
import { LAYOUT } from "./layout.ts"
import { LINK } from "./link.ts"
import { OUTPUT } from "./output.ts"
import { RENDER } from "./render.ts"
import { SOURCE } from "./source.ts"
import { TEXT } from "./text.ts"

/** The built-in checks over compiled output (Appendix A, phase 1, in progress). */
export const CATALOGUE: readonly Check[] = [
  ...COMPILER,
  ...SOURCE,
  ...HTML,
  ...LAYOUT,
  ...CSS,
  ...IMG,
  ...DARK,
  ...A11Y,
  ...LINK,
  ...I18N,
  ...TEXT,
  ...RENDER,
  ...OUTPUT,
]
