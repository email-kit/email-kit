# ADR 0008: The backend formats dates, money and numbers

**Status:** Accepted (2026-11-15). Records rule R5 of the removed `architecture-direction.md`
(decided 2026-10-27; in git history before commit `9727c5d`), so the reasoning stays in the
repository.

## Context

Emails show values that depend on send-time data and on the recipient: an order date, a total, a
discount. How they're written depends on the locale and the time zone: `30. Oktober 2026` or
`October 30, 2026`, `43,60 €` or `€43.60`, `14:05 CET`.

Compiled templates are rendered by a small runtime in each backend language, and the same template
and data must give the same bytes in every one of them ([mustache-core](../reference/mustache-core.md)).
Locale formatting differs between JavaScript `Intl`, Python Babel and Go `x/text`: in the CLDR
version each ships, in spacing characters, and in what they support at all (Go's standard library
can't format dates by locale). The recipient's time zone is known to the backend, not to the
template.

## Options

1. **Format in the template at send time.** Templates call a formatter (`{date, date}` in a
   message, or a helper). Every runtime implements the same formatter set with the same CLDR data.
2. **The backend formats; templates print strings.** Fields that need formatting are strings in
   the schema, marked with the kind of value they hold.
3. **Format at compile time.** Only possible for values known when compiling, which these aren't.

## Decision

**Option 2.**

- Templates never format values. Dates, money, numbers and percentages that depend on send-time
  data arrive as strings the backend has formatted for the recipient.
- The schema marks such fields with `formatted(kind)`: `date`, `time`, `date-time`, `money`,
  `number` or `percent`. The kind appears in `schema.json` (`"x-email-kit": { "formatted": … }`)
  and as a comment on the generated data type, so whoever calls `render()` knows what to pass.
- Messages that format (`{date, date}`, `{n, number}`) fail the compile with
  `unsupported-message`. The `i18n.intl-format` check catches currency symbols written next to an
  argument and dates built from parts.
- Plurals are the one exception, since a count must choose a branch: see
  [ADR 0003](0003-runtime-plurals.md).

## Consequences

- Output is identical whichever language renders it, and runtimes stay small: none needs CLDR
  formatting data.
- The recipient's locale and time zone are applied where they're known.
- Each backend writes a little formatting code. The
  [formatting guide](../guide/formatting.md) shows it for JavaScript, Python and Go.
- Two backends in different languages can format the same value differently. email-kit can't
  check that; the guide tells users to compare the output for their locales.
- If demand justifies it, a later ADR can add a specified formatter set that every runtime
  implements. It would replace this one.
