import type { Check } from "../types.ts"

const nothing = () => {}

/**
 * The checks the compiler enforces. A compile that breaks one fails with an error code, and
 * `email-kit check` reports that failure under the check's id, with its location.
 */
export const COMPILER: readonly Check[] = [
  {
    id: "source.id-grammar",
    level: "error",
    rule: "Template ids are lowercase words joined by hyphens, and unique.",
    fix: 'Rename the template id, like "password-reset".',
    compiler: { codes: ["invalid-id", "duplicate-id"] },
    run: nothing,
  },
  {
    id: "legal.purpose-declared",
    level: "error",
    rule: 'Every template declares a purpose: "transactional", "marketing" or "consent-request".',
    fix: 'Add `purpose` to `defineEmail()`; any promotional content makes it "marketing".',
    compiler: { codes: ["invalid-purpose"] },
    run: nothing,
  },
  {
    id: "source.fixture-valid",
    level: "error",
    rule: "Every fixture validates against the template's schema.",
    fix: "Correct the fixture at the path in the message, or the schema.",
    compiler: { codes: ["invalid-fixture"] },
    run: nothing,
  },
  {
    id: "source.schema-portable",
    level: "error",
    rule: "The schema stays within the portable JSON Schema subset.",
    fix: "Use the types and constraints every target language can check; the message names the field.",
    compiler: { codes: ["schema-not-portable", "unsupported-schema", "missing-converter"] },
    run: nothing,
  },
  {
    id: "i18n.missing-keys",
    level: "error",
    rule: "Every locale has every message key a template uses.",
    fix: "Add the key to the locale's messages file the message names.",
    compiler: { codes: ["missing-message"] },
    run: nothing,
  },
  {
    id: "i18n.plural-categories",
    level: "error",
    rule: "Plural messages cover every CLDR category of the locale.",
    fix: "Add the categories the message lists for that locale.",
    compiler: { codes: ["invalid-plural"] },
    run: nothing,
  },
  {
    id: "i18n.fallback",
    level: "error",
    rule: "The locale fallback chain resolves to a compiled locale.",
    fix: "Point locales.fallback at a locale in locales.list.",
    compiler: { codes: ["invalid-config"], match: /locales\.fallback/ },
    run: nothing,
  },
  {
    id: "output.identifiers",
    level: "error",
    rule: "The identifiers derived from template ids are unique and not reserved in target languages.",
    fix: "Rename one of the templates the message names.",
    compiler: { codes: ["identifier-collision"] },
    run: nothing,
  },
]
