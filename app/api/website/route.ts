import { NextResponse } from "next/server";

type Lead = { firm?: string; city?: string; state?: string; landingUrl?: string; pageUrl?: string; websiteUrl?: string };

function isPublicHttpUrl(value?: string) {
  try { const url = new URL(value || ""); return ["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()); }
  catch { return false; }
}

export async function POST(request: Request) {
  try {
    const { lead } = await request.json() as { lead?: Lead };
    const existing = lead?.websiteUrl || lead?.landingUrl;
    if (isPublicHttpUrl(existing)) return NextResponse.json({ websiteUrl: existing, source: "Website URL supplied with the active ad." });
    if (!lead?.firm?.trim()) return NextResponse.json({ error: "Choose an advertiser first." }, { status: 400 });
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return NextResponse.json({ error: "Website lookup needs the OpenRouter key." }, { status: 503 });
    // Runs only when the user explicitly asks for a website lookup. The web
    // server tool is restricted to one result and the answer must be an official
    // firm domain, never a social profile, directory, or guessed URL.
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "https://lawyer-ad-signal.blackmamba7193.chatgpt.site", "X-Title": "Lawyer Ad Signal" },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        tools: [{ type: "openrouter:web_search" }],
        max_total_results: 1,
        messages: [
          { role: "system", content: "Find the official website for the named law firm. Use web search only when no supplied ad/page URL is usable. Return JSON only: {websiteUrl, source}. websiteUrl must be a public official firm domain, never Facebook, Instagram, Yelp, Avvo, FindLaw, Justia, or a directory. If uncertain, return {}." },
          { role: "user", content: JSON.stringify({ firm: lead.firm, city: lead.city, state: lead.state, facebook_page_url: lead.pageUrl || null }) },
        ],
        temperature: 0,
        max_tokens: 180,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) throw new Error(`Website model returned ${response.status}.`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    const result = content ? JSON.parse(content) as { websiteUrl?: string } : {};
    if (!isPublicHttpUrl(result.websiteUrl) || /facebook\.com|instagram\.com|yelp\.com|avvo\.com|findlaw\.com|justia\.com/i.test(result.websiteUrl || "")) return NextResponse.json({ error: "No confident official website was found. Open the Facebook page and add the site manually." }, { status: 404 });
    return NextResponse.json({ websiteUrl: result.websiteUrl, source: "Official website found via one explicit web lookup. Confirm before contacting." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The website lookup failed." }, { status: 500 }); }
}
