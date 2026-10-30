# Checks

<!-- Generated from packages/cli/src/checks: run `pnpm --filter @email-kit/cli test -u` after changing a check. -->

`email-kit check` runs these over the compiled emails and the theme. Change a level per project
with a reason a reviewer will read:

```ts
checks: { "img.fluid-width": { level: "off", reason: "Hero images are fixed width by design" } }
```

## Theme and tokens

### tokens.action-contrast
**Default:** error

**Rule:** Action label/fill ≥ 4.5; fill/canvas ≥ 3, or a border is set.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.brand-ink
**Default:** error

**Rule:** `brandInk` on the canvas ≥ 4.5.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.button-height
**Default:** error

**Rule:** Button minimum height ≥ 44 px (`sm` only for non-primary actions).

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.container
**Default:** warning

**Rule:** The container width is within 480–640 px.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.contrast
**Default:** error

**Rule:** Text pairs ≥ 4.5 (large text and non-text ≥ 3) in light and authored dark.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.dark-ground
**Default:** warning

**Rule:** The authored dark ground isn't `#000000` (aim for `#0a0a0a`–`#1a1a1a`).

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.font-stack
**Default:** error

**Rule:** Every stack ends in a generic family and has an MSO fallback.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.gamut
**Default:** note

**Rule:** Out-of-gamut colours are mapped into sRGB; reports the source and the hex.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.gmail-fill
**Default:** note

**Rule:** Action fill YIQ ≤ 205, so Gmail Android leaves it unchanged.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.letter-spacing
**Default:** warning

**Rule:** Letter-spacing is in px.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.light-ground
**Default:** note

**Rule:** The light ground isn't `#ffffff`.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.link-contrast
**Default:** error

**Rule:** The link colour ≥ 4.5 against the canvas and the page ground in each mode.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.midtone
**Default:** warning

**Rule:** Grounds behind text and meaningful borders aren't in L* 40–65.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.min-size
**Default:** error

**Rule:** Type sizes ≥ 14 px (a warning), never < 13 px (an error).

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.offwhite-tint
**Default:** warning

**Rule:** No near-white with a 1–3 unit channel offset.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.radius
**Default:** error

**Rule:** Radius values parse to single px values.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

### tokens.weights
**Default:** warning

**Rule:** Font weights are 400 or 700.

**Fix:** Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.

## Sources

### source.no-literal-colour
**Default:** error

**Rule:** No literal colours in the styles and colour attributes of templates and user components.

**Fix:** Use a theme role: `style={{ color: role("mutedInk") }}`. Roles get their dark-mode rules and contrast checks; literals get neither.

### source.no-font-family
**Default:** error

**Rule:** No `font-family` in templates or user components.

**Fix:** Font stacks come from the theme (`theme.typography.stacks`), with the fallback classic Outlook needs; use Text, Heading or the font() helper.

### source.no-font-size
**Default:** error

**Rule:** No literal `font-size` in templates or user components, except 0 or 1px on spacer and divider cells.

**Fix:** Sizes come from the type scale: use Text or Heading with a size, or the font() helper.

### source.fixture-exists
**Default:** error

**Rule:** Every template has at least one fixture.

**Fix:** Add sample data under `fixtures` in defineEmail(): the studio previews it and the checks render it.

## Document

### html.doctype
**Default:** error

**Rule:** The email starts with `<!doctype html>`.

**Fix:** Start the document with `<!DOCTYPE html>`; without it, clients render in quirks mode.

### html.lang-dir
**Default:** error

**Rule:** `lang` and `dir` on `<html>` and the wrapper, `xml:lang` on the body, matching the locale.

**Fix:** Render through email-kit's document skeleton, which sets them from the locale.

### html.title
**Default:** warning

**Rule:** `<title>` is present and equals the subject.

**Fix:** Screen readers and some clients show the title; keep it the subject.

### html.xmlns
**Default:** error

**Rule:** Office (`o:`) and VML (`v:`) elements need their namespace on `<html>`.

**Fix:** Declare xmlns:o="urn:schemas-microsoft-com:office:office" or xmlns:v="urn:schemas-microsoft-com:vml".

### html.no-forms-embeds
**Default:** error

**Rule:** No form, input, script, iframe, object, embed, video or svg elements.

**Fix:** Clients strip them or mark the email as suspicious; link to a web page instead.

### html.no-body-style
**Default:** error

**Rule:** No `<style>` inside `<body>`.

**Fix:** Put styles inline or in the head; clients drop body styles.

### html.data-detectors
**Default:** warning

**Rule:** The Apple data-detector reset is present.

