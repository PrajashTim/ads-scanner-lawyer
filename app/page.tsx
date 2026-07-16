"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Lead = { id: string; firm: string; city: string; state: string; adCount: number; activeSince: string; daysLive: number; platforms: string[]; adTheme: string; adCopy: string; landingUrl?: string; libraryUrl: string; confidence: "high" | "medium" };
type Generated = { subject: string; body: string; brief: string };
type Contact = { firstName?: string; email?: string; source?: string; note?: string };

const locations: Record<string, string[]> = {
  VA: ["Fairfax", "Arlington", "Alexandria", "Richmond", "Virginia Beach", "Norfolk", "Roanoke"],
  MD: ["Bethesda", "Baltimore", "Rockville", "Silver Spring", "Annapolis"], DC: ["Washington"],
  FL: ["Miami", "Tampa", "Orlando", "Jacksonville", "Fort Lauderdale"], TX: ["Austin", "Dallas", "Houston", "San Antonio", "Fort Worth"],
  CA: ["Los Angeles", "San Diego", "San Francisco", "Sacramento", "San Jose"], NY: ["New York", "Buffalo", "Albany", "Rochester", "Syracuse"],
};
const stateNames: Record<string, string> = { VA: "Virginia", MD: "Maryland", DC: "District of Columbia", FL: "Florida", TX: "Texas", CA: "California", NY: "New York" };

function daysLabel(days: number) { if (days >= 365) return "1 year+"; if (days >= 180) return "6 months+"; if (days >= 90) return "90 days+"; if (days >= 30) return "30 days+"; return `${Math.max(days, 1)} days`; }

