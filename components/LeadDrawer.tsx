"use client";
import { useEffect, useState } from "react";
import type { Lead, PipelineEntry, Profile, Stage, Details, Dirigeant } from "../lib/types";
import { STAGES, PRESENCE_LABEL } from "../lib/types";
import { getTrade } from "../lib/trades";
import { visitScript, objections, emails, directMessages } from "../lib/generators";
import { approachPlan, CHANNEL_LABEL } from "../lib/approach";
import { encodeReport } from "../lib/report";

type Tab = "plan" | "visite" | "emails" | "messages";

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
  const [tab, setTab] = useState<Tab>("plan");
  const [details, setDetails] = useState<Details | null>(null);
  const [dirs, setDirs] = useState<Dirigeant[] | null>(null);
  const [busy, setBusy] = useState<"" | "avis" | "dir">("");
  const [err, setErr] = useState("");
  const trade = getTrade(lead.tradeId)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setDetails(null);
    setDirs(null);
    setErr("");
    setTab("plan");
  }, [lead.id]);

  async function loadReviews() {
    setBusy("avis");
    setErr("");
    try {
      const r = await fetch(`/api/details?id=${encodeURIComponent(lead.id)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDetails(j);
    } catch (e: any) {
      setErr(e.message || "Impossible de récupérer les avis.");
    } finally {
      setBusy("");
    }
  }

  async function loadDirigeant() {
    setBusy("dir");
    setErr("");
    try {
      const r = await fetch(`/api/dirigeant?name=${encodeURIComponent(lead.name)}&address=${encodeURIComponent(lead.address)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDirs(j.results || []);
    } catch (e: any) {
      setErr(e.message || "Recherche impossible.");
    } finally {
      setBusy("");
    }
  }

  function markContacted(channel: PipelineEntry["channel"]) {
    onPipeline({ stage: "contacte", channel, contactedAt: new Date().toISOString(), followUp: entry?.followUp || plusDays(3) });
  }

  const q = encodeURIComponent(`${lead.name} ${lead.city}`);
  const rep = encodeReport(lead, profile);
  const reportUrl = rep && typeof window !== "undefined" ? `${location.origin}/rapport?d=${rep}` : undefined;
  const mails = emails(lead, profile, reportUrl);
  const script = visitScript(lead, profile);
  const objs = objections(lead, profile);
  const plan = approachPlan(lead, profile);
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
          <div className="actions">
            <a className="btn small" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`} target="_blank" rel="noreferrer">Itinéraire</a>
            <a className="btn ghost small" href={`mailto:${to}?subject=${encodeURIComponent(mails[0].subject)}&body=${encodeURIComponent(mails[0].body)}`}>Écrire un e-mail</a>
            {lead.mapsUrl && <a className="btn ghost small" href={lead.mapsUrl} target="_blank" rel="noreferrer">Fiche Google</a>}
            {lead.website && <a className="btn ghost small" href={lead.website} target="_blank" rel="noreferrer">Son site</a>}
            {reportUrl && <a className="btn ghost small" href={reportUrl} target="_blank" rel="noreferrer">Rapport d'audit</a>}
            {reportUrl && <Copy text={reportUrl} label="Copier le lien du rapport" />}
            {lead.socialUrl && <a className="btn ghost small" href={lead.socialUrl} target="_blank" rel="noreferrer">Sa page</a>}
            <a className="btn ghost small" href={`https://www.instagram.com/explore/search/keyword/?q=${q}`} target="_blank" rel="noreferrer">Instagram</a>
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
            ["plan", "Plan d'approche"],
            ["visite", "Visite"],
            ["emails", "E-mails"],
            ["messages", "Messages"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "plan" && (
          <section className="plan">
            <div className="verdict">
              <span className="hint">Canal conseillé</span>
              <strong>{CHANNEL_LABEL[plan.channel]}</strong>
              <p>{plan.reasons.join(" ")}</p>
              <span className="hint">Plan B : {CHANNEL_LABEL[plan.secondary].toLowerCase()}.</span>
            </div>

            <div className="plan-grid">
              <div className="when">
                <h3>Quand</h3>
                <p className="big">{plan.slot.text}</p>
                {plan.slot.next && <p>Prochain créneau : <b>{plan.slot.next}</b></p>}
                <p className="hint">À éviter : {plan.avoid}.{plan.slot.known ? " Créneau croisé avec ses horaires Google." : " Horaires inconnus : vérifie sur sa fiche Google."}</p>
              </div>
              <div>
                <h3>À qui</h3>
                <p>{plan.ask}</p>
                {dirs === null ? (
                  <button className="btn ghost small" onClick={loadDirigeant} disabled={busy === "dir"}>
                    {busy === "dir" ? "Recherche…" : "Trouver le dirigeant"}
                  </button>
                ) : dirs.length ? (
                  <div className="dirs">
                    {dirs.slice(0, 2).map((d) => (
                      <div key={d.siren} className="dir">
                        <strong>{d.people.length ? d.people.slice(0, 2).map((x) => x.name).join(", ") : d.company}</strong>
                        <small>
                          {d.people[0]?.role ? `${d.people[0].role} · ` : ""}{d.company}{d.created ? `, créée en ${d.created.slice(0, 4)}` : ""}
                        </small>
                        <small>{d.address}</small>
                      </div>
                    ))}
                    <p className="hint">Registre officiel des entreprises. Vérifie que l'adresse correspond avant d'utiliser le nom.</p>
                  </div>
                ) : (
                  <p className="hint">Aucune correspondance dans le registre. <a href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${q}`} target="_blank" rel="noreferrer">Chercher à la main</a></p>
                )}
              </div>
            </div>

            <h3>L'angle</h3>
            <p className="angle">{plan.angle}</p>

            <h3>Tes arguments</h3>
            <ul className="facts-list">{plan.facts.map((f) => <li key={f}>{f}</li>)}</ul>

            <h3>Ce que tu proposes</h3>
            <p>{plan.offer.charAt(0).toUpperCase() + plan.offer.slice(1)}. Ensuite : {profile.offer}.</p>
            <p className="hint">Ses clients cherchent surtout : {plan.needs.join(", ")}.</p>

            <h3>Ce que disent ses clients</h3>
            {details?.reviews?.filter((r) => r.text).length ? (
              <ul className="reviews">
                {details.reviews!.filter((r) => r.text).slice(0, 3).map((r) => (
                  <li key={r.author + r.when}>
                    <p>« {r.text.replace(/\s+/g, " ").trim().slice(0, 240)}{r.text.length > 240 ? "…" : ""} »</p>
                    <small>{r.author}, {r.rating}/5, {r.when}</small>
                  </li>
                ))}
              </ul>
            ) : details ? (
              <p className="hint">Aucun avis rédigé disponible.</p>
            ) : (
              <button className="btn ghost small" onClick={loadReviews} disabled={busy === "avis"}>
                {busy === "avis" ? "Chargement…" : "Voir ses derniers avis à citer"}
              </button>
            )}
            {err && <p className="error">{err}</p>}

            <h3>À préparer</h3>
            <ul className="checklist">{plan.prep.map((x) => <li key={x}>{x}</li>)}</ul>

            <h3>Objections probables</h3>
            {objs.filter((o) => plan.likely.includes(o.id)).map((o) => (
              <details className="obj" key={o.id} open><summary>{o.q}</summary><p>{o.a}</p></details>
            ))}

            <h3>Cadence</h3>
            <ol className="cadence">{plan.cadence.map((c) => <li key={c}>{c}</li>)}</ol>
          </section>
        )}

        {tab === "visite" && (
          <section>
            <p className="hint" style={{ marginTop: 0 }}>Pour passer en boutique : {plan.slot.text.toLowerCase()}.</p>
            {script.map((s) => (
              <div className="step" key={s.step}><span>{s.step}</span><p>{s.text}</p></div>
            ))}
            <div style={{ marginBottom: 16 }}><Copy text={script.map((s) => `${s.step} : ${s.text}`).join("\n\n")} label="Copier le script" /></div>
            <h3 className="h3">Toutes les objections</h3>
            {objs.map((o) => (
              <details className="obj" key={o.id}><summary>{o.q}</summary><p>{o.a}</p></details>
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
      </aside>
    </>
  );
}
