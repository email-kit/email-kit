# Checks

<!-- Generated from packages/cli/src/checks: run `pnpm --filter @email-kit/cli test -u` after changing a check. -->

`email-kit check` runs these over the compiled emails and the theme. Change a level per project
with a reason a reviewer will read:

```ts
checks: { "img.fluid-width": { level: "off", reason: "Hero images are fixed width by design" } }
```

## Team checks

Add your own rules with `defineCheck()` in `customChecks`. They run with the catalogue, take
levels from `checks`, and show in every reporter. Use a family of your own for the id.

```ts
import { defineCheck, defineConfig } from "@email-kit/core"

const helpLink = defineCheck({
  id: "acme.help-link",
  level: "warn",
  rule: "Every email links to the help centre.",
  fix: "Add the footer's help link.",
  run({ emails }, report) {
    for (const email of emails) {
      const hrefs = email.elements("a").map((a) => a.attributes.href ?? "")
      if (!hrefs.some((href) => href.startsWith("https://help.acme.com"))) {
        report({ email, message: "No link to the help centre" })
      }
    }
  },
})

export default defineConfig({ customChecks: [helpLink] })
```

Each email has `template`, `locale`, `subject`, `preheader`, `html`, `text` and
`elements(name?)`. Set `on: "render"` to check the renders of every fixture and generated
variant instead of the compiled templates (each render then has `fixture`), or `both`.

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

### source.id-grammar
**Default:** error

**Rule:** Template ids are lowercase words joined by hyphens, unique, and the name of the template's folder. Enforced when compiling: the compile fails with `invalid-id` or `id-mismatch`, which `email-kit check` reports as this check.

**Fix:** Rename the template id, like "password-reset", and its folder to match.

### source.fixture-valid
**Default:** error

**Rule:** Every fixture validates against the template's schema. Enforced when compiling: the compile fails with `invalid-fixture`, which `email-kit check` reports as this check.

**Fix:** Correct the fixture at the path in the message, or the schema.

### source.schema-portable
**Default:** error

**Rule:** The schema stays within the portable JSON Schema subset. Enforced when compiling: the compile fails with `schema-not-portable` or `unsupported-schema` or `missing-converter`, which `email-kit check` reports as this check.

**Fix:** Use the types and constraints every target language can check; the message names the field.

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

**Fix:** Add sample data under `fixtures` in defineEmail(): the checks render it, and so will the preview studio.

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

**Rule:** No form, input, script, iframe, object, embed, video or svg elements. Also runs on the renders, for values that come from data.

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

### html.wrapper-aria
**Default:** warning

**Rule:** The wrapper has role="article" and an aria-label; aria-roledescription only when localised.

**Fix:** Keep email-kit's document wrapper: screen readers announce the email by its label.

### html.meta
**Default:** error

**Rule:** The head starts with the charset meta and has viewport, x-apple-disable-message-reformatting and format-detection.

**Fix:** Keep email-kit's document head: these stop clients rescaling the email and turning numbers into links.

### html.body-bare
**Default:** warning

**Rule:** <body> has no presentational attributes or styles beyond margin and padding 0.

**Fix:** Gmail, Outlook on the web and Yahoo replace <body>: put backgrounds and spacing on the wrapper.

### html.no-external
**Default:** error

**Rule:** No external stylesheets or @import.

**Fix:** Most clients block them, and they add a tracking request: email-kit writes styles inline and in the head.

### html.no-svg
**Default:** error

**Rule:** No inline <svg> and no SVG references.

**Fix:** Use a PNG: SVG shows blank in Outlook on the web and new Outlook, and Gmail rasterises it.

### html.no-comments
**Default:** error

**Rule:** No HTML comments longer than 120 characters, except MSO conditionals.

**Fix:** Remove the comment: it ships to every reader, counts toward Gmail's clip, and may leak internal notes.

### html.no-unresolved
**Default:** error

**Rule:** No leftover markers, and every placeholder names a field of the schema.

**Fix:** A placeholder that names no field renders empty: check the template against its schema.

### html.hidden-text
**Default:** warning

**Rule:** Hidden styling is used only on the preheader.

**Fix:** Hidden text in the body looks like spam to filters and confuses screen readers: remove it or show it.

## Layout

### layout.ghost-table
**Default:** error

**Rule:** Each `max-width` container sits inside an MSO ghost table of the same px width. Runs when classic Outlook is a target.

