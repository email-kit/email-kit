import type { Check } from "../types.ts"
import { A11Y } from "./a11y.ts"
import { AGENTS } from "./agents.ts"
import { COMPILER } from "./compiler.ts"
import { CSS } from "./css.ts"
import { DARK } from "./dark.ts"
import { HTML } from "./html.ts"
import { I18N } from "./i18n.ts"
import { IMG } from "./img.ts"
import { LAYOUT } from "./layout.ts"
import { LEGAL } from "./legal.ts"
import { LINK } from "./link.ts"
import { OUTPUT } from "./output.ts"
import { PREHEADER } from "./preheader.ts"
import { RENDER } from "./render.ts"
import { SOURCE } from "./source.ts"
import { SUBJECT } from "./subject.ts"
import { TEXT } from "./text.ts"

/** Every built-in check, family by family. Findings are reported in this order. */
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
  ...LEGAL,
  ...I18N,
  ...TEXT,
  ...PREHEADER,
  ...SUBJECT,
  ...RENDER,
  ...OUTPUT,
  ...AGENTS,
]
