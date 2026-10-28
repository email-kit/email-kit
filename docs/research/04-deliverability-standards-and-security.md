# 04 — Deliverability, message-format standards and template security

**Scope.** This file is the reference for the framework's message format, default headers,
transport layer and security checks. It covers the IETF message-format standards (RFC 5322, MIME,
internationalisation, list and auto-submitted headers, threading), sender authentication and
transport security (SPF, DKIM, DMARC/DMARCbis, ARC, BIMI, MTA-STS, TLS-RPT, DANE, PTR), mailbox
provider rules (Google, Yahoo, Microsoft, Apple), content signals that spam filters score,
transactional patterns (sign-in codes, magic links, link scanners), template security, provider API
limits (SES, Resend, Postmark, SendGrid) and local capture tools. Rendering and dark mode are
covered by other slices.

**Verified:** 2026-10-27. Primary sources are the RFC Editor, Google, Yahoo, Microsoft and Apple
sender pages, the provider API docs, and the live SpamAssassin rule channel (update `1939464`,
downloaded 2026-10-27; scores quoted as *set0/set3*: set0 = no network tests and no Bayes, set3 =
network tests and Bayes, the usual production setup). Practitioner sources (Spam Resource, Red Sift,
dmarcian, Suped, Validity) fill gaps and are marked as such.

**How to read the rule tables**
- **Applies:** All = every message; Bulk = senders over about 5,000 messages a day to one provider;
  Txn = transactional; Mkt = marketing, lifecycle and "subscribed" mail; Prov = provider-specific.
- **Level** is the framework requirement: **MUST** (wrong without it: rejected, spoofable or
  non-compliant), **SHOULD** (measurable risk), **MAY** (optional).
- **Check:** **Lint** = build-time check on artifacts and the catalogue; **Guard** = runtime check at
  render or send; **Probe** = only visible in a real received message (`send-test` plus header
  inspection); **Ops** = DNS, provider or ops configuration outside the framework (a `doctor`
  command can probe some of it).
- **Δ** = changed in 2024–2026. **≠** = contradicts or corrects the reference docs. **?** =
  uncertain, contested or folklore.

---

## 0. What changed in 2024–2026

| When | Change | Effect on the framework | Source |
|---|---|---|---|
| Feb 2024 | Gmail and Yahoo sender requirements take effect (all senders: SPF or DKIM, PTR, TLS (Google), spam rate under 0.3%, RFC 5322; bulk: SPF + DKIM + DMARC with alignment, one-click unsubscribe, visible unsubscribe link) | Default headers, DNS `doctor`, lifecycle rules | [Google guidelines][g-guide], [Yahoo][yahoo] |
| Jun 2024 | Gmail one-click unsubscribe deadline for senders with an existing link; spam rate over 0.3% makes bulk senders ineligible for mitigation | `List-Unsubscribe` + `List-Unsubscribe-Post` on Mkt mail | [Google FAQ][g-faq] |
| Oct 2024 | Exchange Online inbound SMTP DANE with DNSSEC generally available (opt-in) | `doctor` informational check | [MC711018][ms-dane] |
| May 2025 | Microsoft Outlook.com high-volume sender requirements (over 5,000/day: SPF, DKIM, DMARC at least `p=none`, aligned); observed rejections `550 5.7.515` | Same DNS baseline as Gmail bulk | [Microsoft policy][ms-policy], [dmarcian][dmarcian-ms] |
| Jul 2025 | Gmail "Manage subscriptions" view, built on `List-Unsubscribe` | Mkt unsubscribes rise; header must work | [Workspace Updates][g-subs] |
| Sep–Oct 2025 | Outlook on the web and new Outlook stop rendering inline SVG (XSS and phishing risk) | Confirms `html.no-svg` | [MC1130385][ms-svg] |
| Sep 2025 → | Postmaster Tools v2 with a Compliance status dashboard; v1 retirement announced, then **postponed** | Monitoring guidance | [PMT dashboards][g-pmt], [PMT deprecation][g-pmt-dep] |
| Nov 2025 | Gmail "ramping up enforcement": non-compliant mail gets **temporary and permanent rejections**; new codes such as `550 5.7.40` (no DMARC record) | Non-compliance now bounces; transports must classify these codes | [Google FAQ][g-faq], [Gmail SMTP codes][g-smtp] |
| May 2026 | **DMARCbis published**: RFC 9989 (DMARC, Standards Track, obsoletes RFC 7489 and RFC 9091), RFC 9990 (aggregate reports), RFC 9991 (failure reports). `pct`, `rf`, `ri` removed; `np`, `psd`, `t` added; DNS tree walk replaces the Public Suffix List | `doctor` parses DMARC per RFC 9989; flags obsolete tags | [RFC 9989][rfc9989], [RFC 9990][rfc9990], [RFC 9991][rfc9991] |
| Sep 2026 | Gmail Android/iOS "Copy code" pill for verification-code emails | OTP templates: code as plain contiguous digits | [9to5Google][9to5-copy], [Android Authority][aa-copy] |

---

## 1. Message format

### 1.1 RFC 5322 header and line rules

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Emit exactly one `Date` and one `From`; at most one each of `Sender`, `Reply-To`, `To`, `Cc`, `Bcc`, `Message-ID`, `In-Reply-To`, `References`, `Subject` | RFC 5322 §3.6 singleton fields. Gmail rejects duplicates: `550 5.7.1 … not RFC 5322 compliant because it has duplicate headers` | All | MUST | Guard + Probe | [RFC 5322 §3.6][rfc5322], [Gmail codes][g-smtp] |
| `From` holds **one** mailbox | Google: "Include only one email address in From". Several mailboxes require `Sender` and look like spoofing | All | MUST | Guard | [Google guidelines][g-guide] |
| Every message has a valid, globally unique `Message-ID` (`<id-left@id-right>`, right side = a domain you control) | RFC 5322 §3.6.4 (SHOULD). Gmail: "Every message must include a valid Message-ID"; missing → `550 5.7.1`. SpamAssassin `MISSING_MID` (0.55/0.50), `INVALID_MSGID` (2.60/0.57) | All | MUST | Guard | [RFC 5322][rfc5322], [Google guidelines][g-guide], [SA rules][sa-upd] |
| Lines MUST be ≤ 998 characters and SHOULD be ≤ 78, excluding CRLF; SMTP limit is 1000 octets including CRLF | RFC 5322 §2.1.1, RFC 5321 §4.5.3.1.6. Minified HTML (often one line per document) breaks this unless the body is transfer-encoded; relays that enforce it insert line breaks at arbitrary points, which corrupts tags, attributes and URLs | All | MUST | Probe (+ MIME snapshot test) | [RFC 5322 §2.1.1][rfc5322], [RFC 5321][rfc5321] |
| Long header fields are **folded** (CRLF + WSP), never hard-cut | RFC 5322 §2.2.3; long `List-Unsubscribe` or `References` values exceed 78 characters | All | MUST | Guard (encoder) | [RFC 5322][rfc5322] |
| `Date` is set when the message is handed to the transport, not when the job is queued, and the clock is NTP-synced | SpamAssassin scores clock skew against `Received`: `DATE_IN_PAST_03_06` (2.40/1.59), `DATE_IN_FUTURE_03_06` (3.40/3.03), `MISSING_DATE` (2.74/1.36). Queued jobs with retries (package 2) can age a render-time `Date` by hours | All | MUST | Guard | [SA rules][sa-upd] |
| No `X-Priority` / `Importance: high` | `XPRIO` (1.80/2.25), `XPRIO_SHORT_SUBJ` (+1.0) | All | MUST | Lint | [SA rules][sa-upd] |
| `To` is formatted `Name <addr>` or `<addr>`, one recipient per transactional message | `TO_NO_BRKTS_*` rules score a bare address combined with other signals (`TO_NO_BRKTS_HTML_ONLY` 2.0/0.65); one recipient per message stops one user seeing another's address | All | SHOULD | Guard | [SA rules][sa-upd] |

