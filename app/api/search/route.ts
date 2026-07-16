import { NextResponse } from "next/server";

type RawAd = Record<string, unknown>;
type Scope = "local" | "broad";

const stateNames: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia" };

function textValue(value: unknown): string { if (typeof value === "string") return value; if (value && typeof value === "object" && "text" in value) return String((value as { text?: unknown }).text || ""); return ""; }
function getCopy(ad: RawAd) { const snapshot = ad.snapshot && typeof ad.snapshot === "object" ? ad.snapshot as RawAd : {}; return textValue(ad.adCopy) || textValue(ad.ad_text) || textValue(ad.body) || textValue(ad.text) || textValue(ad.caption) || textValue(snapshot.body) || textValue(snapshot.linkDescription) || "Active legal-services advertisement"; }
function getStart(ad: RawAd): Date { const raw = ad.startDateFormatted || ad.startDate || ad.start_date || ad.startedAt; if (typeof raw === "number") return new Date(raw * 1000); const date = new Date(String(raw || Date.now())); return Number.isNaN(date.getTime()) ? new Date() : date; }
function makeLibraryUrl(ad: RawAd) { const direct = textValue(ad.ad_snapshot_url); if (direct) return direct; const id = ad.adArchiveId || ad.adArchiveID || ad.adId || ad.ad_id; return id ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(String(id))}` : "https://www.facebook.com/ads/library/"; }
function cleanUrl(value: unknown) { const url = textValue(value); return /^https?:\/\//i.test(url) ? url : undefined; }

function localEvidence(ad: RawAd, city: string, state: string) {
  const haystack = [textValue(ad.pageName), textValue(ad.page_name), textValue(ad.advertiserName), getCopy(ad), textValue(ad.title), textValue(ad.headline), textValue(ad.link_url), textValue(ad.landingPageUrl)].join(" ").toLowerCase();
  const localTerms = [city.toLowerCase().trim(), stateNames[state]?.toLowerCase()].filter(Boolean);
  return localTerms.some((term) => term.length >= 3 && haystack.includes(term));
}

function normalize(raw: RawAd[], city: string, state: string, keyword: string, scope: Scope) {
  const eligible = scope === "local" ? raw.filter((ad) => localEvidence(ad, city, state)) : raw;
  const groups = new Map<string, RawAd[]>();
  for (const ad of eligible) {
    const firm = String(ad.pageName || ad.advertiserName || ad.advertiser || ad.page_name || "Unknown law firm").trim();
    if (!groups.has(firm)) groups.set(firm, []);
    groups.get(firm)!.push(ad);
  }
  return Array.from(groups.entries()).slice(0, 24).map(([firm, ads], index) => {
    const oldest = ads.map(getStart).sort((a, b) => a.getTime() - b.getTime())[0];
    const representative = [...ads].sort((a, b) => getCopy(b).length - getCopy(a).length)[0];
    const reportedDays = Number(representative.duration_days || representative.runningDays || 0);
    const daysLive = Number.isFinite(reportedDays) && reportedDays > 0 ? reportedDays : Math.max(1, Math.floor((Date.now() - oldest.getTime()) / 86400000));
    const platformRaw = representative.publisherPlatform || representative.publisherPlatforms || representative.platforms;
    const platforms = Array.isArray(platformRaw) ? platformRaw.map((p) => String(p).toLowerCase().replace(/^./, (c) => c.toUpperCase())) : ["Facebook"];
    const copy = getCopy(representative);
    const headline = textValue(representative.title) || textValue(representative.headline) || textValue(representative.ad_headline) || keyword || "legal services";
    const landingUrl = cleanUrl(representative.landingPageUrl || representative.linkUrl || representative.link_url || representative.ctaLink || representative.website);
    const pageUrl = cleanUrl(representative.pageUrl || representative.page_url || representative.facebookPageUrl || representative.facebook_page_url || representative.pageLink);
    return { id: String(representative.adArchiveId || representative.adArchiveID || representative.adId || representative.ad_id || `${firm}-${index}`), firm, city, state, scope, adCount: ads.length,
      activeSince: oldest.toISOString().slice(0, 10), daysLive, platforms, adTheme: headline.length > 90 ? `${headline.slice(0, 87)}...` : headline,
      adCopy: copy.length > 420 ? `${copy.slice(0, 417)}...` : copy, landingUrl, pageUrl, libraryUrl: makeLibraryUrl(representative), confidence: scope === "local" ? "high" : "medium" };
  }).sort((a, b) => b.daysLive - a.daysLive);
}

function sampleLeads(city: string, state: string, keyword: string, scope: Scope) {
  return [{ id: "sample-1", firm: "Northstar Injury Law", city, state, scope, adCount: 7, activeSince: "2026-01-08", daysLive: 188, platforms: ["Facebook", "Instagram"], adTheme: `${keyword || "injury"} consultation`, adCopy: `Injured in ${city}? Our attorneys explain what to do after a serious collision and offer a no-obligation case review.`, libraryUrl: "https://www.facebook.com/ads/library/", confidence: scope === "local" ? "high" : "medium" }];
}

export async function POST(request: Request) {
  try {
    const { state = "VA", city = "Fairfax", keyword = "lawyer", scope = "local" } = await request.json() as { state?: string; city?: string; keyword?: string; scope?: Scope };
    const normalizedScope: Scope = scope === "broad" ? "broad" : "local";
    const cleanCity = String(city).trim(); const cleanKeyword = String(keyword || "lawyer").trim();
    if (normalizedScope === "local" && !cleanCity) return NextResponse.json({ error: "Enter a city for a local scan." }, { status: 400 });
    const token = process.env.APIFY_API_TOKEN;
    if (!token) return NextResponse.json({ mode: "sample", leads: sampleLeads(cleanCity, state, cleanKeyword, normalizedScope), notice: "Sample mode is on. Add an Apify API token to run live scans." });
    const searchTerms = normalizedScope === "local" ? `${cleanCity} ${cleanKeyword}` : cleanKeyword;
    const url = `https://api.apify.com/v2/acts/dltik~facebook-ads-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searchTerms, country: "US", activeStatus: "active", mediaType: "all", maxResults: 25, enrichAds: false, analyzeAds: false, transcribeVideos: false, useResidentialProxy: false }) });
    if (!response.ok) throw new Error(`Ad provider returned ${response.status}.`);
    const raw = await response.json() as RawAd[];
    const leads = normalize(Array.isArray(raw) ? raw : [], cleanCity, state, cleanKeyword, normalizedScope);
    const notice = normalizedScope === "local"
      ? (leads.length ? `Found ${leads.length} advertisers with explicit ${cleanCity} or ${stateNames[state] || state} evidence. National matches are excluded.` : `No ads showed explicit ${cleanCity} or ${stateNames[state] || state} evidence. That is safer than showing unrelated firms. Try a nearby city, a different practice area, or switch to U.S. broad.`)
      : (leads.length ? `Found ${leads.length} active U.S. advertisers matching “${cleanKeyword}”. This is a broad list, not a local list.` : `No active U.S. ads matched “${cleanKeyword}”.`);
    return NextResponse.json({ mode: "live", leads, notice, searchTerms });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The scan failed." }, { status: 500 }); }
}