**Fix:** Classic Outlook ignores max-width and stretches the content across the reading pane: wrap the container in `<!--[if mso]><table width="N">…<![endif]-->`, as email-kit's page shell does.

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

### css.colour-hex
**Default:** error

**Rule:** Every colour, in CSS and in attributes, is #rrggbb or transparent.

**Fix:** Write six-digit hex: three-digit hex, names and functions break in some clients. Theme roles are hex already.

### css.no-alpha
**Default:** warning

**Rule:** No rgba(), hsla(), 8-digit hex or opacity.

**Fix:** Clients that ignore alpha show the colour solid or not at all: flatten it against its background (the theme does).

### css.banned-layout
**Default:** error

**Rule:** No flex, grid, float, position, calc(), clamp(), min(), max(), :has() or @supports.

**Fix:** Classic Outlook and many webmail clients drop these: lay out with tables, as email-kit's components do.

### css.media-allowlist
**Default:** warning

**Rule:** Media queries use only width, orientation, resolution and prefers-color-scheme.

**Fix:** Other features are unsupported or rewritten by email clients; keep the query to these.

### css.inline-parse
**Default:** error

**Rule:** Every inline style parses cleanly.

**Fix:** Gmail, Outlook on the web and Office 365 drop a whole style attribute with a stray character: fix the declaration.

### css.gradient-fallback
**Default:** error

**Rule:** An element with a background image or gradient also has a solid background colour.

**Fix:** Add background-color (or bgcolor): Outlook and images-off show the colour, and text on it stays readable.

### css.units
**Default:** warning

**Rule:** No rem, vw or vh in inline styles.

**Fix:** Use px: several clients ignore relative units inline.

### css.hide-mso
**Default:** warning

**Rule:** display:none outside MSO blocks comes with mso-hide:all.

**Fix:** Classic Outlook ignores display:none on some elements: add mso-hide:all.

### css.line-height-px
**Default:** error

**Rule:** Text cells set a px line height with mso-line-height-rule:exactly.

**Fix:** Use Text, Heading or the font() helper: Word's default line height differs from every other client's.

## Images

### img.alt
**Default:** error

**Rule:** Every image has `alt`, non-empty when it is linked. Also runs on the renders, for values that come from data.

**Fix:** Describe what the image says, name the destination of a linked one, or use alt="" for decoration.

### img.dimensions
**Default:** error

**Rule:** Every image has integer `width` and `height` attributes.

**Fix:** Word ignores CSS widths on images, and blocked images keep their space only with both attributes.

### img.https
**Default:** error

**Rule:** Image URLs are absolute `https:` URLs. Also runs on the renders, for values that come from data.

**Fix:** Gmail and Apple fetch images through proxies; relative and http: URLs break or warn.

### img.format
**Default:** error

**Rule:** Images are PNG, JPEG or GIF; never SVG or `data:` URIs. Also runs on the renders, for values that come from data.

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

### a11y.one-h1
**Default:** error

**Rule:** Exactly one `h1` (a warning when there is none).

**Fix:** Start the email with one Heading (level 1): screen reader users jump to it, and a second one splits the email in two.

### a11y.link-text
**Default:** error

**Rule:** No empty links (error) and no generic link text such as "click here" (warning).

**Fix:** Say where the link goes ("View your order"): screen reader users list links out of context.

### a11y.font-size
**Default:** error

**Rule:** Text is at least 12 px (error), and 14 px or more (warning below).

**Fix:** Use a type step from the theme: body is 16 px and the smallest step 14 px.

### a11y.viewport
**Default:** error

**Rule:** The viewport meta doesn't block zoom (`user-scalable=no` or `maximum-scale` below 2).

**Fix:** Use `width=device-width, initial-scale=1` only: people with low vision zoom to read.

## Links

### link.dangerous-schemes
**Default:** error

**Rule:** No `javascript:`, `vbscript:`, `data:` or `file:` URLs.

**Fix:** Link to an https:// page instead: clients strip these URLs or flag the email as phishing.

### link.url-fields
**Default:** error

**Rule:** An `href` or `src` starts with a literal https:// (or mailto:/tel:) URL or a `url` field.

**Fix:** Mark the field with `url` in the schema (`z.string().meta(url)`): render() then accepts only https URLs.

## Legal

### legal.purpose-declared
**Default:** error

