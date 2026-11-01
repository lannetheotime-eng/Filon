"use client";
import { useEffect, useState } from "react";
import type { IaResult } from "../../lib/ia-shared";
import CiteReport from "../../components/CiteReport";

const STEPS = ["On pose vos questions aux IA", "Elles cherchent sur le web", "On lit leurs recommandations", "On prépare vos conseils"];
const EXAMPLES = ["boulangerie", "coiffeur", "restaurant", "garage", "fleuriste", "plombier", "avocat", "institut de beauté"];

export default function Cite() {
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [r, setR] = useState<IaResult | null>(null);

  // Pré-remplissage depuis un lien (ex. une fiche Filon)
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("nom")) setName(q.get("nom")!);
    if (q.get("metier")) setTrade(q.get("metier")!);
    if (q.get("ville")) setCity(q.get("ville")!);
    if (q.get("site")) setWebsite(q.get("site")!);
  }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setR(null); setStep(0);
    const t = setInterval(() => setStep((x) => Math.min(x + 1, STEPS.length - 1)), 4000);
    try {
      const res = await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, trade, city, website }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setR(j);
      setTimeout(() => document.getElementById("resultat")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      setErr(e.message || "Le test a échoué, réessayez.");
    } finally {
      clearInterval(t); setBusy(false);
    }
  }

  return (
    <main className="c-main">
      <header className="c-top">
        <span className="c-logo"><i />Cité</span>
        <span className="c-muted">Visibilité dans les IA</span>
      </header>

      <section className="c-hero">
        <span className="c-pill">Test gratuit · 30 secondes</span>
        <h1>Quand vos clients demandent à une IA, <span>est-ce qu'elle vous cite ?</span></h1>
        <p>De plus en plus de gens demandent à ChatGPT ou Gemini « où trouver un bon coiffeur près de chez moi ». Découvrez si votre commerce fait partie des réponses, et qui est recommandé à votre place.</p>

        <form className="c-form" onSubmit={go}>
          <label><span>Votre établissement</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Boulangerie Martin" /></label>
          <label><span>Activité</span><input required list="c-trades" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="boulangerie" /></label>
          <label><span>Ville</span><input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Toulouse" /></label>
          <label><span>Site web <em>(facultatif)</em></span><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="monsite.fr" inputMode="url" /></label>
          <datalist id="c-trades">{EXAMPLES.map((x) => <option key={x} value={x} />)}</datalist>
          <button className="c-btn big" disabled={busy}>{busy ? "Test en cours…" : <>Lancer le test <i>→</i></>}</button>
        </form>
        {err && <p className="c-err">{err}</p>}
      </section>

      {busy && (
        <section className="c-wait" aria-live="polite">
          {STEPS.map((s, i) => <span key={s} className={i < step ? "done" : i === step ? "now" : ""}>{s}</span>)}
          <p className="c-muted">Les IA font de vraies recherches : comptez 20 à 40 secondes.</p>
        </section>
      )}

      {!r && !busy && (
        <section className="c-how">
          <div><b>01</b><h3>On pose la question</h3><p>Comme un client : « {trade || "boulangerie"} à {city || "Toulouse"}, lesquels me recommandes-tu ? », trois fois, formulée différemment.</p></div>
          <div><b>02</b><h3>Les IA cherchent</h3><p>Elles consultent le web en direct, comme pour un vrai client, et donnent leurs adresses.</p></div>
          <div><b>03</b><h3>Vous voyez tout</h3><p>Votre score, les concurrents cités à votre place, les sites qu'elles lisent, et quoi corriger.</p></div>
        </section>
      )}

      <div id="resultat">{r && <CiteReport r={r} />}</div>

      <footer className="c-foot c-muted">Cité · un outil {process.env.NEXT_PUBLIC_CITE_BRAND || "Thot Studio"}. Aucune donnée n'est revendue.</footer>
    </main>
  );
}
