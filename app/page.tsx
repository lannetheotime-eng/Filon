"use client";
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { TRADES, getTrade } from "../lib/trades";
import type { Lead, PipelineEntry, Profile, ScanResult, Stage, WebPresence } from "../lib/types";
import { DEFAULT_PROFILE, PRESENCE_LABEL, STAGES } from "../lib/types";
import { usePersistent, toCsv, download } from "../lib/store";
import { mergeData, toSync, type SyncData } from "../lib/sync";
import { detectNeeds, SERVICES } from "../lib/needs";
import { siteStatus, activity } from "../lib/site";
import LeadDrawer from "../components/LeadDrawer";
import Board from "../components/Board";
import Dashboard from "../components/Dashboard";
import Today from "../components/Today";
import { IconToday, IconScan, IconBoard, IconStats, IconSettings, IconRoute, IconMap, IconList } from "../components/Icons";

const MapView = dynamic(() => import("../components/MapView"), { ssr: false, loading: () => <div className="map" /> });

type View = "scan" | "today" | "pipeline" | "bilan" | "reglages";
type Recent = { city: string; tradeId: string; at: string };
type Usage = { used: number; limit: number | null; today: number; dailyLimit: number };
type Me = { mode: "simple" | "comptes"; user: { email: string; role: "admin" | "user" } | null; usage: Usage | null; google: boolean };

function Score({ value }: { value: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <div className="score" aria-label={`Priorité ${value} sur 100`}>
      <svg viewBox="0 0 46 46" width="46" height="46">
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--mark)" strokeWidth="3" strokeDasharray={`${(value / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      {value}
    </div>
  );
}

