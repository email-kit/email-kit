import type { Check } from "../types.ts"
import { A11Y } from "./a11y.ts"
import { CSS } from "./css.ts"
import { DARK } from "./dark.ts"
import { HTML } from "./html.ts"
import { IMG } from "./img.ts"

/** The built-in checks over compiled output (Appendix A, phase 1, in progress). */
export const CATALOGUE: readonly Check[] = [...HTML, ...CSS, ...IMG, ...DARK, ...A11Y]