**Fix:** Keep the `a[x-apple-data-detectors]` rule email-kit writes in the head.

### html.mso-font
**Default:** error

**Rule:** The MSO font override is present. Runs when classic Outlook is a target.

**Fix:** Keep the `[if mso]` style that sets a font-family; without it Word falls back to Times New Roman.

### html.dpi-noscript
**Default:** error

**Rule:** PixelsPerInch XML inside an MSO conditional and `<noscript>`. Runs when classic Outlook is a target.

**Fix:** Keep the OfficeDocumentSettings block email-kit writes; it stops Word scaling on high-DPI screens.

## CSS

### css.no-double-brace
**Default:** error

**Rule:** No `}}` in CSS.

**Fix:** Separate closing braces with a space or a newline: Outlook on the web and the Outlook apps drop all CSS after `}}`.

### css.important-lowercase
**Default:** error

**Rule:** `!important` is lowercase with a space before it, and never inline.

**Fix:** Write ` !important`; Gmail drops the whole <style> block for `!IMPORTANT`. Inline styles win without it.

### css.no-nesting
**Default:** error

**Rule:** No nested rules, and no at-rule inside an at-rule.

**Fix:** Flatten the CSS: Gmail drops the block, Yahoo applies nested properties to the parent.

### css.no-modern-colour
**Default:** error

**Rule:** No oklch(), oklab(), lch(), lab(), color-mix(), color(), light-dark() or hsl(), and no space-separated rgb().

**Fix:** Use #rrggbb: Gmail drops the whole <style> block for modern colour syntax. Theme colours are converted for you.

### css.no-custom-props
**Default:** error

**Rule:** No custom properties (`--x:`) or `var()`.

**Fix:** Most clients don't support them; email-kit writes resolved values from the theme.

### css.style-size
**Default:** error

**Rule:** All `<style>` blocks together stay under 16,384 bytes (a warning from 12 KB).

**Fix:** Gmail ignores styles past about 16 KB. Move rules inline or drop unused ones.

## Images

### img.alt
**Default:** error

**Rule:** Every image has `alt`, non-empty when it is linked.

**Fix:** Describe what the image says, name the destination of a linked one, or use alt="" for decoration.

### img.dimensions
**Default:** error

**Rule:** Every image has integer `width` and `height` attributes.

**Fix:** Word ignores CSS widths on images, and blocked images keep their space only with both attributes.

### img.https
**Default:** error

**Rule:** Image URLs are absolute `https:` URLs.

**Fix:** Gmail and Apple fetch images through proxies; relative and http: URLs break or warn.

### img.format
**Default:** error

**Rule:** Images are PNG, JPEG or GIF; never SVG or `data:` URIs.

**Fix:** Export a PNG or JPEG: SVG shows blank in Outlook on the web, classic Outlook can't show WebP or AVIF, Gmail drops data: images.

### img.fluid-width
**Default:** warning

**Rule:** An image with `max-width:100%` also has `width:100%`.

**Fix:** Gmail's Android web client rewrites a lone max-width; give width:100% and max-width in px.

## Dark mode

### dark.scheme-declared
**Default:** error

**Rule:** Dark CSS is present if, and only if, the color-scheme meta and `:root { color-scheme }` are.

**Fix:** Apple Mail applies dark CSS only after both declarations; without dark CSS, declaring them turns unstyled text light.

### dark.ogsc-twin
**Default:** warning

**Rule:** Every `prefers-color-scheme` rule has a `[data-ogsc]`/`[data-ogsb]` descendant twin; no `.x[data-og*]`.

**Fix:** Outlook.com ignores the media query and matches attribute selectors only in descendant form, `[data-ogsc] .x`.

### dark.light-only-css-twin
**Default:** warning

**Rule:** A `light only` meta with a dark palette also has `:root { color-scheme: light dark }`.

**Fix:** Apple Mail lets the CSS override the meta, so the authored dark palette still applies there.

### dark.no-blend-hack
**Default:** warning

**Rule:** No `u + .body` blend-mode hack.

**Fix:** It breaks in current Gmail apps and inverts images; author a dark palette instead.

## Accessibility

### a11y.layout-table-role
**Default:** error

**Rule:** Layout tables have `role="presentation"` and no `th`, `caption`, `summary` or `scope`.

**Fix:** Add role="presentation" to tables used for layout; otherwise screen readers announce rows and columns.

### a11y.data-table
**Default:** error

**Rule:** Data tables have `th scope`, a caption or a heading before them, at least 2 × 2 cells, and no presentation role.

**Fix:** Use DataTable, which writes all of these.
