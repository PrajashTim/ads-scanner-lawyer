import { NextResponse } from "next/server";
type Lead = { firm: string; city: string; state: string; scope: "local" | "broad"; adCount: number; daysLive: number; adTheme: string; adCopy: string };

const system = `Write a truthful, concise cold email for a YouTube marketing service contacting a law firm with an active Meta ad. Use only supplied evidence. Never claim spend, targeting, performance, leads, or outcomes. Do not say the ad is local unless scope is local. Do not pitch thumbnails in the email. The offer is a one-page brief that maps three relevant YouTube angles and one tighter opening hook around the paid topic; thumbnail direction is optional later work, not the front-end offer.
Return JSON: subject, body, brief.
SUBJECT: 2-5 lowercase words.
BODY: 42-70 words. Start with first name and a neutral observation about the active ad. Suggest one concrete, professional YouTube title in quotation marks. Then write exactly: I mapped three YouTube angles and a tighter opening hook into a one-page brief. End exactly: Want me to send it over?
No call request, links, hype, flattery, em dashes, or invented facts.
BRIEF: under 210 words with labels TITLE 1, TITLE 2, TITLE 3, OPENING HOOK, WHY THIS FITS. TITLE 1 must match the email title.`;

function fallback(firstName: string, lead: Lead) {
  const title = lead.adTheme.toLowerCase().includes("personal injury") ? "What Happens After You Hire a Personal Injury Lawyer?" : "What Should You Ask Before Hiring a Lawyer?";
  return { subject: "a youtube follow-up", body: `${firstName}, I noticed ${lead.firm} has an active ad about ${lead.adTheme}. A YouTube follow-up I would test is "${title}". I mapped three YouTube angles and a tighter opening hook into a one-page brief. Want me to send it over?`, brief: `TITLE 1: ${title}\nTITLE 2: Three Questions to Ask Before Your First Legal Consultation\nTITLE 3: What Documents Should You Bring to a Consultation?\nOPENING HOOK: Before you choose a lawyer, here is what to understand first.\nWHY THIS FITS: The firm is actively advertising around ${lead.adTheme}.` };
}

export async function POST(request: Request) {
  try {
    const { lead, firstName } = await request.json() as { lead: Lead; firstName: string };
    if (!lead || !firstName?.trim()) return NextResponse.json({ error: "Choose a firm and enter a contact first name." }, { status: 400 });
    const key = process.env.OPENROUTER_API_KEY; if (!key) return NextResponse.json(fallback(firstName.trim(), lead));
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "https://lawyer-ad-signal.blackmamba7193.chatgpt.site", "X-Title": "Lawyer Ad Signal" }, body: JSON.stringify({ model: "deepseek/deepseek-v4-flash", messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify({ firstName: firstName.trim(), lead }) }], temperature: 0.25, max_tokens: 650, response_format: { type: "json_object" } }) });
    if (!response.ok) throw new Error(`Email model returned ${response.status}.`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("The email model returned no content.");
    return NextResponse.json(JSON.parse(content));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The email could not be generated." }, { status: 500 }); }
}
