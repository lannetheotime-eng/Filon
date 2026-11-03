"use client";
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { TRADES, ART_TRADES, getTrade } from "../lib/trades";
import { artFit, isArt, priceText, seriesFor } from "../lib/art";
import type { Lead, PipelineEntry, Profile, ScanResult, Stage, WebPresence } from "../lib/types";
import { DEFAULT_PROFILE, PRESENCE_LABEL, STAGES, FINAL_MAIL } from "../lib/types";
import { usePersistent, toCsv, download } from "../lib/store";
import { mergeData, toSync, type SyncData } from "../lib/sync";
import { detectNeeds, SERVICES, upcomingMoments } from "../lib/needs";
import { activity, rowStatus } from "../lib/site";
import LeadDrawer from "../components/LeadDrawer";
import Board from "../components/Board";
import Dashboard from "../components/Dashboard";
import Today from "../components/Today";
import Palette, { type PaletteItem } from "../components/Palette";
import Toast from "../components/Toast";
import { IconToday, IconScan, IconBoard, IconStats, IconSettings, IconRoute, IconMap, IconList } from "../components/Icons";

const MapView = dynamic(() => import("../components/MapView"), { ssr: false, loading: () => <div className="map" /> });

type View = "scan" | "today" | "pipeline" | "bilan" | "reglages";
type Recent = { city: string; tradeId: string; at: string };
type Usage = { used: number; limit: number | null; today: number; dailyLimit: number };
type Me = { mode: "simple" | "comptes"; user: { email: string; role: "admin" | "user" } | null; usage: Usage | null; google: boolean };