export default function Home() {
  const [state, setState] = useState("VA");
  const [city, setCity] = useState("Fairfax");
  const [keyword, setKeyword] = useState("personal injury");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "sample" | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [contact, setContact] = useState<Contact | null>(null);
  const [findingContact, setFindingContact] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [importText, setImportText] = useState("");
  const selected = useMemo(() => leads.find((lead) => lead.id === selectedId) ?? null, [leads, selectedId]);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function runScan(event: FormEvent) {
    event.preventDefault(); setLoading(true); setElapsed(0); setNotice(""); setGenerated(null); setContact(null);
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, city, keyword }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "The scan could not be completed.");
      setLeads(data.leads); setMode(data.mode); setNotice(data.notice || ""); setSelectedId(data.leads[0]?.id ?? null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The scan could not be completed."); }
    finally { setLoading(false); }
  }

  function importAds() {
    try {
      const parsed = JSON.parse(importText); const items = Array.isArray(parsed) ? parsed : parsed.leads;
      if (!Array.isArray(items)) throw new Error("Paste a JSON array of ad records.");
      const normalized: Lead[] = items.slice(0, 50).map((item: Record<string, unknown>, index: number) => ({
        id: String(item.id || item.adArchiveId || item.ad_id || `import-${index}`), firm: String(item.firm || item.pageName || item.page_name || item.advertiser || "Unknown firm"), city, state,
        adCount: Number(item.adCount || item.collationCount || 1), activeSince: String(item.activeSince || item.startDateFormatted || item.startDate || item.start_date || "Unknown"),
        daysLive: Number(item.daysLive || item.duration_days || item.runningDays || 1), platforms: Array.isArray(item.platforms) ? item.platforms.map(String) : ["Meta"],
        adTheme: String(item.adTheme || item.title || item.headline || keyword || "legal services"), adCopy: String(item.adCopy || item.ad_text || item.body || item.text || item.caption || "Active legal-services ad"),
        landingUrl: item.landingUrl ? String(item.landingUrl) : item.link_url ? String(item.link_url) : undefined, libraryUrl: String(item.libraryUrl || item.ad_snapshot_url || item.inputUrl || "https://www.facebook.com/ads/library/"), confidence: "medium",
      }));
      setLeads(normalized); setMode("live"); setSelectedId(normalized[0]?.id ?? null); setNotice(`${normalized.length} imported ad records are ready.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The import could not be read."); }
  }

  async function findContact() {
    if (!selected) return; setFindingContact(true); setContact(null);
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead: selected }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No public contact was found.");
      setContact(data); if (data.firstName) setFirstName(data.firstName);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No public contact was found."); }
    finally { setFindingContact(false); }
  }

  async function generateEmail() {
    if (!selected || !firstName.trim()) return; setGenerating(true); setGenerated(null);
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead: selected, firstName: firstName.trim(), keyword }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "The email could not be generated."); setGenerated(data);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The email could not be generated."); }
    finally { setGenerating(false); }
  }

  const gmailHref = generated && contact?.email ? `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${encodeURIComponent(generated.subject)}&body=${encodeURIComponent(generated.body)}` : "";

  return <main>
    <header className="topbar"><div className="brand"><span className="brandMark">LS</span><span>Lawyer Ad Signal</span></div><div className="privacy">Private workspace</div></header>
    <section className="hero shell">
      <div className="eyebrow"><span /> Find firms already buying attention</div>
      <h1>Turn active lawyer ads<br />into better cold emails.</h1>
      <p className="lede">Choose a market, scan active advertisers, and turn one real ad signal into a specific YouTube opportunity email.</p>
      <form className="searchPanel" onSubmit={runScan}>
        <label><span>State</span><select value={state} onChange={(event) => { const next = event.target.value; setState(next); setCity(locations[next][0]); }}>{Object.entries(stateNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        <label><span>City</span><select value={city} onChange={(event) => setCity(event.target.value)}>{locations[state].map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="keywordField"><span>Practice area or keyword</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="personal injury" /></label>
        <button className="scanButton" disabled={loading}>{loading ? `Scanning · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : "Scan active ads"}<b>→</b></button>
      </form>
      {loading && <div className="scanProgress" role="status" aria-live="polite"><span />Searching active U.S. ads. This can take up to two minutes.</div>}
      <div className="truthNote"><b>What this proves:</b> the firm has an active ad matching this keyword. Meta does not reveal exact city targeting or inactive commercial ads. <b>Spend control:</b> this runs only when you press Scan, returns up to 25 records, and has no background scans.</div>
    </section>

    {(notice || leads.length > 0) && <section className="workspace shell">
      <div className="workspaceHead"><div><p className="sectionKicker">Signal board</p><h2>{leads.length ? `${leads.length} firms to review` : "No results yet"}</h2></div>{mode && <span className={`mode ${mode}`}>{mode === "live" ? "Live data" : "Sample mode"}</span>}</div>
      {notice && <div className="notice">{notice}</div>}
      <div className="board">
        <div className="leadList">{leads.map((lead) => <button key={lead.id} className={`leadCard ${selectedId === lead.id ? "selected" : ""}`} onClick={() => { setSelectedId(lead.id); setGenerated(null); setContact(null); setFirstName(""); }}>
          <div className="leadTop"><span className="firm">{lead.firm}</span><span className={`confidence ${lead.confidence}`}>{lead.confidence}</span></div>
          <div className="metaLine"><span>{lead.city}, {lead.state}</span><span>{lead.adCount} active creative{lead.adCount === 1 ? "" : "s"}</span></div>
          <p>{lead.adTheme}</p><div className="signalLine"><span className="pulse" /> Running {daysLabel(lead.daysLive)}</div>
        </button>)}</div>
        <aside className="detailPanel">{selected ? <>
          <div className="detailTitle"><div><span>Selected signal</span><h3>{selected.firm}</h3></div><a href={selected.libraryUrl} target="_blank" rel="noreferrer">Verify ad →</a></div>
          <div className="stats"><div><b>{selected.adCount}</b><span>active creatives</span></div><div><b>{daysLabel(selected.daysLive)}</b><span>oldest active ad</span></div><div><b>{selected.platforms.join(" + ")}</b><span>placements seen</span></div></div>
          <div className="evidence"><span>Ad evidence</span><p>{selected.adCopy}</p>{selected.landingUrl && <a href={selected.landingUrl} target="_blank" rel="noreferrer">Open landing page →</a>}</div>
          <div className="contactActions"><button className="contactButton" onClick={findContact} disabled={findingContact || !selected.landingUrl}>{findingContact ? "Checking website..." : "Find public contact"}</button>{!selected.landingUrl && <span>No website URL was included with this ad.</span>}</div>
          {contact && <div className="contactResult"><b>{contact.email || "No email found"}</b>{contact.firstName && <span> · first name: {contact.firstName}</span>}<small>{contact.source || contact.note}</small></div>}
          <label className="nameField"><span>Contact first name</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="John" /></label>
          <p className="truthNote"><b>Contact check:</b> the website lookup only returns an email found publicly on that firm&apos;s site. Confirm the recipient before sending.</p>
          <button className="generateButton" onClick={generateEmail} disabled={!firstName.trim() || generating}>{generating ? "Writing..." : "Generate email for this account"}</button>
          {generated && <div className="generated"><div className="generatedHead"><span>Ready to review</span><div className="emailActions">{gmailHref && <a href={gmailHref} target="_blank" rel="noreferrer">Review in Gmail</a>}<button onClick={() => navigator.clipboard.writeText(`Subject: ${generated.subject}\n\n${generated.body}`)}>Copy email</button></div></div><p className="subject"><b>Subject:</b> {generated.subject}</p><p className="emailBody">{generated.body}</p><details><summary>View the rough one-page brief</summary><pre>{generated.brief}</pre></details></div>}
        </> : <div className="empty">Run a scan, then choose a firm.</div>}</aside>
      </div>
      <details className="importer"><summary>Import ad JSON instead</summary><p>Use this if you already exported records from Apify or another provider.</p><textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='[{"pageName":"Example Law","adCopy":"Injured in a crash?","startDateFormatted":"2026-01-12"}]' /><button onClick={importAds}>Import records</button></details>
    </section>}
    <footer className="shell"><span>Lawyer Ad Signal</span><p>Active-ad research + truthful opportunity emails.</p></footer>
  </main>;
}
