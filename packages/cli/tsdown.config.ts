import { defineConfig, type UserConfig } from "tsdown"

const config: UserConfig = defineConfig({
  entry: ["src/cli.ts"],
  format: "esm",
  platform: "node",
  target: "node22.12",
  fixedExtension: false,
  dts: false,
  clean: true,
})

export default config
