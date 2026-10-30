"use client";
import { useEffect, useState } from "react";
import type { Lead, PipelineEntry, Profile, Stage, Details } from "../lib/types";
import { STAGES } from "../lib/types";
import { getTrade } from "../lib/trades";
import { callScript, objections, emails, directMessages, sitePrompt } from "../lib/generators";

type Tab = "appel" | "emails" | "messages" | "site";

function Copy({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn ghost small"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copié" : label}
    </button>
  );
}

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
  const [tab, setTab] = useState<Tab>("appel");
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

  const q = encodeURIComponent(`${lead.name} ${lead.city}`);
  const script = callScript(lead, profile);
  const prompt = sitePrompt(lead, details);

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Fiche ${lead.name}`}>
        <header>
          <button className="close" onClick={onClose} aria-label="Fermer">×</button>
          <h2>{lead.name}</h2>
          <span className={`tag ${lead.presence === "aucun" ? "none" : "soc"}`}>
            {lead.presence === "aucun" ? "Aucun site" : "Réseaux seulement"}
          </span>
          <dl className="facts">
            <dt>Adresse</dt><dd>{lead.address}</dd>
            <dt>Téléphone</dt><dd>{lead.phone || "Non communiqué"}</dd>
            <dt>Google</dt>
            <dd>{lead.rating ? `${String(lead.rating).replace(".", ",")} / 5 · ${lead.reviews} avis` : "Pas de note"}</dd>
            <dt>Priorité</dt><dd>{lead.score} / 100</dd>
          </dl>
          <div className="actions">
            {lead.phone && <a className="btn small" href={`tel:${(lead.phoneIntl || lead.phone).replace(/\s/g, "")}`}>Appeler</a>}
            {lead.mapsUrl && <a className="btn ghost small" href={lead.mapsUrl} target="_blank" rel="noreferrer">Fiche Google</a>}
            {lead.socialUrl && <a className="btn ghost small" href={lead.socialUrl} target="_blank" rel="noreferrer">Sa page</a>}
            <a className="btn ghost small" href={`https://www.instagram.com/explore/search/keyword/?q=${q}`} target="_blank" rel="noreferrer">Instagram</a>
            <a className="btn ghost small" href={`https://www.linkedin.com/search/results/all/?keywords=${q}`} target="_blank" rel="noreferrer">LinkedIn</a>
            <a className="btn ghost small" href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${q}`} target="_blank" rel="noreferrer">Trouver le gérant</a>
          </div>
        </header>

        <section>
          <div className="row2">
            <label className="field">
              Étape
              <select
                value={entry?.stage || ""}
                onChange={(e) => onPipeline(e.target.value ? { stage: e.target.value as Stage } : null)}
              >
                <option value="">Pas dans le pipeline</option>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              Relance prévue
              <input
                type="date"
                value={entry?.followUp || ""}
                disabled={!entry}
                onChange={(e) => onPipeline({ followUp: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            Notes
            <textarea
              value={entry?.notes || ""}
              disabled={!entry}
              placeholder={entry ? "Gérant, objections, prochaine étape…" : "Ajoute l'entreprise au pipeline pour prendre des notes"}
              onChange={(e) => onPipeline({ notes: e.target.value })}
            />
          </label>
        </section>

        <div className="subtabs" role="tablist">
          {([
            ["appel", "Script d'appel"],
            ["emails", "E-mails"],
            ["messages", "Messages"],
            ["site", "Prompt du site"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "appel" && (
          <section>
            {script.map((s) => (
              <div className="step" key={s.step}><span>{s.step}</span><p>{s.text}</p></div>
            ))}
            <div style={{ marginBottom: 16 }}><Copy text={script.map((s) => `${s.step} : ${s.text}`).join("\n\n")} label="Copier le script" /></div>
            <h3 style={{ fontSize: 15, margin: "8px 0" }}>Réponses aux objections</h3>
            {objections(lead, profile).map((o) => (
              <details className="obj" key={o.q}><summary>{o.q}</summary><p>{o.a}</p></details>
            ))}
          </section>
        )}

        {tab === "emails" && (
          <section>
            {emails(lead, profile).map((m) => (
              <div className="block" key={m.label}>
                <div className="bh">
                  <span>{m.label} · {m.subject}</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <Copy text={`${m.subject}\n\n${m.body}`} />
                    <a className="btn ghost small" href={`mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>Ouvrir</a>
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
                <div className="bh"><span>{m.label}</span><Copy text={m.body} /></div>
                <pre>{m.body}</pre>
              </div>
            ))}
          </section>
        )}

        {tab === "site" && (
          <section>
            <p style={{ marginTop: 0, color: "var(--ink-2)" }}>
              Direction propre à cette entreprise, effet « {trade.effect.name} ». Récupère les horaires et les avis pour un site plus juste, puis colle le prompt dans Claude.
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
