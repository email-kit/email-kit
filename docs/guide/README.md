# User guide

How to use email-kit in a TypeScript backend: write emails as TSX templates, compile them, and
render them from server code. email-kit is in preview (0.1): usable for transactional email, and
changing.

- [Getting started](getting-started.md): set up a project with `init`, compile, render, check in CI.
- [Writing templates](templates.md): `defineEmail`, schemas, field markers, control flow, messages, locales and sender values.
- [Components](components.md): every component in `@email-kit/components`, with its props.
- [Configuration](configuration.md): every option of `email-kit.config.ts`, the theme, check levels and team checks.
- [Rendering and sending](sending.md): the generated module's API, data validation, and handing the result to your mail provider.
- [Formatting dates, money and numbers](formatting.md): formatting values in your backend before `render()`.

Reference pages:

- [Checks](../reference/checks.md): every check `email-kit check` runs, with its default level and fix.
- [Errors](../reference/errors.md): every error id, why it happens and how to fix it.
- [mustache-core](../reference/mustache-core.md): the placeholder language of the compiled output.
