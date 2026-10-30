# P0-09: CSS inliner

**Status:** done; feeds ADR 0005 (P0-12). **Code:** [`spikes/css-inliner/`](../../spikes/css-inliner/bench.ts)
(`pnpm --filter @email-kit/spike-css-inliner bench`).

## Question

BLD-03 says every declaration ends up inline, and only enhancement rules (media queries, dark
mode, client hooks) stay in `<style>`. Which inliner should do it: `juice` or
`@css-inline/css-inline`?

## What was tested

The fixture, [`fixture.html`](../../spikes/css-inliner/fixture.html), is compiled email-kit
output **with its mustache-core placeholders still in**, because that is when the compiler would
inline. It contains:
- the research 01 §2 skeleton, with the DPI block;
- an MSO ghost table;
- a VML button with its `<!--[if !mso]><!-->` twin;
- `{{#items}}` rows directly inside `<tbody>`;
- a placeholder in `<title>` and in attributes;
- the `&#123;` brace escape the serialiser writes;
- `&zwnj;&nbsp;` preheader filler;
- RTL text;
- dark-mode, `[data-ogsc]` and Apple data-detector rules.

Five variants were run: juice; juice with its `{{ }}` protection turned off; juice with the
enhancement rules in a `<style data-embed>` block; css-inline; and css-inline behind a protection
layer written for this spike.

## Results

juice 12.2.1 and css-inline 0.23.2, Node 24.13, macOS arm64.

| Check | juice | juice, code blocks off | juice + data-embed | css-inline | css-inline + protect |
|---|---|---|---|---|---|
| doctype kept | ✓ | ✓ | ✓ | ✓ | ✓ |
| MSO comments byte-identical | ✓ | ✓ | ✓ | ✓ | ✓ |
| placeholders unchanged | ✓ | ✓ | ✓ | **✗** | ✓ |
| valid mustache-core | ✓ | ✓ | ✓ | ✓ | ✓ |
| sections stay between rows | ✓ | ✓ | ✓ | **✗** | ✓ |
| brace entities kept (no `{{{`) | ✓ | ✓ | ✓ | **✗** | ✓ |
| preheader filler kept | ✓ | ✓ | ✓ | ✓ | ✓ |
| non-ASCII kept | ✓ | ✓ | ✓ | ✓ | ✓ |
| no self-closing voids | ✓ | ✓ | ✓ | ✓ | ✓ |
| layout attributes kept | ✓ | ✓ | ✓ | ✓ | ✓ |
| styles inlined | ✓ | ✓ | ✓ | ✓ | ✓ |
| inline style wins | ✓ | ✓ | ✓ | ✓ | ✓ |
| enhancement rules kept | **✗** | **✗** | ✓ | ✓ | ✓ |
| lowercase `!important`, no `}}` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Long email (10 KB), warm median | 3–8 ms | 3–5 ms | 2–3 ms | 0.7–1 ms | 1.3–1.6 ms |
| Install size | 19.7 MB | 19.7 MB | 19.7 MB | 5.4 MB | 5.4 MB |

**css-inline as shipped is unsafe for our output.** It parses with html5ever, a spec-compliant
parser, which causes two failures:
1. **Sections inside tables move.** The parser "foster-parents" stray text out of a `<table>`. So
   `{{#items}}` and `{{/items}}` end up *before* the table, and the rows are no longer repeated.
2. **Brace entities are decoded, which breaks escaping.** `&#123;{{code}}&#125;` is re-serialised
   as `{{{code}}}`. That is still valid mustache-core, but it is now an **unescaped** placeholder:
   an HTML-injection hole for `code`.

A protection layer fixes both. It swaps text-position tags and brace entities for comments, and
must skip `<title>` (RCDATA), which the first version got wrong. But it is a context-aware HTML
scanner we would own forever.

**juice gets placeholders right by default.** It has built-in `{{ }}` "code block" protection,
cheerio uses the forgiving htmlparser2 (no foster-parenting), and entities aren't decoded. It
**drops enhancement rules that match no element**, though: `[data-ogsc] .text` (Outlook.com dark
mode) and `a[x-apple-data-detectors]`. Its documented `<style data-embed>` block avoids that.

The cost of juice is a 19.7 MB tree (cheerio, undici, web-resource-inliner) and a few
milliseconds per email. Speed is irrelevant at build time.

## Recommendation (for ADR 0005)

**Don't run an HTML inliner in the default pipeline.** Write styles inline at the IR level.

- The compiler already builds the IR, and the prototype components set `style` objects from theme
  tokens directly.
- PRD UI-01 and the `source.no-literal-*` checks already rule out user-written CSS. So class rules
  to inline only exist if we generate them, and we can generate inline declarations instead.
- What does go in `<style>` (media queries, dark-mode twins, client hooks) is generated from rule
  lists (BLD-05) and is never inlined anyway.

That removes the whole failure class above, because the placeholder HTML is never re-parsed. It
also keeps MSO comments safe by construction and adds no dependency. The `css.*` checks still
verify the final output.

**If a stylesheet-authoring feature is ever added** (registry blocks with classes, a user
`styles` escape hatch), use **juice**:
- put the generated enhancement rules in `<style data-embed>`;
- keep juice's `{{ }}` code-block protection on;
- pin it, and add this bench's checks as regression tests.

Use css-inline only behind a protection layer, and only if speed ever matters, for example
runtime inlining.

## Follow-ups

- **P1-062 (CSS pipeline):** generate inline declarations in the serialiser, with deterministic
  property order, `px` units and hex colours. Merging with the explicit `style` prop: the
  explicit value wins, as tested here.
- **P1-113 (dark CSS):** dark rules go to `<style>` as generated; nothing is inlined from them.
- **A regression test for the serialiser:** HTML output never contains a raw `{` next to a tag.
  It already writes `&#123;`; the `{{{` guard exists only for the text part.