// Itinéraire Google Maps : départ depuis la position actuelle, jusqu'à 10 arrêts
function routeUrl(stops: Lead[]) {
  const s = stops.slice(0, 10).map((l) => encodeURIComponent(l.address));
  const dest = s[s.length - 1];
  const way = s.slice(0, -1).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${way ? `&waypoints=${way}` : ""}&travelmode=driving`;
}

export default function Home() {
  const [view, setView] = useState<View>("scan");
  const [tradeId, setTradeId] = usePersistent("filon.trade", "boulangerie");
  const [city, setCity] = usePersistent("filon.city", "Toulouse");
  const [deep, setDeep] = usePersistent("filon.deep", false);
  const [includeOld, setIncludeOld] = usePersistent("filon.old", true);
  const [includeAll, setIncludeAll] = usePersistent("filon.all", false);
  const [wpOnly, setWpOnly] = useState(false);
  const [around, setAround] = useState("");
  const [radius, setRadius] = usePersistent("filon.radius", 1000);
  // Mode simple (sans base) : compteur de requêtes tenu par ce navigateur, par mois
  const [localUsage, setLocalUsage] = usePersistent<{ month: string; calls: number; day: string; today: number }>("filon.usage", { month: "", calls: 0, day: "", today: 0 });
  const [recent, setRecent] = usePersistent<Recent[]>("filon.recent", []);
  const [result, setResult] = usePersistent<ScanResult | null>("filon.last", null);
  const [leads, setLeads] = usePersistent<Record<string, Lead>>("filon.leads", {});
  const [pipeline, setPipeline, ready] = usePersistent<Record<string, PipelineEntry>>("filon.pipeline", {});
  const [profile, setProfileRaw] = usePersistent<Profile>("filon.profile", DEFAULT_PROFILE);
  const [profileAt, setProfileAt] = usePersistent<string>("filon.profileAt", "");
  const setProfile = (p: Profile) => { setProfileRaw(p); setProfileAt(new Date().toISOString()); };
  const [me, setMe] = useState<Me | null>(null);
  const [sync, setSync] = useState<"off" | "loading" | "ok" | "saving" | "error">("off");
  const [invite, setInvite] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const synced = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState(0);
  const [kind, setKind] = useState<WebPresence | "all">("all");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  // Compte, mode et consommation
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then(setMe).catch(() => setMe(null));
  }, []);

  // Synchro : au chargement, fusion avec la version enregistrée sur le serveur
  useEffect(() => {
    if (!ready || !me?.user || synced.current) return;
    setSync("loading");
    fetch("/api/data")
      .then((r) => r.json())
      .then(({ data }: { data: SyncData | null }) => {
        const merged = mergeData(toSync(pipeline, leads, profile, profileAt, recent), data);
        setPipeline(merged.pipeline);
        setLeads((prev) => ({ ...prev, ...merged.leads }));
        if (merged.profile) setProfileRaw(merged.profile);
        if (merged.profileAt) setProfileAt(merged.profileAt);
        if (merged.recent) setRecent(merged.recent);
        synced.current = true;
        setSync("ok");
      })
      .catch(() => setSync("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, me]);

  // Puis enregistrement automatique, une seconde après chaque modification
  useEffect(() => {
    if (!synced.current) return;
    const t = setTimeout(() => {
      setSync("saving");
      fetch("/api/data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toSync(pipeline, leads, profile, profileAt, recent)) })
        .then((r) => setSync(r.ok ? "ok" : "error"))
        .catch(() => setSync("error"));
    }, 1000);
    return () => clearTimeout(t);
  }, [pipeline, profile, profileAt, recent, leads]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/connexion";
  }

  async function newInvite() {
    const r = await fetch("/api/invite", { method: "POST" });
    const j = await r.json();
    if (r.ok) setInvite(`${location.origin}/connexion?invitation=${j.code}`);
  }

  function exportAll() {
    const data = { version: 1, exportedAt: new Date().toISOString(), ...toSync(pipeline, leads, profile, profileAt, recent) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `filon-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importAll(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as SyncData;
      if (!data.pipeline || !data.leads) throw new Error();
      const merged = mergeData(toSync(pipeline, leads, profile, profileAt, recent), data);
      setPipeline(merged.pipeline);
      setLeads((prev) => ({ ...prev, ...merged.leads }));
      if (merged.profile) setProfileRaw(merged.profile);
      setImportMsg(`Sauvegarde importée : ${Object.keys(data.pipeline).length} entreprises suivies.`);
    } catch {
      setImportMsg("Ce fichier n'est pas une sauvegarde Filon.");
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const usedToday = localUsage.day === todayKey ? localUsage.today : 0;
  const cap = profile.dailyCap ?? 30;
  const scanCost = deep && !around.trim() ? 27 : 3;
  const live = !!me?.google;

  function spend(n: number) {
    const month = new Date().toISOString().slice(0, 7), day = new Date().toISOString().slice(0, 10);
    setLocalUsage((u) => ({ month, day, calls: (u.month === month ? u.calls : 0) + n, today: (u.day === day ? u.today : 0) + n }));
  }
  function canSpend(n: number) {
    return !live || me?.mode === "comptes" || usedToday + n <= cap;
  }

  // Date de création et nom officiel : registre des entreprises (gratuit, sans requête Google)
  const [regProgress, setRegProgress] = useState<{ done: number; total: number } | null>(null);
  async function enrichRegistry(list: Lead[]) {
    const todo = list.filter((l) => !l.registry && !l.id.startsWith("demo-")).slice(0, 80);
    if (!todo.length) return;
    let done = 0;
    setRegProgress({ done, total: todo.length });
    const apply = (id: string, patch: Partial<Lead>) => {
      setLeads((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
      setResult((r) => (r ? { ...r, leads: r.leads.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : r));
    };
    const worker = async () => {
      while (todo.length) {
        const l = todo.shift()!;
        try {
          const r = await fetch(`/api/dirigeant?name=${encodeURIComponent(l.name)}&address=${encodeURIComponent(l.address)}`);
          const j = await r.json();
          const best = r.ok ? j.results?.[0] : null;
          apply(l.id, best ? { created: best.created, legalName: best.company, registry: "ok" } : { registry: "none" });
        } catch {}
        done++;
        setRegProgress({ done, total: done + todo.length });
        await new Promise((res) => setTimeout(res, 350)); // le registre accepte environ 7 requêtes par seconde
      }
    };
    await Promise.all([worker(), worker()]);
    setRegProgress(null);
  }

  async function runScan(c = city, t = tradeId) {
    if (!canSpend(scanCost)) {
      setError(`Ce scan peut coûter jusqu'à ${scanCost} requêtes et il t'en reste ${Math.max(0, cap - usedToday)} aujourd'hui sur ton plafond de ${cap}. ${deep ? "Désactive le scan complet ou " : ""}Reviens demain pour rester dans le gratuit.`);
      return;
    }
    setLoading(true);
    setError("");
    setSelected([]);
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: c, tradeId: t, deep, includeOld, includeAll, around: around.trim() || undefined, radius }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.usage) setMe((m) => (m ? { ...m, usage: j.usage } : m));
      if (!j.demo && j.calls) spend(j.calls);
      enrichRegistry(j.leads as Lead[]);
      setResult(j);
      setKind("all");
      setLeads((prev) => {
        const next = { ...prev };
        for (const l of j.leads as Lead[]) next[l.id] = l;
        return next;
      });
      setRecent((prev) => [{ city: j.city.name, tradeId: t, at: new Date().toISOString() }, ...prev.filter((x) => !(x.city === j.city.name && x.tradeId === t))].slice(0, 6));
    } catch (e: any) {
      setError(e.message || "Le scan a échoué.");
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, aucun: 0, reseaux: 0, vieux: 0, equipe: 0 } as Record<WebPresence | "all", number>;
    for (const l of result?.leads || []) { c.all++; c[l.presence]++; }
    return c;
  }, [result]);

  const shown = useMemo(() => {
    if (!result) return [];
    return result.leads.filter(
      (l) =>
        (l.rating || 0) >= minRating &&
        (l.reviews || 0) >= minReviews &&
        (kind === "all" || l.presence === kind) &&
        (!wpOnly || l.audit?.cms === "WordPress" || !l.website)
    );
  }, [result, minRating, minReviews, kind, wpOnly]);
  const wpCount = useMemo(() => (result?.leads || []).filter((l) => l.audit?.cms === "WordPress").length, [result]);

  const updatePipeline = useCallback(
    (id: string, patch: Partial<PipelineEntry> | null) => {
      setPipeline((prev) => {
        const next = { ...prev };
        if (patch === null) delete next[id];
        else {
          const before = prev[id];
          const log = [...(before?.log || [])];
          const at = new Date().toISOString();
          if (!before) log.push({ at, text: "Ajoutée au pipeline" });
          if (patch.channel && patch.contactedAt) log.push({ at, text: `Contactée par ${{ visite: "visite", email: "e-mail", message: "message", appel: "téléphone" }[patch.channel]}` });
          else if (patch.stage && before && patch.stage !== before.stage) log.push({ at, text: `Étape : ${STAGES.find((x) => x.id === patch.stage)?.label}` });
          if (patch.amount && patch.amount !== before?.amount) log.push({ at, text: `Montant : ${patch.amount.toLocaleString("fr-FR")} €` });
          next[id] = { ...({ stage: "a_contacter", notes: "" } as PipelineEntry), ...before, ...patch, log: log.slice(-40), updatedAt: at };
        }
        return next;
      });
    },
    [setPipeline]
  );

  function addMany(ids: string[]) {
    for (const id of ids) if (!pipeline[id]) updatePipeline(id, { stage: "a_contacter" });
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 10 ? s : [...s, id]));
  }

  function exportScan() {
    if (!result) return;
    const t = getTrade(result.tradeId)!;
    download(
      `${t.id}-${result.city.name}.csv`.toLowerCase(),
      toCsv(shown.map((l) => ({
        Nom: l.name, Adresse: l.address, Téléphone: l.phone || "", "E-mail": l.audit?.email || "", Note: l.rating ?? "", Avis: l.reviews ?? "",
        Situation: PRESENCE_LABEL[l.presence], "Site actuel": l.website || "", "Défauts du site": (l.audit?.issues || []).join(" / "),
        Score: l.score, "Fiche Google": l.mapsUrl || "",
      })))
    );
  }

  const openLead = openId ? leads[openId] : null;
  const trade = getTrade(result?.tradeId || tradeId)!;
  const pipelineCount = Object.keys(pipeline).length;
  const selLeads = selected.map((id) => leads[id]).filter(Boolean);

  const NAV: [View, string, () => React.ReactElement][] = [
    ["scan", "Scanner", IconScan],
    ["today", "Aujourd'hui", IconToday],
    ["pipeline", "Pipeline", IconBoard],
    ["bilan", "Bilan", IconStats],
    ["reglages", "Réglages", IconSettings],
  ];

  return (
    <>
      <nav className="top">
        <div className="logo"><i aria-hidden />Filon{profile.studio && <small>{profile.studio}</small>}</div>
        <div className="tabs">
          {NAV.map(([id, label]) => (
            <button key={id} className="tab" aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>
              {label}{id === "pipeline" && pipelineCount > 0 && <b>{pipelineCount}</b>}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {result?.demo && <span className="demo">Mode démo : données fictives</span>}
        {me?.user && (
          <span className={`sync ${sync}`} title={me.user.email}>
            {sync === "saving" ? "Enregistrement…" : sync === "error" ? "Non synchronisé" : sync === "loading" ? "Synchronisation…" : "Synchronisé"}
          </span>
        )}
      </nav>

      {view === "scan" && (
        <main>
          <form className="query" onSubmit={(e) => { e.preventDefault(); runScan(); }}>
            <span className="fixed">Trouver des</span>
            <span className="pick">
              <span aria-hidden>{(getTrade(tradeId) || TRADES[0]).label.toLowerCase()}</span>
              <select value={tradeId} onChange={(e) => setTradeId(e.target.value)} aria-label="Métier">
                {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label.toLowerCase()}</option>)}
              </select>
            </span>
            <span className="mark">{includeAll ? "à équiper," : includeOld ? "sans site, ou avec un site à refaire," : "sans site"}</span>
            <span className="fixed">à</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="ville" aria-label="Ville ou code postal" size={Math.max(6, city.length)} />
          </form>

          <div className="run">
            <button className="btn big" onClick={() => runScan()} disabled={loading || !city.trim()}>
              {loading ? (includeOld ? "Scan et analyse des sites…" : "Scan en cours…") : around.trim() ? "Scanner le quartier" : "Scanner la ville"}
            </button>
            <label className="switch">
              <input type="checkbox" checked={includeOld} onChange={(e) => setIncludeOld(e.target.checked)} />
              <span aria-hidden />
              Analyser les sites existants
            </label>
            <label className="switch">
              <input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />
              <span aria-hidden />
              Inclure les sites corrects (maintenance, print)
            </label>
            <label className="switch">
              <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
              <span aria-hidden />
              Scan complet de la ville
            </label>
            {error && <span className="error">{error}</span>}
          </div>
          <div className="around">
            <label className="around-field">
              <span>Autour de</span>
              <input value={around} onChange={(e) => setAround(e.target.value)} placeholder="une adresse, une place, un quartier (facultatif)" aria-label="Scanner autour d'une adresse" />
            </label>
            <select value={radius} onChange={(e) => setRadius(+e.target.value)} aria-label="Rayon" disabled={!around.trim()}>
              {[500, 1000, 2000, 5000].map((r) => <option key={r} value={r}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</option>)}
            </select>
            {live && <span className="cost">Coût : jusqu'à {scanCost} requêtes · {me?.mode === "comptes" ? "" : `il t'en reste ${Math.max(0, cap - usedToday)} aujourd'hui`}</span>}
          </div>
          {me?.google && me.mode === "simple" && (
            <p className="usage">
              {(() => {
                const m = localUsage.month === new Date().toISOString().slice(0, 7) ? localUsage.calls : 0;
                const t = localUsage.day === new Date().toISOString().slice(0, 10) ? localUsage.today : 0;
                return `${m} requête${m > 1 ? "s" : ""} Google ce mois-ci depuis cet appareil, dont ${t} aujourd'hui. Scan rapide : 1 à 3, scan complet : jusqu'à 27.`;
              })()}
            </p>
          )}
          {me?.usage && me.google && me.mode === "comptes" && (
            <p className="usage">
              {me.usage.limit != null
                ? `${me.usage.used} / ${me.usage.limit} requêtes Google ce mois-ci`
                : `${me.usage.used} requête${me.usage.used > 1 ? "s" : ""} Google ce mois-ci`}
              {` · ${me.usage.today} / ${me.usage.dailyLimit} aujourd'hui. Scan rapide : 1 à 3, scan complet : jusqu'à 27.`}
            </p>
          )}
          {ready && !profile.firstName && (
            <div className="onboard">
              <div>
                <b>Bienvenue sur Filon</b>
                <p>Renseigne ton prénom et ton studio : ils signent tes e-mails, tes scripts et tes rapports d'audit.</p>
              </div>
              <div className="onboard-fields">
                <input aria-label="Prénom" placeholder="Prénom" id="ob-first" />
                <input aria-label="Studio" placeholder="Studio ou entreprise" id="ob-studio" />
                <button className="btn small" onClick={() => {
                  const f = (document.getElementById("ob-first") as HTMLInputElement).value.trim();
                  const st = (document.getElementById("ob-studio") as HTMLInputElement).value.trim();
                  if (f) setProfile({ ...profile, firstName: f, studio: st });
                }}>Enregistrer</button>
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="recent">
              <span className="hint">Récents</span>
              {recent.map((r) => (
                <button key={r.city + r.tradeId} className="chip" onClick={() => { setCity(r.city); setTradeId(r.tradeId); runScan(r.city, r.tradeId); }} disabled={loading}>
                  {getTrade(r.tradeId)?.label} · {r.city}
                </button>
              ))}
            </div>
          )}

          {result && (
            <section className="results">
              <div className="headline">
                <span className="n">{result.leads.length}</span>
                <div>
                  <p className="big">prospects pour {trade.label.toLowerCase()} à {result.city.name}</p>
                  {result.city.zone && <p className="hint">Zone : {result.city.zone}</p>}
                  {regProgress && <p className="hint">Recherche des dates de création dans le registre : {regProgress.done} / {regProgress.total}</p>}
                  <p>
                    {result.scanned} fiches Google analysées{result.audited ? `, dont ${result.audited} sites passés au crible` : ""}.
                    {result.withSite > 0 && ` ${result.withSite} ont un site correct et sont écartées.`}
                    {!result.demo && ` ${result.calls} requête${result.calls > 1 ? "s" : ""} Google.`}
                  </p>
                </div>
              </div>

              <div className="segments" role="tablist" aria-label="Type de prospect">
                {(["all", "aucun", "reseaux", "vieux", "equipe"] as const).filter((k) => k === "all" || counts[k] > 0).map((k) => (
                  <button key={k} role="tab" aria-selected={kind === k} className={`seg ${k}`} onClick={() => setKind(k)}>
                    {k === "all" ? "Tous" : PRESENCE_LABEL[k]} <b>{counts[k]}</b>
                  </button>
                ))}
              </div>

              <div className="filters">
                <label>Note min.{" "}
                  <select value={minRating} onChange={(e) => setMinRating(+e.target.value)}>
                    {[0, 3.5, 4, 4.5].map((v) => <option key={v} value={v}>{v ? `${String(v).replace(".", ",")}+` : "Toutes"}</option>)}
                  </select>
                </label>
                <label>Avis min.{" "}
                  <select value={minReviews} onChange={(e) => setMinReviews(+e.target.value)}>
                    {[0, 5, 10, 30, 100].map((v) => <option key={v} value={v}>{v ? `${v}+` : "Tous"}</option>)}
                  </select>
                </label>
                {wpCount > 0 && (
                  <label className="switch small">
                    <input type="checkbox" checked={wpOnly} onChange={(e) => setWpOnly(e.target.checked)} />
                    <span aria-hidden />
                    Sites WordPress seulement ({wpCount})
                  </label>
                )}
                <span style={{ flex: 1 }} />
                <button className="btn ghost small" onClick={() => addMany(shown.map((l) => l.id))} disabled={!shown.length}>Tout ajouter au pipeline</button>
                <button className="btn ghost small" onClick={exportScan} disabled={!shown.length}>CSV</button>
                <div className="toggle-view" role="group" aria-label="Affichage">
                  <button aria-pressed={mobileView === "list"} onClick={() => setMobileView("list")}><IconList /> Liste</button>
                  <button aria-pressed={mobileView === "map"} onClick={() => setMobileView("map")}><IconMap /> Carte</button>
                </div>
              </div>

              <div className="split" data-mobile={mobileView}>
                <MapView leads={shown} center={[result.city.lat, result.city.lng]} activeId={openId || undefined} onSelect={setOpenId} />
                <div className="list-col">
                  {shown.length ? (
                    <ul className="list">
                      {shown.map((l) => {
                        const inPipe = pipeline[l.id];
                        const isSel = selected.includes(l.id);
                        return (
                          <li key={l.id} className="row" data-active={openId === l.id} data-kind={l.presence}>
                            <label className="sel" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={isSel} onChange={() => toggle(l.id)} aria-label={`Sélectionner ${l.name} pour la tournée`} />
                            </label>
                            <button className="row-main" onClick={() => setOpenId(l.id)}>
                              <Score value={l.score} />
                              <div className="row-text">
                                <h3>{l.name}</h3>
                                <div className="meta">
                                  <span>{l.address.replace(/, France$/, "")}</span>
                                  {l.rating && <span>{String(l.rating).replace(".", ",")} ★ ({l.reviews})</span>}
                                </div>
                                {l.audit && l.audit.issues.length > 0 && <div className="issues">{l.audit.issues.slice(0, 3).join(" · ")}</div>}
                                <div className="needs-line">
                                  {(() => { const st = siteStatus(l); return <span className={`cms ${st.kind}`}>{st.label}</span>; })()}
                                  {activity(l.created) && <span className="since">{activity(l.created)!.label}</span>}
                                  {detectNeeds(l).filter((n) => n.priority <= 2).slice(0, 3).map((n) => (
                                    <span key={n.key} className="need-chip">{n.title.length > 42 ? n.title.slice(0, 40) + "…" : n.title}</span>
                                  ))}
                                </div>
                              </div>
                            </button>
                            <div className="side">
                              <span className={`tag ${l.presence}`}>{PRESENCE_LABEL[l.presence]}</span>
                              {inPipe ? (
                                <span className="tag in">Suivi</span>
                              ) : (
                                <button className="btn ghost small" onClick={() => updatePipeline(l.id, { stage: "a_contacter" })}>Ajouter</button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="list empty">
                      <strong>Aucune entreprise avec ces filtres</strong>
                      Baisse la note ou le nombre d'avis minimum, ou lance un scan complet.
                    </div>
                  )}
                  <p className="attrib">Données des entreprises : Google. Analyse des sites : Filon.</p>
                </div>
              </div>
            </section>
          )}

          {!result && !loading && (
            <section className="results">
              <div className="intro">
                <div><b>1</b><p>Choisis un métier et une ville.</p></div>
                <div><b>2</b><p>Filon trouve les entreprises sans site, ou dont le site est dépassé.</p></div>
                <div><b>3</b><p>Pour chacune, un plan d'approche : quel canal, quand, quel angle, quels arguments.</p></div>
              </div>
            </section>
          )}

          {selected.length > 0 && (
            <div className="selbar" role="region" aria-label="Sélection">
              <span><b>{selected.length}</b> sélectionnée{selected.length > 1 ? "s" : ""}{selected.length >= 10 ? " (maximum)" : ""}</span>
              <a className="btn small" href={routeUrl(selLeads)} target="_blank" rel="noreferrer"><IconRoute /> Itinéraire de visite</a>
              <button className="btn ghost small" onClick={() => { addMany(selected); setSelected([]); }}>Ajouter au pipeline</button>
              <button className="btn ghost small" onClick={() => setSelected([])}>Vider</button>
            </div>
          )}
        </main>
      )}

      {view === "today" && <Today leads={leads} pipeline={pipeline} profile={profile} onOpen={setOpenId} routeUrl={routeUrl} />}

      {view === "pipeline" && (
        <Board leads={leads} pipeline={pipeline} onOpen={setOpenId} onMove={(id, stage) => updatePipeline(id, { stage })} routeUrl={routeUrl} />
      )}

      {view === "bilan" && <Dashboard leads={leads} pipeline={pipeline} prices={profile.prices || {}} onOpen={setOpenId} />}

      {view === "reglages" && (
        <main className="settings">
          <h1>Réglages</h1>
          <p>Ces infos signent tes e-mails, tes scripts et tes rapports d'audit, et nourrissent le plan d'approche.</p>
          <div className="row2">
            <label className="field">Prénom<input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></label>
            <label className="field">Studio<input value={profile.studio} onChange={(e) => setProfile({ ...profile, studio: e.target.value })} /></label>
            <label className="field">Téléphone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
            <label className="field">E-mail<input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
            <label className="field">Site<input value={profile.site} onChange={(e) => setProfile({ ...profile, site: e.target.value })} /></label>
            <label className="field">Prix annoncé (facultatif)<input value={profile.price} placeholder="ex. 890 € puis 39 €/mois" onChange={(e) => setProfile({ ...profile, price: e.target.value })} /></label>
          </div>
          <label className="field">Lien vers tes réalisations<input value={profile.portfolio || ""} placeholder="ex. thot-studio.fr/realisations" onChange={(e) => setProfile({ ...profile, portfolio: e.target.value })} /></label>
          <h2 className="set-h">Rester dans le gratuit</h2>
          <div className="set-block">
            <label className="price-row" style={{ borderBottom: 0 }}>
              <span>Plafond de requêtes Google par jour<small>30 par jour = 930 par mois au plus, sous les 1 000 gratuites</small></span>
              <input type="number" min="1" step="1" value={cap} onChange={(e) => setProfile({ ...profile, dailyCap: Math.max(1, Number(e.target.value) || 30) })} />
            </label>
            <p className="hint">Filon refuse un scan qui ferait dépasser ce plafond. Garde le même chiffre dans les quotas de Google Cloud.</p>
          </div>

          <h2 className="set-h">Tes garanties et références</h2>
          <p className="hint" style={{ marginTop: -4 }}>Utilisées dans l'argumentaire de chaque fiche. N'écris que ce que tu offres vraiment.</p>
          <label className="field">Tes garanties (une par ligne)
            <textarea value={profile.guarantees || ""} onChange={(e) => setProfile({ ...profile, guarantees: e.target.value })} placeholder={"Sans engagement de durée\nRetouches jusqu'à validation\nInterlocuteur unique, du premier rendez-vous à la mise en ligne"} />
          </label>
          <label className="field">Clients de référence (un par ligne, avec leur accord)
            <textarea value={profile.references || ""} onChange={(e) => setProfile({ ...profile, references: e.target.value })} placeholder={"Nom du client, ville"} />
          </label>

          <h2 className="set-h">Tes tarifs</h2>
          <p className="hint" style={{ marginTop: -4 }}>Prix de départ HT. Laisse vide ce que tu fais sur devis : ils servent à chiffrer les propositions.</p>
          <div className="prices">
            {SERVICES.map((sv) => (
              <label key={sv.id} className="price-row">
                <span>{sv.label}<small>{sv.family}</small></span>
                <input
                  type="number" inputMode="numeric" min="0" step="10" placeholder="Sur devis"
                  value={profile.prices?.[sv.id] ?? ""}
                  onChange={(e) => {
                    const prices = { ...(profile.prices || {}) };
                    if (e.target.value === "") delete prices[sv.id];
                    else prices[sv.id] = Number(e.target.value);
                    setProfile({ ...profile, prices });
                  }}
                />
              </label>
            ))}
          </div>
          <label className="field">Ce que tu proposes ensuite (abonnement, suivi…)<textarea value={profile.offer} onChange={(e) => setProfile({ ...profile, offer: e.target.value })} /></label>
          <h2 className="set-h">Compte</h2>
          {me?.mode === "comptes" && me.user ? (
            <div className="set-block">
              <p>Connecté en tant que <b>{me.user.email}</b>{me.user.role === "admin" ? " (administrateur)" : ""}. Ton pipeline et tes réglages sont synchronisés sur tous tes appareils.</p>
              <div className="actions">
                {me.user.role === "admin" && <button className="btn small" onClick={newInvite}>Inviter quelqu'un</button>}
                <button className="btn ghost small" onClick={logout}>Se déconnecter</button>
              </div>
              {invite && (
                <div className="invite">
                  <p className="hint">Lien d'invitation valable 30 jours, utilisable une fois :</p>
                  <input readOnly value={invite} onFocus={(e) => e.target.select()} aria-label="Lien d'invitation" />
                </div>
              )}
            </div>
          ) : (
            <div className="set-block">
              <p>Filon fonctionne en mode simple : un mot de passe unique, et tes données restent dans ce navigateur.</p>
              <p className="hint">Pour avoir des comptes et retrouver ton pipeline sur téléphone et ordinateur, branche une base Redis gratuite au projet dans Vercel (Storage). Les comptes s'activent tout seuls.</p>
            </div>
          )}

          <h2 className="set-h">Sauvegarde</h2>
          <div className="set-block">
            <p>Télécharge ton pipeline, tes notes et tes réglages, ou restaure une sauvegarde.</p>
            <div className="actions">
              <button className="btn ghost small" onClick={exportAll}>Télécharger une sauvegarde</button>
              <label className="btn ghost small" style={{ cursor: "pointer" }}>
                Importer une sauvegarde
                <input type="file" accept="application/json" hidden onChange={(e) => importAll(e.target.files?.[0])} />
              </label>
            </div>
            {importMsg && <p className="hint">{importMsg}</p>}
          </div>

          {confirmReset ? (
            <div className="actions">
              <span className="error">Tout effacer de ce navigateur ?</span>
              <button className="btn small" onClick={() => { setLeads({}); setPipeline({}); setResult(null); setRecent([]); setConfirmReset(false); }}>Oui, effacer</button>
              <button className="btn ghost small" onClick={() => setConfirmReset(false)}>Annuler</button>
            </div>
          ) : (
            <button className="btn ghost small" onClick={() => setConfirmReset(true)}>Effacer les données de ce navigateur</button>
          )}
        </main>
      )}

      <nav className="bottom-nav" aria-label="Navigation">
        {NAV.map(([id, label, Icon]) => (
          <button key={id} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>
            <Icon />
            <span>{label}</span>
            {id === "pipeline" && pipelineCount > 0 && <b>{pipelineCount}</b>}
          </button>
        ))}
      </nav>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          profile={profile}
          entry={pipeline[openLead.id]}
          onClose={() => setOpenId(null)}
          onPipeline={(patch) => updatePipeline(openLead.id, patch)}
          canSpend={canSpend}
          onSpend={spend}
        />
      )}
    </>
  );
}
