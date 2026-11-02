"use client";

import { useEffect, useState } from "react";
import type { Era, StratesResult } from "../../lib/strates";

const EXAMPLES = ["thot-studio.fr", "lemonde.fr", "sncf.com", "michelin.fr"];
const DIGS = [
  "Interrogation des archives du web…",
  "Datation des couches…",
  "Extraction des logos…",
  "Lecture des feuilles de style…",
  "Relevé des couleurs…",
  "Identification des typographies…",
  "Regroupement par époque…",
];

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

function copy(text: string, done: () => void) {
  navigator.clipboard?.writeText(text).then(done, () => {});
}

function Swatch({ hex }: { hex: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="st-sw" onClick={() => copy(hex, () => { setOk(true); setTimeout(() => setOk(false), 1200); })} title="Copier">
      <i style={{ background: hex }} />
      <span>{ok ? "copié" : hex}</span>
    </button>
  );
}

function Layer({ era, n }: { era: Era; n: number }) {
  const r = era.rep;
  const stripe = [...r.colors, ...r.neutrals].slice(0, 6);
  const range = era.from === era.to ? `${era.from}` : `${era.from} – ${era.to}`;
  const now = era.layers.some((l) => l.live);
  return (
    <section className="st-layer">
      <div className="st-depth">
        <span>{now ? "Aujourd'hui" : era.to}</span>
        <em>{era.layers.length} capture{era.layers.length > 1 ? "s" : ""}</em>
      </div>
      <div className="st-bed">
        <div className="st-sediment" aria-hidden="true">
          {(stripe.length ? stripe : ["#3a3530"]).map((c, i) => <i key={i} style={{ background: c }} />)}
        </div>
        <div className="st-body">
          <header>
            <p className="st-tag">Strate {ROMAN[n] || n}</p>
            <h2>{range}</h2>
            {r.title && <p className="st-title">{r.title}</p>}
          </header>
          <div className="st-tray">
            {r.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logo.src} alt={`Logo ${range}`} loading="lazy" referrerPolicy="no-referrer" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).dataset.broken = "1")} />
            ) : null}
            <span className="st-tray-empty">Logo non retrouvé dans l'archive</span>
            {r.logo && r.logo.kind !== "img" && r.logo.kind !== "svg" && <small>{r.logo.kind === "icon" ? "icône du site" : "visuel de partage"}</small>}
          </div>
          {(r.colors.length > 0 || r.neutrals.length > 0) && (
            <div className="st-row">
              <h3>Couleurs</h3>
              <div className="st-sws">{[...r.colors, ...r.neutrals].map((c) => <Swatch key={c} hex={c} />)}</div>
            </div>
          )}
          {r.fonts.length > 0 && (
            <div className="st-row">
              <h3>Typographies</h3>
              <p className="st-fonts">{r.fonts.join(" · ")}</p>
            </div>
          )}
          <div className="st-row">
            <h3>Captures</h3>
            <p className="st-years">
              {era.layers.map((l) => (
                <a key={l.ts} href={l.archiveUrl} target="_blank" rel="noreferrer">{l.live ? "en ligne" : l.year}</a>
              ))}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Strates() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [res, setRes] = useState<StratesResult | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => (s + 1) % DIGS.length), 2600);
    return () => clearInterval(t);
  }, [busy]);

  async function dig(d = domain) {
    if (!d.trim() || busy) return;
    setDomain(d);
    setBusy(true); setStep(0); setError(""); setRes(null);
    try {
      const r = await fetch("/api/strates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: d }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "La fouille a échoué.");
      setRes(j);
    } catch (e: any) {
      setError(e.message === "Failed to fetch" ? "Connexion perdue pendant la fouille. Réessayez." : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="st-main">
      <nav className="st-top">
        <a href="/strates" className="st-logo">Strates</a>
        <span>par Thot Studio</span>
      </nav>

      <header className="st-hero">
        <h1>Chaque marque a une histoire. <em>On la déterre.</em></h1>
        <p>Entrez un site. Strates fouille les archives du web et retrouve, couche par couche, ses anciens logos, ses couleurs et ses typographies.</p>
        <form className="st-form" onSubmit={(e) => { e.preventDefault(); dig(); }}>
          <label htmlFor="st-domain">Site à fouiller</label>
          <div>
            <input id="st-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="exemple.fr" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <button type="submit" disabled={busy || !domain.trim()}>{busy ? "Fouille…" : "Fouiller"}</button>
          </div>
        </form>
        <p className="st-ex">
          Essayer :{" "}
          {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => dig(x)} disabled={busy}>{x}</button>)}
        </p>
      </header>

      {busy && (
        <div className="st-digging" role="status">
          <div className="st-core" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.35}s` }} />)}</div>
          <p>{DIGS[step]}</p>
          <small>Les archives sont lentes : comptez 20 à 50 secondes.</small>
        </div>
      )}

      {error && <p className="st-error">{error}</p>}

      {res && (
        <div className="st-result">
          <p className="st-summary">
            <b>{res.domain}</b>
            <span>{res.snapshots} captures analysées</span>
            {res.since && <span>archivé depuis {res.since}</span>}
            <span>{res.eras.length} époque{res.eras.length > 1 ? "s" : ""}</span>
            <span>{res.logoChanges} changement{res.logoChanges > 1 ? "s" : ""} de logo</span>
          </p>

          <div className="st-column">
            {res.eras.map((e, i) => <Layer key={e.from} era={e} n={res.eras.length - i} />)}
            <div className="st-bedrock">Première trace sur le web{res.since ? ` · ${res.since}` : ""}</div>
          </div>

          {res.lost.length > 0 && (
            <section className="st-lost">
              <h2>Ce que la marque a perdu en route</h2>
              <p>Ces couleurs ont porté la marque pendant des années et ne figurent plus dans son identité actuelle.</p>
              <div>
                {res.lost.map((c) => (
                  <figure key={c.hex}>
                    <i style={{ background: c.hex }} />
                    <figcaption><b>{c.hex}</b>{c.from === c.to ? c.from : `${c.from} – ${c.to}`}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <footer className="st-foot">
        Prototype. Les données viennent de la Wayback Machine d'Internet Archive : une capture par an au maximum, et les petits sites peuvent être peu archivés.
        Les logos dessinés en image de fond CSS ne sont pas encore détectés.
      </footer>
    </main>
  );
}
