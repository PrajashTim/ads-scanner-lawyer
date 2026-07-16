import { NextResponse } from "next/server";
type Lead = { firm: string; city: string; state: string; adCount: number; daysLive: number; adTheme: string; adCopy: string };

const system = `You write truthful, calm cold emails for a YouTube marketing service contacting consumer-facing law firms.
The prospect was found through a currently active Meta ad. Never claim exact spend, targeting, performance, leads, or results. Treat ad longevity and creative count only as evidence that the firm is actively buying attention.
Return JSON with keys subject, body, brief.
SUBJECT: 2-5 lowercase words.
BODY: 42-70 words. Start with the first name and one neutral, supported observation about the active ad. Propose one concrete YouTube title in quotation marks. Then use this exact sentence: I mapped three more angles, a tighter opening hook, and thumbnail directions into a one-page brief. End exactly: Want me to send it over?
Do not ask for a call. No links, hype, flattery, em dashes, or promised outcomes.
BRIEF: under 230 words with labels TITLE 1, TITLE 2, TITLE 3, TITLE 4, OPENING HOOK, THUMBNAIL DIRECTION 1, THUMBNAIL DIRECTION 2, WHY THIS FITS. TITLE 1 must match the email title. Make every title professional and explanatory.`;

function fallback(firstName: string, lead: Lead) {
  const topic = lead.adTheme || "your current client question";
  const lower = topic.toLowerCase();
  const title = lower.includes("personal injury")
    ? "What Happens After You Hire a Personal Injury Lawyer?"
    : lower.includes("divorce")
      ? "What Should You Ask Before Hiring a Divorce Lawyer?"
      : "What Should You Ask Before Hiring a Lawyer?";
  return { subject: `${topic.split(/\s+/).slice(0, 3).join(" ")} follow-up`.toLowerCase(), body: `${firstName}, I saw ${lead.firm}'s active ad about ${topic}. The YouTube follow-up I'd test is "${title}" I mapped three more angles, a tighter opening hook, and thumbnail directions into a one-page brief. Want me to send it over?`,
    brief: `TITLE 1: ${title}\nTITLE 2: Three Mistakes to Avoid Before Speaking With an Attorney\nTITLE 3: What Documents Should You Bring to a Legal Consultation?\nTITLE 4: How Long Does a Typical Legal Claim Take?\nOPENING HOOK: If you are comparing legal options, the first conversation matters. Here is what to understand before you choose a lawyer.\nTHUMBNAIL DIRECTION 1: Attorney at desk, simple text: BEFORE YOU HIRE\nTHUMBNAIL DIRECTION 2: Checklist graphic, simple text: 3 QUESTIONS\nWHY THIS FITS: The firm is currently advertising around ${topic}.` };
}

export async function POST(request: Request) {
  try {
    const { lead, firstName } = await request.json() as { lead: Lead; firstName: string }; if (!lead || !firstName?.trim()) return NextResponse.json({ error: "Choose a firm and add the contact's first name." }, { status: 400 });
    const key = process.env.OPENROUTER_API_KEY; if (!key) return NextResponse.json(fallback(firstName.trim(), lead));
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "https://sites.openai.com", "X-Title": "Lawyer Ad Signal" }, body: JSON.stringify({ model: "~google/gemini-flash-latest", messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify({ firstName: firstName.trim(), lead }) }], temperature: 0.3, max_tokens: 900, response_format: { type: "json_object" } }) });
    if (!response.ok) throw new Error(`Email model returned ${response.status}.`); const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; const content = data.choices?.[0]?.message?.content; if (!content) throw new Error("The email model returned no content.");
    return NextResponse.json(JSON.parse(content));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The email could not be generated." }, { status: 500 }); }
}
