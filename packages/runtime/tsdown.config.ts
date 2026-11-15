import { defineConfig, type UserConfig } from "tsdown"

const config: UserConfig = defineConfig({
  entry: ["src/index.ts", "src/validate.ts", "src/plural.ts", "src/locale.ts", "src/context.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2022",
  dts: true,
  clean: true,
  // No source maps: the package ships only what runs.
  sourcemap: false,
})

export default config
