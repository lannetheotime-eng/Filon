"use client";
import type { Lead, PipelineEntry, Stage } from "../lib/types";
import { STAGES } from "../lib/types";
import { getTrade } from "../lib/trades";
import { detectNeeds, serviceLabel } from "../lib/needs";

const CONTACTED: Stage[] = ["contacte", "a_relancer", "rdv", "signe", "perdu"];
const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function Dashboard({
  leads,
  pipeline,
  onOpen,
  prices,
}: {
  leads: Record<string, Lead>;
  pipeline: Record<string, PipelineEntry>;
  onOpen: (id: string) => void;
  prices: Record<string, number>;
}) {
  const ids = Object.keys(pipeline).filter((id) => leads[id]);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const contacted = ids.filter((id) => CONTACTED.includes(pipeline[id].stage));
  const rdv = ids.filter((id) => ["rdv", "signe"].includes(pipeline[id].stage));
  const signed = ids.filter((id) => pipeline[id].stage === "signe");
  const revenue = signed.reduce((s, id) => s + (pipeline[id].amount || 0), 0);
  const conv = contacted.length ? Math.round((signed.length / contacted.length) * 100) : 0;
  const thisWeek = contacted.filter((id) => (pipeline[id].contactedAt || pipeline[id].updatedAt) >= weekAgo).length;
  const due = ids
    .filter((id) => pipeline[id].followUp && pipeline[id].followUp! <= today && !["signe", "perdu"].includes(pipeline[id].stage))
    .sort((a, b) => pipeline[a].followUp!.localeCompare(pipeline[b].followUp!));

  // Potentiel : besoins retenus sur les dossiers en cours, chiffrés avec tes tarifs
  const open = ids.filter((id) => !["signe", "perdu"].includes(pipeline[id].stage));
  const demand = new Map<string, number>();
  let potential = 0;
  for (const id of open) {
    const all = detectNeeds(leads[id]);
    const keys = pipeline[id].needs ?? all.filter((n) => n.priority === 1).map((n) => n.key);
    for (const n of all.filter((x) => keys.includes(x.key))) {
      potential += prices[n.service] || 0;
      demand.set(n.service, (demand.get(n.service) || 0) + 1);
    }
  }
  const topDemand = [...demand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const byStage = STAGES.map((s) => ({ ...s, n: ids.filter((id) => pipeline[id].stage === s.id).length }));
  const max = Math.max(1, ...byStage.map((s) => s.n));

  const byTrade = new Map<string, { n: number; signed: number }>();
  for (const id of ids) {
    const t = leads[id].tradeId;
    const cur = byTrade.get(t) || { n: 0, signed: 0 };
    cur.n++;
    if (pipeline[id].stage === "signe") cur.signed++;
    byTrade.set(t, cur);
  }

  const byChannel = (["visite", "email", "message", "appel"] as const).map((c) => ({
    c,
    label: { visite: "Visite", email: "E-mail", message: "Message", appel: "Appel" }[c],
    n: contacted.filter((id) => pipeline[id].channel === c).length,
    signed: signed.filter((id) => pipeline[id].channel === c).length,
  }));

  return (
    <main className="dash-page">
      <div className="dash-head">
        <h1>Bilan</h1>
        <p className="hint">Calculé à partir de ton pipeline.</p>
      </div>

      <div className="kpis">
        <div className="kpi"><span>Contactées</span><strong>{contacted.length}</strong><small>dont {thisWeek} cette semaine</small></div>
        <div className="kpi"><span>Rendez-vous</span><strong>{rdv.length}</strong><small>{contacted.length ? Math.round((rdv.length / contacted.length) * 100) : 0} % des contacts</small></div>
        <div className="kpi"><span>Signées</span><strong>{signed.length}</strong><small>{conv} % de conversion</small></div>
        <div className="kpi"><span>Potentiel en cours</span><strong>{euro(potential)}</strong><small>{Object.keys(prices).length ? `${open.length} dossiers ouverts` : "Renseigne tes tarifs dans Réglages"}</small></div>
        <div className="kpi accent"><span>Chiffre signé</span><strong>{euro(revenue)}</strong><small>{signed.length ? `${euro(Math.round(revenue / signed.length))} en moyenne` : "Renseigne le montant à la signature"}</small></div>
      </div>

      <div className="dash-grid">
        <section className="panel-b">
          <h2>Entonnoir</h2>
          <div className="funnel">
            {byStage.map((s) => (
              <div className="frow" key={s.id} data-stage={s.id}>
                <span>{s.label}</span>
                <div className="fbar"><i style={{ width: `${(s.n / max) * 100}%` }} /></div>
                <b>{s.n}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-b">
          <h2>Relances à faire</h2>
          {due.length ? (
            <ul className="due-list">
              {due.slice(0, 8).map((id) => (
                <li key={id}>
                  <button onClick={() => onOpen(id)}>
                    <strong>{leads[id].name}</strong>
                    <small className={pipeline[id].followUp! < today ? "late" : ""}>
                      {pipeline[id].followUp! < today ? "En retard depuis le " : "Aujourd'hui, "}
                      {new Date(pipeline[id].followUp!).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Aucune relance en attente. Fixe une date de relance dans la fiche d'une entreprise.</p>
          )}
        </section>

        <section className="panel-b">
          <h2>Ce qui marche</h2>
          <table className="mini">
            <thead><tr><th>Canal</th><th>Contacts</th><th>Signés</th></tr></thead>
            <tbody>
              {byChannel.map((c) => (
                <tr key={c.c}><td>{c.label}</td><td>{c.n}</td><td>{c.signed}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Indique le canal dans la fiche quand tu contactes une entreprise.</p>
        </section>

        <section className="panel-b">
          <h2>Ce que tes prospects demandent</h2>
          {topDemand.length ? (
            <table className="mini">
              <thead><tr><th>Prestation</th><th>Dossiers</th><th>Valeur</th></tr></thead>
              <tbody>
                {topDemand.map(([sv, n]) => (
                  <tr key={sv}><td>{serviceLabel(sv)}</td><td>{n}</td><td>{prices[sv] ? euro(prices[sv] * n) : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="hint">Les besoins de tes dossiers en cours apparaîtront ici.</p>
          )}
        </section>

        <section className="panel-b">
          <h2>Par métier</h2>
          {byTrade.size ? (
            <table className="mini">
              <thead><tr><th>Métier</th><th>Suivies</th><th>Signées</th></tr></thead>
              <tbody>
                {[...byTrade.entries()].sort((a, b) => b[1].n - a[1].n).map(([t, v]) => (
                  <tr key={t}><td>{getTrade(t)?.label || t}</td><td>{v.n}</td><td>{v.signed}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="hint">Ajoute des entreprises au pipeline pour voir la répartition.</p>
          )}
        </section>
      </div>
    </main>
  );
}
