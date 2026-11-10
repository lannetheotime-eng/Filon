"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { Lead, PipelineEntry } from "../lib/types";
import type { RadarItem, RadarResult, SectorId } from "../lib/radar-shared";
import { SECTORS, KIND_LABEL, fmtDay, fmtEur } from "../lib/radar-shared";
import { usePersistent, toCsv, download } from "../lib/store";

// Lit une réponse serveur sans planter si ce n'est pas du JSON (délai dépassé, page d'erreur…)
async function readJson(r: Response) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(r.status === 504 || /timeout|timed out/i.test(t) ? "Le BODACC a mis trop de temps à répondre : réessaie." : "Réponse inattendue du serveur : réessaie dans un instant."); }
}

const PERIODS: [number, string][] = [[7, "7 derniers jours"], [30, "30 derniers jours"], [90, "3 derniers mois"], [180, "6 derniers mois"]];
const today = () => new Date().toISOString().slice(0, 10);
const leadId = (it: RadarItem) => `bodacc-${it.siren}`;

export default function Radar({ pipeline, leads, onAdd, onOpen }: {
  pipeline: Record<string, PipelineEntry>;
  leads: Record<string, Lead>;
  onAdd: (l: Lead, note: string) => void;
  onOpen: (id: string) => void;
}) {
  const [zone, setZone] = usePersistent("filon.radar.zone", "31");
  const [sector, setSector] = usePersistent<SectorId | "tout">("filon.radar.sector", "juridique");
  const [days, setDays] = usePersistent("filon.radar.days", 30);
  const [creations, setCreations] = usePersistent("filon.radar.creations", true);
  const [reprises, setReprises] = usePersistent("filon.radar.reprises", true);
  const [sort, setSort] = usePersistent<"score" | "date">("filon.radar.sort", "score");
  // Visites : « Nouveau » = publié depuis la visite d'un jour précédent
  const [visit, setVisit, ready] = usePersistent<{ last: string; prev: string }>("filon.radar.visit", { last: "", prev: "" });
  const [zoneInput, setZoneInput] = useState("");
  const [res, setRes] = useState<RadarResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!ready) return;
    setZoneInput(zone);
    if (visit.last !== today()) setVisit({ last: today(), prev: visit.last });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function load(offset = 0) {
    if (offset) setMore(true); else setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/radar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zone, sector, days, creations, reprises, offset }) });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error);
      setRes((prev) => (offset && prev ? { ...j, items: [...prev.items, ...(j.items as RadarItem[]).filter((x) => !prev.items.some((y) => y.siren === x.siren))], read: prev.read + j.read, hidden: prev.hidden + j.hidden } : j));
      if (!offset) setOpen(null);
    } catch (e: any) {
      setErr(e.message || "Le radar n'a pas pu lire le BODACC.");
    } finally {
      setBusy(false); setMore(false);
    }
  }
  // Gratuit : on relance dès qu'un réglage change
  useEffect(() => { if (ready) load(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ready, zone, sector, days, creations, reprises]);

  const since = visit.prev;
  const isNew = (it: RadarItem) => !!since && it.published > since;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (res?.items || [])
      .filter((it) => !t || `${it.name} ${it.legalName} ${it.activity} ${it.city} ${it.people.map((p) => p.name).join(" ")} ${it.tags.join(" ")}`.toLowerCase().includes(t))
      .sort((a, b) => (sort === "date" ? b.published.localeCompare(a.published) || b.score - a.score : b.score - a.score || b.published.localeCompare(a.published)));
  }, [res, q, sort]);
  const fresh = list.filter(isNew).length;

  async function add(it: RadarItem, openAfter: boolean) {
    const id = leadId(it);
    if (pipeline[id] && leads[id]) { onOpen(id); return; }
    setAdding(it.siren);
    let geo: { lat?: number | null; lng?: number | null } = {};
    try { geo = await fetch(`/api/radar?geo=${encodeURIComponent(it.address)}&cp=${encodeURIComponent(it.cp)}`).then((r) => r.json()); } catch {}
    const lead: Lead = {
      id, name: it.name, tradeId: it.tradeId, city: it.city, address: it.address,
      lat: geo.lat ?? 43.6045, lng: geo.lng ?? 1.444,
      presence: "aucun", category: it.tags[0], legalName: it.legalName, registry: "ok", people: it.people, source: "bodacc",
      created: it.kind === "reprise" ? undefined : it.registered || it.published,
      score: it.score, foundAt: new Date().toISOString(),
    };
    const note = [
      `BODACC du ${fmtDay(it.published)} · ${KIND_LABEL[it.kind]}${it.form ? ` (${it.form})` : ""} : ${it.activity}`,
      it.starts && it.starts >= today() ? `Début d'activité annoncé : ${fmtDay(it.starts)}.` : "",
      it.kind === "reprise" ? `Fonds repris${it.price ? ` pour ${fmtEur(it.price)}` : ""}${it.previous ? ` à ${it.previous}` : ""} : un site existe peut-être déjà, à vérifier.` : "",
      `Fiche officielle : https://annuaire-entreprises.data.gouv.fr/entreprise/${it.siren}`,
    ].filter(Boolean).join("\n");
    onAdd(lead, note);
    setAdding("");
    if (openAfter) onOpen(id);
  }

  function exportCsv() {
    download(`radar-${zone.replace(/[^\d,]/g, "") || "zone"}-${sector}.csv`, toCsv(list.map((it) => ({
      Nom: it.name, "Dénomination": it.legalName, Type: KIND_LABEL[it.kind], Secteur: it.tags[0] || "", Forme: it.form || "", SIREN: it.siren,
      Activité: it.activity, Adresse: it.address, Dirigeants: it.people.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(" / "),
      Immatriculation: it.registered || "", "Début d'activité": it.starts || "", Parution: it.published, "Prix de rachat": it.price ?? "", "Ancien exploitant": it.previous || "",
      Potentiel: it.score, "Annonce BODACC": it.url, "Fiche officielle": `https://annuaire-entreprises.data.gouv.fr/entreprise/${it.siren}`,
    }))));
  }

  const sectorLabel = SECTORS.find((s) => s.id === sector)?.label || "";

  return (
    <div className="rd">
      <div className="dash-head rd-head">
        <p className="rd-eyebrow"><i aria-hidden /> Radar · BODACC · gratuit</p>
        <h1>Les entreprises qui <em>viennent de naître</em>.</h1>
        <p className="hint">Créations, arrivées et rachats de commerces publiés au bulletin officiel. Elles n'ont encore ni logo, ni site, ni cartes : c'est le meilleur moment pour te présenter. Aucune requête Google.</p>
      </div>

      <div className="segments rd-sectors" role="tablist" aria-label="Secteur">
        {SECTORS.map((s) => (
          <button key={s.id} role="tab" className="seg" aria-selected={sector === s.id} onClick={() => setSector(s.id)} title={s.label}>{s.short}</button>
        ))}
      </div>

      <form className="rd-bar" onSubmit={(e) => { e.preventDefault(); setZone(zoneInput.trim() || "31"); }}>
        <label className="rd-zone"><span>Zone</span>
          <input value={zoneInput} onChange={(e) => setZoneInput(e.target.value)} onBlur={() => zoneInput.trim() && zoneInput.trim() !== zone && setZone(zoneInput.trim())} placeholder="31, 82, 31000 ou Toulouse" aria-label="Départements, codes postaux ou commune" />
        </label>
        <label className="rd-period"><span>Période</span>
          <select value={days} onChange={(e) => setDays(+e.target.value)}>{PERIODS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
        </label>
        <label className="switch small"><input type="checkbox" checked={creations} onChange={(e) => setCreations(e.target.checked)} /><span aria-hidden />Créations</label>
        <label className="switch small"><input type="checkbox" checked={reprises} onChange={(e) => setReprises(e.target.checked)} /><span aria-hidden />Rachats de commerces</label>
      </form>

      {err && <p className="error">{err}</p>}
      {busy && (
        <section className="loading">
          <ul className="list skel">{Array.from({ length: 5 }).map((_, k) => <li key={k} className="row"><span /><span /><span /></li>)}</ul>
        </section>
      )}

      {res && !busy && (
        <section className="results">
          <div className="res-head">
            <h1><b>{list.length}</b> {list.length > 1 ? "entreprises à démarcher" : "entreprise à démarcher"}</h1>
            <p className="hint">
              {sectorLabel} · {PERIODS.find(([d]) => d === days)?.[1] || `${days} jours`} · zone {zone}
              {res.hidden ? ` · ${res.hidden} écartée${res.hidden > 1 ? "s" : ""} (SCI, holdings, sans activité, franchises, livreurs)` : ""}
              {fresh ? <> · <b className="rd-fresh">{fresh} nouvelle{fresh > 1 ? "s" : ""}</b> depuis ta visite du {fmtDay(since)}</> : ""}
            </p>
          </div>
          <div className="res-bar">
            <div className="segments" role="tablist" aria-label="Tri">
              <button role="tab" className="seg" aria-selected={sort === "score"} onClick={() => setSort("score")}>Les plus prometteuses</button>
              <button role="tab" className="seg" aria-selected={sort === "date"} onClick={() => setSort("date")}>Les plus récentes</button>
            </div>
            <div className="res-tools">
              <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer : nom, activité, ville…" />
              <button className="btn ghost small" onClick={exportCsv} disabled={!list.length}>Exporter CSV</button>
            </div>
          </div>

          <ul className="list rd-list">
            {list.map((it) => {
              const id = leadId(it);
              const inPipe = !!pipeline[id];
              const isOpen = open === it.siren;
              const boss = it.people[0];
              return (
                <Fragment key={it.siren}>
                  <li className="row rd-row" data-active={isOpen} data-kind={it.kind}>
                    <button className="row-main" onClick={() => setOpen(isOpen ? null : it.siren)} aria-expanded={isOpen}>
                      <span className={`mono rd-score ${it.score >= 70 ? "hot" : it.score >= 50 ? "warm" : ""}`} title="Potentiel sur 100" aria-label={`Potentiel ${it.score} sur 100`}>{it.score}</span>
                      <div className="row-text">
                        <h3>{it.name}{isNew(it) && <span className="rd-new">Nouveau</span>}</h3>
                        <div className="meta">
                          <span className={`pill rd-${it.kind}`}>{KIND_LABEL[it.kind]}</span>
                          {it.tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
                          <span>{it.city}</span>
                        </div>
                        <div className="next">{boss ? <b>{boss.name}</b> : null}{boss ? " · " : ""}{it.activity}</div>
                      </div>
                    </button>
                    <div className="side">
                      {inPipe ? (
                        <button className="tag in" onClick={() => onOpen(id)}>Suivi</button>
                      ) : (
                        <button className="add" onClick={() => add(it, false)} disabled={adding === it.siren} aria-label={`Ajouter ${it.name} au pipeline`}>{adding === it.siren ? "…" : "+"}</button>
                      )}
                    </div>
                    {isOpen && (
                      <div className="dg-detail rd-detail">
                        <p className="rd-activity">{it.activity}</p>
                        <div className="dg-grid">
                          <div>
                            <small>Entreprise</small>
                            <b>{it.legalName}</b>
                            {it.brand && it.brand !== it.legalName && <span>Enseigne : {it.brand}</span>}
                            <span>{[it.form, `SIREN ${it.siren}`, it.capital ? `capital ${fmtEur(it.capital)}` : ""].filter(Boolean).join(" · ")}</span>
                            <span>{it.address}</span>
                          </div>
                          {it.people.length > 0 && (
                            <div>
                              <small>{it.people.length > 1 ? "Dirigeants" : "Dirigeant"}</small>
                              {it.people.map((p) => <span key={p.name}><b>{p.name}</b>{p.role ? ` · ${p.role}` : ""}</span>)}
                            </div>
                          )}
                          <div>
                            <small>Calendrier</small>
                            {it.registered && <span>Immatriculée le <b>{fmtDay(it.registered)}</b></span>}
                            {it.starts && <span>{it.starts > today() ? "Ouvre le" : "Activité depuis le"} <b>{fmtDay(it.starts)}</b></span>}
                            <span>Publiée au BODACC le {fmtDay(it.published)}</span>
                          </div>
                          {it.kind === "reprise" && (
                            <div>
                              <small>Rachat</small>
                              {it.price ? <span>Fonds repris pour <b>{fmtEur(it.price)}</b></span> : <span>Reprise du fonds de commerce</span>}
                              {it.previous && <span>Ancien exploitant : {it.previous}</span>}
                              <span>Nouveau propriétaire : bon moment pour refaire l'identité.</span>
                            </div>
                          )}
                        </div>
                        <div className="dg-track">
                          <button className="btn small" onClick={() => add(it, true)} disabled={adding === it.siren}>{inPipe ? "Ouvrir la fiche" : adding === it.siren ? "Ajout…" : "Ajouter au pipeline et ouvrir la fiche"}</button>
                          <a className="btn ghost small" href={`https://www.google.com/search?q=${encodeURIComponent(`${it.name} ${it.city}`)}`} target="_blank" rel="noreferrer">Chercher son site</a>
                          {boss && it.kind !== "reprise" && <a className="btn ghost small" href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${boss.name} ${it.legalName}`)}`} target="_blank" rel="noreferrer">LinkedIn</a>}
                          <a className="btn ghost small" href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${it.siren}`} target="_blank" rel="noreferrer">Fiche officielle</a>
                          <a className="btn ghost small" href={it.url} target="_blank" rel="noreferrer">Annonce BODACC</a>
                        </div>
                      </div>
                    )}
                  </li>
                </Fragment>
              );
            })}
            {!list.length && (
              <li className="list empty">
                <strong>Aucune entreprise sur cette période</strong>
                {sector === "juridique" ? "Les cabinets d'avocats et offices notariaux sont rares : élargis à 3 ou 6 mois, ou ajoute des départements (31, 82, 81)." : "Élargis la période, la zone ou le secteur."}
              </li>
            )}
          </ul>
          {res.next != null && (
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => load(res.next)} disabled={more}>{more ? "Lecture…" : "Lire les 100 annonces suivantes"}</button>
          )}
          <p className="attrib">Source : BODACC (DILA), annonces légales publiées chaque jour ouvré. Il couvre les sociétés et commerçants inscrits au registre du commerce : les avocats et professions libérales installés en nom propre n'y apparaissent pas. Les noms de dirigeants sont des données personnelles : ne les garde que pour ta prospection et propose toujours de ne plus être recontacté.</p>
        </section>
      )}
    </div>
  );
}
