import { describe, expect, it } from "vitest"

import { MESSAGE } from "../src/message.ts"

describe("create-email-kit", () => {
  it("explains that it is a placeholder", () => {
    expect(MESSAGE).toContain("pre-release placeholder")
  })
})
