# email-kit playground

A small project to try email-kit by hand: three transactional templates in English and German, a
shadcn-style theme, and one team check. Nothing here is published.

| Template | Shows |
|---|---|
| `sign-in-code` | `OtpCode`, `Callout`, an optional field with `If` |
| `receipt` | `Image`, `KeyValue`, `LineItems` with an optional discount, `Button`, `Divider`, `Link` |
| `security-alert` | `Callout`, stacked `KeyValue`, a destructive `Button`, `DataTable` |

## Setup

From the repository root, once:

```sh
pnpm install
pnpm build            # builds the packages, including the email-kit CLI
cd examples/playground
```

## Things to try

1. **Compile.** `pnpm compile` writes `email-kit/compiled/`: per template and locale an `.html` and
   a `.txt`, plus `schema.json`, `manifest.json` and the typed module `index.mjs` / `index.d.mts`.
   Add `--verbose` for sizes, or run `pnpm exec email-kit compile --watch` and edit a message.
2. **Preview.** `pnpm preview` compiles, renders every fixture in both locales and writes
   `preview/index.html`. Open it in a browser. Switch your OS to dark mode and reload: the
   authored dark palette applies (Apple Mail behaves the same way).
3. **Theme.** `pnpm tokens` prints every colour role in light and dark with its contrast ratio,
   and the findings. Change `--primary` in `theme/globals.css` to something pale, such as
   `oklch(0.9 0.05 264)`, and run it again: the button label fails contrast and the command
   exits 1.
4. **Checks.** `pnpm check` compiles in memory (it writes nothing) and runs every check over the
   compiled emails, the renders of each fixture and generated variant, the source files and the
   theme. Try `pnpm check --reporter github` and `pnpm check --json` too.
   - The team check in `email-kit.config.ts` warns that `sign-in-code` has no help link. Add a
     `Link` to `https://help.playground.example`, or turn the check off with a reason in `checks`.
   - Break things and watch them get caught:
     - `style={{ color: "#333" }}` in a template: `source.no-literal-colour`, with the line;
     - an `Image` with `src="https://…/logo.svg"`: the compile fails with `invalid-image`;
     - remove `.min(1)` from `customerName` in `receipt.tsx`: the generated empty fixture renders
       "Thanks, !" and `copy.placeholder-fallbacks` fails, naming the fixture;
     - change `"minutes": 10` to `"10"` in `fixtures/sign-in-code.json`: the compile fails with
       `invalid-fixture` and the path.
5. **Plurals.** The sign-in code's expiry is an ICU plural:
   `{minutes, plural, one {# minute} other {# minutes}}`. The `one-minute` fixture renders
   "1 minute". Remove the `one` case and compile: it fails, because English needs it.
6. **Pseudo-locales.** `pnpm check` also builds every template in `en-XA` (accented, bracketed,
   up to three times longer) and `ar-XB` (right to left). Set `locales.pseudo: true` in the config
   and run `pnpm preview` to look at them in the browser.
7. **The module.** `email-kit/compiled/index.d.mts` is what a backend imports: `createEmails`,
   `render(data, { locale })` and the data types. `preview.mjs` uses it the way a backend would.

## Real email clients

The preview is a browser, not an email client. To see real rendering, send a file from
`preview/` through your own mail tool, or paste it into a testing service (Litmus, Email on Acid).
Classic Outlook on Windows and Gmail are the ones that differ most. This is the real-client
testing (P0-04) that ADR 0001 waits on, and the findings are welcome.
