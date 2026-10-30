import { defineConfig } from "@email-kit/core"

export default defineConfig({
  locales: { default: "en", list: ["en", "de"] },
  platform: {
    productName: "Shop Example",
    // Differs per environment, so the backend passes it: createEmails({ siteUrl })
    siteUrl: { runtime: true },
  },
})
