import { describe, expect, it } from "vitest"

import { PACKAGE_NAME } from "../src/index.ts"

describe("@email-kit/core", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@email-kit/core")
  })
})
