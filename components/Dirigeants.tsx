"use client";
import { useMemo, useState } from "react";
import type { HoldingLead } from "../lib/holdings-shared";
import { EFFECTIF, EFFECTIF_LABEL, NAF_LABEL, SECTORS, fmtEur, score, signals } from "../lib/holdings-shared";
import { usePersistent, toCsv, download } from "../lib/store";

type Track = { status: string; notes?: string; phone?: string; site?: string; noPhone?: boolean; at: string };
const STATUS = ["À appeler", "Appelé", "À rappeler", "RDV", "Pas intéressé"];

// Lit une réponse serveur sans planter si ce n'est pas du JSON (délai dépassé, page d'erreur…)
async function readJson(r: Response) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(r.status === 504 || /timeout|timed out/i.test(t) ? "Le registre a mis trop de temps à répondre : réessaie." : "Réponse inattendue du serveur : réessaie dans un instant."); }
}

export default function Dirigeants({ canSpend, spend, notify, live }: { canSpend: (n: number) => boolean; spend: (n: number) => void; notify: (m: string) => void; live: boolean }) {
  const [sector, setSector] = usePersistent("filon.dg.sector", 0);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [caMin, setCaMin] = usePersistent("filon.dg.ca", "");
  const [netMin, setNetMin] = usePersistent("filon.dg.net", "");
  const [zone, setZone] = usePersistent("filon.dg.zone", "31");
  const [effectif, setEffectif] = useState("");
  const [holdingOnly, setHoldingOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = usePersistent<{ leads: HoldingLead[]; scanned: number; total: number; next?: number; demo?: boolean } | null>("filon.dg.last", null);
  const [all, setAll] = usePersistent<Record<string, HoldingLead>>("filon.dg.all", {});
  const [scope, setScope] = useState<"last" | "all">("last");
  const [track, setTrack] = usePersistent<Record<string, Track>>("filon.dg.track", {});
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "todo" | "followed">("all");
  const [phoneBusy, setPhoneBusy] = useState("");

  const naf = custom.trim() ? custom.split(/[,\s]+/).filter(Boolean) : SECTORS[sector]?.naf || [];
  const holdingSector = naf.length > 0 && naf.every((n) => n === "64.20Z" || n === "70.10Z");

  async function go(demo = false, more = false) {
    if (more) setMoreBusy(true); else setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/holdings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caMin, netMin, name, naf, zone, effectif, holdingOnly: holdingSector ? false : holdingOnly, from: more ? res?.next : 1, demo }),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error);
      if (!demo) setAll((prev) => { const n = { ...prev }; for (const x of j.leads as HoldingLead[]) n[x.siren] = x; return n; });
      setScope("last");
      setRes((prev) => (more && prev ? { ...j, leads: [...prev.leads, ...j.leads.filter((x: HoldingLead) => !prev.leads.some((y) => y.siren === x.siren))], scanned: prev.scanned + j.scanned, demo } : { ...j, demo }));
      if (!more) setOpen(null);
    } catch (e: any) {
      setErr(e.message || "La recherche a échoué.");
    } finally {
      setBusy(false); setMoreBusy(false);
    }
  }

  const setT = (siren: string, patch: Partial<Track>) => setTrack((t) => ({ ...t, [siren]: { ...({ status: "À appeler" } as Track), ...t[siren], ...patch, at: new Date().toISOString() } }));

  async function phone(l: HoldingLead) {
    if (live && !canSpend(2)) { notify("Plafond de requêtes Google du jour atteint"); return; }
    setPhoneBusy(l.siren);
    try {
      // Holding : on passe par les autres sociétés de son dirigeant ; sinon l'enseigne puis le nom nettoyé + l'adresse
      const owner = l.holdings.flatMap((h) => h.owners)[0]?.name || l.people[0]?.name || "";
      const qs = new URLSearchParams({ name: l.name, city: l.city, brand: l.brand || "", address: l.address, person: owner, holding: l.isHolding ? "1" : "0", dept: l.cp.slice(0, 2) });
      const r = await fetch(`/api/phone?${qs}`);
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error);
      if (live && j.calls) spend(j.calls);
      if (j.phone) { setT(l.siren, { phone: j.phone, site: j.website, notes: track[l.siren]?.notes || (j.via ? `Téléphone de ${j.via}` : undefined) }); notify(`Téléphone trouvé${j.via ? ` (via ${j.via})` : ""} : ${j.phone}`); }
      else setT(l.siren, { noPhone: true });
      if (!j.phone) notify(j.tried?.length ? `Pas de téléphone public (essayé : ${j.tried.join(", ")})` : "Pas de téléphone public trouvé");
    } catch (e: any) {
      notify(e.message || "Recherche impossible");
    } finally {
      setPhoneBusy("");
    }
  }

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (scope === "all" ? Object.values(all) : res?.leads || [])
      .filter((l) => only === "all" || (only === "followed" ? !!track[l.siren] : !track[l.siren] || track[l.siren].status === "À appeler" || track[l.siren].status === "À rappeler"))
      .filter((l) => !t || `${l.name} ${l.city} ${l.holdings.map((h) => h.name + h.owners.map((o) => o.name).join(" ")).join(" ")} ${l.people.map((p) => p.name).join(" ")}`.toLowerCase().includes(t))
      .sort((a, b) => score(b) - score(a));
  }, [res, q, only, track, scope, all]);

  function exportCsv() {
    download(`dirigeants-${zone || "france"}.csv`, toCsv(list.map((l) => ({
      Dirigeant: (l.holdings.flatMap((h) => h.owners)[0] || l.people[0])?.name || "", Rôle: (l.holdings.flatMap((h) => h.owners)[0] || l.people[0])?.role || "",
      Entreprise: l.name, SIREN: l.siren, "Code NAF": l.naf, Activité: NAF_LABEL[l.naf] || "", Adresse: l.address, Ville: l.city,
      Téléphone: track[l.siren]?.phone || "", Statut: track[l.siren]?.status || "", Notes: track[l.siren]?.notes || "",
      Création: l.created || "", Effectif: l.effectif ? EFFECTIF_LABEL[l.effectif] || l.effectif : "", CA: l.ca ?? "", "Résultat net": l.net ?? "",
      Holding: l.holdings.map((h) => `${h.name} (${h.siren})`).join(" / "), Fiche: `https://annuaire-entreprises.data.gouv.fr/entreprise/${l.siren}`,
    }))));
    notify("Export CSV téléchargé");
  }

  return (
    <main className="dg">
      <div className="dash-head">
        <h1>Dirigeants et holdings</h1>
        <p className="hint">Les sociétés holding, ou les entreprises détenues par une holding, par code NAF et par zone, avec la personne qui les dirige. Registre national des entreprises : gratuit, sans requête Google.</p>
      </div>

      <form className="dg-form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label className="sb-field dg-wide"><span>Secteur</span>
          <select value={sector} onChange={(e) => { setSector(+e.target.value); setCustom(""); }}>
            {SECTORS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          </select>
        </label>
        <label className="sb-field"><span>Nom (facultatif)</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="entreprise ou dirigeant" /></label>
        <label className="sb-field"><span>Ou codes NAF</span><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ex. 64.20Z" /></label>
        <label className="sb-field"><span>Zone</span><input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="31, 31000 ou Toulouse" /></label>
        <label className="sb-field"><span>Taille</span>
          <select value={effectif} onChange={(e) => setEffectif(e.target.value)}>{EFFECTIF.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select>
        </label>
        <label className="sb-field"><span>Chiffre d'affaires</span>
          <select value={caMin} onChange={(e) => setCaMin(e.target.value)}>
            {[["", "Tous"], ["100000", "100 k€ et plus"], ["500000", "500 k€ et plus"], ["1000000", "1 M€ et plus"], ["2000000", "2 M€ et plus"], ["5000000", "5 M€ et plus"], ["10000000", "10 M€ et plus"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="sb-field"><span>Bénéfice</span>
          <select value={netMin} onChange={(e) => setNetMin(e.target.value)}>
            {[["", "Tous"], ["1", "Bénéficiaire"], ["50000", "50 k€ et plus"], ["100000", "100 k€ et plus"], ["250000", "250 k€ et plus"], ["500000", "500 k€ et plus"], ["1000000", "1 M€ et plus"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="btn sb-go" disabled={busy}>{busy ? "Recherche…" : "Chercher"}</button>
      </form>
      {(caMin || netMin) && <p className="hint" style={{ margin: "8px 0 0" }}>Filtre financier : seules les sociétés qui publient leurs comptes apparaissent (beaucoup de petites sociétés les gardent confidentiels).</p>}
      <div className="sb-under">
        {!holdingSector && (
          <label className="switch small"><input type="checkbox" checked={holdingOnly} onChange={(e) => setHoldingOnly(e.target.checked)} /><span aria-hidden />Seulement celles détenues par une holding</label>
        )}
        <button type="button" className="chip" onClick={() => go(true)} disabled={busy}>Voir un exemple</button>
      </div>
      {err && <p className="error">{err}</p>}
      {busy && <p className="hint">On interroge le registre{holdingSector ? "" : ", puis on remonte chaque holding jusqu'à son dirigeant"} : 10 à 40 secondes.</p>}

      {Object.keys(all).length > 0 && !busy && (
        <div className="scope" role="tablist" aria-label="Résultats affichés">
          <button role="tab" aria-selected={scope === "last"} onClick={() => setScope("last")} disabled={!res}>Dernière recherche</button>
          <button role="tab" aria-selected={scope === "all"} onClick={() => setScope("all")}>Tout ce que j'ai trouvé <b>{Object.keys(all).length}</b></button>
        </div>
      )}

      {(res || scope === "all") && !busy && (
        <section className="results">
          <div className="res-head">
            <h1><b>{list.length}</b> {scope === "all" ? "dirigeants trouvés au fil de tes recherches" : holdingSector ? "holdings" : holdingOnly ? "entreprises détenues par une holding" : "entreprises"}</h1>
            <p className="hint">{scope === "all" || !res ? "Toutes tes recherches cumulées" : `${res.demo ? "Exemple fictif · " : ""}${res.scanned} analysées sur ${res.total.toLocaleString("fr-FR")} au registre`}</p>
          </div>
          <div className="res-bar">
            <div className="segments">
              {([["all", "Toutes"], ["todo", "À appeler"], ["followed", "Suivies"]] as const).map(([k, l]) => (
                <button key={k} className="seg" aria-selected={only === k} onClick={() => setOnly(k)}>{l}{k === "followed" ? <b>{Object.keys(track).length}</b> : null}</button>
              ))}
            </div>
            <div className="res-tools">
              <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer : nom, ville…" />
              <button className="btn ghost small" onClick={exportCsv} disabled={!list.length}>Exporter CSV</button>
            </div>
          </div>

          <ul className="list dg-list">
            {list.map((l) => {
              const lead = l.holdings.flatMap((h) => h.owners)[0] || l.people[0];
              const t = track[l.siren];
              const isOpen = open === l.siren;
              return (
                <li key={l.siren} className="row dg-row" data-active={isOpen}>
                  <button className="row-main" onClick={() => setOpen(isOpen ? null : l.siren)}>
                    <span className="mono none" aria-hidden>{score(l)}</span>
                    <div className="row-text">
                      <h3>{lead?.name || l.name}</h3>
                      <div className="meta">
                        {t?.status && <span className={`pill ${t.status === "RDV" ? "ok" : t.status === "Pas intéressé" ? "old" : "none"}`}>{t.status}</span>}
                        <span>{lead ? `${lead.role || "Dirigeant"} · ${l.name}` : l.name}</span>
                      </div>
                      <div className="next">{NAF_LABEL[l.naf] || l.naf} · {l.city || "—"}{l.holdings[0] ? ` · holding ${l.holdings[0].name}` : ""}{t?.phone ? ` · ${t.phone}` : ""}</div>
                    </div>
                  </button>
                  {t?.phone && <div className="side"><a className="add" href={`tel:${t.phone.replace(/\s/g, "")}`} aria-label={`Appeler ${lead?.name || l.name}`}>☎</a></div>}
                  {isOpen && (
                    <div className="dg-detail">
                      <div className="nf-tags-f">{signals(l).concat(l.isHolding ? ["Société holding"] : []).map((s) => <span key={s}>{s}</span>)}</div>
                      <div className="dg-grid">
                        <div><small>Société</small><b>{l.name}</b><span>SIREN {l.siren} · {l.naf} {NAF_LABEL[l.naf] ? `(${NAF_LABEL[l.naf]})` : ""}</span><span>{l.address}</span><span>{l.created ? `Créée en ${new Date(l.created).getFullYear()}` : ""}{l.effectif && l.effectif !== "00" ? ` · ${EFFECTIF_LABEL[l.effectif] || l.effectif} salariés` : l.effectif === "00" ? " · sans salarié" : ""}</span>{(l.ca != null || l.net != null) && <span>{l.ca != null ? `CA ${fmtEur(l.ca)}` : ""}{l.net != null ? ` · résultat ${fmtEur(l.net)}` : ""}{l.finYear ? ` (${l.finYear})` : ""}</span>}</div>
                        {l.holdings.map((h) => <div key={h.siren}><small>Holding · {h.role || "associée"}</small><b>{h.name}</b><span>SIREN {h.siren}</span><span>{h.owners.map((o) => `${o.name} (${o.role})`).join(", ") || "Dirigeant non renseigné"}</span></div>)}
                        {l.people.length > 0 && <div><small>Dirigeants</small>{l.people.slice(0, 4).map((p) => <span key={p.name}><b>{p.name}</b> · {p.role}</span>)}</div>}
                      </div>
                      <div className="dg-track">
                        <select value={t?.status || ""} onChange={(e) => (e.target.value ? setT(l.siren, { status: e.target.value }) : setTrack((x) => { const n = { ...x }; delete n[l.siren]; return n; }))} aria-label="Statut">
                          <option value="">+ Suivre</option>
                          {STATUS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        {t?.phone ? (
                          <a className="btn small" href={`tel:${t.phone.replace(/\s/g, "")}`}>Appeler {t.phone}</a>
                        ) : (
                          t?.noPhone ? <span className="hint">Aucun numéro public trouvé (déjà cherché, 0 requête de plus)</span> : <button className="btn small" onClick={() => phone(l)} disabled={phoneBusy === l.siren}>{phoneBusy === l.siren ? "Recherche…" : "Trouver le téléphone (1 à 2 requêtes)"}</button>
                        )}
                        <a className="btn ghost small" href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${l.siren}`} target="_blank" rel="noreferrer">Fiche officielle</a>
                        <a className="btn ghost small" href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${lead?.name || ""} ${l.name}`)}`} target="_blank" rel="noreferrer">LinkedIn</a>
                      </div>
                      {t && <textarea className="dg-notes" value={t.notes || ""} placeholder="Notes d'appel : qui, quand rappeler, ce qui l'intéresse…" onChange={(e) => setT(l.siren, { notes: e.target.value })} />}
                    </div>
                  )}
                </li>
              );
            })}
            {!list.length && <li className="list empty"><strong>Aucune entreprise avec ces filtres</strong>Élargis la zone ou change de secteur.</li>}
          </ul>
          {scope === "last" && res?.next && !res.demo && <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => go(false, true)} disabled={moreBusy}>{moreBusy ? "Chargement…" : "Afficher 10 de plus"}</button>}
          <p className="attrib">Registre national des entreprises (INSEE, INPI) via l'Annuaire des entreprises. Les téléphones viennent de Google quand l'entreprise en affiche un. Prospection B2B : laisse toujours au dirigeant la possibilité de refuser d'être recontacté.</p>
        </section>
      )}
    </main>
  );
}
