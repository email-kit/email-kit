import packageJson from "../package.json" with { type: "json" }

/**
 * The email-kit version, from package.json. `--version` prints it, the compiler writes it into
 * generated files and the manifest, and `init` uses it for the dependency ranges it adds.
 */
export const VERSION: string = packageJson.version
