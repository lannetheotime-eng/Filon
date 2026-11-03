"use client";
import { useEffect, useMemo, useState } from "react";
import { CLASSES, STATUTS, chiffres, parseAnnonce, rentaClass, toNum, type Bien, type Statut } from "../../lib/loue-parse";
import { toCsv, download } from "../../lib/store";

type Res = { biens: Bien[]; total: number; scanned: number; demo?: boolean };
const KEY = "filon-vendu-loue";
const KEYWORDS = ["locataire en place", "vendu loué", "bail en cours", "actuellement loué", "vendu occupé", "investissement locatif"];
const TYPE_LABELS: [string, string][] = [["appartement", "Appartements"], ["maison", "Maisons"], ["immeuble", "Immeubles"]];

const fmt = (n: number | null | undefined, d = 0) => (n == null || !isFinite(n) ? "–" : n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d }));
const cls = (k: string | null) => CLASSES.find((c) => c.k === k);

function load(): Bien[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function save(l: Bien[]) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* stockage indisponible */ } }

function Tag({ k }: { k: string | null }) {
  const c = cls(k);
  return <span className={`vl-tag${c && "dark" in c ? " dark" : ""}${c ? "" : " none"}`} style={c ? { background: c.color } : undefined} aria-label={`Classe de rentabilité ${k || "inconnue"}`}>{k || "?"}</span>;
}

function Ladder({ renta }: { renta: number | null }) {
  const k = rentaClass(renta);
  return (
    <div className="vl-ladder">
      {CLASSES.map((c, i) => {
        const on = c.k === k;
        return (
          <div key={c.k} className={`vl-rung${on || !k ? " on" : ""}`}>
            <div className={`vl-bar${"dark" in c ? " dark" : ""}`} style={{ background: c.color, width: `${46 + i * 7}%` }}><span>{c.label}</span><b>{c.k}</b></div>
            {on && <strong>{fmt(renta, 1)} %</strong>}
          </div>
        );
      })}
    </div>
  );
}

function Card({ b, action, onAction, armed }: { b: Bien; action: string; onAction: () => void; armed?: boolean }) {
  const { m2, renta, classe } = chiffres(b);
  return (
    <article className="vl-card">
      <Tag k={classe} />
      <div className="vl-card-body">
        <h3>{b.titre}</h3>
        <p className="vl-meta"><span className={`vl-dot s-${b.statut}`} /><span>{[b.ville, STATUTS[b.statut]].filter(Boolean).join(", ")}</span></p>
        <div className="vl-nums">
          <span><b>{fmt(b.prix)} €</b></span>
          <span><b>{b.surface ? `${fmt(b.surface, b.surface % 1 ? 1 : 0)} m²` : "– m²"}</b>{b.surface && !b.carrez ? " hors Carrez" : b.surface ? " Carrez" : ""}</span>
          {m2 && <span>{fmt(m2)} €/m²</span>}
          <span>{b.loyer ? `Loyer ${fmt(b.loyer)} €` : "Loyer non indiqué"}</span>
          {renta && <span><b>{fmt(renta, 1)} %</b> brut</span>}
        </div>
        {b.preuve && <q className="vl-proof">{b.preuve}</q>}
        {b.bail && <p className="vl-meta">{b.bail}</p>}
        <div className="vl-links">
          {b.lien && <a href={b.lien} target="_blank" rel="noopener noreferrer">Voir l&apos;annonce</a>}
          <button type="button" onClick={onAction}>{armed ? "Confirmer le retrait" : action}</button>
        </div>
      </div>
    </article>
  );
}

