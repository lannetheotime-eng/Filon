"use client";
import { useState } from "react";
import type { Lead } from "../lib/types";
import type { Cat, Check, DeepAudit } from "../lib/deep-types";
import { CAT_LABEL, EFFORT_LABEL } from "../lib/deep-types";

const tone = (n: number) => (n >= 80 ? "ok" : n >= 55 ? "mid" : "bad");

function planText(a: DeepAudit, name: string) {
  const todo = a.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const g = (e: Check["effort"]) => todo.filter((c) => c.effort === e);
  const block = (t: string, l: Check[]) => (l.length ? [`${t}`, ...l.map((c) => `• ${c.title} : ${c.fix}`), ""] : []);
  return [
    `Audit du site de ${name} (${a.finalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}) · santé ${a.health}/100`,
    "",
    ...block("Corrections rapides", g("rapide")),
    ...block("Chantiers", g("moyen")),
    ...block("Gros travaux", g("lourd")),
    `Recommandation : ${a.verdict.text}`,
  ].join("\n");
}

export default function AuditPanel({ lead, trade, onLead, notify }: { lead: Lead; trade: string; onLead: (patch: Partial<Lead>) => void; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cat, setCat] = useState<Cat | "all">("all");
  const a = lead.deep;
  const url = lead.website || lead.audit?.url;

  async function run() {
    if (!url) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name: lead.name, city: lead.city, trade, phone: lead.phone, rating: lead.rating, reviews: lead.reviews, photos: lead.photoCount, hours: lead.hours ? lead.hours.length > 0 : lead.id.startsWith("demo-") ? true : undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onLead({ deep: j });
      notify(`Audit terminé : santé ${j.health}/100`);
    } catch (e: any) {
      setErr(e.message || "L'audit a échoué.");
    } finally {
      setBusy(false);
    }
  }

  if (!url)
    return (
      <section className="audit">
        <p className="hint" style={{ marginTop: 0 }}>Pas de site à analyser : l'enjeu est d'en créer un. Pour sa fiche Google, regarde les points de l'onglet Approche.</p>
      </section>
    );

  if (!a)
    return (
      <section className="audit">
        <div className="audit-start">
          <b>Audit complet du site</b>
          <p>Vitesse mesurée par Google, téléphone, référencement, visibilité locale, sécurité et versions WordPress, obligations légales, prise de contact. Pour chaque point : ce qui ne va pas, pourquoi, et comment le corriger.</p>
          <p className="hint">Gratuit, sans requête Google Places. Compte 20 à 50 secondes.</p>
          <button className="btn" onClick={run} disabled={busy}>{busy ? "Analyse en cours…" : "Lancer l'audit"}</button>
          {err && <p className="error">{err}</p>}
        </div>
      </section>
    );

  const list = a.checks.filter((c) => cat === "all" || c.cat === cat);
  const todo = list.filter((c) => c.status === "fail" || c.status === "warn");
  const infos = list.filter((c) => c.status === "info");
  const good = list.filter((c) => c.status === "ok");
  const isWp = a.cms === "WordPress";
  const quick = a.checks.filter((c) => (c.status === "fail" || c.status === "warn") && c.effort === "rapide" && c.impact >= 2).length;

  return (
    <section className="audit">
      <div className="audit-head">
        <div className={`audit-ring ${tone(a.health)}`} style={{ ["--p" as any]: a.health }}>
          <b>{a.health}</b><small>/100</small>
        </div>
        <div>
          <span className="eyebrow-s">Santé du site · {new Date(a.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
          <p className={`verdict ${a.verdict.kind}`}><b>{a.verdict.kind === "refonte" ? "Refonte" : a.verdict.kind === "optimisation" ? "Optimisation" : "Maintenance"}</b> {a.verdict.text}</p>
          <p className="hint" style={{ margin: 0 }}>
            {a.checks.filter((c) => c.status === "fail").length} problèmes, {a.checks.filter((c) => c.status === "warn").length} points à améliorer, dont {quick} corrigeables en moins d'une heure.
            {a.cms ? ` ${a.cms}${a.cmsVersion ? ` ${a.cmsVersion}` : ""}${a.builder ? ` + ${a.builder}` : ""}${a.theme ? ` · thème ${a.theme}` : ""}.` : ""}
          </p>
        </div>
      </div>

      <div className="audit-cats" role="tablist">
        <button role="tab" aria-selected={cat === "all"} onClick={() => setCat("all")}><span>Tout</span><b>{a.health}</b></button>
        {a.cats.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} className={tone(c.score)} onClick={() => setCat(c.id)}>
            <span>{c.label}</span><b>{c.score}</b><i style={{ width: `${c.score}%` }} />
          </button>
        ))}
      </div>

      {a.psi && cat !== "legal" && cat !== "local" && cat !== "conversion" && (
        <div className="psi">
          {([["Performance", a.psi.perf], ["SEO", a.psi.seo], ["Accessibilité", a.psi.a11y], ["Bonnes pratiques", a.psi.bp]] as [string, number | undefined][]).filter(([, v]) => v != null).map(([l, v]) => (
            <div key={l} className={tone(v!)}><b>{v}</b><span>{l}</span></div>
          ))}
          <small>Mesure Google PageSpeed sur mobile{a.psi.lcp ? ` · affichage ${a.psi.lcp}` : ""}{a.psi.weight ? ` · poids ${a.psi.weight}` : ""}</small>
        </div>
      )}

      <ul className="checks">
        {todo.map((c) => (
          <li key={c.id} className={`ck ${c.status}`}>
            <details open={c.status === "fail"}>
              <summary>
                <i aria-hidden />
                <span className="ck-t">{c.title}</span>
                <span className={`eff ${c.effort}`}>{c.effort}</span>
              </summary>
              {c.found && <p className="ck-found">{c.found}</p>}
              <p><b>Pourquoi :</b> {c.why}</p>
              <p><b>Quoi faire :</b> {c.fix}</p>
              {isWp && c.wp && <p className="ck-wp"><b>Sur WordPress :</b> {c.wp}</p>}
              <p className="hint ck-meta">{EFFORT_LABEL[c.effort]} · {CAT_LABEL[c.cat]}</p>
            </details>
          </li>
        ))}
        {!todo.length && <li className="hint">Rien à corriger dans cette rubrique.</li>}
      </ul>

      {infos.length > 0 && (
        <details className="fold">
          <summary>À savoir ({infos.length})</summary>
          <ul className="facts-list">{infos.map((c) => <li key={c.id}><b>{c.title}.</b> {c.found ? `${c.found}. ` : ""}{c.fix}</li>)}</ul>
        </details>
      )}
      {good.length > 0 && (
        <details className="fold">
          <summary>Ce qui va bien ({good.length})</summary>
          <ul className="facts-list">{good.map((c) => <li key={c.id}>{c.title}{c.found ? ` (${c.found})` : ""}</li>)}</ul>
        </details>
      )}
      {a.plugins?.length ? (
        <details className="fold">
          <summary>Extensions WordPress visibles ({a.plugins.length})</summary>
          <ul className="facts-list">{a.plugins.map((p) => <li key={p.slug}>{p.slug} {p.version || ""}{p.latest ? (p.version && p.latest !== p.version ? ` → ${p.latest} disponible` : " (à jour)") : ""}</li>)}</ul>
        </details>
      ) : null}

      <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn ghost small" onClick={async () => { try { await navigator.clipboard.writeText(planText(a, lead.name)); notify("Plan d'action copié"); } catch {} }}>Copier le plan d'action</button>
        <button className="btn ghost small" onClick={run} disabled={busy}>{busy ? "Analyse…" : "Relancer l'audit"}</button>
      </div>
      {a.psiError && <p className="hint">Vitesse Google non mesurée cette fois : {a.psiError}</p>}
      {err && <p className="error">{err}</p>}
    </section>
  );
}
