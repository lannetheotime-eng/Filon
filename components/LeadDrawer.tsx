"use client";
import { useEffect, useState } from "react";
import type { Lead, PipelineEntry, Profile, Stage, Details, Dirigeant } from "../lib/types";
import { STAGES } from "../lib/types";
import { getTrade } from "../lib/trades";
import { visitScript, objections, emails, directMessages } from "../lib/generators";
import { approachPlan, CHANNEL_LABEL } from "../lib/approach";
import { encodeReport } from "../lib/report";
import { detectNeeds, proposal } from "../lib/needs";
import { liveProof, roi, closingLine, ticketQuestion, lines } from "../lib/pitch";
import { siteStatus, activity } from "../lib/site";

type Tab = "plan" | "besoins" | "visite" | "emails" | "messages";

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
  canSpend = () => true,
  onSpend = () => {},
}: {
  lead: Lead;
  profile: Profile;
  entry?: PipelineEntry;
  onClose: () => void;
  onPipeline: (patch: Partial<PipelineEntry> | null) => void;
  canSpend?: (n: number) => boolean;
  onSpend?: (n: number) => void;
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
    // Fiche ouverte sans date de création : on interroge le registre (gratuit)
    if (!lead.created && lead.registry !== "none" && !lead.id.startsWith("demo-")) loadDirigeant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function loadReviews() {
    if (!lead.id.startsWith("demo-") && !canSpend(1)) {
      setErr("Plafond de requêtes du jour atteint : reviens demain pour rester dans le gratuit.");
      return;
    }
    setBusy("avis");
    setErr("");
    try {
      const r = await fetch(`/api/details?id=${encodeURIComponent(lead.id)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDetails(j);
      if (!lead.id.startsWith("demo-")) onSpend(1);
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
  const created = lead.created || dirs?.[0]?.created;
  const plan = approachPlan(lead, profile, created);
  const needs = detectNeeds(lead, { created });
  const chosen = entry?.needs ?? needs.filter((n) => n.priority === 1).map((n) => n.key);
  const picked = needs.filter((n) => chosen.includes(n.key));
  const prop = proposal(picked, profile.prices || {});
  const euro = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const propText = [
    `Proposition pour ${lead.name}`,
    "",
    ...prop.lines.map((x) => `• ${x.title}${x.price != null ? ` : ${euro(x.price)}` : " : sur devis"}`),
    "",
    prop.lines.length ? `Total${prop.complete ? "" : " (hors éléments sur devis)"} : ${euro(prop.total)} HT` : "",
    profile.offer ? `Ensuite : ${profile.offer}.` : "",
  ].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");
  function toggleNeed(key: string) {
    const next = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key];
    onPipeline({ needs: next });
  }
  const to = lead.audit?.email || "";

  const st = siteStatus(lead);
  const act = activity(created);
  const legal = lead.legalName || dirs?.[0]?.company;
  const [textTab, setTextTab] = useState<"visite" | "emails" | "messages">(plan.channel === "visite" ? "visite" : plan.channel === "email" ? "emails" : "messages");
  const tq = ticketQuestion(lead.tradeId);
  const price = prop.total || Number(((profile.price || "").match(/\d[\d\s]*/)?.[0] || "").replace(/\s/g, "")) || 0;
  const r = roi(price, entry?.ticket || 0);

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Fiche ${lead.name}`}>
        <header className="d-head">
          <button className="close" onClick={onClose} aria-label="Fermer">×</button>
          <h2>{lead.name}</h2>
          <p className="sub">{lead.address.replace(/, France$/, "")}{lead.phone ? ` · ${lead.phone}` : ""}</p>

          <div className="d-facts">
            <div><span>Site</span><b className={st.kind === "wp" ? "is-wp" : st.kind === "other" ? "is-other" : ""}>{st.label}</b></div>
            <div><span>En activité</span><b>{act ? act.label.replace(/^Depuis /, "depuis ") : lead.id.startsWith("demo-") ? "—" : lead.registry === "none" || (dirs !== null && !dirs.length) ? "Inconnu" : "…"}</b></div>
            <div><span>Google</span><b>{lead.rating ? `${String(lead.rating).replace(".", ",")} ★ · ${lead.reviews} avis` : "Pas de note"}</b></div>
          </div>
          {act && legal && <p className="hint legal">Registre : {legal}</p>}

          <div className="d-actions">
            <a className="btn small" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`} target="_blank" rel="noreferrer">Itinéraire</a>
            <a className="btn ghost small" href={`mailto:${to}?subject=${encodeURIComponent(mails[0].subject)}&body=${encodeURIComponent(mails[0].body)}`}>E-mail</a>
            {reportUrl && <Copy text={reportUrl} label="Lien du rapport d'audit" />}
            <details className="more">
              <summary className="btn ghost small">Plus</summary>
              <div className="more-menu">
                {lead.mapsUrl && <a href={lead.mapsUrl} target="_blank" rel="noreferrer">Fiche Google</a>}
                {lead.website && <a href={lead.website} target="_blank" rel="noreferrer">Ouvrir son site</a>}
                {reportUrl && <a href={reportUrl} target="_blank" rel="noreferrer">Voir le rapport d'audit</a>}
                {lead.socialUrl && <a href={lead.socialUrl} target="_blank" rel="noreferrer">Sa page sur les réseaux</a>}
                <a href={`https://www.instagram.com/explore/search/keyword/?q=${q}`} target="_blank" rel="noreferrer">Chercher sur Instagram</a>
                {lead.phone && <a href={`tel:${(lead.phoneIntl || lead.phone).replace(/\s/g, "")}`}>Appeler</a>}
                {to && <span className="muted">E-mail : {to}</span>}
              </div>
            </details>
          </div>
        </header>

        <section className="d-track">
          <div className="d-track-row">
            <select value={entry?.stage || ""} onChange={(e) => onPipeline(e.target.value ? { stage: e.target.value as Stage } : null)} aria-label="Étape">
              <option value="">+ Ajouter au pipeline</option>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <label className="d-date">Relance<input type="date" value={entry?.followUp || ""} disabled={!entry} onChange={(e) => onPipeline({ followUp: e.target.value })} /></label>
          </div>
          <div className="quick">
            <span className="hint">Contacté aujourd'hui :</span>
            <button className="chip" onClick={() => markContacted("visite")}>Visite</button>
            <button className="chip" onClick={() => markContacted("email")}>E-mail</button>
            <button className="chip" onClick={() => markContacted("message")}>Message</button>
          </div>
          {entry?.stage === "signe" && (
            <label className="field">
              Montant signé (€)
              <input type="number" inputMode="numeric" min="0" step="10" value={entry.amount ?? ""} placeholder="ex. 1200" onChange={(e) => onPipeline({ amount: e.target.value ? Number(e.target.value) : undefined })} />
            </label>
          )}
          {entry && (
            <details className="notes">
              <summary>Notes{entry.notes ? " ✎" : ""}{entry.log?.length ? ` · historique (${entry.log.length})` : ""}</summary>
              <textarea value={entry.notes || ""} placeholder="Nom du gérant, objections, prochaine étape…" onChange={(e) => onPipeline({ notes: e.target.value })} />
              {entry.log?.length ? (
                <ol className="history-list">
                  {[...entry.log].reverse().map((h, i) => (
                    <li key={h.at + i}><time>{new Date(h.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</time> {h.text}</li>
                  ))}
                </ol>
              ) : null}
            </details>
          )}
        </section>

        <div className="subtabs" role="tablist">
          {([
            ["plan", "Approche"],
            ["besoins", `Offre${picked.length ? ` (${picked.length})` : ""}`],
            ["visite", "Textes"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id || (id === "visite" && (tab === "emails" || tab === "messages"))} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "plan" && (
          <section className="plan">
            <div className="brief">
              <div>
                <span>Comment</span>
                <b>{CHANNEL_LABEL[plan.channel]}</b>
              </div>
              <div>
                <span>Quand</span>
                <b>{plan.slot.next ? plan.slot.next.charAt(0).toUpperCase() + plan.slot.next.slice(1) : plan.slot.text}</b>
              </div>
              <div>
                <span>À qui</span>
                <b>{dirs?.[0]?.people?.[0]?.name || plan.ask.replace(/^Demande /, "").replace(/\.$/, "")}</b>
              </div>
            </div>
            <p className="angle">{plan.angle}</p>

            <details className="step-card" open>
              <summary><i>1</i> Lui montrer, sur son téléphone</summary>
              <ol className="proof">{liveProof(lead).map((x) => <li key={x}>{x}</li>)}</ol>
            </details>

            <details className="step-card" open>
              <summary><i>2</i> Chiffrer avec lui</summary>
              <div className="roi">
                <p>Demande-lui : <b>{tq.ask}</b></p>
                <label className="roi-in">
                  {tq.label}
                  <input type="number" inputMode="numeric" min="0" step="10" placeholder="€" value={entry?.ticket ?? ""} onChange={(e) => onPipeline({ ticket: e.target.value ? Number(e.target.value) : undefined })} />
                  €
                </label>
                {r ? <p className="roi-out">« {r.text} »</p> : <p className="hint">{price ? "Saisis sa réponse pour obtenir la phrase à lui dire." : "Choisis ce que tu proposes dans l'onglet Offre pour chiffrer."}</p>}
              </div>
            </details>

            <details className="step-card" open={lines(profile.guarantees).length > 0}>
              <summary><i>3</i> Lui enlever le risque</summary>
              {lines(profile.guarantees).length ? (
                <ul className="facts-list">{lines(profile.guarantees).map((g) => <li key={g}>{g}</li>)}</ul>
              ) : (
                <p className="hint">Ajoute tes garanties dans Réglages (seulement celles que tu offres vraiment).</p>
              )}
              {lines(profile.references).length > 0 && <p className="refs">Ils m'ont fait confiance : {lines(profile.references).join(", ")}.</p>}
            </details>

            <details className="step-card" open>
              <summary><i>4</i> Conclure</summary>
              <p className="angle">{closingLine(picked[0]?.title || needs[0]?.title, picked[0] ? profile.prices?.[picked[0].service] : undefined)}</p>
            </details>

            <h3 className="sec">Pour aller plus loin</h3>
            <details className="fold">
              <summary>Ses points faibles et tes arguments ({plan.facts.length})</summary>
              <ul className="facts-list">{plan.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            </details>
            <details className="fold">
              <summary>Objections probables ({objs.filter((o) => plan.likely.includes(o.id)).length})</summary>
              {objs.filter((o) => plan.likely.includes(o.id)).map((o) => (
                <div className="obj-a" key={o.id}><b>{o.q}</b><p>{o.a}</p></div>
              ))}
            </details>
            <details className="fold">
              <summary>Créneau, dirigeant et préparation</summary>
              <p><b>{plan.slot.text}.</b> À éviter : {plan.avoid}.{plan.slot.known ? "" : " Horaires inconnus : vérifie sur sa fiche Google."}</p>
              <p>{plan.reasons.join(" ")} Plan B : {CHANNEL_LABEL[plan.secondary].toLowerCase()}.</p>
              {dirs === null ? (
                <button className="btn ghost small" onClick={loadDirigeant} disabled={busy === "dir"}>{busy === "dir" ? "Recherche…" : "Trouver le dirigeant"}</button>
              ) : dirs.length ? (
                <p>Dirigeant : <b>{dirs[0].people.slice(0, 2).map((x) => x.name).join(", ") || dirs[0].company}</b> <span className="hint">({dirs[0].company}, à vérifier)</span></p>
              ) : (
                <p className="hint">Dirigeant introuvable dans le registre.</p>
              )}
              <ul className="checklist">{plan.prep.map((x) => <li key={x}>{x}</li>)}</ul>
              <ol className="cadence">{plan.cadence.map((c) => <li key={c}>{c}</li>)}</ol>
            </details>
            <details className="fold" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !details && busy !== "avis") loadReviews(); }}>
              <summary>Ce que disent ses clients</summary>
              {details?.reviews?.filter((x) => x.text).length ? (
                <ul className="reviews">
                  {details.reviews!.filter((x) => x.text).slice(0, 3).map((x) => (
                    <li key={x.author + x.when}>
                      <p>« {x.text.replace(/\s+/g, " ").trim().slice(0, 240)}{x.text.length > 240 ? "…" : ""} »</p>
                      <small>{x.author}, {x.rating}/5, {x.when}</small>
                    </li>
                  ))}
                </ul>
              ) : details ? <p className="hint">Aucun avis rédigé disponible.</p> : <p className="hint">{busy === "avis" ? "Chargement… (1 requête Google)" : "S'ouvre en chargeant ses avis (1 requête Google)."}</p>}
              {err && <p className="error">{err}</p>}
            </details>
          </section>
        )}

        {tab === "besoins" && (
          <section className="needs">
            <p className="hint" style={{ marginTop: 0 }}>Coche ce que tu veux lui proposer. La proposition se calcule toute seule.</p>
            <ul className="need-list">
              {needs.map((n) => (
                <li key={n.key} data-p={n.priority}>
                  <label>
                    <input type="checkbox" checked={chosen.includes(n.key)} onChange={() => toggleNeed(n.key)} />
                    <span>
                      <b>{n.title}</b>
                      <small>{n.why}</small>
                      {n.deadline && <em>À livrer avant le {new Date(n.deadline + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</em>}
                    </span>
                    <span className="need-price">{profile.prices?.[n.service] != null ? euro(profile.prices[n.service]) : "Sur devis"}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="proposal">
              <div className="bh">
                <b>Proposition{prop.total ? ` · ${euro(prop.total)}` : ""}</b>
                <span style={{ display: "flex", gap: 6 }}>
                  <Copy text={propText} />
                  {entry && prop.total > 0 && <button className="btn ghost small" onClick={() => onPipeline({ amount: prop.total })}>Reporter le montant</button>}
                </span>
              </div>
              <pre>{picked.length ? propText : "Coche au moins un besoin."}</pre>
              {!Object.keys(profile.prices || {}).length && <p className="hint">Renseigne tes tarifs dans Réglages pour chiffrer automatiquement.</p>}
            </div>
          </section>
        )}

        {(tab === "visite" || tab === "emails" || tab === "messages") && (
          <section>
            <div className="seg-mini" role="tablist">
              {([["visite", "En boutique"], ["emails", "E-mails"], ["messages", "Messages"]] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={textTab === id} onClick={() => setTextTab(id)}>{label}{plan.channel === (id === "emails" ? "email" : id === "messages" ? "message" : "visite") ? " ★" : ""}</button>
              ))}
            </div>

            {textTab === "visite" && (
              <>
                {script.map((x) => (
                  <div className="step" key={x.step}><span>{x.step}</span><p>{x.text}</p></div>
                ))}
                <div style={{ margin: "4px 0 16px" }}><Copy text={script.map((x) => `${x.step} : ${x.text}`).join("\n\n")} label="Copier le script" /></div>
                <details className="fold">
                  <summary>Toutes les réponses aux objections ({objs.length})</summary>
                  {objs.map((o) => <div className="obj-a" key={o.id}><b>{o.q}</b><p>{o.a}</p></div>)}
                </details>
              </>
            )}

            {textTab === "emails" && (
              <>
                {!to && <p className="hint" style={{ marginTop: 0 }}>Pas d'e-mail trouvé : cherche-le sur sa page ou demande-le lors de ta visite.</p>}
                {mails.map((m, i) => (
                  <details className="block" key={m.label} open={i === 0}>
                    <summary className="bh">
                      <span><b>{m.label}</b> · {m.subject}</span>
                      <span style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <Copy text={`${m.subject}\n\n${m.body}`} />
                        <a className="btn ghost small" href={`mailto:${to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>Ouvrir</a>
                      </span>
                    </summary>
                    <pre>{m.body}</pre>
                  </details>
                ))}
              </>
            )}

            {textTab === "messages" && directMessages(lead, profile).map((m) => (
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
