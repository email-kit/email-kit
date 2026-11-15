# Theme and dark mode

The theme gives every colour, font, size and radius the components use. Without one, emails use
email-kit's built-in neutral theme: shadcn/ui's neutral palette, adjusted so it passes the contrast
checks.

Set it in `email-kit.config.ts` under `theme`. If your app uses shadcn/ui, `init` finds its CSS
file and asks whether to use it, so your emails match your app from the start.

## Options

```ts
theme: {
  source: "app/globals.css",
  roles: { link: { light: "#1d4ed8", dark: "#93c5fd" } },
  radius: 6,
  layout: { container: 640 },
  typography: {
    stacks: { sans: ["Inter", "Helvetica", "Arial", "sans-serif"] },
    scale: { body: { sizePx: 16, lineHeightPx: 26 } },
  },
}
```

| Field | Type | Default | |
|---|---|---|---|
| `source` | see [Sources](#sources) | the built-in theme | Where the colours come from |
| `input` | `{ [modifier]: context }` | each modifier's default | For a DTCG resolver source only: the context of each modifier besides light and dark, such as `{ brand: "acme" }` |
| `roles` | `{ [role]: colour }` | | Override a [role](#roles) with a CSS colour or a `"{token}"` from the source, for both modes or `{ light, dark }` |
| `typography.stacks` | `{ sans?, serif?, mono? }` | system stacks | Font families in order, ending in a generic family. The last named family is classic Outlook's fallback |
| `typography.scale` | `{ [step]: Partial<TypeStyle> }` | see [Type scale](#type-scale) | Override steps of the type scale |
| `radius` | `number` | the source's `--radius`, else 10 | The base radius in px |
| `layout.container` | `number` | `600` | The width of the centred container, in px. Keep it within 480–640 (`tokens.container`) |
| `dark` | `"authored"` or `"none"` | `"authored"` if the source has a dark palette, else `"none"` | Whether the email carries your dark palette |
| `emit` | `boolean` | `false` | Also write the resolved theme to `<out>/theme.json` |

Every colour is converted to 6-digit hex, since email clients don't all read modern colour syntax:
out-of-gamut colours are mapped into sRGB, and translucent ones are flattened onto the surface they
sit on.

## Sources

**shadcn CSS.** The CSS file `shadcn init` writes:

```ts
theme: { source: "app/globals.css" }
```

email-kit reads the variables in `:root` as the light mode and those in `.dark` (or `:root.dark`,
`html.dark`, `[data-theme="dark"]`) as the dark mode, inside `@layer base` too. `var()`
references are resolved; `@theme inline` is skipped.

**DTCG token files.** One file per mode, in the W3C Design Tokens format:

```ts
theme: { source: { light: "tokens/light.tokens.json", dark: "tokens/dark.tokens.json" } }
```

Colour tokens map to the same names as shadcn's variables, with the leading `color` group dropped:
`color.primary.foreground` is `primary-foreground`. A group's own value goes under `$root`:

```json
{
  "color": {
    "$type": "color",
    "background": { "$value": "#ffffff" },
    "foreground": { "$value": "#18181b" },
    "primary": {
      "$root": { "$value": "#1e3a8a" },
      "foreground": { "$value": "#ffffff" }
    }
  },
  "radius": { "$type": "dimension", "$value": { "value": 0.5, "unit": "rem" } }
}
```

Aliases (`"{color.primary}"`) are resolved, and a colour object's `hex` wins over conversion. A
dimension token named `radius` sets the base radius.

**A DTCG resolver.** A `.resolver.json` file:

```ts
theme: { source: "tokens/theme.resolver.json", input: { brand: "acme" } }
```

The modifier whose contexts include `light` and `dark` gives the two modes (if several do, name the
colour-scheme one `theme` or `mode`). `input` picks the context of every other modifier. The theme
checks run on every other combination of contexts too.

**The variables themselves**, by their shadcn names. `dark` is optional:

```ts
theme: {
  source: {
    light: {
      background: "#ffffff",
      foreground: "#18181b",
      primary: "#1e3a8a",
      "primary-foreground": "#ffffff",
      secondary: "#f5f5f5",
      "secondary-foreground": "#18181b",
      muted: "#f5f5f5",
      "muted-foreground": "#52525b",
      destructive: "#991b1b",
      border: "#71717a",
    },
    radius: "0.5rem",
  },
}
```

A source error fails the compile with [`invalid-theme`](../reference/errors.md#invalid-theme) or
[`invalid-colour`](../reference/errors.md#invalid-colour).

## Roles

Components never use raw colours; they use roles, which email-kit resolves from the source's
variables for each mode. Each role takes the first of its variables that the source has. A role
with none of them uses email-kit's default where there is one, and otherwise fails with
[`unresolved-role`](../reference/errors.md#unresolved-role) until you add the variable or set the role in
`roles`.

| Role | From |
|---|---|
| `pageGround` | Light: `muted`, `accent`. Dark: `background` |
| `canvas`, `card` | `card`, `background` |
| `muted` | `muted` |
| `codeSurface` | `muted`, `secondary` |
| `inverse` | `foreground` |
| `ink`, `strongBorder` | `card-foreground`, `foreground` |
| `mutedInk`, `subtleInk` | `muted-foreground`, adjusted to pass contrast unless you override it |
| `inverseInk` | `background` |
| `link`, `brand`, `brandInk` | `primary` |
| `onBrand` | `primary-foreground`, else whichever of `ink` and `inverseInk` reads better on `brand` |
| `hairline`, `divider` | `border` |
| `action.primary.fill`, `.border` | `primary` |
| `action.primary.label` | `primary-foreground` |
| `action.secondary.fill` | `secondary` |
| `action.secondary.label` | `secondary-foreground` |
| `action.secondary.border` | `border` |
| `action.destructive.fill`, `.border` | `destructive` |
| `action.destructive.label` | `destructive-foreground`, else computed |
| `status.<tone>.fill` | `info`, `success`, `warning` or `destructive` (for `error`), else a default |
| `status.<tone>.onFill` | the matching `-foreground`, else computed |
| `status.<tone>.ink`, `.surface`, `.border` | email-kit's defaults, or `roles` |

`<tone>` is `info`, `success`, `warning` or `error`. `email-kit tokens` prints every role in both
modes with its contrast ratio:

```sh
npx email-kit tokens
```

## Type scale

| Step | Default (size/line height, px) | Used by |
|---|---|---|
| `display` | 36/44, bold | |
| `h1`, `h2`, `h3` | 28/36, 22/30, 18/26, bold | `Heading` |
| `lead` | 18/28 | `Text size="lead"` |
| `body` | 16/24 | `Text`, `ListItem`, `KeyValue` |
| `bodySm` | 14/22 | `Text size="bodySm"`, tables |
| `caption` | 14/20 | `Text size="caption"`, `KeyValue` labels |
| `footer` | 14/20 | `Footer` |
| `button` | 16/24, bold | `Button` |
| `code` | 14/20, monospaced | |
| `otp` | 28/36, bold, monospaced, 6px letter-spacing | `OtpCode` |
| `wordmark` | 20/28, bold | |

A step override takes any of `stack` (`"sans"`, `"serif"` or `"mono"`), `sizePx`, `lineHeightPx`,
`weight` (400 or 700) and `letterSpacingPx`.

## Dark mode

With `dark: "authored"`, each email carries your dark palette: `@media (prefers-color-scheme:
dark)` rules for every colour it uses, the `[data-ogsc]` and `[data-ogsb]` selectors Outlook.com
reads, and a `color-scheme: light dark` declaration. With `"none"`, or a source without a dark
mode, the email declares no dark support and clients that darken emails do it their own way.

## See the resolved theme

`email-kit tokens` prints every colour role in light and dark, with its contrast ratio against the
surface it sits on, then the theme's findings:

```sh
npx email-kit tokens
```

```
Theme: email-kit default (shadcn neutral, adjusted for email) (dark: authored)

Role                       Light     Dark      Contrast
pageGround                 #f5f5f5  #0a0a0a
canvas                     #ffffff  #171717  1.09 / 1.10 on pageGround
ink                        #0a0a0a  #fafafa  19.80 / 17.18 on canvas
mutedInk                   #707070  #a1a1a1  4.95 / 6.94 on canvas
link                       #171717  #e5e5e5  17.93 / 14.23 on canvas
…
```

It exits 1 when a `tokens.*` check fails at error level. `email-kit check` runs the same theme
checks: text and link contrast (WCAG AA), button colours and sizes, Gmail's dark-mode handling of
light fills, font stacks and the container width. See the `tokens.*` and `dark.*` entries in the
[checks reference](../reference/checks.md).

## Using theme values in your own components

Your own components use roles too, never literal colours: `role("muted")` writes the light value
inline and tags the element so the dark value applies in dark mode. See
[Your own components](components.md#your-own-components).
