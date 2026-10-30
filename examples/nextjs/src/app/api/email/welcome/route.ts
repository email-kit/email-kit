import { EmailRenderError, emails } from "@/email-kit/compiled"

// GET /api/email/welcome?name=Ada&days=1 → the HTML, to look at in a browser.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const email = emails.welcome.render({
    name: params.get("name") ?? "Ada",
    trialDays: Number(params.get("days") ?? 14),
    startUrl: "https://shop.example/start",
  })
  return new Response(email.html, { headers: { "content-type": "text/html; charset=utf-8" } })
}

// POST /api/email/welcome with JSON data → what you'd hand to your email provider.
export async function POST(request: Request) {
  try {
    const email = emails.welcome.render(await request.json())
    return Response.json({ subject: email.subject, html: email.html, text: email.text })
  } catch (error) {
    if (error instanceof EmailRenderError) {
      return Response.json({ error: error.message, issues: error.issues }, { status: 400 })
    }
    throw error
  }
}
