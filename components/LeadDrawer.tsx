"use client";
import { useEffect, useState } from "react";
import type { Lead, PipelineEntry, Profile, Stage, Details } from "../lib/types";
import { STAGES, PRESENCE_LABEL } from "../lib/types";
import { getTrade } from "../lib/trades";
import { visitScript, objections, emails, directMessages, sitePrompt } from "../lib/generators";

type Tab = "approche" | "emails" | "messages" | "site";

function Copy({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn ghost small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? "Copié" : label}
    </button>
  );
}

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export default function LeadDrawer({
  lead,
  profile,
  entry,
  onClose,
  onPipeline,
}: {
  lead: Lead;
  profile: Profile;
  entry?: PipelineEntry;
  onClose: () => void;
  onPipeline: (patch: Partial<PipelineEntry> | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("approche");
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const trade = getTrade(lead.tradeId)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setDetails(null);
    setErr("");
  }, [lead.id]);

  async function loadDetails() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/details?id=${encodeURIComponent(lead.id)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDetails(j);
    } catch (e: any) {
      setErr(e.message || "Impossible de récupérer les détails.");
    } finally {
      setLoading(false);
    }
  }

  function markContacted(channel: PipelineEntry["channel"]) {
    onPipeline({ stage: "contacte", channel, contactedAt: new Date().toISOString(), followUp: entry?.followUp || plusDays(3) });
  }

  const q = encodeURIComponent(`${lead.name} ${lead.city}`);
  const mails = emails(lead, profile);
  const script = visitScript(lead, profile);
  const prompt = sitePrompt(lead, details);
  const to = lead.audit?.email || "";

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Fiche ${lead.name}`}>
        <header>
          <button className="close" onClick={onClose} aria-label="Fermer">×</button>
          <span className={`tag ${lead.presence}`}>{PRESENCE_LABEL[lead.presence]}</span>
          <h2>{lead.name}</h2>
          <p className="sub">{lead.category || trade.singular} à {lead.city}</p>
          <dl className="facts">
            <dt>Adresse</dt><dd>{lead.address}</dd>
            <dt>Téléphone</dt><dd>{lead.phone || "Non communiqué"}</dd>
            {to && (<><dt>E-mail</dt><dd>{to}</dd></>)}
            <dt>Google</dt>
            <dd>{lead.rating ? `${String(lead.rating).replace(".", ",")} / 5, ${lead.reviews} avis` : "Pas de note"}</dd>
            <dt>Priorité</dt><dd>{lead.score} / 100</dd>
          </dl>

          {lead.audit && (
            <div className="audit">
              <div className="audit-head">
                <strong>Site actuel à refaire</strong>
                <span className="audit-score">{lead.audit.score}<small>/100</small></span>
              </div>
              <ul>{lead.audit.issues.map((i) => <li key={i}>{i}</li>)}</ul>
              {lead.website && <a href={lead.website} target="_blank" rel="noreferrer">Voir le site actuel</a>}
            </div>
          )}

          <div className="actions">
            <a className="btn small" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`} target="_blank" rel="noreferrer">Itinéraire</a>
            <a className="btn ghost small" href={`mailto:${to}?subject=${encodeURIComponent(mails[0].subject)}&body=${encodeURIComponent(mails[0].body)}`}>Écrire un e-mail</a>
            {lead.mapsUrl && <a className="btn ghost small" href={lead.mapsUrl} target="_blank" rel="noreferrer">Fiche Google</a>}
            {lead.socialUrl && <a className="btn ghost small" href={lead.socialUrl} target="_blank" rel="noreferrer">Sa page</a>}
            <a className="btn ghost small" href={`https://www.instagram.com/explore/search/keyword/?q=${q}`} target="_blank" rel="noreferrer">Instagram</a>
            <a className="btn ghost small" href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${q}`} target="_blank" rel="noreferrer">Trouver le gérant</a>
            {lead.phone && <a className="btn ghost small" href={`tel:${(lead.phoneIntl || lead.phone).replace(/\s/g, "")}`}>Appeler</a>}
          </div>
        </header>

        <section className="track">
          <div className="quick">
            <span className="hint">Contacté aujourd'hui par</span>
            <button className="chip" onClick={() => markContacted("visite")}>Visite</button>
            <button className="chip" onClick={() => markContacted("email")}>E-mail</button>
            <button className="chip" onClick={() => markContacted("message")}>Message</button>
          </div>
          <div className="row2">
            <label className="field">
              Étape
              <select value={entry?.stage || ""} onChange={(e) => onPipeline(e.target.value ? { stage: e.target.value as Stage } : null)}>
                <option value="">Pas dans le pipeline</option>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              Relance prévue
              <input type="date" value={entry?.followUp || ""} disabled={!entry} onChange={(e) => onPipeline({ followUp: e.target.value })} />
            </label>
          </div>
          {entry?.stage === "signe" && (
            <label className="field">
              Montant signé (€)
              <input type="number" inputMode="numeric" min="0" step="10" value={entry.amount ?? ""} placeholder="ex. 1200" onChange={(e) => onPipeline({ amount: e.target.value ? Number(e.target.value) : undefined })} />
            </label>
          )}
          <label className="field">
            Notes
            <textarea
              value={entry?.notes || ""}
              disabled={!entry}
              placeholder={entry ? "Nom du gérant, objections, prochaine étape…" : "Ajoute l'entreprise au pipeline pour prendre des notes"}
              onChange={(e) => onPipeline({ notes: e.target.value })}
            />
          </label>
        </section>

        <div className="subtabs" role="tablist">
          {([
            ["approche", "Visite"],
            ["emails", "E-mails"],
            ["messages", "Messages"],
            ["site", "Maquette"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "approche" && (
          <section>
            <p className="hint" style={{ marginTop: 0 }}>Pour passer en boutique, de préférence en dehors des heures de rush.</p>
            {script.map((s) => (
              <div className="step" key={s.step}><span>{s.step}</span><p>{s.text}</p></div>
            ))}
            <div style={{ marginBottom: 16 }}><Copy text={script.map((s) => `${s.step} : ${s.text}`).join("\n\n")} label="Copier le script" /></div>
            <h3 className="h3">Réponses aux objections</h3>
            {objections(lead, profile).map((o) => (
              <details className="obj" key={o.q}><summary>{o.q}</summary><p>{o.a}</p></details>
            ))}
          </section>
        )}

        {tab === "emails" && (
          <section>
            {!to && <p className="hint" style={{ marginTop: 0 }}>Pas d'e-mail trouvé : cherche-le sur sa page ou demande-le lors de ta visite.</p>}
            {mails.map((m) => (
              <div className="block" key={m.label}>
                <div className="bh">
                  <span><b>{m.label}</b> · {m.subject}</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <Copy text={`${m.subject}\n\n${m.body}`} />
                    <a className="btn ghost small" href={`mailto:${to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>Ouvrir</a>
                  </span>
                </div>
                <pre>{m.body}</pre>
              </div>
            ))}
          </section>
        )}

        {tab === "messages" && (
          <section>
            {directMessages(lead, profile).map((m) => (
              <div className="block" key={m.label}>
                <div className="bh"><b>{m.label}</b><Copy text={m.body} /></div>
                <pre>{m.body}</pre>
              </div>
            ))}
          </section>
        )}

        {tab === "site" && (
          <section>
            <p style={{ marginTop: 0, color: "var(--ink-2)" }}>
              Direction propre à cette entreprise, effet « {trade.effect.name} ». Ajoute les horaires et les avis, puis colle le prompt dans Claude.
            </p>
            <div className="actions" style={{ marginBottom: 14 }}>
              <button className="btn small" onClick={loadDetails} disabled={loading || !!details}>
                {details ? "Horaires et avis ajoutés" : loading ? "Récupération…" : "Ajouter horaires et avis"}
              </button>
              <Copy text={prompt} label="Copier le prompt" />
              <a className="btn ghost small" href="https://claude.ai/new" target="_blank" rel="noreferrer">Ouvrir Claude</a>
            </div>
            {err && <p className="error">{err}</p>}
            <div className="block"><pre>{prompt}</pre></div>
          </section>
        )}
      </aside>
    </>
  );
}
