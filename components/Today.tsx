"use client";
import type { Lead, PipelineEntry, Profile } from "../lib/types";
import { approachPlan } from "../lib/approach";
import { detectNeeds } from "../lib/needs";
import { getTrade } from "../lib/trades";

const OPEN = ["a_contacter", "contacte", "a_relancer", "rdv"];

export default function Today({
  leads,
  pipeline,
  profile,
  onOpen,
  routeUrl,
}: {
  leads: Record<string, Lead>;
  pipeline: Record<string, PipelineEntry>;
  profile: Profile;
  onOpen: (id: string) => void;
  routeUrl: (stops: Lead[]) => string;
}) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dow = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const ids = Object.keys(pipeline).filter((id) => leads[id] && OPEN.includes(pipeline[id].stage));

  // Relances arrivées à échéance
  const due = ids
    .filter((id) => pipeline[id].followUp && pipeline[id].followUp! <= today)
    .sort((a, b) => pipeline[a].followUp!.localeCompare(pipeline[b].followUp!));

  // Premiers contacts : on garde ceux dont aujourd'hui est un bon jour, et qui sont ouverts aujourd'hui
  const fresh = ids.filter((id) => pipeline[id].stage === "a_contacter" && !due.includes(id));
  const plans = fresh.map((id) => ({ id, l: leads[id], p: approachPlan(leads[id], profile) }));
  const goodDay = (p: ReturnType<typeof approachPlan>) =>
    p.slot.days.includes(dow) && !(p.slot.known && p.slot.closed.includes(["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][dow]));
  const visits = plans.filter((x) => x.p.channel === "visite" && goodDay(x.p)).sort((a, b) => a.p.slot.window[0] - b.p.slot.window[0] || b.l.score - a.l.score);
  // Pas de visite aujourd'hui : prochain jour où il y a le plus de visites à faire
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  let nextTour: { label: string; n: number } | null = null;
  if (!plans.some((x) => x.p.channel === "visite" && goodDay(x.p))) {
    for (let i = 1; i <= 7 && !nextTour; i++) {
      const d = (dow + i) % 7;
      const n = plans.filter((x) => x.p.channel === "visite" && x.p.slot.days.includes(d) && !(x.p.slot.known && x.p.slot.closed.includes(DAYS[d]))).length;
      if (n) nextTour = { label: new Date(now.getFullYear(), now.getMonth(), now.getDate() + i).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }), n };
    }
  }
  const writes = plans.filter((x) => x.p.channel !== "visite" && goodDay(x.p)).sort((a, b) => b.l.score - a.l.score);

  // Temps forts : besoins datés à livrer dans les 3 semaines
  const deadlines = ids
    .flatMap((id) =>
      detectNeeds(leads[id])
        .filter((n) => n.deadline && (pipeline[id].needs ? pipeline[id].needs!.includes(n.key) : n.priority === 1))
        .map((n) => ({ id, n }))
    )
    .filter(({ n }) => (new Date(n.deadline + "T12:00:00").getTime() - now.getTime()) / 864e5 <= 21)
    .sort((a, b) => a.n.deadline!.localeCompare(b.n.deadline!));

  const dayLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const empty = !due.length && !visits.length && !writes.length && !deadlines.length && !nextTour;

  return (
    <main className="today">
      <div className="dash-head">
        <h1>Aujourd'hui</h1>
        <p className="hint">{dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)} · calculé à partir de ton pipeline, des horaires et des créneaux conseillés.</p>
      </div>

      {empty && (
        <div className="panel-b">
          <p style={{ margin: 0 }}>Rien de prévu pour l'instant. Ajoute des entreprises au pipeline depuis un scan : Filon te dira chaque jour qui voir et à qui écrire.</p>
        </div>
      )}

      {nextTour && (
        <div className="next-tour">
          Pas de visite conseillée aujourd'hui. Prochaine tournée : <b>{nextTour.label}</b>, {nextTour.n} entreprise{nextTour.n > 1 ? "s" : ""} à voir.
        </div>
      )}

      <div className="today-grid">
        {visits.length > 0 && (
          <section className="panel-b">
            <div className="today-h">
              <h2>À visiter <span>{visits.length}</span></h2>
              {visits.length > 1 && <a className="btn small" href={routeUrl(visits.slice(0, 10).map((v) => v.l))} target="_blank" rel="noreferrer">Itinéraire ({Math.min(10, visits.length)})</a>}
            </div>
            <ul className="today-list">
              {visits.map(({ id, l, p }) => {
                const late = mins > p.slot.window[1];
                return (
                  <li key={id}>
                    <button onClick={() => onOpen(id)}>
                      <span className={`slot ${late ? "late" : ""}`}>{p.slot.label}</span>
                      <span className="who">
                        <b>{l.name}</b>
                        <small>{l.address.replace(/, France$/, "")}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {writes.length > 0 && (
          <section className="panel-b">
            <div className="today-h"><h2>À écrire <span>{writes.length}</span></h2></div>
            <ul className="today-list">
              {writes.map(({ id, l, p }) => (
                <li key={id}>
                  <button onClick={() => onOpen(id)}>
                    <span className="slot">{p.slot.label}</span>
                    <span className="who">
                      <b>{l.name}</b>
                      <small>{p.channel === "email" ? "E-mail" : "Message privé"} · {getTrade(l.tradeId)?.singular}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {due.length > 0 && (
          <section className="panel-b">
            <div className="today-h"><h2>Relances <span>{due.length}</span></h2></div>
            <ul className="today-list">
              {due.map((id) => (
                <li key={id}>
                  <button onClick={() => onOpen(id)}>
                    <span className={`slot ${pipeline[id].followUp! < today ? "late" : ""}`}>
                      {pipeline[id].followUp! < today ? "En retard" : "Aujourd'hui"}
                    </span>
                    <span className="who">
                      <b>{leads[id].name}</b>
                      <small>{pipeline[id].notes ? pipeline[id].notes.slice(0, 80) : `Contacté${pipeline[id].channel ? ` par ${{ visite: "visite", email: "e-mail", message: "message", appel: "téléphone" }[pipeline[id].channel!]}` : ""}`}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {deadlines.length > 0 && (
          <section className="panel-b">
            <div className="today-h"><h2>Temps forts à préparer <span>{deadlines.length}</span></h2></div>
            <ul className="today-list">
              {deadlines.map(({ id, n }) => (
                <li key={id + n.key}>
                  <button onClick={() => onOpen(id)}>
                    <span className="slot warn">{new Date(n.deadline + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                    <span className="who">
                      <b>{leads[id].name}</b>
                      <small>{n.title}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
