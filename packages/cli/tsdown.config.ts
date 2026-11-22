import { defineConfig, type UserConfig } from "tsdown"

const config: UserConfig = defineConfig({
  entry: ["src/cli.ts"],
  format: "esm",
  platform: "node",
  target: "node22.12",
  fixedExtension: false,
  dts: false,
  clean: true,
  // The skill for AI coding agents, which `email-kit agents` writes into projects, and the copy of
  // the docs it links to there, generated from the repository's docs/ (ADR 0009).
  copy: [
    { from: "../../skills/email-kit", to: "dist/skill" },
    { from: "docs", to: "dist" },
  ],
})

export default config
