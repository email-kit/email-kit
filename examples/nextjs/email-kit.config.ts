import { defineConfig } from "@email-kit/core"

export default defineConfig({
  locales: { default: "en" },
  platform: { productName: "Shop" },
  checks: {
    "output.gitignored": {
      level: "off",
      reason: "The build script compiles the emails before next build",
    },
  },
})
