import { NextResponse } from "next/server";

type RawAd = Record<string, unknown>;

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value) return String((value as { text?: unknown }).text || "");
  return "";
}

function getCopy(ad: RawAd) {
  const snapshot = ad.snapshot && typeof ad.snapshot === "object" ? ad.snapshot as RawAd : {};
  return textValue(ad.adCopy) || textValue(ad.ad_text) || textValue(ad.body) || textValue(ad.text) || textValue(ad.caption) || textValue(snapshot.body) || textValue(snapshot.linkDescription) || "Active legal-services advertisement";
}

function getStart(ad: RawAd): Date {
  const raw = ad.startDateFormatted || ad.startDate || ad.start_date || ad.startedAt;
  if (typeof raw === "number") return new Date(raw * 1000);
  const date = new Date(String(raw || Date.now()));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function makeLibraryUrl(ad: RawAd) {
  const direct = textValue(ad.ad_snapshot_url);
  if (direct) return direct;
  const id = ad.adArchiveId || ad.adArchiveID || ad.adId || ad.ad_id;
  return id ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(String(id))}` : String(ad.inputUrl || "https://www.facebook.com/ads/library/");
}

function normalize(raw: RawAd[], city: string, state: string, keyword: string) {
  const groups = new Map<string, RawAd[]>();
  for (const ad of raw) {
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
    const landingUrl = String(representative.landingPageUrl || representative.linkUrl || representative.link_url || representative.ctaLink || "") || undefined;
    return {
      id: String(representative.adArchiveId || representative.adArchiveID || representative.adId || representative.ad_id || `${firm}-${index}`), firm, city, state, adCount: ads.length,
      activeSince: oldest.toISOString().slice(0, 10), daysLive, platforms, adTheme: headline.length > 90 ? `${headline.slice(0, 87)}...` : headline,
      adCopy: copy.length > 420 ? `${copy.slice(0, 417)}...` : copy, landingUrl,
      libraryUrl: makeLibraryUrl(representative), confidence: copy.toLowerCase().includes(city.toLowerCase()) ? "high" : "medium",
    };
  }).sort((a, b) => b.daysLive - a.daysLive);
}

function sampleLeads(city: string, state: string, keyword: string) {
  return [
    { id: "sample-1", firm: "Northstar Injury Law", city, state, adCount: 7, activeSince: "2026-01-08", daysLive: 188, platforms: ["Facebook", "Instagram"], adTheme: `${keyword || "injury"} consultation`, adCopy: `Injured in ${city}? Our attorneys explain what to do after a serious collision and offer a no-obligation case review.`, libraryUrl: "https://www.facebook.com/ads/library/", confidence: "high" },
    { id: "sample-2", firm: "Commonwealth Legal Group", city, state, adCount: 3, activeSince: "2026-04-17", daysLive: 89, platforms: ["Facebook"], adTheme: "What to do after a crash", adCopy: "The first steps after an accident can affect your claim. Speak with a local attorney about your options.", libraryUrl: "https://www.facebook.com/ads/library/", confidence: "medium" },
  ];
}

export async function POST(request: Request) {
  try {
    const { state = "VA", city = "Fairfax", keyword = "lawyer" } = await request.json();
    const token = process.env.APIFY_API_TOKEN;
    if (!token) return NextResponse.json({ mode: "sample", leads: sampleLeads(city, state, keyword), notice: "Sample mode is on. Add an Apify API token to make this button run live active-ad scans." });

    // Meta's commercial-ad search does not expose city targeting. The old combined
    // phrase behaved as a strict copy match and caused broad searches to return zero.
    const searchTerms = String(keyword || "lawyer").trim();
    const url = `https://api.apify.com/v2/acts/dltik~facebook-ads-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;
    // This paid request happens only after the user presses Scan. Keep it small:
    // no enrichment, transcription, proxy upgrade, or background processing.
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searchTerms, country: "US", activeStatus: "active", mediaType: "all", maxResults: 25, enrichAds: false, analyzeAds: false, transcribeVideos: false, useResidentialProxy: false }) });
    if (!response.ok) throw new Error(`Ad provider returned ${response.status}.`);
    const raw = await response.json() as RawAd[];
    const leads = normalize(Array.isArray(raw) ? raw : [], city, state, searchTerms);
    return NextResponse.json({ mode: "live", leads, notice: leads.length ? `Found ${leads.length} active U.S. advertiser${leads.length === 1 ? "" : "s"} matching “${searchTerms}”. ${city} is your research market; Meta does not disclose commercial-ad city targeting.` : `No active U.S. ads matched “${searchTerms}”. Try “personal injury”, “car accident”, or “estate planning”.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The scan failed." }, { status: 500 });
  }
}
