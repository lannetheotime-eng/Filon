"use client";
import { useEffect, useState } from "react";
import { decodeReport, explain, type ReportData } from "../../lib/report";

export default function Rapport() {
  const [r, setR] = useState<ReportData | null | undefined>(undefined);

  useEffect(() => {
    const d = new URLSearchParams(location.search).get("d");
    setR(d ? decodeReport(d) : null);
  }, []);

  useEffect(() => {
    if (r) document.title = `Diagnostic du site de ${r.n}`;
  }, [r]);

  if (r === undefined) return <main className="report" />;
  if (r === null)
    return (
      <main className="report">
        <div className="report-card"><h1>Rapport introuvable</h1><p>Le lien est incomplet. Demandez à la personne qui vous l'a envoyé de vous le renvoyer.</p></div>
      </main>
    );

  const level = r.s >= 60 ? "À refaire" : r.s >= 30 ? "À moderniser" : "Correct";
  const date = new Date(r.d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const good = [r.h && "Connexion sécurisée (HTTPS)", r.m && "Adapté aux téléphones"].filter(Boolean) as string[];
  const host = r.u.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <main className="report">
      <article className="report-card">
        <header className="report-head">
          <span className="hint">Diagnostic du {date}</span>
          <h1>Le site de {r.n}</h1>
          <a href={r.u} target="_blank" rel="noreferrer">{host}</a>
        </header>

        <div className="report-score">
          <div className="gauge-n" aria-label={`Score de ${r.s} sur 100`}>
            <strong>{r.s}</strong><span>/100</span>
          </div>
          <div>
            <b>{level}</b>
            <p>Plus le score est élevé, plus le site freine vos clients. {r.i.length} point{r.i.length > 1 ? "s" : ""} à corriger.</p>
          </div>
        </div>

        <h2>Ce qui freine vos clients</h2>
        <ol className="report-issues">
          {r.i.map((i) => {
            const e = explain(i);
            return (
              <li key={i}>
                <h3>{e.title}</h3>
                <p>{e.why}</p>
              </li>
            );
          })}
        </ol>

        {good.length > 0 && (
          <>
            <h2>Ce qui va bien</h2>
            <ul className="report-good">{good.map((g) => <li key={g}>{g}</li>)}</ul>
          </>
        )}

        <footer className="report-foot">
          <p>Analyse automatique de la page d'accueil, réalisée {r.c ? `pour une entreprise de ${r.c} ` : ""}le {date}.</p>
          {(r.f.s || r.f.n) && (
            <div className="report-contact">
              <b>{[r.f.n, r.f.s].filter(Boolean).join(", ")}</b>
              {r.f.p && <span>{r.f.p}</span>}
              {r.f.e && <a href={`mailto:${r.f.e}`}>{r.f.e}</a>}
              {r.f.w && <a href={/^https?:/.test(r.f.w) ? r.f.w : `https://${r.f.w}`} target="_blank" rel="noreferrer">{r.f.w}</a>}
            </div>
          )}
          <button className="btn ghost small no-print" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button>
        </footer>
      </article>
    </main>
  );
}
