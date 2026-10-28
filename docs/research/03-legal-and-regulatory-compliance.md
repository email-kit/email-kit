# 03 — Legal and regulatory compliance for email

**Scope.** These are the laws and regulator positions that decide what an email must carry, who may receive it, and what the sender must record. They cover commercial (marketing) email, transactional (service) email, mixed email and consent-request email in the US, Canada, the EU (with Germany and France), the UK, Australia, New Zealand, Singapore, Japan, South Korea, India, China, Sri Lanka, Brazil and Mexico. Children's rules and the mailbox-provider rules that work like regulation are covered as well. Deliverability itself (authentication, DMARC, complaint rates) is in another research file.

**Verified:** 2026-10-27. Every source was accessed on that date (see [Sources](#sources)).

> **This is not legal advice.** It is engineering research to drive a framework's defaults and checks. Laws change, and regulators interpret them case by case. Have counsel in each target market review the compliance profiles before they ship, and again every year.

**How to read the tables**

| Column | Meaning |
|---|---|
| **Applies to** | `M` marketing/commercial · `T` transactional/service · `X` mixed · `C` consent-request (e.g. double-opt-in confirmation) · `All` |
| **Level** | What the framework should do when that jurisdiction's profile is active: **MUST** (block the build or send), **SHOULD** (warn by default), **MAY** (offer as an option) |
| **Checkable?** | `lint` = static check on the template or render · `config` = check on the project configuration · `runtime` = send-time guard · `process` = needs human or organisational evidence |
| **Verification** | **P** = read in the primary text or on the regulator's site during this check · **S** = confirmed only through secondary sources (law firms, trade press) · **K** = settled statute text, with the official link given but the page not re-read today (blocked or unreachable) |

---

## 0. Headlines

### 0.1 What changed in 2024–2026

| Date | Change | Effect on email |
|---|---|---|
| 2024-10-07 | EDPB Guidelines 2/2023 v2.0 adopted (P) | Tracking pixels **and tracking links** in email fall under ePrivacy Art. 5(3). Consent is needed unless strictly necessary. |
| 2025-02 → 2025-10-06 | Commission withdraws the **ePrivacy Regulation** proposal. It was announced in the 2025 work programme, and the withdrawal notice is reported as OJ C/2025/5423 (S) | The 2002 ePrivacy Directive and national laws stay in force. |
| 2025-04-22 / 06-23 / 2026-04-22 | **COPPA** amended rule published / effective / main compliance date (S, FTC) | Separate parental consent for third-party disclosure, a written retention policy, wider "personal information". |
| 2025-03-21 | Mexico's new **LFPDPPP** in force. INAI dissolved, and the Secretaría Anticorrupción y Buen Gobierno now enforces it (S) | New regulator. Privacy-notice and opposition rights carry over. |
| 2025-09-01 | CNIL fines Google **€325m**, partly because ads shown among Gmail messages were direct marketing that needed consent (P) | Email-like ads count as email marketing under L.34-5 CPCE. |
| 2025-10-30 | Sri Lanka **PDPA (Amendment) Act No. 22 of 2025** certified (P) | Fixed commencement deadlines removed. Rights requests now get a one-month response, free of charge. Cross-border rule (s.26) replaced. |
| 2025-11-13 | India **DPDP Rules 2025** notified (S, PIB) | Core duties (notice, consent, children) apply from **2027-05-13**. Consent managers from 2026-11-13. |
| 2025-11-13 | CJEU **C-654/23 Inteligo Media** (S) | A free account registration can be "a sale" for the soft opt-in. No separate GDPR basis is needed when Art. 13(2) is met. |
| 2025-11 | Arizona Court of Appeals rejects "spy pixel" claims under the state's TUCSRA (S) | US email-pixel class actions are weakening (still watch other states). |
| 2026-01-01 | Updated CCPA regulations in force (risk assessments, ADMT, audits) (S, CPPA) | Pixel or ad-sharing programmes may need risk assessments. |
| 2026-02-05 | UK **DUAA** commencement: charity soft opt-in (s.114), PECR fines raised to UK GDPR level (s.115, Sch. 13), new cookie exceptions (s.112) (P) | Charities may use soft opt-in for details collected from 2026-02-05. PECR fines up to £17.5m or 4% for conduct from that date. |
| 2026-03 | Australia: Lululemon **A$702,900** penalty for "service" emails that carried promotions (S, ACMA) | A receipt with promotional content is a commercial message and needs an unsubscribe. |
| 2026-03-12 / 04-14 | **CNIL recommendation on email tracking pixels** (deliberation 2026-042) adopted / published. Grace period ended **2026-07-14**. FAQ 2026-07-22 (P) | Consent is the default. Narrow exemptions for authentication security and for deliverability on *requested* email (last-open day only). |
| 2026-04-28/29 | ICO final storage-and-access guidance; ICO charity soft opt-in guidance (S) | Email pixels are covered by PECR reg. 6, including when sent to corporate subscribers. |
| 2026-07-10 / 07-17 | Japan **APPI amendment** passed / promulgated. Commencement within 2 years. Administrative surcharge; reported parental consent under 16 (S) | Pending. Watch the cabinet orders. |
| 2026-07-22 | Sri Lanka Gazette **2498/16**: PDPA ss.2–3, **Part I** (processing) and **Part III** (controllers/processors, incl. s.26 cross-border) commence **2027-01-01** (P) | Parts II (rights), IV (s.27 direct marketing) and VII (penalties) are still not commenced. |
| 2026-10-01 | Korea **Network Act** amendment in force, with revenue-based surcharges for unlawful advertising transmission (S, BKL) | Spam enforcement risk rises from fixed fines to a percentage of revenue. |
| 2026-10-21 | EU **Digital Omnibus**: Council mandate drops the proposed GDPR Art. 88a/88b and keeps terminal-equipment rules in ePrivacy Art. 5(3) (S) | Pending trilogue. Pixel consent rules are unchanged for now. |

### 0.2 Findings that contradict the reference docs

| # | Reference doc says | Finding | Recommendation |
|---|---|---|---|
| R1 | Package-1 FR-25: postal address is optional and omitted when empty. Package-2 footer: "Bloopp · Sri Lanka". | A **physical postal address is mandatory** in commercial email under CAN-SPAM (15 USC 7704(a)(5)(A)(iii)), in the CASL mailing address (SOR/2012-36), in Japan's 住所 display duty and in Mexico's domicilio (LFPC Art. 17). | Postal address is a **required slot for `marketing` and `consent-request`**, and the build fails if it is empty. SHOULD on every email. |
| R2 | Package-1 G2/FR-09/T-CAT-13: a transactional email *cannot* carry an unsubscribe link, and the check fails if the text contains "unsubscribe". | No law forbids an unsubscribe link in transactional mail. Under **CASL s.6(6)** a quote, receipt or warranty message that is a CEM is exempt only from *consent*. It still needs sender identification and an **unsubscribe mechanism** (s.6(1)(b)). | Keep "no unsubscribe on transactional" as a *product* default. Make the real check "**no promotional content in transactional**". In the `ca` profile, allow or require a low-key "manage email preferences" link. |
| R3 | Package-1: "A double-opt-in confirmation is transactional." | CASL s.1(3): a message that **requests consent is itself a CEM**, so it needs sender ID and an unsubscribe mechanism. Germany and France expect the confirmation to contain **no advertising**. Japan exempts consent-confirmation mail from opt-in. Package-2 (`mailing-list` + `listUnsubscribe`) is closer to the law. | Add a distinct **`consent-request` purpose** with sender ID, postal address and an "I didn't ask for this / remove me" link, no promotional content, and no tracking. |
| R4 | Package-1 cites the Gmail/Yahoo 2024 rules as the reason for unsubscribe. | Unsubscribe is a **legal** duty in every regime here, regardless of volume. The mailbox-provider rules add one-click (RFC 8058) and a 48-hour target. | Cite both. Apply legal rules to every marketing send, not only above 5,000 a day. |
| R5 | Package-2 NOT-005: "Emails go only to adults". The walkthrough lets independent teens aged 16–17 receive `own-purchases`. | The internal rule is inconsistent, and "child" differs by law: **Sri Lanka < 16** (and child data is a *special category*, PDPA s.56), **India < 18**, GDPR Art. 8 **13–16** by member state, **COPPA < 13**, Korea < 14, China < 14. | Make the age thresholds a per-jurisdiction table in the compliance profile. Never send `marketing` to anyone under 18. |
| R6 | Neither package mentions open or click tracking. Package-1 sends through an SES configuration set. | SES and Resend can insert open pixels and rewrite links. In the EU, UK and France both need **consent** unless exempt (EDPB 2/2023, CNIL 2026-042, ICO 2026). | Tracking is **off by default**. A build check flags 1×1 images and rewritten links. Tracking is gated per recipient at send time. |
| R7 | Package-2's "Remove me" label for the list unsubscribe. | Some regimes require a *statement* that the reader can opt out: Japan 受信拒否の通知ができる旨, Singapore (in English), Korea (refusal method stated), Sri Lanka s.27(3). | Use explicit wording ("Unsubscribe from these emails") and localise it. Keep "Remove me" only as extra text. |

---

## 1. Message types used in this document

| Type | Working definition (strictest common reading) | Typical examples |
|---|---|---|
| **Marketing / commercial** | Any message where *one* of the purposes is to promote goods, services, a business or a cause (CASL "one of its purposes", Spam Act, ICO) | Newsletter, offer, launch invitation, cart reminder, win-back, "rate us and get 10% off" |
| **Transactional / service** | Triggered by the recipient's own action or relationship, purely informational, and necessary for the service | Sign-in code, receipt, shipping notice, password reset, security alert, legal or contract notice |
| **Mixed** | A transactional message that also carries promotional content | A receipt with "you may also like", an order confirmation with a coupon |
| **Consent-request** | A message asking someone to confirm or give consent to receive marketing | Double-opt-in confirmation, re-permission request |

---

## 2. United States

### 2.1 CAN-SPAM Act and the FTC CAN-SPAM Rule (15 USC 7701–7713; 16 CFR Part 316)

**Definitions.** The test is the message's **primary purpose** (16 CFR 316.3). If commercial content is combined with transactional content, the message is *transactional* only if the subject line would not lead a recipient to think it is commercial **and** the transactional content appears mainly at the beginning. If commercial content is combined with "other" content, the message is *commercial* if a reasonable recipient would read the subject line or body as promoting something. **Transactional or relationship** messages fall into five narrow categories: they confirm an agreed transaction; give warranty, recall, safety or security information about something purchased; notify changes to a membership, subscription, account or loan, or give regular balance information; give employment or benefits information; or deliver goods and services already agreed. **B2B mail is covered.** The **consent model is opt-out**: no prior consent is needed. (P: FTC guide)

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| Header information ("From", "To", "Reply-To", routing) is accurate and identifies the sender. This also applies to **transactional** messages. | All | MUST | lint: From display name and domain resolve to the configured sender; runtime: Reply-To comes from config | [FTC guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) (P); 15 USC 7704(a)(1) (K) |
| Subject line is not deceptive about the content | M, X | MUST | lint (partial): no `Re:`/`Fwd:` on a non-reply; `process` review | FTC guide (P) |
| Clear and conspicuous identification as an advertisement. **Not required where the recipient gave affirmative consent** (7704(a)(5)(B)). | M | SHOULD (MUST if sending without consent, which the safe default never does) | lint: a "why you got this" reason that names the subscription | FTC guide (P); [15 USC 7704](https://www.law.cornell.edu/uscode/text/15/7704) (K) |
| Valid physical postal address: a street address, a USPS-registered PO box, or a private mailbox at a registered **CMRA** | M | MUST | config + lint: the `postalAddress` slot renders in HTML and text | FTC guide (P); [16 CFR 316.2](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-316) (K) |
| Clear opt-out notice that lets the recipient stop **all** commercial email from the sender. A preference menu is allowed if it includes "all". | M | MUST | lint: unsubscribe link in both parts; config: the preference centre has "unsubscribe from all marketing" | FTC guide (P) |
| Honour opt-out within **10 business days** | M | MUST (framework target ≤ 48 h) | runtime: suppression is written synchronously on one-click POST | FTC guide (P) |
| Opt-out mechanism works for **at least 30 days** after sending | M | MUST | config: unsubscribe-token lifetime ≥ 30 days (safe default: no expiry) | FTC guide (P) |
| No fee, no information beyond the email address and preferences, nothing more than one reply or **one web page** | M | MUST | lint: the unsubscribe URL lands on a single-step page; one-click POST works without login | FTC guide (P); 16 CFR 316.5 (K) |
| Don't sell or transfer opted-out addresses (except to a compliance vendor) | M | MUST | process | FTC guide (P) |
| Multiple advertisers: one designated "sender" appears in From and meets the duties | M | SHOULD | config: `sentOnBehalfOf` | FTC guide (P) |
| Sexually explicit content: "SEXUALLY-EXPLICIT:" subject prefix | M | MAY (out of scope) | — | 16 CFR 316.4 (K) |

**Penalties.** Up to **$53,088 per violating email** (2025 inflation adjustment). The FTC has stated that 2025 levels continue unchanged through 2026 ([FR public inspection 2026-18853](https://public-inspection.federalregister.gov/2026-18853.pdf), S). Aggravated violations and some deceptive practices are criminal (18 USC 1037). There is no private right of action, except for internet access providers. **Records:** CAN-SPAM requires none, but keep opt-out logs to prove the 10-business-day compliance. **Recent changes:** none to the Act or Rule in 2024–2026.

**Pre-emption.** CAN-SPAM pre-empts state laws on commercial email *except* those that prohibit falsity or deception (15 USC 7707(b)) (K).

### 2.2 Notable state laws

| Law | Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|---|
| **California B&P §17529.5** | Unlawful to send a commercial email ad from or to California that has a falsified or forged header, or a subject line likely to mislead about the contents. Recipients and ISPs have a private action with **$1,000 liquidated damages per email**. Courts limit it to actual falsity or deception (federal pre-emption). | M | MUST (covered by the header and subject rules above) | lint: sender-identity and subject checks | [Cal. B&P 17529.5](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=17529.5.&lawCode=BPC) (K) |
| **Arizona TUCSRA** (ARS 44-1376) pixel suits | About 20 class actions claimed email open pixels were unlawful "communication service records". The **Arizona Court of Appeals (Nov 2025) affirmed dismissal**, and federal courts agree. | M | — (risk note) | — | [Womble Bond Dickinson alert](https://www.womblebonddickinson.com/us/insights/alerts/arizona-court-appeals-affirms-dismissal-arizona-spy-pixel-class-action) (S) |

### 2.3 CCPA/CPRA (California) as it touches email

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| Email addresses and pixel-derived data (opens, device, IP) are personal information. A **notice at collection** is required where addresses are collected. | All | MUST (in the signup flow, not the template) | process; lint: privacy link in the footer | [CCPA, Civ. Code 1798.100 ff.](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5) (K) |
| Uploading lists or pixel data to ad platforms for cross-context behavioural advertising is **"sharing"**: honour "Do Not Sell or Share" and opt-out preference signals | M | SHOULD | runtime: a `share` flag on the consent record | CCPA 1798.120/135 (K) |
| **Under 16:** opt-*in* before selling or sharing (under 13 needs a parent) | M | MUST | runtime: age guard | CCPA 1798.120(c) (K) |
| An email-signup discount is a **financial incentive**: a notice is required | M | SHOULD (signup flow) | process | CCPA regs §7016 (K) |
| Updated CCPA regulations in force **2026-01-01** (risk assessments from 2026, ADMT and audits phased to 2027–2030) | M | SHOULD (programme level) | process | [CPPA updates](https://cppa.ca.gov/regulations/ccpa_updates.html) (S) |

Penalties are administrative fines of up to $2,500 per violation, or $7,500 if intentional or involving minors (amounts are inflation-adjusted).

### 2.4 COPPA (15 USC 6501; 16 CFR Part 312)

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| A child's email address is "online contact information", which is personal information. Collecting it from an **under-13** user of a child-directed service, or with actual knowledge of age, needs verifiable parental consent (VPC) unless an exception applies. | All | MUST (block) | runtime: child guard (package-2 already has no child recipient kind) | [16 CFR 312](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312) (K) |
| Exceptions: a **one-time response** to a child's request, then delete (§312.5(c)(3)). **Multiple contacts** such as a newsletter need direct notice to the parent and a parental opt-out, and no other use (§312.5(c)(4)). Contact information may be collected to *obtain* parental consent (§312.5(c)(1)). | T | MAY (only if a product targets children) | process | [16 CFR 312.5](https://www.law.cornell.edu/cfr/text/16/312.5) (S) |
| **2025 amendments:** published 2025-04-22 (90 FR 16918), **effective 2025-06-23**, **compliance by 2026-04-22** (some Safe Harbor provisions on other dates). Separate VPC is required for disclosing to third parties (e.g. targeted advertising). There must be a written data-retention policy with no indefinite retention, and biometric and government identifiers become personal information. The proposed limits on push notifications were **not** adopted. | All | MUST (if in scope) | process | [Federal Register](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule) (S); [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data) (P) |

Penalties: up to $53,088 per violation (2025 level).

---

## 3. Canada — CASL (S.C. 2010, c. 23) and the CRTC regulations

**Definitions.** A **commercial electronic message (CEM)** is one where *one of its purposes* is to encourage participation in a commercial activity. **A message requesting consent is itself a CEM (s.1(3)).** Messages that *solely* do a s.6(6) thing (requested quote, confirming an agreed transaction, warranty/recall/safety, factual account or subscription information, employment, delivering a purchased product) are **exempt from consent only. Identification and unsubscribe still apply** (s.6(1)(b)). (P)

**Consent model:** opt-in. **Express** consent, or **implied** consent (an existing business relationship from a purchase or contract within **2 years**; an inquiry within **6 months**; conspicuous publication; a business card), s.10(9)–(10). (P)

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| Consent (express or implied) before sending | M, X | MUST | runtime: consent record exists and implied consent has not expired (2 y / 6 m windows) | [CASL s.6(1), s.10](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/FullText.html) (P) |
| Identify the sender and anyone on whose behalf it is sent: name, **mailing address**, and a phone number, email or web address. A link to this information is acceptable where it is impractical to include it. | M, X, C, T-if-CEM | MUST | lint: `senderLegalName`, `postalAddress`, `contact` slots | CASL s.6(2) (P); [SOR/2012-36](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/) (K) |
| Contact information valid for **≥ 60 days** after sending | M, X, C | MUST | config | CASL s.6(3) (P) |
| Unsubscribe mechanism: free of cost, by the same electronic means, from **all** CEMs or a specified class, through a link or address | M, X, C, T-if-CEM | MUST | lint + config ("all" option) | CASL s.11(1) (P) |
| Unsubscribe address or page valid for **≥ 60 days** | M, X, C | MUST | config: token lifetime ≥ 60 days | CASL s.11(2) (P) |
| Give effect **without delay, ≤ 10 business days**, with no further action needed from the recipient | M, X, C | MUST | runtime | CASL s.11(3) (P) |
| When requesting consent: state the purpose, who is asking, and that consent can be withdrawn | C | MUST | lint: the consent-request template has the required copy keys | CASL s.10(1) (P) |
| **Onus of proving consent is on the sender** | M | MUST (keep records) | runtime: consent record id stored with every send | CASL s.13 (P) |

**Penalties:** administrative monetary penalties of up to **C$1m (individual) / C$10m (other) per violation** (s.20(4)). The private right of action has never been brought into force. Enforcement is sparse but continuing; for example, the CRTC accepted an undertaking from **Indeed Canada (Aug 2026, C$200,000)** ([CRTC enforcement](https://crtc.gc.ca/eng/ce/actions.htm), S). **Quebec Law 25:** where a technology can identify, locate or profile a person, they must be told, and profiling functions must be **off by default** (Act respecting the protection of personal information in the private sector, s.8.1, K). Treat email open pixels as such a technology. **Pending:** **Bill C-36** (*Protecting Privacy and Consumer Data Act*), tabled on 2026-06-15, would replace PIPEDA Part 1 ([DLA Piper](https://www.dlapiper.com/en/insights/publications/2026/06/canada-tables-bill-c36-the-protecting-privacy-and-consumer-data-act), S).

---

## 4. European Union

### 4.1 ePrivacy Directive 2002/58/EC, Art. 13, and the e-Commerce Directive

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| **Prior consent** for email direct marketing to natural persons (Art. 13(1)). Member states choose the rule for legal persons (Art. 13(5)). | M, X | MUST | runtime: consent record | [Directive 2002/58/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219) (K) |
| **Soft opt-in** (Art. 13(2)): details obtained from a customer *in the context of a sale*; the **same** sender; **own similar** products or services; and a free, easy chance to object **at collection and in every message**. A free freemium account can qualify (CJEU **C-654/23 *Inteligo Media***, 2025-11-13). | M | MAY (basis = `soft-opt-in`) | runtime: basis + "objection offered at collection" flag; lint: unsubscribe link | Art. 13(2) (K); [CJEU C-654/23](https://curia.europa.eu/juris/liste.jsf?num=C-654/23) (S) |
| The sender must not disguise or conceal its identity. There must be a **valid address** for opt-out requests (Art. 13(4)). | M | MUST | lint | Art. 13(4) (K) |
| A commercial communication must be clearly identifiable as such, and the person on whose behalf it is made must be identifiable (e-Commerce Directive Art. 6). | M | SHOULD | lint: sender identity and `reason` | [Directive 2000/31/EC](https://eur-lex.europa.eu/eli/dir/2000/31/oj) (K) |

### 4.2 GDPR (Regulation 2016/679)

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| A lawful basis for each processing: consent (Art. 6(1)(a)) or ePrivacy-compliant soft opt-in for marketing. Direct marketing *may* be a legitimate interest (Recital 47), but ePrivacy Art. 13 overrides it for email. *Inteligo*: no separate GDPR basis is needed where Art. 13(2) is met. | M | MUST | runtime: `basis` field | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) (K) |
| Consent is freely given, specific, informed and unambiguous: no pre-ticked boxes, not bundled, and **demonstrable** (Art. 7(1)). Withdrawal is as easy as giving (Art. 7(3)). | M, C | MUST | runtime: consent proof stored | GDPR Art. 4(11), 7 (K) |
| An **absolute right to object** to direct marketing, after which processing for marketing must stop (Art. 21(2)–(3)). It must be brought to attention at first communication (Art. 21(4)). | M | MUST | runtime: suppression | GDPR Art. 21 (K) |
| Transparency information (Art. 13/14). A **privacy notice link** in email is the practical carrier. | All | MUST | lint: privacy link in the footer | GDPR Art. 12–14 (K) |
| Records of processing (Art. 30). Retention limited to what is necessary (Art. 5(1)(e)). | All | MUST (organisation) | process | GDPR Art. 5, 30 (K) |
| **Children (Art. 8):** an information society service offered directly to a child on a consent basis needs parental authorisation **under 16**. Member states may set an age from **13 to 16**. | All | MUST | runtime: per-country age table | GDPR Art. 8 (K) |

**Penalties:** up to €20m or 4% of worldwide turnover (Art. 83). ePrivacy penalties are set nationally; France applies Art. 82 of the Loi Informatique et Libertés with CNIL fines, for example **Google €325m (SAN-2025-004, 2025-09-01)** ([CNIL](https://www.cnil.fr/en/cookies-and-advertisements-inserted-between-emails-google-fined-325-million-euros-cnil), P/S).

### 4.3 Tracking pixels and link tracking

**EDPB Guidelines 2/2023 on the technical scope of Art. 5(3), v2.0 (adopted 2024-10-07), §3.1 (P).** "In the case of an email, the sender may include a tracking pixel to detect when the receiver reads the email." Tracking links "function in the same way, but the identifier is appended to the website address". Delivering either to the device "does constitute storage, at the very least through the caching mechanism", and collecting the identifier is "gaining of access". **Art. 5(3) therefore applies to pixels *and* tracked links in email.** Consent is required unless the operation is strictly necessary for a service the user explicitly requested, or is solely for transmission.

**CNIL recommendation on tracking pixels in email: deliberation 2026-042, adopted 2026-03-12, published 2026-04-14, FAQ 2026-07-22 (P).** This is soft law interpreting Art. 82 of the Loi Informatique et Libertés; it is not itself binding.

| CNIL position | Detail |
|---|---|
| **Consent required** for | campaign open-rate measurement and optimisation (including anti-ad-fraud checks); profiling to target outside email; fraud detection (unusual or mass opens); individual open measurement for deliverability *outside* the exemption |
| **Exempt** (no consent) | (1) pixels used **only for authentication security** (e.g. checking that a code email is opened on a known device); (2) **individual open measurement for deliverability**, strictly limited to adjusting frequency or stopping mail to inactive recipients. Keep **only the date (day, no time) of the last open**, overwriting the previous one. The exemption applies **only to emails the recipient requested** (transactional emails, or emails sent with consent). |
| Not exempt | Cart-abandonment emails (FAQ Q16: promotional, so they need consent). Soft-opt-in customer marketing (FAQ Q15). Collecting IP or user-agent "even if quickly anonymised" (FAQ Q7). Anonymous or aggregate collection *through a pixel* still triggers Art. 82 (FAQ Q18). |
| Link tracking | Not directly covered by the recommendation (FAQ Q1). Art. 82 applies case by case. A **per-recipient tracked link used for secure consent withdrawal is exempt** as an authentication-security measure. |
| Collection of consent | Preferably **when the email address is collected**, naming the address and stating that pixels act on every device. Ask per purpose (a single consent may cover personalised marketing plus the pixels that personalise it). Refusing must be as easy as accepting. Silence means refusal. Don't ask again for about **6 months** after a refusal. A later request comes in an email **without consent-requiring pixels**, through a page that needs a positive action (to defeat link prefetching). |
| Withdrawal | A tracked link in the **footer of each email**, working without re-entering the address. After withdrawal, **ignore every request from previously sent pixels** (FAQ Q22). |
| Proof | Individual records. A contract clause with a list provider is not proof (GDPR Art. 7(1)). |
| Scope | All recipients, including employees at work addresses (FAQ Q3). B2B prospecting gets no exemption. |
| Transition | Addresses collected before 2026-04-14: inform recipients and allow objection by **2026-07-14**, otherwise stop pixels that need consent (FAQ Q25–26). |

### 4.4 Germany

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| Email advertising without **prior express consent** is always an unreasonable nuisance (UWG §7(2) Nr. 2) | M, X | MUST | runtime | [UWG §7](https://www.gesetze-im-internet.de/uwg_2004/__7.html) (P) |
| Ads that conceal the sender, or have **no valid address** for objections at basic transmission cost, are unlawful (§7(2) Nr. 3) | M | MUST | lint | UWG §7 (P) |
| Soft opt-in (§7(3)): the address was received *in connection with a sale*, used for **own similar** goods, the customer has not objected, and the customer is told **clearly at collection and with every use** that they can object free of charge | M | MAY | runtime + lint | UWG §7(3) (P) |
| **Double opt-in** is the accepted way to prove email consent. Keep the DOI log. The confirmation email must be neutral, with no advertising. (Contrast OLG München 29 U 1682/12 (2012), which treated a confirmation email as advertising; most later practice accepts neutral confirmations.) | C | SHOULD (MUST in the `de` profile) | runtime: DOI timestamp required before the first marketing send | UWG §7; DSK guidance (K) |
| §7a's 5-year consent-documentation duty applies to **phone** advertising only. For email, keep DOI evidence for as long as you rely on it. | — | — | — | [UWG §7a](https://www.gesetze-im-internet.de/uwg_2004/__7a.html) (P) |
| Pixels: **TDDDG §25** (the former TTDSG, renamed 2024-05-14) implements Art. 5(3) | M, T | MUST (if tracking) | runtime: tracking gate | [TDDDG §25](https://www.gesetze-im-internet.de/ttdsg/__25.html) (K) |
| Imprint (DDG §5) is customary in German commercial email footers | M | MAY (`de` profile SHOULD) | lint: `legalImprint` slot | DDG §5 (K) |

Enforcement is mostly through competitor and consumer-association injunctions (UWG) and GDPR fines.

### 4.5 Status of EU reform (pending)

| Item | Status at 2026-10-27 | Source |
|---|---|---|
| **ePrivacy Regulation** (COM(2017) 10) | **Withdrawn.** Listed in the Commission 2025 work programme (Feb 2025); withdrawal notice reported as OJ C/2025/5423 (2025-10-06). The Directive stays. | [EDRi](https://edri.org/our-work/the-eprivacy-regulation-proposal-has-been-withdrawn-but-the-fight-for-your-privacy-is-far-from-over/); [OJ C/2025/5423](https://eur-lex.europa.eu/eli/C/2025/5423/oj) (S; EUR-Lex not machine-readable today) |
| **Digital Omnibus** (COM(2025) 837, 2025-11) | The proposed GDPR Art. 88a/88b (cookie-type rules, six-month re-ask ban, browser signals) were **deleted in the Council mandate of 2026-10-21**, which keeps the rules in ePrivacy Art. 5(3) with new audience-measurement exceptions and a 4-month re-ask ban. Parliament's position is open and trilogues have not started. | [EUTechReg dossier](https://research.eutechreg.com/dossiers/gdpr-reform-digital-omnibus/) (S) |
| **Digital Fairness Act** | Commission proposal expected in late 2026 (reportedly 2026-11-11): dark patterns and subscription cancellation | [PrivacyLaws](https://www.privacylaws.com/news/eu-proposal-on-digital-fairness-act-expected-by-the-end-of-2026/) (S) |

---

## 5. United Kingdom — PECR, UK GDPR and the Data (Use and Access) Act 2025

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| Marketing email or SMS to **individual subscribers** (including sole traders and some partnerships) needs specific consent (PECR reg. 22(2)) | M, X | MUST | runtime | [ICO electronic mail marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/) (P); [PECR](https://www.legislation.gov.uk/uksi/2003/2426/contents) (K) |
| **Commercial soft opt-in** (reg. 22(3)): an existing customer who bought or negotiated for a similar product, with a simple free opt-out at collection and in every message. Not for bought lists or prospects. | M | MAY | runtime + lint | ICO (P) |
| **Charitable-purposes soft opt-in** (new paragraphs inserted into reg. 22 by DUAA s.114), **in force 2026-02-05**: the charity collected the details itself from someone who showed interest in or support for its purposes, offered an opt-out at collection and in each message, and covers **details collected on or after 2026-02-05 only**. Final ICO guidance came in late April 2026. Keep separate opt-outs where commercial and charity soft opt-in overlap. | M | MAY (basis = `charity-soft-opt-in`) | runtime: collection date ≥ 2026-02-05 | [SI 2026/82](https://www.legislation.gov.uk/uksi/2026/82/made) (P); [DMA](https://www.dma.org.uk/about/articles/ico-finalises-charity-soft-opt-in-guidance) (S) |
| Corporate subscribers: consent is not required, but the sender must still identify itself and give a **valid opt-out address**. Keep a business "do not email" list. | M | MUST | lint | ICO (P) |
| Do not disguise or conceal identity, and provide a valid contact address for opt-out (reg. 23) | M | MUST | lint | ICO (P); PECR reg. 23 (K) |
| **Service messages that contain any marketing element are direct marketing.** A neutral tone is not a defence. (ICO fined Allay Claims £120k in Jan 2026 after rejecting its "service update" argument.) | X | MUST (classification) | lint: `transactional-no-promo` | [ICO identify direct marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-guidance/identify-direct-marketing/) (S); [ICO fines Jan 2026](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/01/fines-of-225-000-for-nuisance-marketing-messages/) (S) |
| UK GDPR Art. 21(3): stop marketing on objection. The ICO says act "promptly" and keep a suppression list. | M | MUST | runtime | ICO (P) |
| **Email tracking pixels fall under PECR reg. 6** (storage and access), for **all subscriber types, including corporate**. Consent is needed unless exempt, and legitimate interests cannot substitute. The DUAA s.112 statistical exception is read strictly and was framed for first-party analytics of a service (its application to email opens is unclear, so treat it as consent-required). | M, T | MUST (if tracking) | runtime: tracking gate | [ICO storage & access](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-storage-and-access-technologies/); [ICO email: what else](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/what-else-do-we-need-to-consider/) (S) |
| **PECR penalties raised to UK GDPR level** (up to **£17.5m or 4%** of worldwide turnover), DUAA s.115 and Sch. 13, **for acts on or after 2026-02-05**. Earlier acts stay under the old regime (£500k cap): SI 2026/82 regs. 8(2) and 11. | — | — | — | SI 2026/82 (P) |
| DUAA: direct marketing is listed as processing that *may* be a legitimate interest (Art. 6(1)(f), balancing still required). It is **not** a "recognised legitimate interest". Commenced 2026-02-05 (s.70). | M | — | — | SI 2026/82 (P); commentary (S) |
| **Children:** UK GDPR Art. 8 age **13**. The **Age Appropriate Design Code** (15 standards) applies to online services likely to be accessed by under-18s: high-privacy defaults, profiling off by default, no nudge techniques. DUAA s.81 adds "children's higher protection matters" to data protection by design (from 2026-02-05). | All | MUST (if children may use the service) | runtime: age guard; tracking off for minors | [ICO Children's code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/) (K); SI 2026/82 (P) |

---

## 6. Australia and New Zealand

### 6.1 Australia — Spam Act 2003 (Cth)

**Definitions.** A commercial electronic message (CEM) is one where *a* purpose is commercial. **Designated CEMs** (Sch. 1) are exempt from consent and unsubscribe, but not from identification: purely factual messages, and messages from government bodies, registered charities, political parties and educational institutions (to students and alumni). A "service" email with promotions is a CEM. The ACMA says this was its **fifth action in 18 months** against businesses that treated commercial messages as non-commercial (S).

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| Consent: **express**, or **inferred** (an existing relationship and a reasonable expectation; conspicuous publication with no "no spam" statement) (s.16, Sch. 2) | M, X | MUST | runtime | [Spam Act 2003](https://www.legislation.gov.au/C2004A01214/latest/text) (K); [ACMA](https://www.acma.gov.au/avoid-sending-spam) (S) |
| Accurate sender information: who authorised it and how to contact them, reasonably likely to stay accurate for **30 days** (s.17) | M, X | MUST | lint | Spam Act s.17 (K) |
| **Functional unsubscribe** in every CEM, presented clearly, with **no unreasonable cost**, working for **≥ 30 days** after sending. Honour within **5 working (business) days** (s.18). | M, X | MUST | lint + config + runtime | Spam Act s.18 (K); [ACMA unsubscribe fact sheet](https://www.acma.gov.au/sites/default/files/2024-05/Fact%20sheet%20-%20email%20and%20SMS%20unsubscribe%20rules.pdf) (S) |
| Channel-specific opt-outs must be honoured: TAB emailed and texted **217,000+** customers who had unsubscribed | M | MUST | runtime: suppression scope per channel and list | [ACMA TAB 2026-07](https://www.acma.gov.au/articles/2026-07/tab-pays-27m-telemarketing-and-spam-breaches) (S) |
| Keep evidence of consent (the ACMA expects senders to prove consent) | M | MUST | runtime | ACMA (S) |

**Penalties and themes, 2024–2026:** civil penalties in penalty units, up to 10,000 units a day for repeat corporate offenders. Infringement notices and enforceable undertakings: Commonwealth Bank **A$7.5m** (2024-10); Tabcorp A$4.0m (2025-06); Latitude **A$3.96m** (2026-04, no accurate sender details, no working unsubscribe); Lululemon **A$702,900** (2026-03, promotions inside order and delivery emails); TAB **A$2.7m** (2026-07, consent and channel opt-outs). Themes: messages mislabelled as "service", unsubscribe that fails or is ignored, invalid consent. **Pending:** the OAIC **Children's Online Privacy Code** must be registered by **2026-12-10** (consultation closed 2026-06-05) ([OAIC](https://www.oaic.gov.au/engage-with-us/consultations/draft-childrens-online-privacy-code-consultation-for-industry,-civil-society,-academia), S).

### 6.2 New Zealand — Unsolicited Electronic Messages Act 2007

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| Consent: express, inferred (from conduct or a business relationship) or deemed (conspicuous publication) (ss.4, 9). Purely factual or transactional messages are not CEMs (s.6). | M, X | MUST | runtime | [UEMA 2007](https://www.legislation.govt.nz/act/public/2007/0007/latest/whole.html) (K) |
| Accurate sender identification and contact details (s.10) | M, X | MUST | lint | UEMA s.10 (K) |
| Functional unsubscribe, clear and conspicuous, **free**. Consent is deemed withdrawn **5 working days** after use (s.9(2), s.11). DIA treats a facility that stops working **within 30 days** of the message as a breach. | M, X | MUST | lint + config + runtime | UEMA (K); [DIA](https://www.dia.govt.nz/Information-about-unsubscribing) (P) |
| No address-harvesting software (s.12) | M | MUST (process) | process | UEMA (K) |

Penalties: court-ordered pecuniary penalties of up to NZ$200,000 for an individual or NZ$500,000 for an organisation, plus infringement notices (K).

---

## 7. Asia

### 7.1 Singapore — Spam Control Act 2007 (SCA) and the PDPA

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| SCA Part III and the Second Schedule apply to **unsolicited** commercial electronic messages **sent in bulk** (> 100 in 24 h, > 1,000 in 30 days, or > 1m in a year) with a Singapore link | M | — (the safe default never sends unsolicited mail) | — | [SCA](https://sso.agc.gov.sg/Act/SCA2007) (K) |
| An unsolicited CEM must have an **unsubscribe facility** (email, URL, phone or postal) with a clear statement **in English** (and in any other language used), valid **≥ 30 days** after sending. Stop within **10 business days** of a request (s.3(3)). | M | MUST (`sg` profile, if ever unsolicited) | lint + config | SCA (K); [IMDA](https://imda.gov.sg/infocomm-regulation-and-guides/unsolicited-communications/best-practices-for-organisations) (S) |
| **`<ADV>` label** with a space before the subject (or first in the body), and no misleading header or subject | M (unsolicited only) | MUST if unsolicited, else not required | lint: subject prefix | SCA Second Schedule (K) |
| No dictionary attacks or address harvesting (applies to all) | M | MUST | process | SCA (K) |
| **PDPA:** consent and purpose limitation for marketing use of personal data, and withdrawal of consent must be honoured. The **Do Not Call** provisions cover **Singapore phone numbers** (voice, SMS, WhatsApp), **not email**. | M | MUST | runtime | [PDPC DNC guidelines](https://pdpc.gov.sg/Guidelines-and-Consultation/2020/02/Advisory-Guidelines-on-the-Do-Not-Call-Provisions) (S) |

Penalties: SCA civil action with statutory damages of up to S$25 per message (S$1m aggregate unless actual loss is higher). PDPA fines of up to 10% of Singapore turnover (above S$10m) or S$1m (K).

### 7.2 Japan — Act on Regulation of Transmission of Specified Electronic Mail (特定電子メール法) and the Act on Specified Commercial Transactions (特定商取引法)

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| **Opt-in** for advertising email (including email sent from abroad to Japan, and SMS). **Exceptions:** an existing business relationship (取引関係); an address given in writing (e.g. a business card); an address published by a business without a "no ads" note; and, for people who gave their address, **consent-confirmation emails** and **transaction-notice emails with incidental advertising**. (Mail-order ads under 特商法 need a request or consent even in these cases.) | M | MUST | runtime | [MIC pamphlet](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/pdf/m_mail_pamphlet.pdf) (P); [Act No. 26 of 2002](https://laws.e-gov.go.jp/law/414AC0000000026) (K) |
| **Record of consent** (time and method per address, or the standard consent text and when it was shown). Keep until **1 month after the last ad sent** (1 year if under a measures order). For 特商法 mail-order ads, keep **3 years**. | M | MUST | runtime: consent record retention policy ≥ 3 years for JP | MIC (P) |
| **Display duties (表示義務):** sender name; a statement that the recipient can refuse (受信拒否の通知ができる旨) placed immediately before or after the opt-out address or URL; the opt-out email address or URL; the **sender's postal address**; a complaint or contact phone, email or URL. The address and contact may be behind a link if the email shows where. | M | MUST | lint: `senderLegalName`, `postalAddress` (or a link to it), `contact`, opt-out statement copy key | MIC (P) |
| No sending after a refusal. Incidental ads in transaction notices are still allowed. | M | MUST | runtime | MIC (P) |
| No false sender information (address, IP, domain) | All | MUST | lint | MIC (P) |

Penalties: measures orders. Breaching an order can bring up to 1 year's imprisonment (拘禁刑 since the June 2025 Penal Code reform) or ¥1m, and **¥30m for a corporation**. False sender information is punished directly (MIC, P). **Pending:** an **APPI amendment** passed on 2026-07-10 and was promulgated on 2026-07-17 (administrative surcharge; reportedly parental consent under 16). Most of it commences by cabinet order within 2 years (S).

### 7.3 South Korea — Network Act (정보통신망법) Art. 50, and PIPA

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| **Express prior consent** for advertising information sent for profit (Art. 50(1)). Exception: contact details collected directly in a transaction may be used for ads for the **same kinds of goods** within the period set by Presidential Decree (6 months from the transaction, per the Decree: K). | M, X | MUST | runtime | [Network Act (KLRI, Act No. 21066)](https://elaw.klri.re.kr/eng_service/lawViewContent.do?hseq=71563) (P) |
| No sending after refusal or withdrawal (Art. 50(2)) | M | MUST | runtime | KLRI (P) |
| **Night-time 21:00–08:00**: separate express consent (Art. 50(3)), except for media set by Decree. **Email is excluded** per KISA guidance; the rule applies to SMS and push. Judged by the time of receipt. | M | MAY for email (SHOULD for SMS/push) | runtime: `kr` quiet-hours guard | KLRI (P); [thecheck.co.kr citing KISA](https://thecheck.co.kr/promotional-email-label-unsubscribe/) (S) |
| Must state the **sender's name and contact details**, and how to refuse or withdraw easily (Art. 50(4)). By Decree, email ads begin the **subject with "(광고)"**, and the body carries sender name, email, phone and address and the opt-out instructions. | M | MUST (`kr` profile) | lint: subject starts with `(광고)`; contact and address slots; localized opt-out copy | KLRI (P); Decree Annex 6 (K, verify) |
| No evading or obstructing opt-out, no harvesting or auto-generated addresses, no concealing the sender (Art. 50(5)) | M | MUST | lint | KLRI (P) |
| Opt-out is **free** (Art. 50(6)) | M | MUST | lint | KLRI (P) |
| **Notify the result** of consent, refusal or withdrawal (Art. 50(7)), within **14 days** per the Decree | M, C | MUST (`kr`) | runtime: send a confirmation email (with no ads) | KLRI (P); Decree Art. 62-2 (S) |
| **Re-confirm consent periodically** (Art. 50(8)), **every 2 years** per the Decree, stating the sender, the date consent was given, and how to keep or withdraw it | M | MUST (`kr`) | runtime: consent age ≥ 24 months means re-permission, then stop | KLRI (P); Decree Art. 62-3 (S) |
| KISA guide (7th edition, Mar 2026, reported): consent wording must say "광고성 정보 수신동의". "Benefit alerts" or pre-ticked boxes are invalid, and **coupon or point expiry notices are advertising**. | M, X | SHOULD | process | [Boannews](https://m.boannews.com/html/detail.html?idx=142460) (S) |
| PIPA: marketing use of personal data needs separate consent. Under 14 needs the legal representative's consent. | M | MUST | runtime | PIPA Art. 22, 22-2 (K) |

Penalties: administrative fines of up to KRW 30m per violation (7.5m / 15m / 30m tiers). **From 2026-10-01**, revenue-based surcharges apply for unlawful advertising transmission (1–4%, or 3–6% for Art. 50(5) or 50-8 violations) ([BKL](https://www.bkl.co.kr/en/law/insight/newsletter/6794), S).

### 7.4 India — Digital Personal Data Protection Act 2023 and the DPDP Rules 2025

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| **Commencement:** Rules notified **2025-11-13** (gazetted 11-14). Board provisions apply immediately. **Consent managers from 2026-11-13. Notice, consent, children, security, breach, rights and retention from 2027-05-13.** | — | — | — | [PIB backgrounder](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf); [Hogan Lovells](https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-) (S) |
| Marketing needs **consent** (the s.7 legitimate uses do not cover marketing). Consent must be free, specific, informed, unconditional and unambiguous, by clear affirmative action (s.6). | M | MUST (from 2027-05-13; SHOULD now) | runtime | [DPDP Act](https://www.meity.gov.in/data-protection-framework) (K) |
| An itemised **notice** (purpose, how to withdraw, how to complain), available in English or any Eighth-Schedule language (s.5; Rule 3) | M, C | MUST | process; lint: privacy link | DPDP Act s.5 (K) |
| **Withdrawal as easy as giving**, then stop within a reasonable time (s.6(4)–(6)) | M | MUST | runtime | DPDP Act (K) |
| **Onus on the fiduciary to prove notice and consent** (s.6(10)) | M | MUST | runtime: consent record | DPDP Act (K) |
| **Child = under 18.** Verifiable parental consent (Rule 10). **No tracking, behavioural monitoring or targeted advertising directed at children** (s.9(3)). | All | MUST | runtime: age guard; tracking off | DPDP Act s.2(f), s.9 (K); Hogan Lovells (S) |
| Large e-commerce, social and gaming fiduciaries: erase personal data **3 years after the last interaction**, with prior notice to the user (Third Schedule) | All | SHOULD | process | Hogan Lovells (S) |

Penalties: up to ₹250 crore (security), ₹200 crore (children) and ₹50 crore (other) (Schedule, K). India has no email-specific anti-spam law; TRAI's TCCCPR covers SMS and voice only.

### 7.5 China (brief)

| Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|
| No commercial-ad email without the recipient's **explicit consent**. Subject must begin with **"广告" or "AD"**. Stop on refusal. (Internet Email Service Measures 2006, Arts. 13–14) | M | MUST (`cn`) | lint: subject prefix | [Measures (mirror)](https://ocac.pku.edu.cn/gzzd/gjzcfg/121574.htm) (S) |
| Advertising Law Art. 43: no electronic ads without consent or request. Show the **sender's true identity and contact details**, and give a way to **refuse further messages**. | M | MUST | lint | [Advertising Law (NPC database)](https://flk.npc.gov.cn/) (K) |
| PIPL: consent or another basis. Automated push or marketing must offer a non-personalised option or an easy refusal (Art. 24). **Under 14 = sensitive data** needing guardian consent (Art. 28, 31). Fines up to RMB 50m or 5% of turnover. | All | MUST | runtime | [PIPL](http://www.npc.gov.cn/npc/c30834/202108/a8c4e3672c74491a80b53a172bb753fe.shtml) (K) |

### 7.6 Sri Lanka — Personal Data Protection Act No. 9 of 2022 (PDPA)

This is the home jurisdiction (`en-LK`). The PDPA applies to processing **by a controller domiciled, resident or established in Sri Lanka wherever the data subjects are** (s.2), as well as to processing in Sri Lanka and to offering goods or services to, or monitoring, people in Sri Lanka. **The Sri Lankan teams' email will be subject to the PDPA in addition to each recipient's local law.**

**Commencement (all P: Gazettes on dpa.gov.lk, Acts on parliament.lk)**

| Instrument | Date | Effect |
|---|---|---|
| PDPA No. 9 of 2022 | Certified 2022-03-19 | Enacted. Original s.1(3)–(5) set an 18–36 month window (48 for Part IV). |
| Gazette 2341/59 | 2023-07-21 | **Part V** (Data Protection Authority, DPA) in operation from **2023-07-17** |
| Gazette 2366/08 | 2024-01-08 | Parts VI, VIII, IX, X from **2023-12-01**. Parts I, II, III, VII from 2025-03-18 (later repealed). |
| Gazette 2427/34 | 2025-03-14 | **Repealed** the 2025-03-18 date |
| **Amendment Act No. 22 of 2025** | Certified **2025-10-30** | New s.1(3): all remaining provisions commence on date(s) the Minister appoints by Gazette. Statutory deadlines removed. Rights requests answered **within one month** (+2 months with notice) and **free** (fees only under DPA rules). Appeals to the DPA. **s.26 cross-border flows replaced.** DPO definition widened. |
| **Gazette 2498/16** | 2026-07-22 (order dated 2026-07-13) | **ss.2–3, Part I (processing) and Part III (controllers and processors, incl. s.26) commence 2027-01-01** |
| Not yet commenced | — | **Part II (data subject rights), Part IV (s.27 solicited messages), Part VII (penalties)**. No order found as of 2026-10-27. |

**Requirements relevant to email**

| Rule | Applies to | In force? | Level (`lk` profile) | Checkable? | Source |
|---|---|---|---|---|---|
| **s.27(1):** a controller may use postal, telecommunication, **electronic** or similar means to disseminate messages that promote goods or services (or a person or entity) **only if the data subject has consented** ("solicited messages"). There is **no soft opt-in** in the text. | M, X | Not yet (Part IV) | MUST (forward-compatible) | runtime: consent record | [PDPA 2022](https://www.parliament.lk/uploads/acts/gbills/english/6242.pdf) (P) |
| **s.27(2):** consent per **Schedule III**: the controller can **demonstrate** it; the request is distinguishable from other matters; not conditional on a contract; the person is told it can be withdrawn at any time | M, C | Not yet (s.27); Schedule III via s.5 from 2027-01-01 | MUST | runtime: consent proof | PDPA Sch. III (P) |
| **s.27(3):** at collection **and in every message**, tell the person how to **opt out free of charge** | M | Not yet | MUST | lint: unsubscribe link + opt-out statement | PDPA (P) |
| **s.27(4):** tell recipients the **nature of the message** and the **identity of the controller or third party on whose behalf** it is sent | M | Not yet | MUST | lint: `reason` + `senderLegalName` + `sentOnBehalfOf` | PDPA (P) |
| **s.27(5):** the DPA may prescribe a **code or prefix** for categories of solicited messages. **None prescribed yet.** | M | Not yet | SHOULD (support a configurable subject prefix) | config | PDPA (P) |
| **Part I** lawful processing (Schedule I: consent, contract, legal obligation, vital, public task, legitimate interests "in particular where the data subject is a child") and the transparency, purpose and minimisation duties (s.5 ff.) | All | **From 2027-01-01** | MUST | process; lint: privacy link | PDPA (P); Gazette 2498/16 (P) |
| **Child = under 16. "Personal data relating to a child" is a *special category*** (s.56). Schedule II: consent means **the parent's or legal guardian's** consent. | All | From 2027-01-01 (via Part I) | MUST | runtime: child guard (package-2's no-child rule satisfies this) | PDPA s.56, Sch. II (P) |
| **Notice at collection** (Schedule V): controller identity and contact, DPO contact, purposes and legal basis, right to withdraw consent and how, recipients, and more | All | From 2027-01-01 | MUST (signup flows) | process | PDPA Sch. V (P) |
| **s.26 cross-border flows (as amended):** allowed only if the controller or processor ensures compliance with Parts I and II and ss.20–25, using instruments the DPA specifies by directive. Alternatively explicit informed consent, contract necessity, and other listed grounds. **Using a foreign ESP (SES, Resend) is a cross-border flow.** | All | **From 2027-01-01** (Part III) | MUST (organisation) | process: ESP data-processing agreement + DPA-specified instrument | Amendment Act No. 22 of 2025 s.10 (P) |
| Part II rights: access, **withdraw consent / object** (s.14), rectify, erase. Respond within one month, free (as amended). | M | Not yet | SHOULD now, MUST on commencement | runtime: suppression honours withdrawal | PDPA s.14; Amendment s.4 (P) |
| **Penalties:** up to **LKR 10 million per non-compliance** with a DPA directive, and twice the previous penalty for each repeat (s.38) | — | Not yet (Part VII) | — | — | PDPA s.38 (P) |

**Other Sri Lankan law.** No email-specific anti-spam statute was found. DPA rule-making to date (public-consultation drafts) covers the DPO, impact assessments, breach notification, fees, appeals, inquiry procedure and data categories and hosting. **There is no draft rule on direct marketing yet** ([DPA downloads](https://www.dpa.gov.lk/guidelines.php), P).

---

## 8. Latin America

| Jurisdiction | Rule | Applies to | Level | Checkable? | Source |
|---|---|---|---|---|---|
| **Brazil — LGPD** (Lei 13.709/2018) | A legal basis (consent, or legitimate interest with a balancing test) for marketing. Right to oppose and revoke consent (Art. 18). **Children under 12: specific parental consent** (Art. 14). Fines up to 2% of Brazilian revenue, capped at R$50m per infraction. | M, All | MUST | runtime | [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) (K) |
| Brazil — **ECA Digital** (Lei 15.211/2025) | Digital child and adolescent protection (under 18), in force **2026-03-17**. The ANPD is the supervisory authority. ANPD converted into a regulatory agency (reported as Lei 15.352/2026). | All | SHOULD (minors) | runtime: age guard | [Mayer Brown](https://www.mayerbrown.com/pt/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies) (S) |
| Brazil — **CAPEM** (self-regulation, CGI.br 2009) | Voluntary code: soft opt-in for prior relationships; an opt-out link in every message (reported: removal within **2 days** via the link, 5 business days by other means); sender identified by its own domain. No legal force. | M | MAY | — | [CGI.br Res. 2009/001](https://www.cg.org.br/resolucoes/documento/2009/CGI.br_Resolucao_2009_001.pdf) (S) |
| **Mexico — new LFPDPPP** (DOF 2025-03-20, in force 2025-03-21) | Privacy notice (aviso de privacidad). Consent may be express or tacit for ordinary data. ARCO rights, including **opposition** to marketing. Enforced by the **Secretaría Anticorrupción y Buen Gobierno** (INAI abolished). Fines in UMA multiples. | M, All | MUST | runtime | [LFPDPPP](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf) (S) |
| Mexico — **LFPC Art. 17** (consumer law) | Advertising sent to consumers must show the supplier's **name, domicile, phone (or email)**. Consumers may demand not to be contacted for marketing. REPEP is phone-centric. | M | MUST (`mx`) | lint: `postalAddress` + `contact` | [LFPC](https://www.diputados.gob.mx/LeyesBiblio/ref/lfpc.htm) (S) |

---

## 9. Children (cross-cutting)

Package-2 forbids email to children (NOT-005). The law supports that and goes further in places.

| Regime | "Child" | Rule relevant to email | Source |
|---|---|---|---|
| COPPA (US) | < 13 | VPC to collect or use online contact information (exceptions in §312.5(c)). 2025 rule: separate consent for third-party disclosure, retention policy. | §2.4 |
| CCPA (US-CA) | < 16 | Opt-in to sell or share | §2.3 |
| GDPR Art. 8 (EU) | < 16 (13–16 by member state) | Parental authorisation for consent-based information society services | §4.2 |
| UK GDPR + AADC | < 13 (Art. 8); AADC < 18 | AADC defaults: profiling off, no nudges | §5 |
| Australia | Draft COPC (consent from a parent under 15) | Code due 2026-12-10 | §6.1 |
| Korea PIPA | < 14 | Legal representative's consent | §7.3 |
| India DPDP | **< 18** | Verifiable parental consent. **No tracking or targeted ads** to children. | §7.4 |
| China PIPL | < 14 | Sensitive data, guardian consent | §7.5 |
| **Sri Lanka PDPA** | **< 16** | Child data is a **special category**. Parent or guardian consent. From 2027-01-01. | §7.6 |
| Brazil | < 12 (LGPD Art. 14); ECA Digital < 18 | Specific parental consent; heightened duties | §8 |
| Japan APPI (amended 2026, pending) | < 16 (reported) | Legal representative's consent | §7.2 |

**Framework consequence:** age gating needs a per-jurisdiction threshold table. The strictest common rule is **no marketing to anyone known or likely to be under 18**, and **no tracking in any email to a minor**. Transactional email to a minor is allowed only where the profile permits it, the age is at or above the local child threshold or parental consent exists, and the data is minimised (package-2's `child-activity` rule: display name only).

---

## 10. Industry rules that act like regulation (reference only; see the deliverability research)

| Provider | Rule | Source |
|---|---|---|
| Gmail (bulk = about 5,000+ a day to personal Gmail; once bulk, always bulk) | Marketing must carry `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058). Honour within **48 hours**. Stepped-up enforcement, including rejections, **from Nov 2025**. | [Gmail sender FAQ](https://support.google.com/mail/answer/14229414) (S) |
| Yahoo | Same one-click requirement and 2-day honouring (2024) | [Yahoo sender best practices](https://senders.yahooinc.com/best-practices/) (K) |
| Microsoft Outlook.com (> 5,000 a day) | SPF, DKIM and DMARC plus a functional unsubscribe. Enforcement from **2025-05-05**. | [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730) (S) |
| IETF | [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058) one-click (POST, no cookies, no redirect to a confirmation); [RFC 2369](https://www.rfc-editor.org/rfc/rfc2369) `List-Unsubscribe` | (K) |

---

## 11. Synthesis A — requirement matrix

### 11.1 Marketing messages

Abbreviations: `bd` = business days, `wd` = working days, `+` = required, `—` = not legally required, `(link)` = may be behind a link the email shows.

| Jurisdiction | Consent model | Sender ID | Postal address | Unsub. link | Opt-out deadline | Mechanism lifetime | Subject label | Consent record | Privacy link | Tracking consent |
|---|---|---|---|---|---|---|---|---|---|---|
| US (CAN-SPAM) | Opt-out | + (accurate headers) | **+** (street, PO box or CMRA) | + | 10 bd | ≥ 30 days | Ad identification unless affirmative consent | — | — (CCPA notice at collection) | — (CCPA "share" opt-out) |
| Canada (CASL) | Opt-in (express or implied 2 y / 6 m) | + (+ on whose behalf) | **+** mailing address | + ("all" option) | 10 bd | **≥ 60 days** | — | **+ (onus s.13)** | — | Quebec: profiling off by default |
| EU (ePrivacy + GDPR) | Opt-in; soft opt-in | + | — (DE imprint customary) | + / valid address | Without undue delay | Valid address | — | **+ (Art. 7(1))** | + (Art. 13) | **+ (Art. 5(3))** |
| Germany | Express opt-in (DOI); §7(3) soft opt-in | + | — (imprint MAY) | + | Immediately | Valid address | — | + (DOI log) | + | + (TDDDG §25) |
| France | Opt-in; existing-customer exception | + | — | + | Without undue delay | Withdrawal link works on sent mail | — | + | + | **+ (CNIL 2026-042)** |
| UK (PECR) | Opt-in; soft opt-in; charity soft opt-in (2026) | + | — | + / valid address | "Promptly" | Valid address | — | + | + | **+ (reg. 6, incl. B2B)** |
| Australia | Express or inferred | + (30 days accurate) | — | + functional | **5 wd** | ≥ 30 days | — | + (prove consent) | — | — |
| New Zealand | Express, inferred, deemed | + | — | + functional | **5 wd** | 30 days (DIA) | — | + | — | — |
| Singapore | PDPA consent (SCA covers unsolicited) | + | — | + (if unsolicited) | 10 bd | ≥ 30 days | `<ADV>` if unsolicited | + (PDPA) | — | — |
| Japan | Opt-in (exceptions) | + | **+ (link)** | + plus refusal statement | Immediately | — | — | **+ (1 month / 3 y)** | — | — |
| South Korea | Express opt-in (6-month same-goods exception) | + name + contact | **+** (Decree) | + free | Immediately; notify within 14 days | — | **`(광고)` prefix** | + (re-confirm every 2 y) | — | — |
| India (from 2027-05-13) | Consent | + | — | + (easy withdrawal) | Reasonable time | — | — | **+ (onus s.6(10))** | + notice | Children: none allowed |
| China | Explicit consent | + true identity + contact | — | + refusal method | On refusal | — | **"广告"/"AD"** | + | + | PIPL basis |
| **Sri Lanka** (s.27 pending) | **Consent** (no soft opt-in) | + (+ on whose behalf) | — | + free (collection + each message) | Not set | — | Prefix may be prescribed | **+ (Sch. III)** | + (Sch. V, 2027) | Part I basis |
| Brazil | Consent or legitimate interest | + | — | + (CAPEM) | CAPEM 2 days (voluntary) | — | — | + | + | LGPD basis |
| Mexico | Express or tacit + notice | + | **+ domicile** (LFPC) | + (opposition) | — | — | — | + | + aviso | LFPDPPP basis |

### 11.2 Transactional messages

| Jurisdiction | In scope of the anti-spam law? | Still required |
|---|---|---|
| US | Mostly exempt | Accurate header and routing information. No deception. |
| Canada | Not a CEM if purely informational. **If it is a s.6(6) CEM, it is exempt from consent only.** | s.6(6) CEMs: **sender ID + unsubscribe mechanism** |
| EU / UK / DE / FR | Not direct marketing if purely service | GDPR transparency (privacy link). **Pixels and tracked links need consent** unless strictly necessary (CNIL exempts authentication security and deliverability last-open-day on requested mail). |
| Australia | Not a CEM if factual with no commercial content | Identification is good practice |
| New Zealand | Excluded (s.6) | — |
| Singapore | Not a CEM | PDPA |
| Japan | Not advertising mail | — |
| Korea | Not advertising information. **Coupon and point expiry notices count as advertising.** | PIPA |
| India | Processing under the contract or legitimate uses (s.7) | Notice and security (from 2027) |
| China | Not commercial ads | PIPL |
| Sri Lanka | Not a "solicited message" unless it promotes | Part I lawful basis (contract), minimisation, cross-border (2027) |
| Brazil / Mexico | Contract basis | Privacy notice |

### 11.3 Mixed messages (transactional + promotional)

| Jurisdiction | Test | A receipt with a promo block is... |
|---|---|---|
| US | **Primary purpose** (16 CFR 316.3) | **Transactional** if the subject is not promotional and the transactional content comes first, otherwise **commercial** |
| Canada | CEM if *one of its purposes* is commercial. The s.6(6) exemption is for messages that *solely* do the listed thing. | **CEM needing consent**, plus ID and unsubscribe |
| EU / UK | Any marketing element makes it direct marketing (ICO) | **Marketing**: consent or soft opt-in, plus unsubscribe |
| Australia / NZ | A commercial purpose among others (ACMA Lululemon 2026) | **Commercial**: consent plus unsubscribe |
| Japan | Incidental ads in transaction notices are allowed without consent and **even after opt-out** | **Allowed** (display duties still apply to ads) |
| Korea | Advertising information for profit, including points or coupon notices | **Advertising**: consent, `(광고)`, opt-out |
| Sri Lanka | s.27(6): any message "intended to promote" | **Solicited message**: consent needed (once Part IV commences) |
| China / India / Brazil / Mexico | Advertising or marketing purpose | **Marketing**: consent or lawful basis plus refusal method |

---

## 12. Synthesis B — "global-strict" safe default profile

The strictest common denominator a global framework can ship as the default when the recipient's jurisdiction is unknown:

| Element | Safe default | Driven by |
|---|---|---|
| Purpose classification | Every template declares `transactional`, `marketing` or `consent-request`. **Any promotional content makes it `marketing`.** | CASL, ICO, ACMA, KR, LK |
| Consent for marketing | **Express opt-in**, unticked, unbundled, per purpose, with **double opt-in** confirmation | DE, GDPR, LK s.27, KR, JP |
| Implied or soft opt-in | Off by default. Per-profile opt-in with expiry (CASL 2 y / 6 m, KR 6 months, UK charity cut-off 2026-02-05). | CASL, PECR, UWG, KR |
| Sender identity | Legal entity name + brand in From and footer. "On behalf of" when it applies. Accurate headers. | All |
| Postal address | **In every marketing and consent-request email**, recommended in all | US, CA, JP, KR, MX |
| Contact channel | Email or web contact (plus phone where available) valid ≥ 60 days | CASL, JP, KR |
| Unsubscribe | Visible link in HTML **and** text, explicit wording plus a refusal statement, **RFC 8058 one-click headers**, no login, no fee, no more than one page, an "unsubscribe from all marketing" option | All + Gmail/Yahoo |
| Opt-out processing | Suppress **synchronously** on click or POST. Guarantee ≤ **48 h** (strictest legal: AU/NZ 5 wd; JP/KR/DE immediately). | Gmail, AU, NZ, JP, KR |
| Mechanism lifetime | Unsubscribe tokens **never expire** (legal floor: **60 days**, CASL) | CASL |
| Subject label | Auto-prefix **`(광고)`** for KR and **"广告"/"AD"** for CN recipients on marketing. `<ADV>` only if a profile ever allows unsolicited SG bulk mail (default: never). No deceptive subjects. | KR, CN, SG, US |
| Reason line | "Why you got this", naming the subscription or relationship | LK s.27(4), US ad identification, package-2 |
| Privacy link | In every email | GDPR, DPDP, LK Sch. V |
| Tracking | **Off.** No open pixels, no click rewriting. If enabled: per-recipient consent; exemptions only for authentication security and last-open-day deliverability on requested mail. Honour withdrawal by ignoring old pixels. | EDPB, CNIL, ICO, TDDDG, Quebec |
| Consent record | Who, what (purpose, wording version), when, how (source, DOI timestamp), jurisdiction, basis, expiry, withdrawal. Linked from every marketing send. | CASL s.13, GDPR 7(1), JP, LK Sch. III, DPDP 6(10) |
| Re-permission | Re-confirm marketing consent after 24 months (MUST for KR, SHOULD elsewhere) | KR Art. 50(8) |
| Quiet hours | No marketing email 21:00–08:00 recipient-local for KR (MAY; legally SMS and push only) | KR |
| Minors | No marketing under 18. No tracking to minors. Transactional to minors only above the local child age or with parental consent. | DPDP, ECA Digital, LK, COPPA, AADC |
| Retention | Suppression kept indefinitely (minimal, hashed). Consent proof kept while relied on + ≥ 3 years. Send metadata minimal. | GDPR 21(3), JP 特商法, CASL |

---

## 13. Synthesis C — mixed-purpose email and when transactional becomes commercial

1. **Keep transactional templates pure.** A receipt, code or security notice contains only what the recipient needs. Most regimes (CA, EU, UK, AU, NZ, KR, LK, CN) reclassify a message as marketing if **one** of its purposes is promotional. Only the US (primary purpose) and Japan (incidental ads) tolerate promotional additions.
2. **Triggers that turn a transactional message commercial:** an upsell, cross-sell or "you may also like" block; a coupon or discount; a promotional subject or preheader; a welcome email with offers; review requests with incentives; win-back or "we miss you"; **cart abandonment** (CNIL FAQ Q16); **points or coupon expiry** (KISA); newsletters dressed as account updates; "service updates" that push products (ICO v Allay Claims, 2026). This includes **ads inserted between messages** (CNIL v Google, 2025).
3. **If the business insists on promotional content in a transactional email:**
   - US: put the transactional content first, keep the subject non-promotional, and keep the promotional part secondary in placement and space. It then stays transactional.
   - Japan: incidental ads are allowed, but ads still need the display items.
   - **Everywhere else:** treat it as `marketing`. Send it only to recipients with marketing consent (or soft opt-in), add an unsubscribe link and headers and a postal address, and suppress it for unsubscribed recipients. **The underlying transactional message must still reach unsubscribed recipients**, so the framework must be able to render the *same* template **without** the promo slot.
4. **A marketing unsubscribe never blocks transactional email.** Hard bounces and complaints do (package-2 already lets `requestedByRecipient` security mail through).
5. **Consent-request emails**: no promotional content, no tracking, sender ID, postal address and a "not you? ignore / remove" link (CASL s.1(3)). Send once, with no reminder series without consent (practice in DE and FR).

---

## 14. Synthesis D — suppression, consent proof, minimisation and retention

| Topic | Guidance | Basis |
|---|---|---|
| **Suppression, not deletion** | Deleting an unsubscribed address lets it re-enter through a re-import. Keep a **suppression record** instead: an HMAC-SHA-256 of the normalised address (keyed with a secret, not a bare hash), scope (all marketing, a list, or a channel), timestamp, source (link, one-click, reply, complaint, bounce) and jurisdiction. Keeping it is necessary to honour the objection. | GDPR Art. 21(3) and 17(3)(b)/(e) reasoning; ICO "do not contact" lists; CAN-SPAM (no transfer of opted-out addresses) |
| Erasure versus suppression | On an erasure request, delete the profile and keep only the minimal suppression key, and tell the person why. | GDPR Art. 17; LK s.16 (pending) |
| **Consent proof** | Store per recipient: subject id, channel, purpose(s), basis, **exact wording version**, form or source, timestamp, DOI confirmation timestamp, jurisdiction, actor (self or parent), and withdrawal timestamp. Avoid storing the IP unless needed (minimisation), or store it truncated. | CASL s.13; GDPR 7(1); JP Art. 3 records; LK Sch. III(a); DPDP s.6(10); CNIL §6 |
| Send ledger | For every marketing send: template id and version, purpose, consent-record id, suppression check result, message id and time. No body, no address in logs (package-1 FR-92, package-2 privacy rule). | Proof; minimisation |
| **Minimisation in templates** | Include only what the purpose needs. **Never** include passwords, full card or bank numbers, government IDs, health data or full dates of birth. Show masked identifiers (`•••• 4821`). Keep codes out of the preheader (package-1 rule) and amounts out of subjects. Use first name or display name only for children (package-2). Put tokens in URL **fragments** (package-2) so they don't reach server logs, ESP click-trackers or referrers. Never put email addresses in query strings. | GDPR 5(1)(c); LK Part I; DPDP; COPPA |
| Third parties in links | Avoid third-party remote resources (fonts, images) that act as trackers (package-1 already bans web fonts). Self-host images on the sender domain. | EDPB 2/2023 |
| Tracking data (if consented) | Keep raw open and click events briefly. For exempt deliverability, keep **only the last-open date (day)**. | CNIL §3.2 |
| **Retention** | Suppression: indefinitely (minimal). Consent proof: while relied on + ≥ 3 years (JP 特商法 3 y; CASL onus). Send ledger: 1–3 years. Sealed address and data cleared once the send is final (package-2). Large Indian platforms: erase 3 years after the last interaction. | As cited |
| Children | Never store a child's email for marketing. Parent-directed `child-activity` mail carries only the display name. | COPPA; LK; DPDP |

---

## 15. Implications for the framework

### 15.1 Category model

Use two orthogonal axes. Add jurisdiction as a third input at send time.

| Axis | Values | Notes |
|---|---|---|
| **`purpose`** (legal) | `transactional` · `marketing` · `consent-request` | Replaces package-1 `transactional`/`lifecycle` (lifecycle maps to `marketing` unless purely factual). No `mixed`: a promo slot forces `marketing` except in profiles that allow incidental content (US, JP), where it must be declared explicitly. |
| **`category`** (domain, package-2) | `account-security`, `own-purchases`, `consent`, `billing-for-others`, `child-activity`, `general` → `transactional`. `mailing-list` → **split** into `list-confirm` (`consent-request`) and `list-message` (`marketing`). | `waitlist-invitation` (a launch invitation) is **marketing**. `newsletter-confirm` and `waitlist-confirm` are **consent-request**. |
| `requestedByRecipient` | boolean (package-2) | Lets security mail past complaint suppression. Also marks mail as "requested" for the CNIL deliverability exemption. |

### 15.2 Required template slots and footer fields

| Slot | `transactional` | `marketing` | `consent-request` | Notes |
|---|---|---|---|---|
| `sender.legalName` + brand | MUST | MUST | MUST | Platform var; a call site cannot override it (package-1 FR-22) |
| `sender.postalAddress` | SHOULD | **MUST** | **MUST** | Fixes R1. The build fails if it is empty for M or C. |
| `sender.contact` (email, web, phone) | SHOULD | MUST | MUST | CASL, JP, KR |
| `sentOnBehalfOf` | if any | MUST if any | MUST if any | CASL, LK s.27(4), CAN-SPAM |
| `reason` ("why you got this") | MUST | MUST | MUST | Package-2 rule. Also LK s.27(4). |
| `unsubscribe` link + statement | MAY (`ca` profile: preferences link) | **MUST** | MUST ("remove me / not you?") | Explicit wording (R7) |
| `List-Unsubscribe` + `-Post` headers | — | MUST | SHOULD | RFC 8058 |
| `preferences` link | MAY | SHOULD | — | Must include "all marketing" |
| `privacyNotice` link | MUST | MUST | MUST | |
| `trackingNotice` / withdraw link | if tracking | if tracking | — (no tracking allowed) | CNIL |
| `legalImprint` | MAY | SHOULD in `de` | SHOULD in `de` | DDG §5 |
| `subjectPrefix` | — | auto per profile (`(광고)`, `广告/AD`, `lk` configurable) | — | |
| `helpUrl` | SHOULD | SHOULD | SHOULD | Package-2 |

### 15.3 Per-jurisdiction compliance profiles

Ship profiles as data: `global-strict` (default), `us`, `ca` (+ `ca-qc`), `eu`, `de`, `fr`, `uk`, `au`, `nz`, `sg`, `jp`, `kr`, `in`, `cn`, `lk`, `br`, `mx`. Each declares:
`consentModel`, `softOptIn` (with expiry rules), `optOutDeadline`, `mechanismMinLifetimeDays`, `requiresPostalAddress`, `subjectPrefix`, `quietHours`, `reconfirmAfterMonths`, `childAge`, `trackingRequiresConsent`, `trackingExemptions`, `mixedContentRule` (`primary-purpose` | `incidental-ok` | `any-promo-is-marketing`), `effectiveFrom` (e.g. `lk` Part I 2027-01-01; `in` 2027-05-13) and `sources`. A send applies the **union** of the recipient's profiles and the sender's home profile (`lk` for these teams). Unknown jurisdiction means `global-strict`. Version profiles with a `verifiedOn` date and make the CLI warn when a profile is older than 12 months.

### 15.4 Consent and tracking metadata (runtime model)

`ConsentRecord { id, subjectRef, channel: "email", purposes[], basis: express|implied-purchase|implied-inquiry|soft-opt-in|charity-soft-opt-in|deemed, wordingVersion, source, collectedAt, doiConfirmedAt?, jurisdiction, actor: self|parent, expiresAt?, reconfirmDueAt?, withdrawnAt?, tracking: { opens: bool, clicks: bool, consentedAt?, withdrawnAt? } }`
`Suppression { key: HMAC(addr), scope: all-marketing|list:<id>|channel, reason: unsubscribe|one-click|complaint|bounce|erasure, at, jurisdiction }`

### 15.5 Checks (`email-kit check`)

| Check id | Fails when | Level |
|---|---|---|
| `legal.purpose-declared` | A template has no `purpose` | MUST |
| `legal.marketing-unsubscribe` | A `marketing` render lacks an unsubscribe link in HTML or text, or the RFC 8058 headers | MUST |
| `legal.marketing-postal-address` | A `marketing` or `consent-request` render lacks a non-empty postal address (or a profile-allowed link to it) | MUST |
| `legal.sender-identity` | The legal name, or "on behalf of" when configured, is missing; the From domain is not the configured one | MUST |
| `legal.privacy-link` | No privacy notice link | MUST |
| `legal.reason` | No "why you got this" line | MUST |
| `legal.transactional-no-promo` | A `transactional` template has a promo slot or coupon or discount markers (heuristic plus an allowlist with a reason) | MUST (warn under `us`/`jp` if declared) |
| `legal.consent-request-clean` | A `consent-request` has promo content, tracking, or no remove link | MUST |
| `legal.no-tracking` | 1×1 or hidden images, recipient-specific image URLs, or rewritten links while tracking is disabled, or in `consent-request` or minor-audience templates | MUST |
| `legal.subject-prefix` | A `kr` or `cn` marketing subject lacks its prefix | MUST |
| `legal.subject-honest` | `Re:`/`Fwd:` on a non-reply; a subject in the deny-list patterns | SHOULD |
| `legal.unsubscribe-lifetime` | Unsubscribe token TTL < 60 days | MUST |
| `legal.opt-out-copy` | The localized opt-out statement key is missing (JP, KR, SG, LK) | SHOULD |
| `legal.child-minimisation` | A `child-activity` template references data fields beyond the display name | MUST |
| `legal.no-pii-in-urls` | An email address or token appears in a URL query string | SHOULD |
| `legal.profile-freshness` | A profile's `verifiedOn` is > 12 months old | SHOULD |

### 15.6 Runtime send guards

1. **Resolve jurisdiction(s)** from account data. Fall back to `global-strict`.
2. **Purpose gate:** `marketing` requires a valid `ConsentRecord` (not withdrawn, not expired: CASL implied windows, KR 24-month reconfirm). Otherwise throw `ConsentMissing`.
3. **Suppression gate:** scope-aware. Marketing unsubscribes never block `transactional`. Complaints and bounces block all except `requestedByRecipient` security mail (package-2).
4. **Audience/age gate:** per-profile child age. No `marketing` under 18. Minors only through allowed categories.
5. **Tracking gate:** strip pixels and use plain links unless per-recipient tracking consent exists (or an exemption is declared and allowed by the profile). After withdrawal, ignore old pixel hits.
6. **Header injection:** `List-Unsubscribe` (HTTPS + optional mailto) and `List-Unsubscribe-Post` for `marketing`. Make the endpoint suppress synchronously (≤ 48 h guaranteed).
7. **Subject prefix injection** per profile, plus a **quiet-hours** guard (`kr`, configurable).
8. **Config guard:** refuse `marketing` sends if the postal address, legal name or privacy URL is unset (`MailConfigError`).
9. **Proof:** attach the consent-record id and profile version to the send ledger. Log no addresses or bodies.
10. **ESP settings:** assert that provider-level open and click tracking is disabled unless the tracking gate is in use (SES configuration set, Resend domain settings). For `lk` from 2027-01-01, record the cross-border instrument used with the ESP.

---

## 16. Open uncertainties and pending items

| Item | Status | Action |
|---|---|---|
| Sri Lanka Part II, IV (s.27) and VII commencement | Not commenced. No Gazette found. | Watch dpa.gov.lk. The `lk` profile already enforces s.27 as forward-compatible. |
| Sri Lanka s.27(5) message prefix | Not prescribed | Keep the prefix configurable |
| EU Digital Omnibus (cookie or pixel rules) | Council mandate 2026-10-21. Trilogue pending. | Re-check in Q1 2027 |
| EU Digital Fairness Act | Proposal expected late 2026 | Monitor (cancellation and dark-pattern rules may touch preference centres) |
| Canada Bill C-36 | Tabled 2026-06-15 | Monitor for CASL or consent changes |
| Japan APPI amendment | Promulgated 2026-07-17. Cabinet orders pending. | Monitor the under-16 consent rule |
| Australia Children's Online Privacy Code | Due 2026-12-10 | Monitor |
| Korea Decree details (`(광고)` placement, Korean/English opt-out text, the email night-time exclusion) | Confirmed only through the KISA-derived secondary sources | Have Korean counsel confirm Annex 6 |
| UK DUAA statistical exception for email open pixels | Unclear | Treat as consent-required |
| ePrivacy Regulation OJ withdrawal reference (C/2025/5423) | Secondary confirmation only | Low impact |
| Brazil ANPD agency law number, CAPEM deadlines | Secondary | Low impact |
| Package-2 age rule (adults only vs teens aged 16–17) | Internal inconsistency | Product decision, per jurisdiction |

---

## Sources

All accessed **2026-10-27**. Type: **P** primary (read), **K** primary (linked, not re-read), **S** secondary.

| URL | Title | Type |
|---|---|---|
| https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business | FTC — CAN-SPAM Act: A Compliance Guide for Business | P |
| https://www.law.cornell.edu/uscode/text/15/7704 | 15 USC 7704 | K |
| https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-316 | 16 CFR Part 316 (CAN-SPAM Rule) | K |
| https://public-inspection.federalregister.gov/2026-18853.pdf | FTC notice: civil penalty amounts unchanged for 2026 | S |
| https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=17529.5.&lawCode=BPC | Cal. Bus. & Prof. Code §17529.5 | K |
| https://www.womblebonddickinson.com/us/insights/alerts/arizona-court-appeals-affirms-dismissal-arizona-spy-pixel-class-action | Arizona Court of Appeals affirms dismissal of "spy pixel" class action | S |
| https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5 | California Consumer Privacy Act | K |
| https://cppa.ca.gov/regulations/ccpa_updates.html | CPPA — CCPA updates, risk assessments, ADMT, cybersecurity audits | S |
| https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule | Federal Register — COPPA Rule (2025 amendments) | S |
| https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data | FTC finalizes changes to children's privacy rule | P |
| https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312 | 16 CFR Part 312 (COPPA Rule) | K |
| https://www.law.cornell.edu/cfr/text/16/312.5 | 16 CFR 312.5 Parental consent | S |
| https://laws-lois.justice.gc.ca/eng/acts/E-1.6/FullText.html | Canada's Anti-Spam Legislation (S.C. 2010, c. 23) | P |
| https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/ | Electronic Commerce Protection Regulations (CRTC) | K |
| https://crtc.gc.ca/eng/ce/actions.htm | CRTC enforcement actions | S |
| https://www.dlapiper.com/en/insights/publications/2026/06/canada-tables-bill-c36-the-protecting-privacy-and-consumer-data-act | Canada tables Bill C-36 | S |
| https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1 | Quebec private-sector privacy act (s.8.1) | K |
| https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219 | ePrivacy Directive 2002/58/EC (consolidated) | K |
| https://eur-lex.europa.eu/eli/dir/2000/31/oj | e-Commerce Directive 2000/31/EC | K |
| https://eur-lex.europa.eu/eli/reg/2016/679/oj | GDPR | K |
| https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf | EDPB Guidelines 2/2023 on Technical Scope of Art. 5(3) ePD, v2.0 | P |
| https://www.cnil.fr/sites/default/files/2026-04/recommandation-pixels_de_suivi.pdf | CNIL — Recommandation relative aux pixels de suivi (FR) | K |
| https://www.cnil.fr/sites/default/files/2026-05/recommandation_tracking_pixels_emails.pdf | CNIL — Recommendation on tracking pixels in emails (EN courtesy translation) | P |
| https://www.cnil.fr/fr/faq-recommandation-pixels-courriers-electroniques | CNIL — Questions-réponses, recommandation pixels (2026-07-22) | P |
| https://www.cnil.fr/fr/pixels-de-suivi-dans-les-courriers-electroniques-vous-devez-etre-mieux-informes | CNIL — Pixels de suivi : vous devez être mieux informés | P |
| https://www.seban-associes.avocat.fr/le-pixel-invisible-des-courriels-sort-de-lombre/ | Seban Avocats — deliberation 2026-042 summary | S |
| https://www.cnil.fr/en/cookies-and-advertisements-inserted-between-emails-google-fined-325-million-euros-cnil | CNIL — Google fined €325m | S |
| https://curia.europa.eu/juris/liste.jsf?num=C-654/23 | CJEU C-654/23 Inteligo Media | S |
| https://edri.org/our-work/the-eprivacy-regulation-proposal-has-been-withdrawn-but-the-fight-for-your-privacy-is-far-from-over/ | EDRi — ePrivacy Regulation withdrawn | S |
| https://eur-lex.europa.eu/eli/C/2025/5423/oj | OJ C/2025/5423 — Withdrawal of Commission proposals | S |
| https://research.eutechreg.com/dossiers/gdpr-reform-digital-omnibus/ | EUTechReg — GDPR reform in the Digital Omnibus | S |
| https://www.privacylaws.com/news/eu-proposal-on-digital-fairness-act-expected-by-the-end-of-2026/ | Digital Fairness Act expected end 2026 | S |
| https://www.gesetze-im-internet.de/uwg_2004/__7.html | UWG §7 | P |
| https://www.gesetze-im-internet.de/uwg_2004/__7a.html | UWG §7a | P |
| https://www.gesetze-im-internet.de/ttdsg/__25.html | TDDDG §25 | K |
| https://www.legislation.gov.uk/uksi/2003/2426/contents | Privacy and Electronic Communications Regulations 2003 | K |
| https://www.legislation.gov.uk/ukpga/2025/18/contents | Data (Use and Access) Act 2025 | K |
| https://www.legislation.gov.uk/uksi/2026/82/made | DUAA (Commencement No. 6 and Transitional and Saving Provisions) Regulations 2026 | P |
| https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/ | ICO — Electronic mail marketing | P |
| https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-guidance/identify-direct-marketing/ | ICO — Identify direct marketing | S |
| https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-storage-and-access-technologies/ | ICO — What are storage and access technologies? | S |
| https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/what-else-do-we-need-to-consider/ | ICO — Email marketing: what else do we need to consider? | S |
| https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/01/fines-of-225-000-for-nuisance-marketing-messages/ | ICO — Fines of £225,000 for nuisance marketing messages | S |
| https://www.dma.org.uk/about/articles/ico-finalises-charity-soft-opt-in-guidance | DMA — ICO finalises charity soft opt-in guidance | S |
| https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/ | ICO — Age Appropriate Design Code | K |
| https://www.legislation.gov.au/C2004A01214/latest/text | Spam Act 2003 (Cth) | K |
| https://www.acma.gov.au/avoid-sending-spam | ACMA — Avoid sending spam | S |
| https://www.acma.gov.au/sites/default/files/2024-05/Fact%20sheet%20-%20email%20and%20SMS%20unsubscribe%20rules.pdf | ACMA — Email and SMS unsubscribe rules fact sheet | S |
| https://www.acma.gov.au/articles/2026-03/lululemon-penalised-702k-spam-breaches | ACMA — Lululemon penalised $702K | S |
| https://www.acma.gov.au/articles/2026-04/latitude-finance-pays-396m-more-spam-breaches | ACMA — Latitude Finance pays $3.96m | S |
| https://www.acma.gov.au/articles/2026-07/tab-pays-27m-telemarketing-and-spam-breaches | ACMA — TAB pays $2.7m | S |
| https://www.oaic.gov.au/engage-with-us/consultations/draft-childrens-online-privacy-code-consultation-for-industry,-civil-society,-academia | OAIC — Draft Children's Online Privacy Code consultation | S |
| https://www.legislation.govt.nz/act/public/2007/0007/latest/whole.html | Unsolicited Electronic Messages Act 2007 (NZ) | K |
| https://www.dia.govt.nz/Information-about-unsubscribing | DIA — About unsubscribing | P |
| https://sso.agc.gov.sg/Act/SCA2007 | Spam Control Act 2007 (Singapore) | K |
| https://imda.gov.sg/infocomm-regulation-and-guides/unsolicited-communications/best-practices-for-organisations | IMDA — Unsolicited communications best practices | S |
| https://pdpc.gov.sg/Guidelines-and-Consultation/2020/02/Advisory-Guidelines-on-the-Do-Not-Call-Provisions | PDPC — Advisory Guidelines on the DNC Provisions | S |
| https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/pdf/m_mail_pamphlet.pdf | MIC — 特定電子メール法 pamphlet | P |
| https://laws.e-gov.go.jp/law/414AC0000000026 | 特定電子メールの送信の適正化等に関する法律 (e-Gov) | K |
| https://elaw.klri.re.kr/eng_service/lawViewContent.do?hseq=71563 | Korea — Network Act (KLRI English, Act No. 21066) | P |
| https://www.bkl.co.kr/en/law/insight/newsletter/6794 | BKL — Network Act amendment effective 2026-10-01 | S |
| https://thecheck.co.kr/promotional-email-label-unsubscribe/ | 광고 이메일 표시법 (KISA-based summary) | S |
| https://m.boannews.com/html/detail.html?idx=142460 | Boannews — KISA illegal-spam guide revision | S |
| https://www.meity.gov.in/data-protection-framework | MeitY — Data protection framework (DPDP Act, Rules) | K |
| https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf | PIB — DPDP Rules, 2025 notified | S |
| https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force- | Hogan Lovells — DPDP Act brought into force | S |
| https://ocac.pku.edu.cn/gzzd/gjzcfg/121574.htm | 互联网电子邮件服务管理办法 (mirror) | S |
| https://flk.npc.gov.cn/ | NPC national law database (Advertising Law) | K |
| http://www.npc.gov.cn/npc/c30834/202108/a8c4e3672c74491a80b53a172bb753fe.shtml | Personal Information Protection Law (PRC) | K |
| https://www.parliament.lk/uploads/acts/gbills/english/6242.pdf | Personal Data Protection Act, No. 9 of 2022 | P |
| https://www.parliament.lk/uploads/acts/gbills/english/6384.pdf | Personal Data Protection (Amendment) Act, No. 22 of 2025 | P |
| https://www.parliament.lk/en/business-of-parliament/act-details/G6384 | Parliament of Sri Lanka — PDP (Amendment) act details | P |
| https://www.dpa.gov.lk/guidelines.php | Data Protection Authority of Sri Lanka — Downloads and gazettes | P |
| https://www.dpa.gov.lk/Gazet/2498-16_E.pdf | Gazette Extraordinary 2498/16 (2026-07-22) | P |
| https://www.dpa.gov.lk/Gazet/G%2043988%20(E).pdf | Gazette Extraordinary 2427/34 (2025-03-14) | P |
| https://www.dpa.gov.lk/Gazet/2024-01-08/2366-08_E.pdf | Gazette Extraordinary 2366/08 (2024-01-08) | P |
| https://www.dpa.gov.lk/Gazet/2023-07-21/2341-59_E.pdf | Gazette Extraordinary 2341/59 (2023-07-21) | P |
| https://readme.lk/digital-policy-watch/personal-data-protection-act-no-9-of-2022/ | readme.lk — PDPA tracker | S |
| https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm | LGPD (Lei 13.709/2018) | K |
| https://www.mayerbrown.com/pt/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies | Mayer Brown — ECA Digital enforcement | S |
| https://www.cg.org.br/resolucoes/documento/2009/CGI.br_Resolucao_2009_001.pdf | CGI.br Resolution 2009/001 (CAPEM) | S |
| https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf | Mexico — LFPDPPP (2025) | S |
| https://www.diputados.gob.mx/LeyesBiblio/ref/lfpc.htm | Mexico — Ley Federal de Protección al Consumidor | S |
| https://support.google.com/mail/answer/14229414 | Gmail — Email sender guidelines FAQ | S |
| https://senders.yahooinc.com/best-practices/ | Yahoo — Sender best practices | K |
| https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730 | Microsoft — Outlook requirements for high-volume senders | S |
| https://www.rfc-editor.org/rfc/rfc8058 | RFC 8058 — One-click unsubscribe | K |
| https://www.rfc-editor.org/rfc/rfc2369 | RFC 2369 — List-* header fields | K |
