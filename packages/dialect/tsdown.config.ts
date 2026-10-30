import { defineConfig, type UserConfig } from "tsdown"

const config: UserConfig = defineConfig({
  entry: ["src/index.ts", "src/module.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2023",
  dts: true,
  clean: true,
})

export default config
