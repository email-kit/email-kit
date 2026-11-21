# @email-kit/components

## 1.0.1

### Patch Changes

- d986a7a: Every package's npm page now shows the same README: how to start with `npm create email-kit`, a
  template, what each package is for and how they fit together, with links to the docs at
  https://email-kit.dev, which is now each package's homepage.
- Updated dependencies [d986a7a]
  - @email-kit/core@1.0.1

## 1.0.0

### Major Changes

- First stable release. The packages leave the `preview` tag and are published as `latest`, so
  `npm create email-kit` and `npm i -D @email-kit/cli` install them without asking for a tag. From
  here, changes follow semver: a breaking change to the config, the template API or the generated
  module is a major release.
  
  What 1.0 covers: TSX email templates with typed data and messages, compiled to a small module that
  renders with `@email-kit/runtime`; `email-kit init`, `new`, `compile`, `check` and `tokens`; themes
  from shadcn CSS or DTCG tokens with dark mode; email-safe components, including a transactional
  `Footer`; ICU plurals, locale fallback and pseudo-locales. Still to come: marketing email
  (unsubscribe, multi-column layouts), testing in real email clients, and the preview studio.

### Patch Changes

- Updated dependencies [068d44a]
- Updated dependencies [3206f9b]
- Updated dependencies
  - @email-kit/core@1.0.0

## 0.1.0-preview.0

### Minor Changes

- First preview. TSX email templates with typed data and messages, compiled to HTML, plain text and a
  dependency-free module; `email-kit init`, `new`, `compile`, `check` and `tokens`; themes from shadcn
  CSS or DTCG tokens with dark mode; a centred page container and fifteen components, including a
  transactional `Footer`; ICU plurals, locale fallback and pseudo-locales; 111 of the planned 175
  checks. Not yet: marketing email (unsubscribe, multi-column layouts), testing in real email
  clients, and the preview studio.

### Patch Changes

- Updated dependencies
  - @email-kit/core@0.1.0-preview.0
