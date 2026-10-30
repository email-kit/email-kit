// The happy path: the compiled email, rendered by the route handler exactly as Next.js calls it.

import { describe, expect, it } from "vitest"

import { GET, POST } from "@/app/api/email/welcome/route"

const post = (data: unknown) =>
  POST(
    new Request("http://localhost/api/email/welcome", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }),
  )

describe("/api/email/welcome", () => {
  it("GET returns the email as HTML, with the plural from the data", async () => {
    const response = await GET(new Request("http://localhost/api/email/welcome?name=Grace&days=1"))
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8")
    const html = await response.text()
    expect(html).toContain("<title>Welcome to Shop, Grace</title>")
    expect(html).toContain("Your Shop trial lasts 1 day.")
  })

  it("POST returns what an email provider needs", async () => {
    const response = await post({
      name: "Ada",
      trialDays: 14,
      startUrl: "https://shop.example/start",
    })
    const email = await response.json()
    expect(email.subject).toBe("Welcome to Shop, Ada")
    expect(email.html).toContain('href="https://shop.example/start"')
    expect(email.text).toContain("Your Shop trial lasts 14 days.")
    expect(email.text).toContain("Get started: https://shop.example/start")
  })

  it("POST rejects data that doesn't match the schema, with every problem", async () => {
    const response = await post({ name: "", trialDays: "2", startUrl: "http://evil.example" })
    expect(response.status).toBe(400)
    const { issues } = await response.json()
    expect(issues.map((issue: { path: string }) => issue.path)).toEqual([
      "name",
      "trialDays",
      "startUrl",
    ])
  })
})
