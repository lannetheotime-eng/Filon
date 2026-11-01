"use client";
import { useState } from "react";
import type { IaResult } from "../lib/ia-shared";
import { encodeIa, scoreLabel } from "../lib/ia-shared";

const BRAND = process.env.NEXT_PUBLIC_CITE_BRAND || "Thot Studio";
const CONTACT = process.env.NEXT_PUBLIC_CITE_CONTACT || "";
const SITE = process.env.NEXT_PUBLIC_CITE_SITE || "https://thot-studio.fr";
const OFFER = process.env.NEXT_PUBLIC_CITE_OFFER || "un suivi mensuel de votre visibilité dans les IA, avec les corrections faites pour vous";

export default function CiteReport({ r, shared = false }: { r: IaResult; shared?: boolean }) {
  const [copied, setCopied] = useState(false);
  const s = scoreLabel(r.score);
  const runs = r.engines.flatMap((e) => e.runs.map((x) => ({ ...x, engine: e.label })));
  const ok = runs.filter((x) => !x.error);
  const shareUrl = typeof window !== "undefined" ? `${location.origin}/ia/rapport?d=${encodeIa(r)}` : "";
  const mail = CONTACT
    ? `mailto:${CONTACT}?subject=${encodeURIComponent(`Visibilité IA de ${r.name}`)}&body=${encodeURIComponent(`Bonjour,\n\nJ'ai fait le test Cité pour ${r.name} (${r.trade}, ${r.city}) : score ${r.score}/100, cité dans ${r.citedIn} réponse(s) sur ${r.asked}.\n\nJ'aimerais en savoir plus sur votre accompagnement.\n\nLe rapport : ${shareUrl}\n`)}`
    : "";

  return (
    <section className="c-report">
      <div className="c-score" data-tone={s.tone}>
        <div className="c-ring" style={{ ["--p" as any]: `${r.score}` }}>
          <b>{r.score}</b>
          <small>/100</small>
        </div>
        <div className="c-score-text">
          <span className="c-eyebrow">{r.demo ? "Démonstration · " : ""}{r.trade} · {r.city}</span>
          <h2>{r.name} : <em>{s.label.toLowerCase()}</em></h2>
          <p>
            Cité dans <b>{r.citedIn} réponse{r.citedIn > 1 ? "s" : ""} sur {r.asked}</b>, quand on demande aux IA « {r.trade} à {r.city} ».
            <br />
            <span className="c-muted">Testé le {new Date(r.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} avec {r.engines.map((e) => e.label).join(" et ")}.</span>
          </p>
        </div>
      </div>

      {r.rivals.length > 0 && (
        <div className="c-block">
          <h3>Qui les IA recommandent à votre place</h3>
          <ol className="c-rivals">
            {r.rivals.map((x) => (
              <li key={x.name}>
                <span>{x.name}</span>
                <i style={{ width: `${Math.round((x.count / r.asked) * 100)}%` }} />
                <b>{x.count}/{r.asked}</b>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="c-block">
        <h3>Ce que vous devriez faire</h3>
        <ul className="c-tips">
          {r.tips.map((t) => (
            <li key={t.title} data-level={t.level}>
              <b>{t.title}</b>
              <p>{t.text}</p>
            </li>
          ))}
        </ul>
      </div>

      {r.domains.length > 0 && (
        <div className="c-block">
          <h3>Les sites que les IA ont consultés</h3>
          <div className="c-chips">{r.domains.map((d) => <span key={d.domain}>{d.domain}<small>{d.count}</small></span>)}</div>
        </div>
      )}

      <div className="c-block">
        <h3>Les réponses des IA</h3>
        <div className="c-runs">
          {ok.map((x, i) => (
            <details key={i} className="c-run" open={i === 0}>
              <summary>
                <span className={`c-dot ${x.cited ? "yes" : "no"}`} aria-hidden />
                <span className="c-q">{x.prompt.split(". ")[0].split(" Donne")[0].split(" Réponds")[0]}</span>
                <small>{x.engine} · {x.cited ? (x.rank ? `cité en n°${x.rank}` : "cité") : "pas cité"}</small>
              </summary>
              {x.items.length ? (
                <ol>
                  {x.items.map((it) => (
                    <li key={it.rank + it.name} className={it.isYou ? "you" : ""}>
                      <b>{it.name}</b>{it.why && <span> — {it.why}</span>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="c-muted">{x.answer ? x.answer.slice(0, 600) : "Réponse non conservée dans le lien partagé."}</p>
              )}
            </details>
          ))}
        </div>
        <p className="c-muted c-note">Les réponses des IA varient d'une fois à l'autre et selon la personne qui pose la question. Ce test les interroge avec la recherche web activée, comme le ferait un client, au moment indiqué.</p>
      </div>

      <div className="c-cta">
        <div>
          <span className="c-eyebrow">Passer devant</span>
          <h3>Faites-vous recommander par les IA.</h3>
          <p>{BRAND} vous propose {OFFER}.</p>
        </div>
        <div className="c-cta-actions">
          <a className="c-btn" href={mail || SITE} target={mail ? undefined : "_blank"} rel="noreferrer">Être accompagné <i>→</i></a>
          {!shared && (
            <button className="c-btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>
              {copied ? "Lien copié" : "Copier le lien du rapport"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
