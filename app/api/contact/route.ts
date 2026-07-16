import { NextResponse } from "next/server";

type Lead = { firm?: string; landingUrl?: string };
type ContactResult = { first_name?: string; email?: string; note?: string };

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return !(host === "localhost" || host === "::1" || host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host));
  } catch { return false; }
}

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 18000);
}

function publicEmails(html: string) {
  return [...new Set((html.match(emailPattern) || []).map((email) => email.toLowerCase()).filter((email) => !email.endsWith("@example.com")))].slice(0, 8);
}

export async function POST(request: Request) {
  try {
    const { lead } = await request.json() as { lead?: Lead };
    const landingUrl = lead?.landingUrl?.trim();
    if (!landingUrl || !isSafePublicUrl(landingUrl)) return NextResponse.json({ error: "This ad did not include a public website URL to check." }, { status: 400 });

    // This network request and the optional model call happen only after the
    // user presses Find public contact. The model receives page text, not a
    // free-form browsing request, and may never invent an email address.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const page = await fetch(landingUrl, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": "LawyerAdSignal/1.0 contact lookup" } });
    clearTimeout(timeout);
    if (!page.ok) throw new Error(`The firm website returned ${page.status}.`);
    const html = (await page.text()).slice(0, 750000);
    const emails = publicEmails(html);
    const key = process.env.OPENROUTER_API_KEY;

    if (!key) return NextResponse.json({ email: emails[0], source: emails.length ? "Public email found on the landing page." : "No public email was found on the landing page." });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "https://lawyer-ad-signal.blackmamba7193.chatgpt.site", "X-Title": "Lawyer Ad Signal" },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        messages: [
          { role: "system", content: "Extract a public business contact only from supplied website text. Return JSON: first_name, email, note. An email must be copied exactly from the supplied candidate list or website text; never infer or invent it. first_name must be a real named person explicitly associated with the business, otherwise omit it. note must be brief and factual." },
          { role: "user", content: JSON.stringify({ firm: lead?.firm, website: landingUrl, candidate_emails: emails, page_text: cleanHtml(html) }) },
        ],
        temperature: 0,
        max_tokens: 220,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) throw new Error(`Contact model returned ${response.status}.`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    const result = content ? JSON.parse(content) as ContactResult : {};
    const email = result.email && emails.includes(result.email.toLowerCase()) ? result.email.toLowerCase() : emails[0];
    return NextResponse.json({ firstName: result.first_name?.trim() || undefined, email, source: email ? "Public email found on the firm website. Confirm before sending." : "No public email was found on this landing page." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The public contact lookup failed." }, { status: 500 });
  }
}
