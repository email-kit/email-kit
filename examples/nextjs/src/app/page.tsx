export default function Home() {
  return (
    <main>
      <h1>email-kit + Next.js</h1>
      <p>
        The welcome email, rendered by <code>src/app/api/email/welcome/route.ts</code>:
      </p>
      <ul>
        <li>
          <a href="/api/email/welcome">14-day trial</a>
        </li>
        <li>
          <a href="/api/email/welcome?name=Grace&amp;days=1">1-day trial, for Grace</a>
        </li>
      </ul>
      <p>
        POST JSON to the same route to get the subject, HTML and text you would hand to your email
        provider.
      </p>
    </main>
  )
}