### 1.2 MIME structure

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Body = `multipart/alternative` with `text/plain` **first** and `text/html` **last** | RFC 2046 §5.1.4: parts go "in increasing order of preference … with the preferred format last". HTML-only mail fires `MIME_HTML_ONLY` (0.1) and feeds `TO_NO_BRKTS_HTML_ONLY` (2.0) | All | MUST | MIME snapshot test | [RFC 2046][rfc2046], [SA rules][sa-upd] |
| CID images: wrap the HTML in `multipart/related` (`multipart/alternative` → [`text/plain`, `multipart/related` → [`text/html`, `image/*` with `Content-ID`]]); reference with `cid:` URLs | RFC 2387, RFC 2392. CID adds base64 weight (+33%) to every message; some clients also list the parts as attachments | All | MAY (prefer hosted HTTPS images on the site's own host) | MIME snapshot test | [RFC 2387][rfc2387], [RFC 2392][rfc2392] |
| Attachments: `multipart/mixed` outermost, containing the alternative part then the attachments | RFC 2046 §5.1.3 | Txn (receipts) | MAY | MIME snapshot test | [RFC 2046][rfc2046] |
| `MIME-Version: 1.0`; every text part declares `charset=utf-8` | RFC 2045; an undeclared charset is read as US-ASCII. `MIME_HEADER_CTYPE_ONLY` fires on `Content-Type` without `MIME-Version` | All | MUST | Probe | [RFC 2045][rfc2045], [SA rules][sa-upd] |
| Text and HTML parts use `quoted-printable` (Latin-script content) or `base64` (mostly non-Latin content); never `7bit`/`8bit` for generated HTML | QP keeps lines ≤ 76 and stays readable to filters (RFC 2045 §6.7); base64 lines ≤ 76 (§6.8). `BASE64_LENGTH_79_INF` (1.38/1.50) fires on longer base64 lines; `MIME_BASE64_TEXT` (0.001/1.74) treats base64 text parts as disguise; `MIME_QP_LONG_LINE` fires on QP lines over 76 | All | MUST (an encoding) / SHOULD (QP for Latin text) | Probe | [RFC 2045][rfc2045], [SA rules][sa-upd] |
| HTTP-API transports (SES Simple, Resend, Postmark, SendGrid) build MIME themselves; the framework controls encoding only on SMTP/raw paths | The 998 rule and encoding choice move to the provider; verify with a probe | Prov | SHOULD (probe each transport) | Probe | Provider docs (§7) |

### 1.3 Internationalisation

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Non-ASCII `Subject` and display names are RFC 2047 encoded-words (`=?UTF-8?Q?…?=` or `?B?`); each encoded-word ≤ 75 characters, header lines containing them ≤ 76 | RFC 2047 §2. `SUBJECT_NEEDS_ENCODING` (0.50/0.05), `SUBJ_ILLEGAL_CHARS` (0.62/1.52). SES: the subject "can only contain 7-bit ASCII" unless encoded | All | MUST | Guard (encoder) | [RFC 2047][rfc2047], [SES Message][ses-message] |
| Encode only when needed; prefer Q for mostly-ASCII text | `FROM_EXCESS_BASE64` fires on base64 used "unnecessarily" (low score) | All | SHOULD | Guard | [SA rules][sa-upd] |
| Encoded-words never appear inside the address (`addr-spec`), only in the display name | RFC 2047 §5 | All | MUST | Guard | [RFC 2047][rfc2047] |
| Internationalised domains are sent as A-labels (punycode); non-ASCII **local parts** need SMTPUTF8 end to end | RFC 6531 (SMTPUTF8) and RFC 6532 (UTF-8 headers) work only if every hop supports them. **SES does not support SMTPUTF8**: addresses must be 7-bit ASCII with punycode domains | All | MUST (A-labels) / MAY (EAI only where the transport declares SMTPUTF8) | Guard (transport capability) | [RFC 6531][rfc6531], [RFC 6532][rfc6532], [SES Destination][ses-dest] |
| Follow Unicode TS #39 §5.2 for internationalised domains in links and display | Google sender guidelines cite it to stop homograph lookalikes | All | SHOULD | Lint (link hosts) | [Google guidelines][g-guide], [UTS #39][uts39] |

### 1.4 Automated-mail headers

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| `Auto-Submitted: auto-generated` on every automated message | RFC 3834 §5: SHOULD be used for mail from automatic processes that is not a direct reply; well-behaved autoresponders do not answer it. Not for DSNs or direct replies | All (Txn and Mkt) | SHOULD | Lint (default header) | [RFC 3834][rfc3834] |
| `X-Auto-Response-Suppress: OOF, AutoReply` | Microsoft extension that asks Exchange/Outlook not to send out-of-office replies; harmless elsewhere | All | MAY | Lint | [MS-OXCMAIL][ms-oxcmail] |
| ? Do **not** emit `Precedence: bulk` / `list` / `junk` by default | RFC 3834: "Precedence is not a standard header field" and its use is not recommended. Google, Yahoo, Microsoft and Apple sender pages do not mention it; some autoresponders still honour it. On transactional mail it can only hurt (it says "bulk") | All | SHOULD NOT | Lint | [RFC 3834][rfc3834] |
| Identify the template with a provider tag, not a visible header; if a header is kept (≠ package 1 `X-Template`), carry only the non-sensitive template id | Headers are visible to recipients and filters; tags stay in provider metadata | All | SHOULD | Lint | [SES MessageTag][ses-tag], [Resend send][resend-send] |

### 1.5 Threading control (Gmail conversation view)

Google's documented rule (2019, still the only official description): Gmail threads messages with
the same subject and sender/recipients within a week, **but** "an incoming message's Reference
header, if present, must reference IDs of previous messages in order to thread". To keep messages
apart, use "different subjects or send each message with a unique References header value that will
never match another message" ([Workspace Updates 2019][g-thread]).

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Sign-in codes, password resets and other one-shot auth mail are **isolated**: each carries `References: <ref-{random}@{sending-domain}>` that never repeats | Stops a stale code hiding in a collapsed thread under a new one; the documented Gmail mechanism | Txn (auth) | SHOULD | Guard | [Gmail threading][g-thread] |
| Mail that should thread (updates to one order) uses a stable subject plus `References` that "consistently refer to the same message ID", a synthetic per-entity ID the framework generates | The documented way to thread. Do not rely on the provider keeping your `Message-ID`: SES is widely reported to rewrite it to `…@email.amazonses.com` | Txn | MAY | Guard | [Gmail threading][g-thread], [SES Message-ID reports][ses-msgid] |
| Never reuse one `References` value across unrelated messages | An identical `References` value tells Gmail they are one conversation (seen in the field) | All | MUST | Guard | [Gmail threading][g-thread] |
| ? `X-Entity-Ref-ID` with a unique value | **Folklore.** Widely repeated (blog posts, Resend's custom-header example, developer reports that it works); Google has never documented it. Harmless, but use the documented `References` method | Txn | MAY | — | [Waypoint][waypoint], [Resend headers][resend-headers] |
| A unique token in the subject (order number) also prevents threading | Documented ("different subjects"); good for receipts, not for generic codes | Txn | MAY | — | [Gmail threading][g-thread] |
| `Re:` / `Fwd:` only on real replies or forwards | Google: subject lines must be accurate | All | MUST | Lint | [Google guidelines][g-guide] |

### 1.6 List headers and one-click unsubscribe (RFC 2369, RFC 8058)

Exact syntax (RFC 8058 §8.1), with an optional `mailto:` fallback (§8.2):

```
List-Unsubscribe: <https://example.com/unsubscribe/opaquepart>, <mailto:unsub@example.com?subject=unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Mkt messages carry `List-Unsubscribe` with **exactly one HTTPS URI** in angle brackets (comma-separated alternatives allowed; `mailto:` as a fallback) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` | RFC 8058 §3.1 ("MUST contain one HTTPS URI"); RFC 2369 angle-bracket syntax. Gmail and Yahoo require it for bulk Mkt mail; Yahoo: POST "highly recommended", mailto acceptable | Mkt (Bulk) | MUST | Lint + Probe | [RFC 8058][rfc8058], [RFC 2369][rfc2369], [Google guidelines][g-guide], [Yahoo][yahoo] |
| Both headers are **covered by a valid DKIM signature** (`h=` lists them) | RFC 8058 §4: "The List-Unsubscribe and List-Unsubscribe-Post headers MUST be covered by the signature". ESPs do not document which custom headers they sign (SES, Resend) | Mkt | MUST | Probe | [RFC 8058][rfc8058], [AWS one-click blog][aws-oneclick] |
| The URI holds an opaque, hard-to-forge identifier that the endpoint verifies | RFC 8058 §3.1 (SHOULD); prevents unsubscribing others | Mkt | MUST | Guard (URL builder) | [RFC 8058][rfc8058] |
| Endpoint accepts `POST` with body `List-Unsubscribe=One-Click` (`application/x-www-form-urlencoded` or `multipart/form-data`), **without cookies, auth or CSRF token**, returns 2xx and **no redirect** | RFC 8058 §3.1–3.2: the POST "MUST NOT include cookies, HTTP authorization…"; sender "MUST NOT return an HTTPS redirect". CSRF middleware rejecting the POST is a common silent failure. Resend's guide: return 200 or 202 | Mkt | MUST | Ops (`doctor` POST dry-run) | [RFC 8058][rfc8058], [Resend unsubscribe][resend-unsub] |
| A `GET` on the URI never unsubscribes; it may show a page with a confirm button | RFC 8058 §1: anti-spam software fetches header URIs automatically | Mkt | MUST | Ops | [RFC 8058][rfc8058] |
| Honour within **48 hours** (Google) / **2 days** (Yahoo); "as soon as possible" (Apple) | Provider requirements; Postmaster Tools v2 tracks "honor unsubscribe" for bulk senders | Mkt | MUST | Ops | [Google FAQ][g-faq], [Yahoo][yahoo], [Apple][apple-pm] |
| Also a clearly visible unsubscribe link in the body, above any Gmail clip point (~102 KB) | Google and Yahoo bulk rule; a footer link below the clip is hidden | Mkt | MUST | Lint (`size.gmail` + link present) | [Google guidelines][g-guide], [HubSpot (clip)][clip] |
| Transactional mail: no `List-Unsubscribe` required | Google: "Transactional messages are excluded"; Yahoo: promotional/marketing only. Package 1's rule stands | Txn | — | Lint | [Google FAQ][g-faq], [Yahoo FAQ][yahoo-faq] |
| `List-Id` (RFC 2919) on Mkt streams | Lets users and clients group and filter lists; not required by any provider | Mkt | MAY | Lint | [RFC 2919][rfc2919] |

### 1.7 Provider feedback headers

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| `Feedback-ID: a:b:c:SenderId`: up to three optional identifiers plus a mandatory SenderId of 5–15 characters, consistent per stream, **never unique per message**; added before DKIM signing by a domain verified in Postmaster Tools | Gmail Feedback Loop aggregates complaint data by these fields (@gmail.com recipients only). Suggested: `{templateId}:{category}:{audience}:{senderId}` | Bulk / Mkt (Txn useful too) | SHOULD (Bulk) / MAY (Txn) | Lint + Probe | [Gmail FBL][g-fbl] |
| Let the transport declare whether the provider sets its own `Feedback-ID` and reserved headers, so the framework does not duplicate them | SendGrid lists headers you may not override; ESPs add their own feedback headers (? exact behaviour varies, check with a probe) | Prov | SHOULD | Guard (transport capability) | [SendGrid mail send][sg-send] |

---

## 2. Authentication and transport security

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| **SPF** record on the envelope-from (Return-Path) domain: one `v=spf1` record, ≤ **10** DNS-querying terms (`include`, `a`, `mx`, `ptr`, `exists`, `redirect`), ≤ **2** void lookups, ends `~all` or `-all`, never `+all` | RFC 7208 §4.6.4: implementations "MUST limit the total number of those terms to 10"; "SHOULD limit void lookups to two". Overflow = `permerror` = SPF fail | All | MUST | Ops (`doctor`) | [RFC 7208][rfc7208] |
| Use a **custom MAIL FROM / Return-Path** subdomain of the From domain (SES custom MAIL FROM, Postmark custom Return-Path, Resend's `send.` subdomain) | Otherwise SPF passes for the ESP's domain only and is not aligned; `HEADER_FROM_DIFFERENT_DOMAINS` (0.25 net) | All | SHOULD | Ops | [Google guidelines][g-guide], [SA rules][sa-upd] |
| **DKIM**-sign every message with `d=` aligned to the From domain; RSA ≥ **1024** bits (MUST), **2048** recommended; `rsa-sha256` only | RFC 6376; RFC 8301: signers "MUST use RSA keys of at least 1024 bits … SHOULD use RSA keys of at least 2048 bits"; rsa-sha1 must not be used. Gmail requires ≥ 1024, recommends 2048 | All | MUST | Ops + Probe | [RFC 6376][rfc6376], [RFC 8301][rfc8301], [Google guidelines][g-guide] |
| DKIM `h=` covers at least `From` (mandatory), `To`, `Subject`, `Date`, `Message-ID`, `Reply-To`, `MIME-Version`, `Content-Type`, `List-Unsubscribe`, `List-Unsubscribe-Post`, `Feedback-ID`; oversign `From` and `Subject` against added duplicates | RFC 6376 §5.4 and §8.15 (extra-header attacks); RFC 8058 coverage rule | All | SHOULD (MUST for From and the List headers) | Probe | [RFC 6376][rfc6376], [RFC 8058][rfc8058] |
| Rotate DKIM keys at least every six months, with overlapping selectors | M3AAWG DKIM Key Rotation BCP | All | SHOULD | Ops | [M3AAWG][m3aawg-dkim] |
| ? **Ed25519** (RFC 8463) only as a **second** signature next to RSA | RFC 8463 allows dual signing. 2026 tests disagree on Gmail verification (Red Sift: fails; CaptainDNS: supported); Microsoft 365 and Yahoo reported as not verifying | All | MAY | Ops | [RFC 8463][rfc8463], [Red Sift][redsift-ed], [CaptainDNS][captaindns] |
| **DMARC** record at `_dmarc.<from-domain>` with `v=DMARC1`, a `p=` policy and an `rua=` reporting address; From aligned with SPF **or** DKIM (relaxed alignment is fine) | Required for bulk by Gmail, Yahoo and Microsoft (`p=none` accepted). Gmail: no record → `550 5.7.40` / `421 4.7.40`. RFC 9989: Domain Owners that want to "fully participate" MUST publish a record and MUST collect and analyse aggregate reports | All (Bulk: required) | MUST | Ops (`doctor`) | [RFC 9989][rfc9989], [Google FAQ][g-faq], [Gmail codes][g-smtp] |
| Δ ≠ DMARC records follow **RFC 9989** (May 2026), not RFC 7489: flag `pct`, `rf`, `ri` as obsolete; understand `t=y` (test mode: apply one level below the policy), `np` (non-existent subdomains), `psd`; organisational domain by **DNS tree walk**, not the Public Suffix List | RFC 9989 Appendix C; the PSL can give different results | All | SHOULD | Ops (`doctor`) | [RFC 9989][rfc9989] |
| Δ A domain at `p=reject` **must DKIM-sign** and not rely on SPF alone | RFC 9989: domains that publish "p=reject" "MUST NOT rely solely on SPF … and MUST apply valid DKIM signatures" (forwarding breaks SPF) | All | MUST | Ops + Probe | [RFC 9989][rfc9989] |
| Δ Receivers are told not to reject on `p=reject` alone (treat as quarantine absent other analysis) | RFC 9989 §7.4/§8. Do not assume `p=reject` guarantees a bounce for spoofed mail | Info | — | — | [RFC 9989][rfc9989] |
| **ARC** (RFC 8617, Experimental) is for forwarders and lists, not originating senders | Apple and Google ask forwarders to add ARC; the framework only originates mail | Prov | MAY (ignore) | — | [RFC 8617][rfc8617], [Apple][apple-pm] |
| **PTR / FCrDNS**: sending IPs have a non-generic PTR whose name resolves back to the IP | Google (all senders), Yahoo (all), Microsoft ("must have valid reverse DNS"). Gmail `550 5.7.25` / `451 4.7.23`. ESP shared IPs handle this; dedicated IPs and the SMTP transport need it | All | MUST | Ops | [Google guidelines][g-guide], [Yahoo][yahoo], [Microsoft policy][ms-policy] |
| **TLS** for every hop the framework controls (SMTP transport: STARTTLS with certificate validation; API transports: HTTPS) | Google requires TLS for all senders (`550 5.7.29`) | All | MUST | Guard (SMTP transport config) | [Google guidelines][g-guide], [Gmail codes][g-smtp] |
| **MTA-STS** (RFC 8461) and **TLS-RPT** (RFC 8460) on the organisation's *receiving* domains (replies, bounces, DMARC reports) | Protects inbound mail against downgrade; reports TLS failures | Ops | SHOULD | Ops (`doctor`, informational) | [RFC 8461][rfc8461], [RFC 8460][rfc8460] |
| **DANE** (RFC 7672) needs DNSSEC on the MX zone | Δ Exchange Online supports inbound DANE (GA Oct 2024, opt-in) | Ops | MAY | Ops (informational) | [RFC 7672][rfc7672], [MC711018][ms-dane] |
| **BIMI**: DMARC `p=quarantine` or `p=reject` (Gmail also requires `pct=100`), SVG logo, and a **VMC or CMC** certificate (PEM) for Gmail; checkmark only with a VMC | Gmail page updated 2026-10-22. Δ Gmail accepts CMC (no trademark; logo publicly shown for about 12 months). Apple requires a VMC (practitioner reports); Yahoo can show logos without a certificate if reputation allows; **Microsoft does not support BIMI** | Mkt (brand) | MAY | Ops (`doctor`) | [Gmail BIMI][g-bimi], [BIMI Group][bimi], [Red Sift BIMI][redsift-bimi] |
| ? BIMI with DMARCbis records | BIMI evaluators were written against RFC 7489 (`pct=100`); how they treat `t=y` or a missing `pct` is not documented | Mkt | — | — | — |
| Apple **Branded Mail** (Apple Business Connect, Oct 2024): logo in Apple Mail without a VMC; needs DMARC quarantine/reject plus SPF and DKIM | Proprietary alternative to BIMI for Apple Mail (practitioner sources) | Mkt (brand) | MAY | Ops | [Validity][validity-abc] |

---

## 3. Mailbox-provider requirements

### 3.1 Comparison (as of 2026-10-27)

| Requirement | Google (all) | Google (bulk ≥ ~5,000/day) | Yahoo/AOL | Microsoft Outlook.com (> 5,000/day) | Apple iCloud Mail |
|---|---|---|---|---|---|
| SPF / DKIM | SPF **or** DKIM | SPF **and** DKIM | All: SPF or DKIM; bulk: both | SPF pass **and** DKIM pass | "Make use of" SPF and DKIM |
| DMARC | Recommended | Required, `p=none` OK, aligned (SPF or DKIM) | Bulk: required, `p=none` OK, relaxed alignment OK, `rua` strongly recommended | Required, at least `p=none`, aligned (preferably both) | "The sending domain must publish" DMARC |
| PTR / forward DNS | Required | Required | Required (all) | Required | Recommended |
| TLS | Required | Required | Not stated | Not stated | Not stated |
| RFC 5322 format | Required (+ Message-ID, single From, no duplicate singletons) | Same | RFC 5321 and 5322 | Not stated | RFC 5321 and 5322 (bulk) |
| Spam rate | < 0.3% (target < 0.1%) | Same; > 0.3% = no mitigation until 7 days below | < 0.3% | Not published | Not published |
| One-click unsubscribe | Recommended | Mkt and subscribed mail; transactional excluded | Bulk Mkt; RFC 8058 POST highly recommended, mailto acceptable | "Functional unsubscribe" recommended | Unsubscribe link; honour ASAP |
| Honour unsubscribe | — | 48 hours | 2 days | — | ASAP |
| Other | No Gmail From impersonation; accurate display names; no hidden content; same From per category; one IP per message type | Visible unsubscribe link | Visible body link (bulk) | From or Reply-To valid and able to receive replies (recommended); stop after 5xx; ≤ 500 connections | Consistent From; segment Mkt and Txn streams; no FBL offered |
| Enforcement | Δ Nov 2025: temporary **and permanent** rejections | Same | Gradual since Feb 2024 | Δ May 2025; policy page says junk first, rejection if unresolved; observed `550 5.7.515` rejections (?) | Reputation-based |
| Sources | [guidelines][g-guide], [FAQ][g-faq] | [FAQ][g-faq] | [Yahoo][yahoo], [FAQ][yahoo-faq] | [policy][ms-policy], [dmarcian][dmarcian-ms] | [Apple][apple-pm] |

Notes:
- Google's bulk status is per primary domain and **permanent** once reached ("Senders who meet the
  above criteria at least once are permanently considered bulk senders") ([FAQ][g-faq]). The
  framework should treat every deployment as bulk.
- Yahoo publishes no volume threshold ([Yahoo FAQ][yahoo-faq]).
- ? Microsoft: the official policy page still says non-compliant mail goes to junk, with rejection
  if issues remain; dmarcian and others report rejection from 5 May 2025 with `550 5.7.515`. Treat
  `5.7.515` as possible today.

### 3.2 Gmail rejection codes the transport must classify

| Code | Meaning (Google's text, abridged) | Transport classification |
|---|---|---|
| `421 4.7.26` / `4.7.27` / `4.7.30` / `4.7.40` | Rate limited: unauthenticated / SPF fail / DKIM fail / no DMARC record | Retryable, raise an auth alert |
| `550 5.7.26` / `5.7.27` / `5.7.30` / `5.7.40` | Blocked: DMARC policy / SPF / DKIM / no DMARC record | Permanent, config error (not the recipient's fault: do not suppress the address) |
| `421 4.7.32` | From header not aligned | Retryable, config alert |
| `451 4.7.23` / `550 5.7.25` | No PTR record | Config error |
| `421 4.7.29` / `550 5.7.29` | No TLS | Config error |
| `421 4.7.28` / `550 5.7.28` | Unusual rate / unsolicited volume | Back off ≥ 10 minutes, then resume from one connection |
| `550 5.7.1` | Likely unsolicited / missing Message-ID / duplicate headers / missing From | Permanent; header bugs are framework bugs |
| `552 5.3.4` | Message too big | Permanent |
| Microsoft `550 5.7.515` | Sending domain does not meet the required authentication level | Permanent, config error |

Source: [Gmail SMTP errors][g-smtp] (fetched 2026-10-27), [Microsoft policy][ms-policy]. Generic
classification follows RFC 3463: class `4` = transient, `5` = permanent ([RFC 3463][rfc3463]).

### 3.3 Monitoring tools

| Tool | Status 2026-10 | Use | Source |
|---|---|---|---|
| Google Postmaster Tools v2 | Δ Compliance status dashboard (Compliant / Needs work / No data per requirement), spam rate, feedback loop, authentication, encryption, delivery errors. v1 deprecation **postponed** "stay tuned"; Domain and IP Reputation dashboards to be retired | Verify the From domain; watch spam rate (computed on DKIM-authenticated mail delivered to the inbox) | [PMT dashboards][g-pmt], [PMT deprecation][g-pmt-dep] |
| Microsoft SNDS and JMRP | Free IP reputation data and complaint feedback for Outlook.com | Dedicated IPs only (shared ESP IPs are the ESP's) | [Microsoft policy][ms-policy] |
| Yahoo Sender Hub and Complaint Feedback Loop (CFL) | "An active CFL is needed for all DKIM domains"; ARF reports | Register the DKIM `d=` domain | [Yahoo][yahoo] |
| Apple iCloud | "We don't offer a feedback loop" | Rely on bounces and engagement | [Apple][apple-pm] |

### 3.4 Gmail surfaces

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Δ Gmail **Manage subscriptions** (Jul 2025) lists senders by frequency and unsubscribes via `List-Unsubscribe` (Gmail POSTs itself, or sends the user to the site) | One-click must work at scale; unsubscribe volume rises (practitioners report up to 2×) | Mkt | MUST (working one-click) | Ops | [Workspace Updates][g-subs], [Spam Resource][spamresource-subs] |
| Tabs (Primary / Promotions / Updates) are Gmail's classification; no header or markup forces a tab | Keep Txn free of promotional content ("Don't mix content types") so receipts stay out of Promotions | Txn | SHOULD | Lint (component flag) | [Google guidelines][g-guide] |
| Promotions annotations (deal badge, single image, product carousel) use JSON-LD/Microdata in `<head>`; image annotations need allowlisting by Google (practitioner reports) | Mkt-only feature | Mkt | MAY | Lint (schema validate) | [Gmail Promotions][g-promotab] |
| Gmail Actions / schema.org markup works in testing but needs **registration** for production: DKIM or SPF aligned with the From domain, a static From address, "hundreds of emails a day … for at least a few weeks", very low complaints; go-to actions only for high-value cases | Registration gate | Txn | MAY | Ops | [Gmail markup registration][g-markup] |

---

## 4. Content and structure signals

### 4.1 SpamAssassin rules templates can trip (live channel `1939464`)

| Rule (what to do) | Why: rule and score (set0/set3) | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Always send a text part | `MIME_HTML_ONLY` (0.1), `MIME_HTML_ONLY_MULTI`; feeds `TO_NO_BRKTS_HTML_ONLY` (2.0/0.65) | All | MUST | Lint | [SA rules][sa-upd] |
| Keep text and HTML **content-equivalent** | `MPART_ALT_DIFF` fires when the parts are 99–100% different (2.25/0.79); `MPART_ALT_DIFF_COUNT` (2.80/1.11). A hand-written text part (package 1) passes if it carries the same words | All | MUST | Lint (`text.parity`) | [SA rules][sa-upd] |
| Avoid image + little text: keep ≥ ~400 bytes of visible words when any `<img>` is present | `HTML_IMAGE_ONLY_04` (0–400 bytes of words, 1.68/1.17) … `_32`; short OTP emails with an image logo are at risk; live-text wordmarks avoid it | Txn | SHOULD | Lint | [SA rules][sa-upd] |
| ? Image/text **area ratio** | `HTML_IMAGE_RATIO_02…08` score 0.001: neutralised. Bug 7713 notes they barely separate ham from spam. "60/40 text-to-image" advice is folklore for SpamAssassin (other filters are opaque) | All | — | — | [SA rules][sa-upd], [SA bug 7713][sa-7713] |
| No tiny HTML with a linked image | `HTML_SHORT_LINK_IMG_1..3` (HTML < ~1 KB with a linked image; up to 2.22) | All | SHOULD | Lint | [SA rules][sa-upd] |
| No URL shorteners | `SHORTENER_SHORT_IMG` (0.33/2.50), `URL_SHORTENER_DISABLED` (2.0), `URL_SHORTENER_CHAINED`, `T_PDS_FROM_2_EMAILS_SHRTNER`; `25_url_shortener.cf` lists 242 shortener domains | All | MUST | Lint | [SA rules][sa-upd] |
| Link text that looks like a URL must match its `href` host; no `http:` links | `__SPOOFED_URL` (anchor text shows a different URL) → `PDS_NO_FULL_NAME_SPOOFED_URL` (0.75); `HTTPS_HTTP_MISMATCH` (0.1). Also a core phishing signal | All | MUST | Lint | [SA rules][sa-upd] |
| No IP-literal URLs | `NORMAL_HTTP_TO_IP` (0.16/0.001) | All | MUST | Lint | [SA rules][sa-upd] |
| No hidden text beyond one short preheader | `HTML_FONT_LOW_CONTRAST` (0.71/0.001), `HTML_TEXT_INVISIBLE_STYLE` (2.80/1.07), `WORD_INVIS` (3.0), `STY_INVIS_DIRECT` (2.5/0.001), `HTML_OFF_PAGE` (1.0). Most are meta rules that also need other spam signs, and several exclude DKIM-signed mail. Google: "Don't use HTML or CSS to hide content". ? The standard hidden preheader is near-universal and low risk when signed; keep it short | All | SHOULD | Lint | [SA rules][sa-upd], [Google guidelines][g-guide] |
| No email address inside a display name | `PDS_FROM_2_EMAILS` (3.50): `"support@bank.com" <x@other.com>` | All | MUST | Guard | [SA rules][sa-upd] |
| Reply-To on a freemail domain while From is not | `FREEMAIL_FORGED_REPLYTO` (1.20/2.10). ≠ Package 2's contact message sets Reply-To to the visitor's (often Gmail) address: fine for an internal inbox, but expect the score | Txn | SHOULD (document) | Guard (warn) | [SA rules][sa-upd] |
| Do not send from a freshly registered domain | `FROM_FMBLA_NEWDOM` (registered ≤ 7 days, 0.001/1.50), `…NEWDOM14`, `…NEWDOM28` | Ops | SHOULD | Ops (`doctor` WHOIS age) | [SA rules][sa-upd] |
| Authenticate | `DKIM_VALID`, `DKIM_VALID_AU`, `DMARC_PASS` are small negatives; `SPF_FAIL`/`SOFTFAIL`, `DKIM_INVALID` small positives; providers weigh authentication far more | All | MUST | Ops | [SA rules][sa-upd] |

SpamAssassin is one filter among many and is used by smaller providers and corporate gateways;
Gmail, Microsoft and Yahoo use proprietary filters. Use it as a **lint**, not a predictor. Mailpit
runs it locally (§7.2).

### 4.2 Other content and structure rules

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Every link and image is HTTPS on the site's own host(s) (package 2's rule) | Domain consistency with the From domain; avoids third-party reputation; trains users to trust one host | All | SHOULD (MUST for auth mail) | Lint | [Google guidelines][g-guide] ("links … clear about where they lead") |
| No third-party click-tracking redirects in Txn mail | Redirect domains add another reputation and break "every link on our host". Critical for package 2: with click tracking, the ESP rewrites each link to its own redirect and records the full destination URL, **fragment token included**, in click events, dashboards and webhook payloads, so the token reaches systems that fragment tokens were meant to keep it out of. Scanner clicks also inflate click data | Txn | MUST (auth) / SHOULD (other Txn) | Guard (transport tracking flags off) | [Postmark API][pm-api] (`TrackLinks`), §5.2 |
| If tracking is used (Mkt), use a branded tracking subdomain and never an open redirect (§6.3) | Alignment of link domains with the sending domain | Mkt | SHOULD | Ops | — |
| HTML ≤ ~102 KB after rendering with the largest data | Gmail clips at about 102 KB of HTML (ESP documentation; Google does not publish it). Content and the unsubscribe link below the clip are hidden | All | SHOULD (warn 90 KB) | Lint (`size.gmail`) | [HubSpot][clip] |
| Total message within the provider limit (SES 40 MB, Resend 40 MB, Postmark 10 MB, SendGrid 30 MB; all after base64) | §7.1 | All | MUST | Guard | §7.1 |
| No attachments in auth mail; in other Txn mail prefer a link to an authenticated download; never executable or script types | Attachments are the main malware/phishing vector; base64 inflates size | Txn | SHOULD | Guard | Apple and Google phishing-resistance guidance (§6.5) |
| No image-only messages; logo as live text | Blocked images leave nothing; `HTML_IMAGE_ONLY_*` | All | MUST | Lint | [SA rules][sa-upd] |
| No forms, `<input>`, `<script>`, `<iframe>`, `<object>`, `<embed>`; no inline SVG | Clients strip them; forms are credential-phishing patterns; `HTML_EMBEDS`, `HTML_IFRAME_SRC`; Δ Outlook stopped rendering inline SVG (Sep–Oct 2025) | All | MUST | Lint | [SA rules][sa-upd], [MC1130385][ms-svg] |
| Display name identifies the sender first; no subject text, recipient name, emoji or reply hints | Google display-name rules | All | MUST | Lint + Guard | [Google guidelines][g-guide] |
| Same From address per message category; different categories may use different addresses | Google; Apple ("consistent From") | All | SHOULD | Lint (catalogue) | [Google guidelines][g-guide], [Apple][apple-pm] |

### 4.3 Stream separation and warm-up

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Separate Txn and Mkt streams: distinct From addresses, provider streams (Postmark `MessageStream`, SES configuration sets / dedicated IP pools, SendGrid IP pools / subusers, Resend separate sending domains), and ideally IPs | Apple: "segment marketing and transactional email streams"; Google: a different IP per message type; Mkt complaints must not block sign-in codes | All | SHOULD | Ops + Guard (category → stream map) | [Apple][apple-pm], [Google guidelines][g-guide], [Postmark API][pm-api] |
| ? Separate subdomains per stream (e.g. `news.example.com` for Mkt) | Common practice; isolates DKIM/SPF/DMARC reports and some reputation. Providers do not document how reputation flows between subdomains and the organisational domain | All | SHOULD | Ops | Practitioner consensus |
| Warm up new domains and IPs: increase volume gradually, send at a consistent rate, avoid bursts; on `4.7.28` stop ≥ 10 minutes | Google guidelines | All | SHOULD | Ops (transport rate limiter) | [Google guidelines][g-guide] |
| Do not mix promotional content into transactional messages | Google: "Don't mix content types … such as promotions inside sales receipts" | Txn | MUST | Lint (component flag) | [Google guidelines][g-guide] |

### 4.4 Bounces, complaints and suppression

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Classify outcomes with RFC 3463 enhanced codes: `5.x.x` permanent → suppress the address (hard bounce, e.g. `5.1.1`); `4.x.x` transient → retry with backoff; repeated soft bounces → suppress | Microsoft: stop retrying after a permanent 5xx and stop sending after multiple NDRs; Apple: act on temporary and permanent errors | All | MUST | Guard (webhook handler) | [RFC 3463][rfc3463], [Microsoft policy][ms-policy], [Apple][apple-pm] |
| Policy/auth rejections (`5.7.x` auth, `5.7.515`) are **sender** problems: alert, do not suppress the recipient | §3.2 | All | MUST | Guard | [Gmail codes][g-smtp] |
| Consume provider bounce and complaint events (DSN per RFC 3464; complaints in ARF, RFC 5965) through webhooks and verify each provider's webhook signature | ESPs parse DSNs; complaints come from Yahoo CFL, Microsoft JMRP and others; Gmail gives only aggregates (Feedback-ID) | All | MUST | Guard | [RFC 3464][rfc3464], [RFC 5965][rfc5965] |
| A complaint suppresses all mail except security mail the person just requested (package 2's `requestedByRecipient`) | Complaints drive the 0.3% limit; a user locked out of sign-in is worse | All | MUST | Guard | [Google FAQ][g-faq] |
| Never re-add suppressed or unsubscribed addresses; remove inactive Mkt subscribers; no bought lists; no pre-checked opt-in boxes | Apple, Google | Mkt | MUST | Ops | [Apple][apple-pm], [Google guidelines][g-guide] |
| Protect forms that trigger mail: CAPTCHA/rate limit, reject URLs or HTML in name fields, never echo free-text names into subjects | Attackers put spam links in "name" fields so a site's welcome email delivers them (Abusix: 750,000 messages from one form); subscription bombing | Txn | MUST | Guard (var schema: `name` = no URL) | [Abusix][abusix] |

### 4.5 Open and click tracking reliability

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Opens are not a signal for anything | Apple Mail Privacy Protection downloads remote content "in the background by default — regardless of whether you engage with the email" through two relays, hiding the IP; Gmail proxies images. (? One researcher reports content is fetched on open instead; either way the signal is corrupted) | All | MUST (no logic on opens) | — | [Apple MPP][apple-mpp] |
| Clicks are inflated by security scanners (§5.2) | Safe Links and others fetch every link at delivery and at click time | All | SHOULD (dedupe; no logic on single clicks) | — | [Safe Links][ms-safelinks] |
| Txn default: open and click tracking **off** | Privacy, fragment leakage, link-domain alignment, no pixel image | Txn | MUST (auth) / SHOULD | Guard | §5.2 |

---

## 5. Transactional specifics

### 5.1 Sign-in codes (OTP)

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Show the code in the body as plain contiguous digits (no spaces or hyphens inside it), next to the words "code"/"verification code", in **both** parts | ? Apple Mail (iOS 17 / macOS Sonoma) fills codes from Mail into Safari, but Apple has published **no detection rules**; developers report failures and one report suggests the sender domain must match the site (subdomain failed). Δ Gmail's "Copy code" pill (Android 2026.09.07.x, iOS 6.0.260907; Sep 2026) has no documented sender requirements | Txn (auth) | SHOULD | Lint | [Apple forum][apple-otp], [9to5Google][9to5-copy] |
| Send from the same registrable domain as the sign-in site | Helps Apple autofill (anecdotal) and phishing resistance | Txn (auth) | SHOULD | Ops | [Apple forum][apple-otp] |
| ? ≠ Code in the subject: **off by default**, opt-in per template | Package 1 allows it for lock-screen convenience. Against: lock-screen and watch previews, shared screens, and provider event payloads and logs (SES events carry `commonHeaders.subject`), so the code spreads to systems that otherwise see only metadata. Gmail Copy code and Apple autofill now cover the convenience case. If enabled, never repeat it in the preheader (package 1's rule) | Txn (auth) | SHOULD NOT (default) / MAY | Lint (`subject.no-secret`) | [SES notification contents][ses-notif] |
| Codes are short-lived (10–15 minutes), single-use, rate-limited, and invalidated when a new one is issued | Limits replay and brute force; deferrals (4xx greylisting) can delay delivery by minutes, so not under ~5 minutes | Txn (auth) | MUST | Guard (app) | [OWASP Forgot Password][owasp-forgot] |
| Do not present an emailed code as a second factor | NIST SP 800-63B-4 §3.1.3.2: "Email SHALL NOT be used for out-of-band authentication" (password-only mailbox access, interception, DNS rerouting); confirmation codes for email validation and recovery codes are not covered by the ban | Txn (auth) | SHOULD | — | [NIST 800-63B-4][nist-63b] |

### 5.2 Magic links and link scanners

Microsoft Defender Safe Links rewrites links and checks them at delivery and at click time, and
URL "detonation" can fire even for hosts excluded from rewriting ([Safe Links][ms-safelinks],
[Tech Community thread][ms-detonation]). Mimecast, Proofpoint URL Defense and Barracuda rewrite and
prefetch similarly; developers report one-time links burned before the user clicks, clustered on
corporate, school and hospital domains ([Supabase discussion][supabase]). Bert Hubert reports (Jan
2025) that Microsoft's scanners now **run JavaScript and send POSTs** ([berthub.eu][berthub]):
"assume security scanners will execute them".

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| A `GET` on any emailed link never changes state (no token consumption, confirmation, unsubscribe or approval) | Scanners and previewers fetch every link | Txn | MUST | Ops (app) + Lint (link kind) | [RFC 8058 §1][rfc8058], [Supabase][supabase] |
| The landing page acts only on an explicit user action (button → POST), and works without JavaScript | Stops plain prefetchers (package 2 does this) | Txn | MUST | Ops (app) | [berthub.eu][berthub] |
| Tokens in the URL **fragment** (package 2) | Keeps tokens out of server logs, `Referer`, proxies and plain GET scanners. ? Not sufficient alone: a JS-executing scanner can read `location.hash`; ESP click tracking records the full URL, fragment included, in its click events; verify that Safe Links / URL Defense / Mimecast rewriting preserves fragments | Txn (auth) | SHOULD | Lint (`auth.token-in-fragment`) | [Supabase][supabase] |
| Offer a typed code next to the link (package 2's sign-in mail does) | A code cannot be consumed by a scanner | Txn (auth) | SHOULD | Lint | [Supabase][supabase] |
| Make consumption tolerant: a scanner-triggered POST must not lock the user out (allow re-use by the same browser within the expiry, or bind the link to the initiating browser and fall back to the code on another device) | JS-executing scanners can click the button | Txn (auth) | SHOULD | Ops (app) | [berthub.eu][berthub] |
| ? Do not rely on scanner user-agent or IP lists | Undocumented and change without notice | Txn | SHOULD NOT | — | — |
| Expiry: sign-in links ≤ 15 minutes, reset links ≤ 1 hour, invitations days (state it in the email) | Short windows limit replay from mailbox compromise | Txn | MUST | Lint (catalogue `expiresAfterMs`) | [OWASP Forgot Password][owasp-forgot] |

### 5.3 Time to inbox

No provider publishes a guaranteed time to inbox. API acceptance is not delivery: 4xx deferrals
(greylisting, `4.7.28` rate limits) can delay mail by minutes to hours. Measure with delivery
webhooks, set expiries to absorb a few minutes, and offer "resend code" with a cooldown that
invalidates the previous code.

---

## 6. Template security

### 6.1 Escaping contexts and URLs

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| HTML-escape every substituted value in HTML text (`& < > " '`) | User data must never become markup. Email clients strip scripts, but injected markup still enables phishing inside a DKIM-signed message: fake buttons, links, hidden legitimate content, tracking images | All | MUST | Lint (`source.no-triple-stash`) + test | [OWASP XSS][owasp-xss], package 1 SEC-01 |
| Attributes are always quoted and escaped; user data never enters event-handler, `style` or unquoted attributes, or `<style>` | Attribute and CSS contexts need different encoding; CSS injection can hide or overlay content | All | MUST | Lint | [OWASP XSS][owasp-xss] |
| URL values: validate scheme (allow `https:`; `mailto:` only for the reply address) **and host** against an allow-list **before** attribute-escaping; reject `javascript:`, `data:`, `vbscript:`, `file:`, userinfo (`https://acme.com@evil.com`), backslashes, control characters and leading whitespace (browsers ignore `java\tscript:`) | ≠ Package 1 SEC-07 makes `https:` a SHOULD; it must be a MUST, with a host allow-list as in package 2 | All | MUST | Guard + Lint | [OWASP XSS][owasp-xss] |
| Path and query components built from data are percent-encoded; templates build links from IDs, never accept whole URLs as data (package 2) | Prevents parameter injection and open redirects | All | MUST | Guard (link helpers) | — |
| User-supplied rich text is either rendered as text or passed through an allow-list sanitiser | Blocks markup injection | All | MUST | Guard | [OWASP XSS][owasp-xss] |
| Text part: no HTML escaping (package 1), but the same URL validation, and strip bidi controls | Escaping breaks URLs; bidi controls reorder visible text | All | MUST | Guard | — |

### 6.2 Header injection and spoofing

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Reject (not strip) CR, LF and NUL in every header input: subject, display names, addresses, Reply-To, custom headers, tag values | CRLF injection (CWE-93) adds headers (`Bcc:`) or a new body. Do not rely on the SMTP library | All | MUST | Guard | [CWE-93][cwe93] |
| Addresses: strict `addr-spec` parse; one From mailbox; ASCII local parts unless the transport declares SMTPUTF8; IDN → A-labels | §1.1, §1.3 | All | MUST | Guard | [RFC 5322][rfc5322], [SES Destination][ses-dest] |
| Display names: strip bidi overrides (U+202A–202E, U+2066–2069) and zero-width characters; no `@`; length cap; user-controlled names only in a fixed pattern ("Alice via Acme") | Spoofing and `PDS_FROM_2_EMAILS`; Google: sender identified first, no emoji | All | MUST | Guard | [Google guidelines][g-guide], [SA rules][sa-upd] |
| Reply-To and From are platform values, never call-site data (package 1 SEC-03/04); package 2's visitor Reply-To is the documented exception | Stops a caller turning the platform into a spoofing relay | All | MUST | Guard | package 1 |
| Homographs: link hosts and the From domain pass UTS #39 confusable checks; no punycode lookalikes of the brand | Google cites UTS #39 §5.2 | All | SHOULD | Lint | [UTS #39][uts39] |

### 6.3 Open redirects and tracking

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Any redirect endpoint (click tracking, "continue to") only redirects to allow-listed hosts or to signed (HMAC) target URLs | An open redirect on the trusted domain lets phishers borrow its reputation and pass link checks | All | MUST | Ops (app) | [OWASP XSS][owasp-xss] (context), §4.2 |
| No redirect in the one-click unsubscribe path | RFC 8058 | Mkt | MUST | Ops | [RFC 8058][rfc8058] |

### 6.4 Data minimisation: never in an email

| Never | Why | Level | Check | Source |
|---|---|---|---|---|
| Passwords, including temporary or initial passwords (send a set-password link) | Mail is stored indefinitely in mailboxes, provider logs and backups; TLS is hop-by-hop only | MUST | Lint (var names / secret flag) | [NIST 800-63B-4][nist-63b] (email is not a secure channel) |
| Full card numbers (PAN), CVV, full bank account numbers | PCI DSS 4.2.2 bans unprotected PANs over end-user messaging, email included; show the last 4 only | MUST | Guard (Luhn pattern scan in vars) | [PCI SSC FAQ 1085][pci] |
| Government IDs, security answers, health data, API keys, long-lived session or login tokens | Breach impact; minimisation | MUST | Lint | — |
| Codes or tokens in subject, preheader, query strings or logs | §5.1, §6.6 | MUST (logs, query) / SHOULD (subject) | Lint + Guard | [SES notification contents][ses-notif] |
| Amounts and personal details in subject/preheader | Notification previews (package 1 rule) | SHOULD | Lint | package 1 |

### 6.5 Phishing-resistant design for legitimate mail

| Rule | Why | Level | Check |
|---|---|---|---|
| Consistent sender (same From per category, same display name, same domain) | Users and filters learn the pattern | MUST | Lint |
| Never ask for a password, card or code by reply or form; say so in security mail ("we will never ask…") | Breaks the phishing script | MUST | Lint (no forms) |
| Links only to the brand's known host; show the destination host in text for important actions | Users can verify; matches anchor-text checks | MUST | Lint |
| No attachments in account and security mail | Removes the malware vector | MUST | Guard |
| Security notices link to "review activity" on the site rather than "click to cancel" actions | Avoids training users to act on emailed buttons | SHOULD | — |
| Authenticate fully (DMARC enforcement, BIMI or Apple Branded Mail where justified) | Spoofed lookalikes fail; logos add a trust cue | SHOULD | Ops |

### 6.6 Logging, S/MIME and PGP

| Rule | Why | Applies | Level | Check | Source |
|---|---|---|---|---|---|
| Logs carry template id, framework Message-ID, provider message id, outcome, duration and error *name*; never addresses, subjects, bodies, URLs or vars (package 1 SEC-02, package 2) | Provider errors echo addresses; URLs carry tokens; subjects may carry codes | All | MUST | Guard (logger) | package 1/2 |
| If correlation by recipient is needed, log an HMAC of the normalised address, not the address | Lets support find sends without storing PII in logs | All | MAY | Guard | — |
| Remember provider-side copies: SES event payloads include `commonHeaders` (subject, from, to); ESP dashboards show content | Data-processing scope and retention | All | SHOULD (document) | — | [SES notification contents][ses-notif] |
| S/MIME (RFC 8551) and OpenPGP (RFC 9580, Jul 2024): out of scope for v1 | Consumer clients rarely verify or display them usefully; encryption needs recipient keys; DKIM/DMARC is the operative authentication | All | MAY (later) | — | [RFC 8551][rfc8551], [RFC 9580][rfc9580] |

---

## 7. Provider API constraints

### 7.1 Transports

| Constraint | Amazon SES (v2) | Resend | Postmark | SendGrid (v3) |
|---|---|---|---|---|
| Idempotency | **None** native (dedupe in the framework) | `Idempotency-Key` header (SMTP: `Resend-Idempotency-Key`), 1–256 chars, kept **24 h**; same key + same payload → original response; different payload → `409 invalid_idempotent_request`; in flight → `409 concurrent_idempotent_requests`; batch supported | None documented | None documented |
| Tags / metadata | `EmailTags`: name and value `[A-Za-z0-9_-]`, ≤ 256 chars each | `tags`: name and value `[A-Za-z0-9_-]`, ≤ 256 chars | `Tag` (one, ≤ 1000 chars); `Metadata` ≤ 10 fields, key ≤ 20, value ≤ 80 chars | `categories` ≤ 10 × 255 chars; `custom_args` total ≤ 10,000 bytes |
| Custom headers | `Headers` ≤ **15** items (Simple/Templated content) | `headers` object | `Headers` array | `headers`; reserved: `x-sg-id`, `x-sg-eid`, `received`, `dkim-signature`, `Content-Type`, `Content-Transfer-Encoding`, `To`, `From`, `Subject`, `Reply-To`, `CC`, `BCC` |
| Message size | 40 MB after base64 (v2/SMTP; v1 10 MB) | Attachments ≤ 40 MB after base64 | 10 MB total after base64; `TextBody`/`HtmlBody` ≤ 5 MB each; batch payload 50 MB | < 30 MB total |
| Recipients | 50 per message | `to` ≤ 50 | 50 (To+Cc+Bcc) | 1000 personalizations |
| Streams | Configuration sets (≤ 10,000; names ≤ 64 chars), dedicated IP pools, tenants | Separate sending domains (verify) | `MessageStream` (default `outbound` transactional; broadcast streams for Mkt) | IP pools, subusers, `asm` unsubscribe groups |
| Text part | You supply it | Generated from HTML if omitted (opt out with `text: ""`) | You supply it | You supply it |
| Tracking | Configuration-set option | Domain-level setting (verify) | `TrackOpens`, `TrackLinks` per message | `tracking_settings` |
| Internationalisation | No SMTPUTF8; punycode domains; subject 7-bit or RFC 2047 | Not documented | Not documented | Not documented |
| Message-ID | ? Reported to be rewritten to `…@email.amazonses.com` | Not documented | Not documented | Not documented |
| Simulator / sandbox | `success@`, `bounce@`, `ooto@`, `complaint@`, `suppressionlist@simulator.amazonses.com` (+labels); works in the sandbox; **billed** like normal mail; limited by the max send rate; does not count toward the daily quota or reputation metrics | `delivered@`, `bounced@`, `complained@`, `suppressed@resend.dev` (+labels except suppressed); **counts against quota** | Sandbox servers (deliver to a black hole, still count toward volume); fake bounces via `…@bounce-testing.postmarkapp.com` or `X-PM-Bounce-Type`; `POSTMARK_API_TEST` token validates without sending | `mail_settings.sandbox_mode` validates the request without sending |
| Sources | [quotas][ses-quotas], [MessageTag][ses-tag], [Message][ses-message], [simulator][ses-sim], [Destination][ses-dest] | [send][resend-send], [idempotency][resend-idem], [test addresses][resend-test] | [API][pm-api], [size][pm-size], [metadata][pm-meta], [sandbox][pm-sandbox], [fake bounces][pm-bounces], [test token][pm-test] | [mail send][sg-send], [limits][sg-limits] |

Consequences:
- ≠ **Phantom sends** (package 1): the SES simulator is a fair sink (same path, billed, quota-free);
  Resend's `delivered@resend.dev` uses quota; Postmark and SendGrid have no success sink on a
  production server (use a no-op with matched latency, or SendGrid `sandbox_mode`). Phantom timing
  must match a real send or it leaks the enumeration it is meant to hide.
- ≠ **Idempotency** (package 2): Resend forgets keys after 24 hours. A job that waits out a daily or
  monthly cap and retries later can send twice; the job must check its own stored provider id
  before resending. SES, Postmark and SendGrid need framework-level dedupe.
- Package 1's template id grammar `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` is a valid SES/Resend tag value;
  package 2's idempotency keys contain `/`, which is not valid in a tag value.

### 7.2 Local capture tools

| Tool | What it does | Use in the framework | Source |
|---|---|---|---|
| **Mailpit** | Single binary or Docker; SMTP on 1025, web UI and REST API on 8025; HTML compatibility check, link check, SpamAssassin check (needs a SpamAssassin server), `List-Unsubscribe` syntax validation, "chaos" configurable SMTP errors, webhook, relay with allow-list, POP3 | Default dev transport (`smtp://localhost:1025`); CI probe for MIME, headers, links and spam score through the API | [Mailpit][mailpit] |
| **Ethereal** | Nodemailer's free fake SMTP (`smtp.ethereal.email`); "messages never get delivered"; accounts via `nodemailer.createTestAccount()`; web preview for messages caught in the last 15 days | Zero-install fallback for `send-test` without a provider | [Ethereal][ethereal] |

---

## 8. Where this research contradicts or corrects the reference docs

| # | Reference doc says | Finding | Action |
|---|---|---|---|
| 1 | Pkg 1 `06` Unsubscribe: lifecycle mail needs `List-Unsubscribe` + `List-Unsubscribe-Post` | Correct but incomplete: RFC 8058 also requires a DKIM signature covering both headers, one HTTPS URI, POST without cookies or CSRF, no redirect, and GET must not unsubscribe. ESPs do not document `h=` coverage | Add a probe and a `doctor` POST dry-run |
| 2 | Pkg 1 `06`: "A code may be in the subject" | Contested: subjects reach notification previews and provider event logs (SES `commonHeaders.subject`); Gmail Copy code and Apple autofill reduce the need | Default off; opt-in per template |
| 3 | Pkg 1 SEC-07: `https:` URLs are a SHOULD | Must be a MUST, with a host allow-list (package 2) and userinfo/control-character rejection | Raise to MUST |
| 4 | Pkg 1 `05`: phantom address `success@simulator.amazonses.com` as transport default | Valid for SES only (billed; rate-limited). Resend's sink uses quota; Postmark/SendGrid have no success sink | Per-transport phantom strategy with latency parity |
| 5 | Pkg 1 `03`: `X-Template: id` header on every message | Exposes internal names to recipients; tags already carry it | Make the header optional (off by default) |
| 6 | Pkg 1 identity: `sender: "Brand <no-reply@example.com>"` | Microsoft recommends a From or Reply-To that can receive replies | Require a Reply-To whenever From is a no-reply mailbox |
| 7 | Pkg 1 `06`: "No SVG … blocked across major clients since late 2025" | Verified for Outlook web and new Outlook (MC1130385, Sep–Oct 2025); Gmail has long not rendered SVG; "across major clients" is broader than the evidence | Keep the rule; cite MC1130385 |
| 8 | Pkg 1 `03` `OutboundMessage` | No Message-ID, Date, idempotency key, list-unsubscribe fields, stream/category, tracking flags, threading or attachments | Extend (§10.3) |
| 9 | Pkg 2: tokens in the fragment stop mail scanners | True for plain prefetchers; JS-executing scanners can read fragments, and ESP click tracking records them in click events. Package 2 also requires a button press, which is the real defence | Keep both; force click tracking off for auth mail; test rewriters |
| 10 | Pkg 2: send ID as Resend's idempotency key; jobs wait out caps and retry | Resend keys expire after 24 h; a long wait can duplicate | Check stored provider id before resending |
| 11 | Pkg 2: contact message Reply-To = visitor's address | Trips `FREEMAIL_FORGED_REPLYTO` (1.2/2.1) when the visitor uses freemail | Acceptable for an internal inbox; document it |
| 12 | Pkg 2: "The Maker web forwards that POST to the API" (one-click) | Must be a server-side forward, not a 3xx (RFC 8058), and must not require CSRF tokens or cookies | Verify; add a `doctor` check |
| 13 | Pkg 1 SEC-01 / `text` rules | Consistent with this research | — |

---

## 9. Uncertain, contested or folklore

| Topic | Status |
|---|---|
| `X-Entity-Ref-ID` stops Gmail threading | Folklore; Google documents unique `References` or different subjects instead |
| `Precedence: bulk` | Non-standard (RFC 3834); no provider documents a benefit; omit |
| Image-to-text ratio rules | Neutralised in SpamAssassin (0.001); other filters opaque |
| Hidden preheader text | Universal practice; Google says not to hide content; low SpamAssassin risk when DKIM-signed |
| Microsoft enforcement | Policy page: junk first; field reports: rejection `550 5.7.515` since May 2025 |
| Postmaster Tools v1 retirement | Postponed with no date; reputation dashboards still listed on one Google page and "to be retired" on another |
| Gmail Ed25519 verification | Conflicting 2026 test reports |
| Apple Mail OTP autofill triggers | Undocumented; domain matching anecdotal |
| Gmail Copy code triggers | Undocumented (Sep 2026) |
| BIMI and DMARCbis (`t=y`, no `pct`) | Undocumented |
| Scanners executing JS and POSTing | One credible practitioner report (Microsoft), widespread anecdotes; vendors do not document behaviour |
| Fragments surviving URL rewriters | Not documented by Microsoft, Proofpoint, Mimecast or Barracuda; test |
| SES Message-ID rewriting | Community reports; AWS docs ambiguous |
| ESP DKIM coverage of custom headers | Not documented by SES or Resend; probe |
| Gmail clip at ~102 KB | ESP-documented, not Google-documented; stable for years |
| Subdomain separation of reputation | Practitioner consensus, undocumented by providers |

---

## 10. Implications for the framework

### 10.1 Headers emitted by default

| Header | Value | When | Notes |
|---|---|---|---|
| `From` | `Display <local@domain>` (one mailbox) | Always | Platform value; display name sanitised; RFC 2047 when non-ASCII |
| `To` | `<addr>` or `Name <addr>`, one recipient | Always | One message per recipient for Txn |
| `Reply-To` | Audience reply address | Always when From is no-reply | Platform value |
| `Subject` | Unicode in, RFC 2047 out | Always | CR/LF rejected; secrets off by default |
| `Date` | RFC 5322 date at transport handoff | Always (unless the provider sets it) | Never the queue time |
| `Message-ID` | `<{random 128-bit, base32}@{from-domain}>` | Always (transport may report a provider id too) | Returned in `SendResult`; no PII or template id inside |
| `MIME-Version` / `Content-Type` | `1.0` / `multipart/alternative` (§10.2) | Always | Built by the transport or MIME builder |
| `Auto-Submitted` | `auto-generated` | Always | RFC 3834 |
| `X-Auto-Response-Suppress` | `OOF, AutoReply` | Default on, configurable | Microsoft-specific |
| `References` | `<ref-{random}@{domain}>` (isolate) or `<thread-{entity}@{domain}>` (thread) | Auth mail: isolate; per-entity threads opt-in | Gmail's documented mechanism |
| `List-Unsubscribe` / `List-Unsubscribe-Post` | `<https://…/opaque>`[, `<mailto:…>`] / `List-Unsubscribe=One-Click` | Mkt only (required by `lifecycle()`) | Must be DKIM-covered (probe) |
| `List-Id` | `<stream.domain>` | Mkt, optional | RFC 2919 |
| `Feedback-ID` | `{template}:{category}:{audience}:{senderId}` | Mkt default, Txn optional | Not per message; skip if the provider manages it |
| Never | `X-Priority`, `Importance`, `Precedence`, `X-Mailer` with version, `Bcc` | — | Spam signals or leaks |

### 10.2 MIME structure

```
multipart/mixed                      (only if attachments)
└─ multipart/alternative
   ├─ text/plain; charset=utf-8      (quoted-printable; base64 if mostly non-Latin)
   └─ multipart/related              (only if CID images)
      ├─ text/html; charset=utf-8    (quoted-printable; base64 if mostly non-Latin)
      └─ image/png; Content-ID: <…>  (base64, ≤ 76-char lines)
```
No line over 998 characters anywhere; QP and base64 lines ≤ 76. HTTP-API transports build this
themselves; the SMTP and memory transports use the framework's builder, and a snapshot test pins
the structure.

### 10.3 Transport interface fields

```ts
interface OutboundMessage {
  from: Mailbox; to: Mailbox[]; replyTo?: Mailbox[];          // Mailbox = { name?: string; address: string }
  subject: string; html: string; text: string;                 // Unicode; the transport encodes
  messageId: string; date?: Date;                              // framework-generated; date set at handoff
  category: "transactional" | "marketing"; stream?: string;    // → MessageStream / configuration set / asm group / domain
  threading: { mode: "isolate" } | { mode: "thread"; key: string };
  listUnsubscribe?: { https: string; mailto?: string };        // required for marketing; implies the Post header
  feedbackId?: string;
  idempotencyKey?: string;                                     // native on Resend; framework dedupe elsewhere
  tags: { name: string; value: string }[];                     // [A-Za-z0-9_-], ≤ 256
  metadata?: Record<string, string>;                           // mapped to Postmark Metadata / SendGrid custom_args
  tracking: { opens: boolean; clicks: boolean };               // default false/false; forced false for auth
  headers?: { name: string; value: string }[];                 // validated; reserved names refused
  attachments?: Attachment[];                                  // refused for auth templates
  phantom?: boolean;
}
interface TransportCapabilities {
  name: string; maxBytes: number; maxHeaders?: number; reservedHeaders: string[];
  tagPattern: RegExp; maxTags?: number; idempotency: "native" | "none";
  keepsMessageId: boolean | "unknown"; smtputf8: boolean; managesFeedbackId: boolean;
  phantom: { kind: "sink"; address: string } | { kind: "sandbox" } | { kind: "noop" };
}
interface SendResult { messageId: string; providerMessageId?: string; acceptedAt: Date }
// Errors: TransportError with kind "retryable" (4xx, 429, network) | "permanent-recipient" (5.1.x)
//   | "permanent-sender" (5.7.x auth/policy, 5.7.515) | "too-big" (5.3.4) | "idempotency-conflict" (409)
```

### 10.4 Runtime guards (render and send)

1. **Header guard:** reject CR, LF, NUL in every header input; fold long headers; RFC 2047 encode.
2. **Address guard:** strict parse; one From; A-label domains; non-ASCII local parts only if `smtputf8`.
3. **Display-name guard:** strip bidi/zero-width characters; refuse `@`; cap length; brand pattern for user names.
4. **URL guard:** scheme + host allow-list; refuse userinfo, IP hosts, shorteners, control characters; auth links keep tokens in the fragment.
5. **Secret guard:** vars flagged `secret` (codes, tokens) never in subject (unless opted in), preheader, query strings, tags, metadata or logs.
6. **Category guard:** `marketing` requires `listUnsubscribe`; `transactional` forbids promotional components; category picks the stream.
7. **Tracking guard:** tracking off for Txn by default and forced off for auth templates.
8. **Suppression guard:** check suppression before sending (except `requestedByRecipient` security mail); classify bounces (§4.4).
9. **Date guard:** set `Date` at handoff; refuse when the host clock is unsynchronised (optional).
10. **Size guard:** rendered HTML warn at 90 KB, fail at 102 KB; total under `maxBytes`.
11. **Idempotency guard:** key from the event; with Resend, re-check the stored provider id when a retry falls outside 24 h.
12. **Phantom guard:** same code path and latency profile per transport capability.
13. **Logging guard:** structured safe fields only (§6.6).

### 10.5 Build-time check candidates (ids follow package 1's style)

| Id | Rule |
|---|---|
| `mime.structure` | Snapshot: alternative with text first, HTML last; related only with CID; no line > 998; QP/base64 ≤ 76 |
| `headers.defaults` | Rendered message has Message-ID, Date, single From, Auto-Submitted; no `X-Priority`/`Precedence` |
| `text.parity` | Word overlap between visible HTML text and the text part above a threshold (guards `MPART_ALT_DIFF`) |
| `text.links-match` | Every HTML link appears in the text part and vice versa |
| `html.link-hosts` | Every `href`/`src` is HTTPS on an allowed host (package 2 FR-011) |
| `html.dangerous-schemes` | No `javascript:`, `data:`, `vbscript:`, `file:` |
| `html.link-text-matches-href` | URL-like anchor text matches the `href` host; no `http:` |
| `html.no-shorteners` / `html.no-ip-hosts` | Against SpamAssassin's shortener list |
| `html.hidden-text` | Hidden styling only on the single preheader element; preheader ≤ ~150 chars |
| `html.image-text-balance` | With any `<img>`, ≥ 400 bytes of visible text; no HTML < 1 KB with a linked image |
| `html.no-forms-embeds` | No `form`, `input`, `script`, `iframe`, `object`, `embed`, `svg` |
| `subject.no-secret` | No `secret` var in subject (unless opted in) or preheader |
| `auth.token-in-fragment` | Auth templates put tokens after `#`, never in the query |
| `auth.code-format` | OTP code rendered as contiguous digits in both parts |
| `mkt.list-unsubscribe` | Lifecycle entries define an HTTPS one-click URL on an allowed host and a visible body link |
| `catalog.stream` | Every entry maps to a category and stream; same From per category |
| `display-name.rules` | No `@`, emoji or reply hints in display names |
| `size.gmail` | Existing; also checks the unsubscribe link sits above the clip |
| `spam.spamassassin` | Optional CI: score each fixture through Mailpit/`spamc`; fail above a threshold (e.g. 2.0) |

### 10.6 `doctor` DNS and endpoint check

| Check | Pass condition |
|---|---|
| SPF (envelope-from domain) | One `v=spf1` record; ≤ 10 lookups after recursion; ≤ 2 void lookups; ends `-all`/`~all`; includes the provider |
| DKIM | Configured selectors resolve; RSA ≥ 1024 (warn < 2048); no `t=y` in production; `d=` aligns with From |
| DMARC | One `v=DMARC1` record at `_dmarc.<from>` (tree walk per RFC 9989); `p` present; `rua` present (and external-destination authorisation record if off-domain); warn on obsolete `pct`/`rf`/`ri`; note `t=y`, `sp`, `np` |
| Alignment | From domain vs DKIM `d=` vs MAIL FROM (relaxed, organisational domain) |
| MX for From and Reply-To domains | Replies and bounces can be received |
| PTR / FCrDNS | For dedicated IPs or the SMTP transport host |
| Domain age | Warn if the From domain is under 28 days old |
| MTA-STS / TLS-RPT | `_mta-sts` TXT + policy file matching MX; `_smtp._tls` TXT (informational) |
| DANE | TLSA at `_25._tcp.<mx>` with DNSSEC (informational) |
| BIMI | `default._bimi` TXT `v=BIMI1`, HTTPS SVG `l=`, PEM `a=`; DMARC at quarantine/reject |
| Link host | Allowed hosts resolve with valid HTTPS certificates |
| One-click endpoint | POST `List-Unsubscribe=One-Click` to a test token → 2xx, no redirect, no cookie needed; GET does not unsubscribe |
| Probe (`send-test`) | Received message shows `dkim=pass`, `spf=pass`, `dmarc=pass` aligned; `h=` covers From, Subject, Date, Message-ID, List-Unsubscribe, List-Unsubscribe-Post, Feedback-ID; no line > 998; Date skew < 5 minutes |

---

## 11. Sources

All accessed 2026-10-27.

| Ref | Title | URL |
|---|---|---|
| rfc5322 | RFC 5322 Internet Message Format | https://www.rfc-editor.org/rfc/rfc5322 |
| rfc5321 | RFC 5321 Simple Mail Transfer Protocol | https://www.rfc-editor.org/rfc/rfc5321 |
| rfc2045 | RFC 2045 MIME Part One | https://www.rfc-editor.org/rfc/rfc2045 |
| rfc2046 | RFC 2046 MIME Part Two: Media Types | https://www.rfc-editor.org/rfc/rfc2046 |
| rfc2047 | RFC 2047 MIME Part Three: Message Header Extensions | https://www.rfc-editor.org/rfc/rfc2047 |
| rfc2387 | RFC 2387 The MIME Multipart/Related Content-type | https://www.rfc-editor.org/rfc/rfc2387 |
| rfc2392 | RFC 2392 Content-ID and Message-ID URLs | https://www.rfc-editor.org/rfc/rfc2392 |
| rfc6531 | RFC 6531 SMTP Extension for Internationalized Email | https://www.rfc-editor.org/rfc/rfc6531 |
| rfc6532 | RFC 6532 Internationalized Email Headers | https://www.rfc-editor.org/rfc/rfc6532 |
| rfc3834 | RFC 3834 Recommendations for Automatic Responses to Electronic Mail | https://www.rfc-editor.org/rfc/rfc3834 |
| rfc2369 | RFC 2369 The Use of URLs as Meta-Syntax for Core Mail List Commands | https://www.rfc-editor.org/rfc/rfc2369 |
| rfc2919 | RFC 2919 List-Id | https://www.rfc-editor.org/rfc/rfc2919 |
| rfc8058 | RFC 8058 Signaling One-Click Functionality for List Email Headers | https://www.rfc-editor.org/rfc/rfc8058 |
| rfc7208 | RFC 7208 Sender Policy Framework | https://www.rfc-editor.org/rfc/rfc7208 |
| rfc6376 | RFC 6376 DKIM Signatures | https://www.rfc-editor.org/rfc/rfc6376 |
| rfc8301 | RFC 8301 Cryptographic Algorithm and Key Usage Update to DKIM | https://www.rfc-editor.org/rfc/rfc8301 |
| rfc8463 | RFC 8463 A New Cryptographic Signature Method for DKIM (Ed25519) | https://www.rfc-editor.org/rfc/rfc8463 |
| rfc9989 | RFC 9989 DMARC (May 2026, Standards Track) | https://www.rfc-editor.org/rfc/rfc9989 |
| rfc9990 | RFC 9990 DMARC Aggregate Reporting (May 2026) | https://www.rfc-editor.org/rfc/rfc9990 |
| rfc9991 | RFC 9991 DMARC Failure Reporting (May 2026) | https://www.rfc-editor.org/rfc/rfc9991 |
| rfc8617 | RFC 8617 Authenticated Received Chain | https://www.rfc-editor.org/rfc/rfc8617 |
| rfc8461 | RFC 8461 SMTP MTA Strict Transport Security | https://www.rfc-editor.org/rfc/rfc8461 |
| rfc8460 | RFC 8460 SMTP TLS Reporting | https://www.rfc-editor.org/rfc/rfc8460 |
| rfc7672 | RFC 7672 SMTP Security via Opportunistic DANE TLS | https://www.rfc-editor.org/rfc/rfc7672 |
| rfc3463 | RFC 3463 Enhanced Mail System Status Codes | https://www.rfc-editor.org/rfc/rfc3463 |
| rfc3464 | RFC 3464 Delivery Status Notifications | https://www.rfc-editor.org/rfc/rfc3464 |
| rfc5965 | RFC 5965 Abuse Reporting Format | https://www.rfc-editor.org/rfc/rfc5965 |
| rfc8551 | RFC 8551 S/MIME 4.0 Message Specification | https://www.rfc-editor.org/rfc/rfc8551 |
| rfc9580 | RFC 9580 OpenPGP | https://www.rfc-editor.org/rfc/rfc9580 |
| g-guide | Google: Email sender guidelines | https://support.google.com/mail/answer/81126 |
| g-faq | Google: Email sender guidelines FAQ | https://support.google.com/mail/answer/14229414 |
| g-smtp | Google: Gmail SMTP errors and codes | https://knowledge.workspace.google.com/admin/support/troubleshooting/gmail-smtp-errors-and-codes |
| g-pmt | Google: Postmaster Tools dashboards | https://support.google.com/mail/answer/14668346 |
| g-pmt-dep | Google: Deprecation of the old Postmaster Tools interface | https://support.google.com/mail/answer/16594218 |
| g-fbl | Google: Feedback Loop | https://support.google.com/mail/answer/6254652 |
| g-bimi | Google Workspace: Set up BIMI (updated 2026-10-22) | https://knowledge.workspace.google.com/admin/security/set-up-bimi |
| g-thread | Google Workspace Updates: Threading changes in Gmail conversation view (2019) | https://workspaceupdates.googleblog.com/2019/03/threading-changes-in-gmail-conversation-view.html |
| g-subs | Google Workspace Updates: Manage email subscriptions in Gmail (2025-07-08) | https://workspaceupdates.googleblog.com/2025/07/manage-email-subscriptions-in-gmail.html |
| g-markup | Google: Register with Google (Gmail markup) | https://developers.google.com/workspace/gmail/markup/registering-with-google |
| g-promotab | Google: Annotate emails in the Promotions tab | https://developers.google.com/workspace/gmail/promotab/overview |
| yahoo | Yahoo Sender Hub: Sender Requirements & Recommendations | https://senders.yahooinc.com/best-practices/ |
| yahoo-faq | Yahoo Sender Hub: FAQs | https://senders.yahooinc.com/faqs |
| ms-policy | Microsoft Outlook.com: Policies, Practices, and Guidelines | https://substrate.office.com/ip-domain-management-snds/postmaster/Policies |
| dmarcian-ms | dmarcian: Microsoft enforces SPF, DKIM, DMARC (updated 2025-05-02) | https://dmarcian.com/microsoft-enforces-spf-dkim-dmarc/ |
| ms-svg | Microsoft 365 Message Center MC1130385: Retirement of inline SVG images in Outlook | https://mc.merill.net/message/MC1130385 |
| ms-dane | Microsoft 365 Message Center MC711018: Inbound SMTP DANE with DNSSEC | https://mc.merill.net/message/MC711018 |
| ms-safelinks | Microsoft Learn: Safe Links in Defender for Office 365 | https://learn.microsoft.com/en-us/defender-office-365/safe-links-about |
| ms-detonation | Microsoft Tech Community: Possible major problem with MS Defender scanning/clicking links | https://techcommunity.microsoft.com/discussions/microsoftdefenderforoffice365/possible-major-problem-with-ms-defender-scanningclicking-links/3874918 |
| ms-oxcmail | Microsoft [MS-OXCMAIL] 2.1.3.2.20 Auto Response Suppress | https://msdn.microsoft.com/en-us/library/ee219609 |
| apple-pm | Apple: Postmaster information for iCloud Mail | https://support.apple.com/en-us/102322 |
| apple-mpp | Apple: Mail Privacy Protection & Privacy | https://www.apple.com/legal/privacy/data/en/mail-privacy-protection/ |
| apple-otp | Apple Developer Forums: Autofill verification codes received in Mail | https://developer.apple.com/forums/thread/738690 |
| 9to5-copy | 9to5Google: Gmail "Copy code" (2026-09-19) | https://9to5google.com/2026/09/19/gmail-copy-code/ |
| aa-copy | Android Authority: Gmail copy 2FA codes from the inbox (2026-09-21) | https://www.androidauthority.com/gmail-copy-2fa-codes-inbox-3713263/ |
| bimi | BIMI Group: BIMI infographic (provider support, May 2025) | https://bimigroup.org/bimi-infographic/ |
| redsift-bimi | Red Sift: BIMI in 2026 | https://redsift.com/guides/bimi-in-2026-verified-logos-cmcs-and-the-fastest-path-to-inbox-display |
| validity-abc | Validity: Business logos in Apple Mail | https://www.validity.com/blog/business-logos-in-apple-mail-now-easy-as-abc/ |
| redsift-ed | Red Sift: Ed25519 DKIM support | https://redsift.com/blog/ed25519-dkim-support-weak-keys |
| captaindns | CaptainDNS: RSA vs Ed25519 for DKIM | https://www.captaindns.com/en/blog/rsa-vs-ed25519-dkim |
| m3aawg-dkim | M3AAWG: DKIM Key Rotation Best Common Practices | https://m3aawg.org/DKIMKeyRotation |
| sa-upd | Apache SpamAssassin rule update 1939464 (sa-update channel, mirror) | https://www.sa-update.pccc.com/1939464.tar.gz |
| sa-src | Apache SpamAssassin rules source (GitHub mirror) | https://github.com/apache/spamassassin/tree/trunk/rules |
| sa-7713 | SpamAssassin Bug 7713 (HTML_IMAGE_RATIO) | https://bz.apache.org/SpamAssassin/show_bug.cgi?id=7713 |
| clip | HubSpot: Review and decrease the size of marketing emails (Gmail 102 KB) | https://knowledge.hubspot.com/marketing-email/review-and-decrease-the-size-of-marketing-emails |
| waypoint | Waypoint: Prevent threading on Gmail with X-Entity-Ref-ID | https://www.usewaypoint.com/blog/prevent-threading-on-gmail-with-the-x-entity-ref-id-email-header |
| spamresource-subs | Spam Resource: The Gmail subscription management (2025-07) | https://www.spamresource.com/2025/07/the-gmail-subscription-management.html |
| berthub | Bert Hubert: Shifting cyber norms: Microsoft security POST-ing to you | https://berthub.eu/articles/posts/shifting-cyber-norms-microsoft-post/ |
| supabase | Supabase discussion #41618: links consumed by email scanners | https://github.com/orgs/supabase/discussions/41618 |
| nist-63b | NIST SP 800-63B-4 Authenticators (final, Jul 2025) | https://pages.nist.gov/800-63-4/sp800-63b/authenticators/ |
| pci | PCI SSC FAQ 1085: unencrypted PANs over end-user messaging | https://www.pcisecuritystandards.org/faqs/1085 |
| owasp-xss | OWASP Cross Site Scripting Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html |
| owasp-forgot | OWASP Forgot Password Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html |
| cwe93 | CWE-93: Improper Neutralization of CRLF Sequences | https://cwe.mitre.org/data/definitions/93.html |
| uts39 | Unicode Technical Standard #39: Unicode Security Mechanisms | https://www.unicode.org/reports/tr39/ |
| abusix | Abusix: 9 ways to secure your webforms | https://abusix.com/blog/how-to-secure-your-webforms/ |
| ses-sim | AWS: Sending test emails with the SES mailbox simulator | https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html |
| ses-quotas | AWS: Service quotas in Amazon SES | https://docs.aws.amazon.com/ses/latest/dg/quotas.html |
| ses-tag | AWS: SES v2 MessageTag | https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_MessageTag.html |
| ses-message | AWS: SES v2 Message (Headers ≤ 15) | https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_Message.html |
| ses-dest | AWS: SES Destination (no SMTPUTF8) | https://docs.aws.amazon.com/ses/latest/APIReference/API_Destination.html |
| ses-notif | AWS: Amazon SNS notification contents for SES | https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html |
| ses-msgid | AWS re:Post: SES changing Message-ID header | https://repost.aws/questions/QUbG0NM6VYRo6nx2O7Ym_xOg/ses-changing-message-id-header |
| aws-oneclick | AWS Messaging blog: Using one-click unsubscribe with Amazon SES (2024-02-06) | https://aws.amazon.com/blogs/messaging-and-targeting/using-one-click-unsubscribe-with-amazon-ses/ |
| resend-send | Resend: Send email API | https://resend.com/docs/api-reference/emails/send-email |
| resend-idem | Resend: Idempotency keys | https://resend.com/docs/dashboard/emails/idempotency-keys |
| resend-test | Resend: Send test emails | https://resend.com/docs/dashboard/emails/send-test-emails |
| resend-headers | Resend: Custom headers | https://resend.com/docs/dashboard/emails/custom-headers |
| resend-unsub | Resend: Add unsubscribe to transactional emails | https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails |
| pm-api | Postmark: Email API | https://postmarkapp.com/developer/api/email-api |
| pm-size | Postmark: Attachment and email size limits | https://postmarkapp.com/support/article/1056-what-are-the-attachment-and-email-size-limits |
| pm-meta | Postmark: Custom metadata for your emails | https://postmarkapp.com/blog/feature-announcement-custom-metadata-for-your-emails |
| pm-sandbox | Postmark: Server sandbox mode | https://postmarkapp.com/developer/user-guide/sandbox-mode/server-sandbox-mode |
| pm-bounces | Postmark: Generate fake bounces | https://postmarkapp.com/developer/user-guide/sandbox-mode/generate-fake-bounces |
| pm-test | Postmark: Send a single email (POSTMARK_API_TEST) | https://postmarkapp.com/developer/user-guide/send-email-with-api/send-a-single-email |
| sg-send | Twilio SendGrid: Mail Send v3 | https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send |
| sg-limits | Twilio SendGrid: Mail Send limitations | https://docs.sendgrid.com/api-reference/mail-send/limitations |
| mailpit | Mailpit (GitHub README) | https://github.com/axllent/mailpit |
| ethereal | Ethereal Email | https://ethereal.email/ |

[rfc5322]: https://www.rfc-editor.org/rfc/rfc5322
[rfc5321]: https://www.rfc-editor.org/rfc/rfc5321
[rfc2045]: https://www.rfc-editor.org/rfc/rfc2045
[rfc2046]: https://www.rfc-editor.org/rfc/rfc2046
[rfc2047]: https://www.rfc-editor.org/rfc/rfc2047
[rfc2387]: https://www.rfc-editor.org/rfc/rfc2387
[rfc2392]: https://www.rfc-editor.org/rfc/rfc2392
[rfc6531]: https://www.rfc-editor.org/rfc/rfc6531
[rfc6532]: https://www.rfc-editor.org/rfc/rfc6532
[rfc3834]: https://www.rfc-editor.org/rfc/rfc3834
[rfc2369]: https://www.rfc-editor.org/rfc/rfc2369
[rfc2919]: https://www.rfc-editor.org/rfc/rfc2919
[rfc8058]: https://www.rfc-editor.org/rfc/rfc8058
[rfc7208]: https://www.rfc-editor.org/rfc/rfc7208
[rfc6376]: https://www.rfc-editor.org/rfc/rfc6376
[rfc8301]: https://www.rfc-editor.org/rfc/rfc8301
[rfc8463]: https://www.rfc-editor.org/rfc/rfc8463
[rfc9989]: https://www.rfc-editor.org/rfc/rfc9989
[rfc9990]: https://www.rfc-editor.org/rfc/rfc9990
[rfc9991]: https://www.rfc-editor.org/rfc/rfc9991
[rfc8617]: https://www.rfc-editor.org/rfc/rfc8617
[rfc8461]: https://www.rfc-editor.org/rfc/rfc8461
[rfc8460]: https://www.rfc-editor.org/rfc/rfc8460
[rfc7672]: https://www.rfc-editor.org/rfc/rfc7672
[rfc3463]: https://www.rfc-editor.org/rfc/rfc3463
[rfc3464]: https://www.rfc-editor.org/rfc/rfc3464
[rfc5965]: https://www.rfc-editor.org/rfc/rfc5965
[rfc8551]: https://www.rfc-editor.org/rfc/rfc8551
[rfc9580]: https://www.rfc-editor.org/rfc/rfc9580
[g-guide]: https://support.google.com/mail/answer/81126
[g-faq]: https://support.google.com/mail/answer/14229414
[g-smtp]: https://knowledge.workspace.google.com/admin/support/troubleshooting/gmail-smtp-errors-and-codes
[g-pmt]: https://support.google.com/mail/answer/14668346
[g-pmt-dep]: https://support.google.com/mail/answer/16594218
[g-fbl]: https://support.google.com/mail/answer/6254652
[g-bimi]: https://knowledge.workspace.google.com/admin/security/set-up-bimi
[g-thread]: https://workspaceupdates.googleblog.com/2019/03/threading-changes-in-gmail-conversation-view.html
[g-subs]: https://workspaceupdates.googleblog.com/2025/07/manage-email-subscriptions-in-gmail.html
[g-markup]: https://developers.google.com/workspace/gmail/markup/registering-with-google
[g-promotab]: https://developers.google.com/workspace/gmail/promotab/overview
[yahoo]: https://senders.yahooinc.com/best-practices/
[yahoo-faq]: https://senders.yahooinc.com/faqs
[ms-policy]: https://substrate.office.com/ip-domain-management-snds/postmaster/Policies
[dmarcian-ms]: https://dmarcian.com/microsoft-enforces-spf-dkim-dmarc/
[ms-svg]: https://mc.merill.net/message/MC1130385
[ms-dane]: https://mc.merill.net/message/MC711018
[ms-safelinks]: https://learn.microsoft.com/en-us/defender-office-365/safe-links-about
[ms-detonation]: https://techcommunity.microsoft.com/discussions/microsoftdefenderforoffice365/possible-major-problem-with-ms-defender-scanningclicking-links/3874918
[ms-oxcmail]: https://msdn.microsoft.com/en-us/library/ee219609
[apple-pm]: https://support.apple.com/en-us/102322
[apple-mpp]: https://www.apple.com/legal/privacy/data/en/mail-privacy-protection/
[apple-otp]: https://developer.apple.com/forums/thread/738690
[9to5-copy]: https://9to5google.com/2026/09/19/gmail-copy-code/
[aa-copy]: https://www.androidauthority.com/gmail-copy-2fa-codes-inbox-3713263/
[bimi]: https://bimigroup.org/bimi-infographic/
[redsift-bimi]: https://redsift.com/guides/bimi-in-2026-verified-logos-cmcs-and-the-fastest-path-to-inbox-display
[validity-abc]: https://www.validity.com/blog/business-logos-in-apple-mail-now-easy-as-abc/
[redsift-ed]: https://redsift.com/blog/ed25519-dkim-support-weak-keys
[captaindns]: https://www.captaindns.com/en/blog/rsa-vs-ed25519-dkim
[m3aawg-dkim]: https://m3aawg.org/DKIMKeyRotation
[sa-upd]: https://www.sa-update.pccc.com/1939464.tar.gz
[sa-7713]: https://bz.apache.org/SpamAssassin/show_bug.cgi?id=7713
[clip]: https://knowledge.hubspot.com/marketing-email/review-and-decrease-the-size-of-marketing-emails
[waypoint]: https://www.usewaypoint.com/blog/prevent-threading-on-gmail-with-the-x-entity-ref-id-email-header
[spamresource-subs]: https://www.spamresource.com/2025/07/the-gmail-subscription-management.html
[berthub]: https://berthub.eu/articles/posts/shifting-cyber-norms-microsoft-post/
[supabase]: https://github.com/orgs/supabase/discussions/41618
[nist-63b]: https://pages.nist.gov/800-63-4/sp800-63b/authenticators/
[pci]: https://www.pcisecuritystandards.org/faqs/1085
[owasp-xss]: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
[owasp-forgot]: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
[cwe93]: https://cwe.mitre.org/data/definitions/93.html
[uts39]: https://www.unicode.org/reports/tr39/
[abusix]: https://abusix.com/blog/how-to-secure-your-webforms/
[ses-sim]: https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html
[ses-quotas]: https://docs.aws.amazon.com/ses/latest/dg/quotas.html
[ses-tag]: https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_MessageTag.html
[ses-message]: https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_Message.html
[ses-dest]: https://docs.aws.amazon.com/ses/latest/APIReference/API_Destination.html
[ses-notif]: https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
[ses-msgid]: https://repost.aws/questions/QUbG0NM6VYRo6nx2O7Ym_xOg/ses-changing-message-id-header
[aws-oneclick]: https://aws.amazon.com/blogs/messaging-and-targeting/using-one-click-unsubscribe-with-amazon-ses/
[resend-send]: https://resend.com/docs/api-reference/emails/send-email
[resend-idem]: https://resend.com/docs/dashboard/emails/idempotency-keys
[resend-test]: https://resend.com/docs/dashboard/emails/send-test-emails
[resend-headers]: https://resend.com/docs/dashboard/emails/custom-headers
[resend-unsub]: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails
[pm-api]: https://postmarkapp.com/developer/api/email-api
[pm-size]: https://postmarkapp.com/support/article/1056-what-are-the-attachment-and-email-size-limits
[pm-meta]: https://postmarkapp.com/blog/feature-announcement-custom-metadata-for-your-emails
[pm-sandbox]: https://postmarkapp.com/developer/user-guide/sandbox-mode/server-sandbox-mode
[pm-bounces]: https://postmarkapp.com/developer/user-guide/sandbox-mode/generate-fake-bounces
[pm-test]: https://postmarkapp.com/developer/user-guide/send-email-with-api/send-a-single-email
[sg-send]: https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send
[sg-limits]: https://docs.sendgrid.com/api-reference/mail-send/limitations
[mailpit]: https://github.com/axllent/mailpit
[ethereal]: https://ethereal.email/