**Rule:** Every template declares a purpose: "transactional", "marketing" or "consent-request". Enforced when compiling: the compile fails with `invalid-purpose`, which `email-kit check` reports as this check.

**Fix:** Add `purpose` to `defineEmail()`; any promotional content makes it "marketing".

### legal.reason
**Default:** error

**Rule:** Every email says why the reader got it ("why you got this"), naming the account or subscription.

**Fix:** Add `<Footer reason={t("footer")} …>`, with a line like "You're receiving this because you have an account with Acme."

### legal.sender-identity
**Default:** error

**Rule:** Every email names who sends it: the legal name or brand.

**Fix:** Add `<Footer sender={sender.legalName} …>`, with `legalName` (or `productName`) set in the config's `sender`.

### legal.postal-address
**Default:** error

**Rule:** Marketing and consent-request emails show the sender's postal address.

**Fix:** Pass `address={sender.postalAddress}` to `Footer`, with `postalAddress` set in the config's `sender`.

## Internationalisation

### i18n.missing-keys
**Default:** error

**Rule:** Every locale has every message key a template uses. Enforced when compiling: the compile fails with `missing-message`, which `email-kit check` reports as this check.

**Fix:** Add the key to the locale's messages file the message names.

### i18n.plural-categories
**Default:** error

**Rule:** Plural messages cover every CLDR category of the locale. Enforced when compiling: the compile fails with `invalid-plural`, which `email-kit check` reports as this check.

**Fix:** Add the categories the message lists for that locale.

### i18n.fallback
**Default:** error

**Rule:** The locale fallback chain resolves to a compiled locale. Enforced when compiling: the compile fails with `invalid-config`, which `email-kit check` reports as this check.

**Fix:** Point locales.fallback at a locale in locales.list.

### i18n.expansion
**Default:** error

**Rule:** Every template compiles in the pseudo-locales en-XA (accented, bracketed, longer by length) and ar-XB (right to left), and passes the static checks there.

**Fix:** Translations run up to three times longer and right to left: don't build copy from fragments, and don't let the layout depend on a string's length.

### i18n.intl-format
**Default:** error

**Rule:** No currency symbols next to an argument, and no dates built from parts, in messages or templates.

**Fix:** Format the value in the backend for the recipient's locale (Intl.NumberFormat with a currency, Intl.DateTimeFormat with a time zone) and pass it as a field marked formatted("money") or formatted("date").

### i18n.unused-keys
**Default:** warning

**Rule:** Every message key is used by its template.

**Fix:** Delete the key from every locale, or use it. Translators spend time on every key.

### i18n.rtl-explicit
**Default:** error

**Rule:** In right-to-left emails, every text cell (p, h1–h6, li, td, th, caption) carries dir and an explicit alignment.

**Fix:** Use email-kit's components, which do this, or add dir="rtl" and text-align to the element: Orange strips dir from tables and cells, and Outlook mishandles inherited direction.

## Text part

### text.present
**Default:** error

**Rule:** The text part has at least 80 characters of its own copy.

**Fix:** Every email needs a real text part: spam filters score a missing or token one, and some readers only see it.

### text.no-markup
**Default:** error

**Rule:** The text part has no HTML tags.

**Fix:** Text-part copy comes from the same messages as the HTML: remove markup from the message.

### text.no-entities
**Default:** error

**Rule:** The text part has no HTML entities.

**Fix:** Write the character itself (é, ’, &): entities show up literally in plain text.

### text.wrap-78
**Default:** warning

**Rule:** Text-part lines are at most 78 characters, except lines with a URL.

**Fix:** Shorten the copy or split the paragraph: RFC 5322 recommends 78, and some clients wrap long lines badly.

### text.urls-full
**Default:** error

**Rule:** Links are absolute URLs, so the text part can show them.

**Fix:** Use https:// URLs (or a url field): a relative link can't be followed from plain text, or from a forward.

### text.links-match
**Default:** error

**Rule:** Every HTML link appears in the text part, and every URL in the text part is a link in the HTML.

**Fix:** Write links with Link or Button, which put them in both parts; don't paste URLs into copy.

### text.parity
**Default:** warning

**Rule:** The text part carries the words of the HTML (at least 80% of them).

**Fix:** Spam filters compare the parts (MPART_ALT_DIFF): keep the same copy in both.

### text.preheader-first
**Default:** warning

**Rule:** The text part starts with the preheader.