// Itinéraire Google Maps : départ depuis la position actuelle, jusqu'à 10 arrêts
function routeUrl(stops: Lead[]) {
  const s = stops.slice(0, 10).map((l) => encodeURIComponent(l.address));
  const dest = s[s.length - 1];
  const way = s.slice(0, -1).join("%7C");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${way ? `&waypoints=${way}` : ""}&travelmode=driving`;
}

export default function Home() {
  const [view, setView] = useState<View>("scan");
  const [mode, setMode] = usePersistent<"sites" | "tableaux">("filon.mode", "sites");
  const [siteTrade, setSiteTrade] = usePersistent("filon.trade", "boulangerie");
  const [artTrade, setArtTrade] = usePersistent("filon.artTrade", "art-deco");
  const tradeId = mode === "tableaux" ? artTrade : siteTrade;
  const setTradeId = (id: string) => { if (isArt(id)) { setMode("tableaux"); setArtTrade(id); } else { setMode("sites"); setSiteTrade(id); } };
  const LIST = mode === "tableaux" ? ART_TRADES.filter((t) => !t.hidden) : TRADES;
  const [artKind, setArtKind] = useState<"all" | "fit" | "insta">("all");
  const [city, setCity] = usePersistent("filon.city", "Toulouse");
  const [deep, setDeep] = usePersistent("filon.deep", false);
  const [includeOld, setIncludeOld] = usePersistent("filon.old", true);
  const [includeAll, setIncludeAll] = usePersistent("filon.all", false);
  const [wpOnly, setWpOnly] = useState(false);
  const [around, setAround] = useState("");
  const [byName, setByName] = useState(false);
  const [bizName, setBizName] = useState("");
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
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((m: string) => setToast(m), []);
  const [step, setStep] = useState(0);

  // ⌘K / Ctrl+K : palette de commandes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Suivi des e-mails envoyés depuis Filon : statut mis à jour à l'ouverture (30 derniers jours)
  const mailsChecked = useRef(false);
  const [mailOn, setMailOn] = useState<{ enabled: boolean; from: string | null } | null>(null);
  useEffect(() => { fetch("/api/mail/send").then((r) => r.json()).then(setMailOn).catch(() => setMailOn({ enabled: false, from: null })); }, []);
  useEffect(() => {
    if (!ready || mailsChecked.current) return;
    mailsChecked.current = true;
    const limit = new Date(Date.now() - 30 * 864e5).toISOString();
    const todo = Object.entries(pipeline).flatMap(([lid, e]) => (e.mails || []).filter((m) => m.at > limit && !FINAL_MAIL.includes(m.status || "")).map((m) => ({ lid, id: m.id })));
    if (!todo.length) return;
    (async () => {
      for (let i = 0; i < todo.length; i += 20) {
        const chunk = todo.slice(i, i + 20);
        const j = await fetch(`/api/mail/status?ids=${chunk.map((x) => x.id).join(",")}`).then((r) => r.json()).catch(() => null);
        if (!j?.statuses) return;
        const now = new Date().toISOString();
        setPipeline((prev) => {
          const next = { ...prev };
          let hot = 0;
          for (const { lid, id } of chunk) {
            const st = j.statuses[id];
            const e = next[lid];
            if (!st || !e?.mails) continue;
            const old = e.mails.find((m) => m.id === id)?.status;
            if (old === st) continue;
            if (st === "clicked") hot++;
            const log = [...(e.log || []), { at: now, text: `E-mail : ${st === "clicked" ? "a cliqué sur un lien" : st === "delivered" ? "bien reçu" : st === "bounced" ? "adresse invalide" : st}` }].slice(-40);
            next[lid] = { ...e, mails: e.mails.map((m) => (m.id === id ? { ...m, status: st, checkedAt: now } : m)), log, updatedAt: now };
          }
          if (hot) setTimeout(() => notify(`${hot} prospect${hot > 1 ? "s ont" : " a"} cliqué sur un lien de ton e-mail`), 0);
          return next;
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
  const scanCost = byName ? 1 : deep && !around.trim() ? 27 : 3;
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
    setStep(0);
    const tick = setInterval(() => setStep((x) => Math.min(x + 1, 3)), 1800);
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: byName ? bizName.trim() : undefined, city: c, tradeId: t, deep, includeOld: includeOld || isArt(t), includeAll: includeAll || isArt(t), around: around.trim() || undefined, radius }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.usage) setMe((m) => (m ? { ...m, usage: j.usage } : m));
      if (!j.demo && j.calls) spend(j.calls);
      enrichRegistry(j.leads as Lead[]);
      setResult(j);
      setKind("all");
      setArtKind("all");
      setLeads((prev) => {
        const next = { ...prev };
        for (const l of j.leads as Lead[]) next[l.id] = l;
        return next;
      });
      if (!(byName && bizName.trim())) setRecent((prev) => [{ city: j.city.name, tradeId: t, at: new Date().toISOString() }, ...prev.filter((x) => !(x.city === j.city.name && x.tradeId === t))].slice(0, 6));
    } catch (e: any) {
      setError(e.message || "Le scan a échoué.");
    } finally {
      clearInterval(tick);
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, aucun: 0, reseaux: 0, vieux: 0, equipe: 0 } as Record<WebPresence | "all", number>;
    for (const l of result?.leads || []) { c.all++; c[l.presence]++; }
    return c;
  }, [result]);

  const artMode = !!result && isArt(result.tradeId);
  const fits = useMemo(() => Object.fromEntries((result?.leads || []).map((l) => [l.id, artFit(l)])), [result]);
  const shown = useMemo(() => {
    if (!result) return [];
    if (isArt(result.tradeId))
      return result.leads
        .filter((l) => (l.rating || 0) >= minRating && (l.reviews || 0) >= minReviews && (artKind === "all" || (artKind === "fit" ? fits[l.id]?.universe : fits[l.id]?.insta)))
        .sort((a, b) => (fits[b.id]?.score || 0) - (fits[a.id]?.score || 0));
    return result.leads.filter(
      (l) =>
        (l.rating || 0) >= minRating &&
        (l.reviews || 0) >= minReviews &&
        (kind === "all" || l.presence === kind) &&
        (!wpOnly || l.audit?.cms === "WordPress" || !l.website)
    );
  }, [result, minRating, minReviews, kind, wpOnly, artKind, fits]);
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
    const n = ids.filter((id) => !pipeline[id]).length;
    for (const id of ids) if (!pipeline[id]) updatePipeline(id, { stage: "a_contacter" });
    if (n) notify(`${n} entreprise${n > 1 ? "s ajoutées" : " ajoutée"} au pipeline`);
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

  const paletteItems: PaletteItem[] = [
    ...([["scan", "Chercher des clients"], ["today", "Aujourd'hui"], ["pipeline", "Pipeline"], ["bilan", "Bilan"], ["reglages", "Réglages"]] as [View, string][]).map(([v, label]) => ({
      id: `v-${v}`, group: "Aller à", label, run: () => setView(v),
    })),
    ...[...TRADES, ...ART_TRADES.filter((t) => !t.hidden)].map((t) => ({
      id: `t-${t.id}`, group: t.art ? "Chercher des lieux pour tes tableaux" : "Chercher des clients", label: `${t.label} à ${city || "…"}`, hint: "1 à 3 requêtes",
      run: () => { setView("scan"); setTradeId(t.id); runScan(city, t.id); },
    })),
    ...Object.keys(pipeline).filter((id) => leads[id]).map((id) => ({
      id: `p-${id}`, group: "Ton pipeline", label: leads[id].name, hint: `${leads[id].city} · ${STAGES.find((x) => x.id === pipeline[id].stage)?.label}`,
      run: () => setOpenId(id),
    })),
    ...(result?.leads || []).filter((l) => !pipeline[l.id]).map((l) => ({
      id: `r-${l.id}`, group: "Dernière recherche", label: l.name, hint: rowStatus(l).label, run: () => { setView("scan"); setOpenId(l.id); },
    })),
    { id: "a-name", group: "Actions", label: "Chercher une entreprise précise par son nom", hint: "1 requête", run: () => { setView("scan"); setByName(true); } },
    { id: "a-save", group: "Actions", label: "Télécharger une sauvegarde", run: exportAll },
    { id: "a-prices", group: "Actions", label: "Régler mes tarifs", run: () => setView("reglages") },
  ];

  const NAV: [View, string, () => React.ReactElement][] = [
    ["scan", "Chercher", IconScan],
    ["today", "Aujourd'hui", IconToday],
    ["pipeline", "Pipeline", IconBoard],
    ["bilan", "Bilan", IconStats],
    ["reglages", "Réglages", IconSettings],
  ];

  return (
    <>
      <header className="top">
        <div className="logo"><i aria-hidden />Filon{profile.studio && <small>{profile.studio}</small>}</div>
        <button className="cmdk" onClick={() => setPalette(true)} aria-label="Ouvrir la palette de commandes">
          <span>Rechercher, ouvrir, lancer…</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="top-right">
          {result?.demo && <span className="demo">Démo</span>}
          {me?.user && (
            <span className={`sync ${sync}`} title={me.user.email}>
              {sync === "saving" ? "Enregistrement…" : sync === "error" ? "Hors ligne" : sync === "loading" ? "Synchro…" : "Synchronisé"}
            </span>
          )}
          {profile.firstName && <span className="avatar" title={profile.firstName}>{profile.firstName.slice(0, 1).toUpperCase()}</span>}
        </div>
      </header>

      {view === "scan" && (
        <main className="find">
          <div className="mode" role="tablist" aria-label="Ce que tu prospectes">
            <button role="tab" aria-selected={mode === "sites"} onClick={() => setMode("sites")}>Sites et print</button>
            <button role="tab" aria-selected={mode === "tableaux"} onClick={() => setMode("tableaux")}>Tableaux</button>
          </div>
          <form className={`searchbar ${byName ? "by-name" : ""}`} onSubmit={(e) => { e.preventDefault(); runScan(); }}>
            {byName && (
              <label className="sb-field grow">
                <span>Nom de l'entreprise</span>
                <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="ex. Cabinet VPA" autoFocus />
              </label>
            )}
            <label className="sb-field">
              <span>{mode === "tableaux" ? "Lieu" : "Métier"}</span>
              <select value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
                {LIST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="sb-field grow">
              <span>Ville</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville ou code postal" />
            </label>
            <button className="btn sb-go" type="submit" disabled={loading || !city.trim() || (byName && !bizName.trim())}>
              {loading ? "Recherche…" : "Chercher"}
            </button>
          </form>

          <div className="sb-under">
            <button type="button" className={`chip by-name-chip ${byName ? "on" : ""}`} onClick={() => setByName((v) => !v)} aria-pressed={byName}>
              {byName ? "← Recherche par métier" : "Une entreprise précise"}
            </button>
            {mode === "sites" && !byName && <div className="target" role="radiogroup" aria-label="Qui chercher">
              {([
                ["sans", "Sans site"],
                ["refaire", "+ sites à refaire"],
                ["toutes", "Toutes"],
              ] as const).map(([id, label]) => {
                const on = (id === "sans" && !includeOld && !includeAll) || (id === "refaire" && includeOld && !includeAll) || (id === "toutes" && includeAll);
                return (
                  <button key={id} type="button" role="radio" aria-checked={on} className={on ? "on" : ""}
                    onClick={() => { setIncludeOld(id !== "sans"); setIncludeAll(id === "toutes"); }}>
                    {label}
                  </button>
                );
              })}
            </div>}
            {!byName && <details className="opts">
              <summary>Options{around.trim() || deep ? " ·" : ""}{around.trim() ? " quartier" : ""}{deep ? " ville entière" : ""}</summary>
              <div className="opts-body">
                <label className="field">Autour d'une adresse (facultatif)
                  <input value={around} onChange={(e) => setAround(e.target.value)} placeholder="ex. place du Capitole" />
                </label>
                <label className="field">Rayon
                  <select value={radius} onChange={(e) => setRadius(+e.target.value)} disabled={!around.trim()}>
                    {[500, 1000, 2000, 5000].map((r) => <option key={r} value={r}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</option>)}
                  </select>
                </label>
                <label className="switch small">
                  <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} disabled={!!around.trim()} />
                  <span aria-hidden />
                  Toute la ville (jusqu'à 27 requêtes)
                </label>
              </div>
            </details>}
            {live && <span className="cost">{scanCost === 1 ? "1 requête" : scanCost <= 3 ? "1 à 3 requêtes" : `jusqu'à ${scanCost} requêtes`} · {me?.mode === "comptes" && me.usage ? `${me.usage.today}/${me.usage.dailyLimit} aujourd'hui` : `${Math.max(0, cap - usedToday)} restantes aujourd'hui`}</span>}
          </div>
          {error && <p className="error find-err">{error}</p>}

          {ready && !profile.firstName && (
            <div className="onboard">
              <div>
                <b>Bienvenue sur Filon</b>
                <p>Ton prénom et ton studio signent tes e-mails, tes scripts et tes rapports.</p>
              </div>
              <div className="onboard-fields">
                <input aria-label="Prénom" placeholder="Prénom" id="ob-first" />
                <input aria-label="Studio" placeholder="Studio" id="ob-studio" />
                <button className="btn small" onClick={() => {
                  const f = (document.getElementById("ob-first") as HTMLInputElement).value.trim();
                  const st = (document.getElementById("ob-studio") as HTMLInputElement).value.trim();
                  if (f) setProfile({ ...profile, firstName: f, studio: st });
                }}>Enregistrer</button>
              </div>
            </div>
          )}

          {loading && (
            <section className="loading">
              <div className="steps">
                {(mode === "tableaux" ? ["Recherche sur Google", "Repérage des lieux", "Identité et fréquentation", "Presque prêt"] : ["Recherche sur Google", "Analyse des sites", "Repérage des besoins", "Presque prêt"]).map((t, k) => (
                  <span key={t} className={k < step ? "done" : k === step ? "now" : ""}>{t}</span>
                ))}
              </div>
              <ul className="list skel">{Array.from({ length: 6 }).map((_, k) => <li key={k} className="row"><span /><span /><span /></li>)}</ul>
            </section>
          )}

          {!result && !loading && (
            <section className="empty-start">
              {mode === "tableaux" ? (
                <>
                  <h1>Mets tes affiches sur les <span>bons murs</span>.</h1>
                  <p>Un type de lieu, une ville. Filon repère ceux qui ont l'œil pour la déco, te dit quelle série apporter et comment vendre ta pièce.</p>
                  {!profile.art?.priceFrom && <p className="hint">Pense à renseigner ton Instagram et tes prix dans Réglages › Tes tableaux : ils sont repris dans tes messages.</p>}
                </>
              ) : (
                <>
                  <h1>Trouve tes prochains <span>clients</span>.</h1>
                  <p>Un métier, une ville. Filon repère qui a besoin de toi et te dit comment l'approcher.</p>
                </>
              )}
              <div className="quick-trades">
                {(mode === "tableaux" ? ART_TRADES.filter((t) => !t.hidden).map((t) => t.id).slice(0, 10) : ["boulangerie", "coiffeur", "restaurant", "garage", "plombier", "avocat", "fleuriste", "beaute"]).map((id) => (
                  <button key={id} className={`qt ${tradeId === id ? "on" : ""}`} onClick={() => setTradeId(id)}>{getTrade(id)?.label}</button>
                ))}
              </div>
              {recent.length > 0 && (
                <div className="recent">
                  {recent.filter((r) => isArt(r.tradeId) === (mode === "tableaux")).map((r) => (
                    <button key={r.city + r.tradeId} className="chip" onClick={() => { setCity(r.city); setTradeId(r.tradeId); runScan(r.city, r.tradeId); }} disabled={loading}>
                      {getTrade(r.tradeId)?.label} · {r.city}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {result && !loading && (
            <section className="results">
              <div className="res-head">
                <h1><b>{result.leads.length}</b> {result.city.zone?.startsWith("Recherche") ? `résultat${result.leads.length > 1 ? "s" : ""} à ${result.city.name}` : `${trade.label.toLowerCase()} à ${result.city.name}`}</h1>
                {artMode && <p className="eyebrow">Lieux pour tes tableaux · vente directe{priceText(profile) ? ` · ${priceText(profile)}` : ""}</p>}
                <p className="hint">
                  {result.city.zone ? `${result.city.zone} · ` : ""}{result.scanned} fiches analysées
                  {regProgress ? ` · ancienneté ${regProgress.done}/${regProgress.total}` : ""}
                </p>
              </div>

              {(() => {
                const m = upcomingMoments(result.tradeId)[0];
                return m ? (
                  <div className="moment">
                    <b>{m.m.name.charAt(0).toUpperCase() + m.m.name.slice(1)} dans {m.days} jours</b> : bon prétexte pour proposer {m.m.pitch} à toutes ces entreprises.
                  </div>
                ) : null;
              })()}

              <div className="res-bar">
                <div className="segments" role="tablist" aria-label="Type de prospect">
                  {artMode && ([["all", "Tous", result.leads.length], ["fit", "Forte identité", result.leads.filter((l) => fits[l.id]?.universe).length], ["insta", "Sur Instagram", result.leads.filter((l) => fits[l.id]?.insta).length]] as const).filter(([k, , n]) => k === "all" || n > 0).map(([k, label, n]) => (
                    <button key={k} role="tab" aria-selected={artKind === k} className="seg" onClick={() => setArtKind(k)}>{label} <b>{n}</b></button>
                  ))}
                  {!artMode && (["all", "aucun", "reseaux", "vieux", "equipe"] as const).filter((k) => k === "all" || counts[k] > 0).map((k) => (
                    <button key={k} role="tab" aria-selected={kind === k} className={`seg ${k}`} onClick={() => setKind(k)}>
                      {k === "all" ? "Tous" : PRESENCE_LABEL[k]} <b>{counts[k]}</b>
                    </button>
                  ))}
                </div>
                <div className="res-tools">
                  <div className="toggle-view" role="group" aria-label="Affichage">
                    <button aria-pressed={mobileView === "list"} onClick={() => setMobileView("list")}><IconList /> Liste</button>
                    <button aria-pressed={mobileView === "map"} onClick={() => setMobileView("map")}><IconMap /> Carte</button>
                  </div>
                  <details className="more">
                    <summary className="btn ghost small">Filtres et actions</summary>
                    <div className="more-menu wide">
                      <label>Note minimum
                        <select value={minRating} onChange={(e) => setMinRating(+e.target.value)}>
                          {[0, 3.5, 4, 4.5].map((v) => <option key={v} value={v}>{v ? `${String(v).replace(".", ",")}+` : "Toutes"}</option>)}
                        </select>
                      </label>
                      <label>Avis minimum
                        <select value={minReviews} onChange={(e) => setMinReviews(+e.target.value)}>
                          {[0, 5, 10, 30, 100].map((v) => <option key={v} value={v}>{v ? `${v}+` : "Tous"}</option>)}
                        </select>
                      </label>
                      {wpCount > 0 && (
                        <label className="switch small">
                          <input type="checkbox" checked={wpOnly} onChange={(e) => setWpOnly(e.target.checked)} />
                          <span aria-hidden />
                          WordPress seulement ({wpCount})
                        </label>
                      )}
                      <button onClick={() => addMany(shown.map((l) => l.id))} disabled={!shown.length}>Tout ajouter au pipeline</button>
                      <button onClick={() => { exportScan(); notify("Export CSV téléchargé"); }} disabled={!shown.length}>Exporter en CSV</button>
                    </div>
                  </details>
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
                        const rs = rowStatus(l);
                        const act = activity(l.created);
                        const fit = artMode ? fits[l.id] : null;
                        const top = artMode ? null : detectNeeds(l).find((n) => n.priority === 1 && !n.deadline) || detectNeeds(l).find((n) => !n.deadline && n.priority === 2);
                        return (
                          <li key={l.id} className="row" data-active={openId === l.id} data-kind={l.presence}>
                            <label className="sel" title="Ajouter à la tournée" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={isSel} onChange={() => toggle(l.id)} aria-label={`Ajouter ${l.name} à la tournée`} />
                            </label>
                            <button className="row-main" onClick={() => setOpenId(l.id)}>
                              <span className={`mono ${fit ? (fit.universe ? "none" : fit.insta ? "social" : "ok") : rs.tone}`} aria-hidden>{l.name.replace(/^(boulangerie|salon de coiffure|salon de tatouage|garage|restaurant japonais|restaurant asiatique|restaurant|boucherie|fleuriste|institut|bar à jeux|bar|café|concept store|boutique de déco|boutique manga|galerie|barber shop|hôtel|disquaire)\s+(de la |du |des |de |d')?/i, "").slice(0, 1).toUpperCase()}</span>
                              <div className="row-text">
                                <h3>{l.name}</h3>
                                <div className="meta">
                                  {fit ? <span className={`pill ${fit.universe ? "none" : fit.insta ? "social" : "ok"}`}>{fit.universe ? "Forte identité" : fit.insta ? "Instagram" : "À démarcher"}</span> : <span className={`pill ${rs.tone}`}>{rs.label}</span>}
                                  {l.rating ? <span>{String(l.rating).replace(".", ",")} ★ ({l.reviews})</span> : null}
                                  {act && <span>depuis {act.since}</span>}
                                </div>
                                {top && <div className="next">→ {top.title}</div>}
                                {fit && <div className="next">→ Apporte : {seriesFor(l.tradeId)[0].name}</div>}
                              </div>
                            </button>
                            <div className="side">
                              {inPipe ? (
                                <span className="tag in">Suivi</span>
                              ) : (
                                <button className="add" onClick={() => { updatePipeline(l.id, { stage: "a_contacter" }); notify(`${l.name} ajoutée au pipeline`); }} aria-label={`Ajouter ${l.name} au pipeline`}>+</button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="list empty">
                      <strong>Aucune entreprise avec ces filtres</strong>
                      Assouplis les filtres, ou cherche « Toutes ».
                    </div>
                  )}
                  <p className="attrib">Données des entreprises : Google. Analyse des sites : Filon.</p>
                </div>
              </div>
            </section>
          )}

          {selected.length > 0 && (
            <div className="selbar" role="region" aria-label="Tournée">
              <span><b>{selected.length}</b> dans la tournée{selected.length >= 10 ? " (max.)" : ""}</span>
              <a className="btn small" href={routeUrl(selLeads)} target="_blank" rel="noreferrer"><IconRoute /> Itinéraire</a>
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

          <details className="set-sec" open>
            <summary>Ton profil</summary>
            <p className="hint">Il signe tes e-mails, tes scripts et tes rapports d'audit.</p>
            <div className="row2">
              <label className="field">Prénom<input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></label>
              <label className="field">Studio<input value={profile.studio} onChange={(e) => setProfile({ ...profile, studio: e.target.value })} /></label>
              <label className="field">Téléphone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
              <label className="field">E-mail<input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
              <label className="field">Envoyer depuis Gmail (ton adresse Gmail)<input type="email" value={profile.gmail || ""} placeholder="prenom.nom@gmail.com" onChange={(e) => setProfile({ ...profile, gmail: e.target.value.trim() })} /></label>
              <label className="field">Site<input value={profile.site} onChange={(e) => setProfile({ ...profile, site: e.target.value })} /></label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>Qui tu es, en une ou deux phrases (repris dans tes e-mails)<textarea value={profile.about || ""} placeholder="Je suis Theo, directeur artistique à Toulouse depuis dix ans." onChange={(e) => setProfile({ ...profile, about: e.target.value })} /></label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>Pourquoi te choisir, un point par ligne (3 maximum, repris dans tes e-mails)<textarea value={profile.why || ""} placeholder={"Dix ans de direction artistique : un site qui vous ressemble, pas un modèle.\nUn seul interlocuteur, de la charte graphique au site, puis pour l'entretien.\nVous gardez la main : textes, photos et horaires se modifient depuis WordPress, sans toucher une ligne de code."} onChange={(e) => setProfile({ ...profile, why: e.target.value })} /></label>
              <label className="field">Lien vers tes réalisations<input value={profile.portfolio || ""} placeholder="ex. thot-studio.fr/realisations" onChange={(e) => setProfile({ ...profile, portfolio: e.target.value })} /></label>
            </div>
          </details>

          <details className="set-sec" open={mode === "tableaux"}>
            <summary>Tes tableaux</summary>
            <p className="hint">Repris dans tes messages Instagram, e-mails et scripts de visite. Vente directe aux lieux.</p>
            {(() => {
              const a = profile.art || {};
              const set = (patch: Partial<NonNullable<Profile["art"]>>) => setProfile({ ...profile, art: { ...a, ...patch } });
              const num = (v: string) => (v === "" ? undefined : Number(v));
              return (
                <>
                  <div className="row2">
                    <label className="field">Ton Instagram<input value={a.instagram || ""} placeholder="@tprod_creation" onChange={(e) => set({ instagram: e.target.value })} /></label>
                    <label className="field">Ce que tu fais<input value={a.style || ""} placeholder="des affiches illustrées en édition limitée" onChange={(e) => set({ style: e.target.value })} /></label>
                    <label className="field">Prix à partir de (€)<input type="number" inputMode="numeric" min="0" step="10" value={a.priceFrom ?? ""} onChange={(e) => set({ priceFrom: num(e.target.value) })} /></label>
                    <label className="field">Jusqu'à (€, facultatif)<input type="number" inputMode="numeric" min="0" step="10" value={a.priceTo ?? ""} onChange={(e) => set({ priceTo: num(e.target.value) })} /></label>
                    <label className="field">Formats<input value={a.formats || ""} placeholder="30×40, 50×70 et 70×100 cm" onChange={(e) => set({ formats: e.target.value })} /></label>
                  </div>
                  <label className="field">Lieux qui ont déjà tes pièces ou une collab avec toi (un par ligne)
                    <textarea value={a.references || ""} placeholder={"L'Arrosoir, cantine et breuvages\nHomard & Co"} onChange={(e) => set({ references: e.target.value })} />
                  </label>
                  <label className="field">Ce que tu offres en plus (un par ligne, seulement ce qui est vrai)
                    <textarea value={a.extras || ""} placeholder={"Livraison offerte sur Toulouse\nAccrochage offert"} onChange={(e) => set({ extras: e.target.value })} />
                  </label>
                </>
              );
            })()}
          </details>

          <details className="set-sec">
            <summary>Tes tarifs</summary>
            <p className="hint">Prix de départ HT. Laisse vide ce que tu fais sur devis.</p>
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
            <label className="field">Prix annoncé dans les scripts (facultatif)<input value={profile.price} placeholder="ex. 890 € puis 39 €/mois" onChange={(e) => setProfile({ ...profile, price: e.target.value })} /></label>
          </details>

          <details className="set-sec">
            <summary>Tes garanties et références</summary>
            <p className="hint">Utilisées dans l'argumentaire. N'écris que ce que tu offres vraiment.</p>
            <label className="field">Tes garanties (une par ligne)
              <textarea value={profile.guarantees || ""} onChange={(e) => setProfile({ ...profile, guarantees: e.target.value })} placeholder={"Sans engagement de durée\nRetouches jusqu'à validation\nInterlocuteur unique, du premier rendez-vous à la mise en ligne"} />
            </label>
            <label className="field">Clients de référence (un par ligne, avec leur accord)
              <textarea value={profile.references || ""} onChange={(e) => setProfile({ ...profile, references: e.target.value })} placeholder={"Nom du client, ville"} />
            </label>
          </details>

          <details className="set-sec">
            <summary>Envoi des e-mails</summary>
            {mailOn?.enabled ? (
              <p className="hint">Actif : tes e-mails partent de <b>{mailOn.from}</b>. Dans chaque fiche, onglet Textes › E-mails › « Envoyer depuis Filon ». Le statut (bien reçu, adresse invalide, clic sur un lien) se met à jour à chaque ouverture de Filon.</p>
            ) : (
              <>
                <p className="hint">Envoie tes e-mails depuis Filon et sache s'ils sont bien arrivés. Gratuit jusqu'à 100 e-mails par jour avec Resend.</p>
                <ol className="hint" style={{ paddingLeft: 18 }}>
                  <li>Crée un compte sur resend.com et ajoute ton domaine (ex. thot-studio.fr) : copie les enregistrements DNS chez ton hébergeur.</li>
                  <li>Dans le domaine, active le suivi des clics (« Click tracking ») et laisse le suivi des ouvertures désactivé.</li>
                  <li>Crée une clé API, puis dans Vercel ajoute <b>RESEND_API_KEY</b> et <b>MAIL_FROM</b> (ex. Theo · Thot Studio &lt;theo@thot-studio.fr&gt;), et éventuellement <b>MAIL_REPLY_TO</b>. Relance le déploiement.</li>
                </ol>
              </>
            )}
            <p className="hint">Pas de suivi des ouvertures : depuis juillet 2026, la CNIL demande le consentement du destinataire pour les pixels de suivi, ce qu'un prospect n'a pas donné. Et Apple Mail fausse ces chiffres de toute façon. Le clic sur un lien (ton portfolio, ton rapport d'audit) est un signal bien plus fiable.</p>
          </details>

          <details className="set-sec">
            <summary>Rester dans le gratuit</summary>
            <label className="price-row" style={{ borderBottom: 0 }}>
              <span>Requêtes Google par jour, au maximum<small>30 par jour = 930 par mois au plus, sous les 1 000 gratuites</small></span>
              <input type="number" min="1" step="1" value={cap} onChange={(e) => setProfile({ ...profile, dailyCap: Math.max(1, Number(e.target.value) || 30) })} />
            </label>
            <p className="hint">
              {(() => {
                const m = localUsage.month === new Date().toISOString().slice(0, 7) ? localUsage.calls : 0;
                return `Ce mois-ci depuis cet appareil : ${m} requête${m > 1 ? "s" : ""}, dont ${usedToday} aujourd'hui. Garde le même plafond dans les quotas de Google Cloud.`;
              })()}
            </p>
          </details>

          <details className="set-sec">
            <summary>Compte et sauvegarde</summary>
            {me?.mode === "comptes" && me.user ? (
              <>
                <p>Connecté en tant que <b>{me.user.email}</b>{me.user.role === "admin" ? " (administrateur)" : ""}. Tout est synchronisé sur tes appareils.</p>
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
              </>
            ) : (
              <p className="hint">Mode simple : tes données restent dans ce navigateur. Pour les retrouver sur tous tes appareils, branche une base Upstash gratuite au projet dans Vercel (onglet Storage).</p>
            )}
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn ghost small" onClick={exportAll}>Télécharger une sauvegarde</button>
              <label className="btn ghost small" style={{ cursor: "pointer" }}>
                Importer une sauvegarde
                <input type="file" accept="application/json" hidden onChange={(e) => importAll(e.target.files?.[0])} />
              </label>
              {confirmReset ? (
                <>
                  <button className="btn small danger" onClick={() => { setLeads({}); setPipeline({}); setResult(null); setRecent([]); setConfirmReset(false); }}>Oui, tout effacer</button>
                  <button className="btn ghost small" onClick={() => setConfirmReset(false)}>Annuler</button>
                </>
              ) : (
                <button className="btn ghost small" onClick={() => setConfirmReset(true)}>Effacer les données</button>
              )}
            </div>
            {importMsg && <p className="hint">{importMsg}</p>}
          </details>
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

      <Palette open={palette} onClose={() => setPalette(false)} items={paletteItems} />
      <Toast msg={toast} onDone={() => setToast(null)} />

      {openLead && (
        <LeadDrawer
          notify={notify}
          onLead={(patch) => {
            const id = openLead.id;
            setLeads((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
            setResult((r) => (r ? { ...r, leads: r.leads.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : r));
          }}
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