export default function VenduLoue() {
  // Recherche
  const [zips, setZips] = useState("31000, 31100, 31200, 31300, 31400, 31500");
  const [budget, setBudget] = useState("");
  const [surfaceMin, setSurfaceMin] = useState("");
  const [types, setTypes] = useState<string[]>(["appartement"]);
  const [onlyRented, setOnlyRented] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [offline, setOffline] = useState(false);
  const [res, setRes] = useState<Res | null>(null);

  // Liste
  const [items, setItems] = useState<Bien[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => { setItems(load()); }, []);
  const update = (l: Bien[]) => { setItems(l); save(l); };

  // Analyse d'une annonce collée
  const [texte, setTexte] = useState("");
  const [lien, setLien] = useState("");
  const [draft, setDraft] = useState<Bien | null>(null);

  async function search(demo = false) {
    setBusy(true); setErr(""); setOffline(false);
    try {
      const r = await fetch("/api/loue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zips, budgetMax: budget, surfaceMin, types, demo }) });
      const j = await r.json();
      if (j.configured === false) { setOffline(true); setRes(null); return; }
      if (!r.ok) throw new Error(j.error);
      setRes({ ...j, demo });
    } catch (e: any) {
      setErr(e.message || "La recherche a échoué.");
    } finally {
      setBusy(false);
    }
  }

  const results = useMemo(() => (res?.biens || [])
    .filter((b) => !onlyRented || b.statut === "loue" || b.statut === "verifier")
    .sort((a, b) => (chiffres(b).renta ?? -1) - (chiffres(a).renta ?? -1)), [res, onlyRented]);

  const sorted = useMemo(() => [...items].sort((a, b) => (chiffres(b).renta ?? -1) - (chiffres(a).renta ?? -1)), [items]);
  const inList = (id: string) => items.some((i) => i.id === id);

  function analyse() {
    const p = parseAnnonce(texte);
    setDraft({
      id: Date.now().toString(36), titre: p.titre || "Annonce sans titre", ville: p.ville, prix: p.prix, surface: p.carrez,
      carrez: p.surfaceSource === "carrez", loyer: p.loyer, bail: p.finBail, statut: texte.trim() ? p.statut : "none",
      preuve: p.preuve, lien: lien.trim(), source: "Saisie",
    });
  }
  const setD = (patch: Partial<Bien>) => draft && setDraft({ ...draft, ...patch });
  const dc = draft ? chiffres(draft) : null;

  function remove(id: string) {
    if (armed === id) { update(items.filter((i) => i.id !== id)); setArmed(null); return; }
    setArmed(id); setTimeout(() => setArmed((a) => (a === id ? null : a)), 4000);
  }

  function exportCsv() {
    download("vendu-loue.csv", toCsv(sorted.map((b) => {
      const c = chiffres(b);
      return {
        Titre: b.titre, Ville: b.ville, Statut: STATUTS[b.statut], Prix: b.prix ?? "", "Surface m²": b.surface ?? "", Carrez: b.carrez ? "oui" : "non",
        "Prix/m²": c.m2 ? Math.round(c.m2) : "", "Loyer mensuel": b.loyer ?? "", "Rentabilité brute %": c.renta ? c.renta.toFixed(1).replace(".", ",") : "",
        Classe: c.classe || "", Bail: b.bail, Lien: b.lien,
      };
    })));
  }

  const lbc = (k: string) => {
    const u = new URL("https://www.leboncoin.fr/recherche");
    u.searchParams.set("category", "9");
    u.searchParams.set("text", k);
    const b = toNum(budget);
    if (b) u.searchParams.set("price", `min-${Math.round(b)}`);
    return u.toString();
  };

  return (
    <main className="vl-main">
      <header className="vl-hero">
        <p className="vl-brand">Filon</p>
        <h1>Vendu loué</h1>
        <p>Les biens vendus avec leur locataire, classés par ce qu&apos;ils rapportent.</p>
      </header>

      {/* Recherche automatique */}
      <section className="vl-panel" aria-labelledby="t-search">
        <h2 id="t-search">Rechercher</h2>
        <form className="vl-form" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <label className="wide"><span>Codes postaux</span><input id="zips" value={zips} onChange={(e) => setZips(e.target.value)} inputMode="numeric" placeholder="31000, 31200" /></label>
          <label><span>Budget max (€)</span><input id="budget" value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" placeholder="250 000" /></label>
          <label><span>Surface min (m²)</span><input id="surface" value={surfaceMin} onChange={(e) => setSurfaceMin(e.target.value)} inputMode="numeric" placeholder="25" /></label>
          <div className="wide vl-types" role="group" aria-label="Type de bien">
            {TYPE_LABELS.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={types.includes(v)} onClick={() => setTypes(types.includes(v) ? types.filter((t) => t !== v) : [...types, v])}>{l}</button>
            ))}
          </div>
          <div className="wide vl-actions">
            <button className="vl-primary" type="submit" disabled={busy}>{busy ? "Recherche…" : "Lancer la recherche"}</button>
            <button className="vl-ghost" type="button" onClick={() => search(true)} disabled={busy}>Voir un exemple</button>
          </div>
        </form>

        {offline && (
          <div className="vl-notice">
            <strong>La recherche automatique arrive bientôt.</strong>
            <p>Elle n&apos;est pas encore branchée à la base d&apos;annonces. En attendant, &laquo;&nbsp;Voir un exemple&nbsp;&raquo; montre le résultat, et ces raccourcis ouvrent Leboncoin déjà filtré sur les ventes immobilières :</p>
            <div className="vl-chips">{KEYWORDS.map((k) => <a key={k} className="vl-chip" href={lbc(k)} target="_blank" rel="noopener noreferrer">{k}</a>)}</div>
          </div>
        )}
        {err && <p className="vl-err">{err}</p>}

        {res && (
          <div className="vl-results">
            <div className="vl-bar-row">
              <p className="vl-count">
                {res.demo ? "Exemple : annonces inventées. " : ""}
                {results.length} {results.length > 1 ? "biens" : "bien"}{onlyRented ? " loués ou à vérifier" : ""} sur {res.scanned} annonces lues
              </p>
              <label className="vl-check"><input type="checkbox" checked={onlyRented} onChange={(e) => setOnlyRented(e.target.checked)} /> Loués seulement</label>
            </div>
            {results.length === 0 && <p className="vl-empty">Aucun bien loué dans ces annonces. Élargis les codes postaux ou le budget.</p>}
            <div className="vl-list">
              {results.map((b) => (
                <Card key={b.id} b={b} action={inList(b.id) ? "Dans ma liste" : "Ajouter à ma liste"} onAction={() => !inList(b.id) && update([...items, b])} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Analyse d'une annonce */}
      <section className="vl-panel" aria-labelledby="t-analyse">
        <h2 id="t-analyse">Analyser une annonce</h2>
        <p className="vl-hint">Copie tout le texte d&apos;une annonce Leboncoin et colle-le ici, ou remplis les champs à la main.</p>
        <label className="vl-field"><span>Texte de l&apos;annonce</span>
          <textarea id="texte" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={"T3 vendu loué…\n185 000 €\nSurface loi Carrez : 61,5 m²\nLoyer 720 € HC"} />
        </label>
        <label className="vl-field"><span>Lien de l&apos;annonce (facultatif)</span>
          <input id="lien" type="url" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://www.leboncoin.fr/ad/…" />
        </label>
        <button className="vl-primary" type="button" onClick={analyse}>Analyser</button>

        {draft && dc && (
          <div className="vl-draft">
            <p className={`vl-status s-${draft.statut}`}><span className={`vl-dot s-${draft.statut}`} /><strong>{STATUTS[draft.statut as Statut]}</strong>{draft.preuve && <q>{draft.preuve}</q>}</p>
            <div className="vl-form">
              <label className="wide"><span>Titre</span><input id="d-titre" value={draft.titre} onChange={(e) => setD({ titre: e.target.value })} /></label>
              <label><span>Prix (€)</span><input id="d-prix" inputMode="decimal" value={draft.prix ?? ""} onChange={(e) => setD({ prix: toNum(e.target.value) })} /></label>
              <label><span>{draft.carrez ? "Surface Carrez (m²)" : "Surface (Carrez non précisée)"}</span><input id="d-surface" inputMode="decimal" value={draft.surface ?? ""} onChange={(e) => setD({ surface: toNum(e.target.value) })} /></label>
              <label><span>Loyer mensuel (€)</span><input id="d-loyer" inputMode="decimal" value={draft.loyer ?? ""} onChange={(e) => setD({ loyer: toNum(e.target.value) })} /></label>
              <label><span>Ville</span><input id="d-ville" value={draft.ville} onChange={(e) => setD({ ville: e.target.value })} /></label>
              <label className="wide"><span>Bail</span><input id="d-bail" value={draft.bail} onChange={(e) => setD({ bail: e.target.value })} placeholder="Fin de bail, type de bail…" /></label>
            </div>
            <div className="vl-figs">
              <div><span>Prix au m²</span><b>{dc.m2 ? `${fmt(dc.m2)} €` : "–"}</b></div>
              <div><span>Loyers sur un an</span><b>{draft.loyer ? `${fmt(draft.loyer * 12)} €` : "–"}</b></div>
            </div>
            <div className="vl-ladder-head"><b>Rentabilité brute</b><small>loyer × 12 ÷ prix</small></div>
            <Ladder renta={dc.renta} />
            <button className="vl-primary" type="button" onClick={() => { update([...items, draft]); setDraft(null); setTexte(""); setLien(""); }}>Ajouter à ma liste</button>
          </div>
        )}
      </section>

      {/* Liste */}
      <section className="vl-panel" aria-labelledby="t-liste">
        <div className="vl-bar-row">
          <h2 id="t-liste">Ma liste</h2>
          {sorted.length > 0 && <button className="vl-ghost" type="button" onClick={exportCsv}>Exporter</button>}
        </div>
        {sorted.length === 0
          ? <p className="vl-empty">Aucun bien pour l&apos;instant. Ajoute-en depuis la recherche ou l&apos;analyse : la liste se classe toute seule, du plus rentable au moins rentable.</p>
          : <div className="vl-list">{sorted.map((b) => <Card key={b.id} b={b} action="Retirer" armed={armed === b.id} onAction={() => remove(b.id)} />)}</div>}
      </section>

      <footer className="vl-foot">La liste reste enregistrée sur ce téléphone.</footer>
    </main>
  );
}