**Fix:** Keep email-kit's text part: clients preview the first line of text when there's no HTML.

### text.no-preheader-padding
**Default:** error

**Rule:** The text part has none of the preheader's filler characters.

**Fix:** The filler pads the HTML preview only; in plain text it shows as junk.

### text.no-decorative-runs
**Default:** warning

**Rule:** No long runs of =, -, * or _ beyond heading underlines.

**Fix:** Screen readers read every character: drop the decoration.

## Preheader

### preheader.first
**Default:** error

**Rule:** The first text in the wrapper is the hidden preheader.

**Fix:** Set the preheader in defineEmail(): clients preview the first text they find.

### preheader.not-subject
**Default:** error

**Rule:** The preheader isn't the subject again.

**Fix:** Use the preheader to add something: the inbox shows both side by side.

### preheader.length
**Default:** warning

**Rule:** The preheader has 1–90 visible characters. Runs on the renders of every fixture and generated variant.

**Fix:** Without one, clients preview the first body text; past about 90 characters it's cut.

### preheader.padding
**Default:** warning

**Rule:** The hidden preheader is padded with filler, so body text doesn't leak into the preview.

**Fix:** Keep email-kit's preheader block: the filler pushes the body text out of the preview.

### preheader.no-boilerplate
**Default:** error

**Rule:** The preheader has no "view in browser" or "trouble viewing" text.

**Fix:** Say what the email is about: boilerplate wastes the preview and reads as spam.

## Subject

### subject.length
**Default:** warning

**Rule:** The subject is at most 60 characters. Runs on the renders of every fixture and generated variant.

**Fix:** Phones show about 30–40 characters: put the key words first and cut the rest.

### subject.no-fake-reply
**Default:** error

**Rule:** The subject doesn't start with Re: or Fwd:.

**Fix:** A fake reply prefix is deceptive and a spam signal: describe the email instead.

### subject.no-secret
**Default:** error

**Rule:** No secret field (a code or token) in the subject or the preheader.

**Fix:** Subjects show on lock screens and in provider logs: put the code in the body only.

### subject.generic
**Default:** warning

**Rule:** The subject isn't generic ("Update", "Notification", "Important").

**Fix:** Say what happened: generic subjects get ignored and look like spam.

## Copy

### copy.placeholder-fallbacks
**Default:** error

**Rule:** Empty, long and real data render cleanly: no “Hi ,”, doubled spaces or empty brackets in the subject, preheader or text. Runs on the renders of every fixture and generated variant.

**Fix:** Give the value a fallback, restructure the message (“Hi,” rather than “Hi {name},”), or require it in the schema (`z.string().min(1)`).

## Size

### size.gmail
**Default:** error

**Rule:** The HTML part of the largest render, plus 5 KB for the provider, stays under Gmail's 102 KB clip (a warning from 90 KB). Runs on the renders of every fixture and generated variant.

**Fix:** Gmail hides everything past the clip behind “View entire message”, footers and tracking included. Trim the content, or cap long lists.

## Output

### output.identifiers
**Default:** error

**Rule:** The identifiers derived from template ids are unique and not reserved in target languages. Enforced when compiling: the compile fails with `identifier-collision`, which `email-kit check` reports as this check.

**Fix:** Rename one of the templates the message names.

### output.drift
**Default:** error

**Rule:** The committed output equals a fresh compile.

**Fix:** Run `email-kit compile` and commit the result: the module your app imports is out of date.

### output.manifest
**Default:** error

**Rule:** With `contract: true`, the manifest lists exactly the compiled templates and locales, and its hashes match the files.

**Fix:** Don't edit compiled files by hand: change the template or messages and run `email-kit compile`.

### output.no-orphans
**Default:** error

**Rule:** Every template folder in the output folder has a source template.

**Fix:** Delete the folder, or restore its template: the module may still export a template that no longer exists.

### output.runtime-dependency
**Default:** error

**Rule:** `@email-kit/runtime` is in the app's dependencies, not its devDependencies: the generated module imports it when the app runs.

**Fix:** Install it as a dependency: `npm install @email-kit/runtime` (or your package manager's equivalent). Production installs leave devDependencies out.

### output.gitignored
**Default:** warning

**Rule:** The output folder is committed, not gitignored.

**Fix:** Commit the output so deploys don't need a compile step, or compile in your build and set this check off with that reason.
