import packageJson from "../package.json" with { type: "json" }

/** The email-kit version, written into generated files and the manifest: package.json's. */
export const VERSION: string = packageJson.version
