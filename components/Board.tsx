"use client";
import { useState } from "react";
import type { Lead, PipelineEntry, Stage } from "../lib/types";
import { STAGES, PRESENCE_LABEL } from "../lib/types";
import { getTrade } from "../lib/trades";
import { toCsv, download } from "../lib/store";

export default function Board({
  leads,
  pipeline,
  onMove,
  onOpen,
  routeUrl,
}: {
  leads: Record<string, Lead>;
  pipeline: Record<string, PipelineEntry>;
  onMove: (id: string, stage: Stage) => void;
  onOpen: (id: string) => void;
  routeUrl: (stops: Lead[]) => string;
}) {
  const [over, setOver] = useState<Stage | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const ids = Object.keys(pipeline).filter((id) => leads[id]);

  function exportCsv() {
    const rows = ids.map((id) => {
      const l = leads[id], p = pipeline[id];
      return {
        Nom: l.name,
        Métier: getTrade(l.tradeId)?.singular || l.tradeId,
        Ville: l.city,
        Adresse: l.address,
        Téléphone: l.phone || "",
        Note: l.rating ?? "",
        Avis: l.reviews ?? "",
        Situation: PRESENCE_LABEL[l.presence],
        "E-mail": l.audit?.email || "",
        Canal: p.channel || "",
        "Montant signé": p.amount ?? "",
        Score: l.score,
        Étape: STAGES.find((s) => s.id === p.stage)?.label,
        Relance: p.followUp || "",
        Notes: p.notes,
        "Fiche Google": l.mapsUrl || "",
      };
    });
    download(`pipeline-${today}.csv`, toCsv(rows));
  }

  const dueCount = ids.filter((id) => pipeline[id].followUp && pipeline[id].followUp! <= today && !["signe", "perdu"].includes(pipeline[id].stage)).length;

  return (
    <>
      <div className="board-head">
        <div>
          <h1>Pipeline</h1>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            {ids.length} entreprise{ids.length > 1 ? "s" : ""} suivie{ids.length > 1 ? "s" : ""}
            {dueCount > 0 && <> · <span className="error">{dueCount} relance{dueCount > 1 ? "s" : ""} à faire aujourd'hui</span></>}
          </p>
        </div>
        <button className="btn ghost" onClick={exportCsv} disabled={!ids.length}>Exporter en CSV</button>
      </div>
      <div className="board">
        {STAGES.map((s) => {
          const items = ids
            .filter((id) => pipeline[id].stage === s.id)
            .sort((a, b) => (pipeline[a].followUp || "9").localeCompare(pipeline[b].followUp || "9"));
          return (
            <div
              key={s.id}
              className="col"
              data-stage={s.id}
              data-over={over === s.id}
              onDragOver={(e) => { e.preventDefault(); setOver(s.id); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) onMove(id, s.id);
                setOver(null);
              }}
            >
              <h2>{s.label}<span>{items.length}</span></h2>
              {s.id === "a_contacter" && items.length > 1 && (
                <a className="col-action" href={routeUrl(items.slice(0, 10).map((id) => leads[id]))} target="_blank" rel="noreferrer">
                  Tournée de visite ({Math.min(10, items.length)} arrêts)
                </a>
              )}
              <div className="cards">
                {items.map((id) => {
                  const l = leads[id], p = pipeline[id];
                  const late = p.followUp && p.followUp <= today;
                  return (
                    <div
                      key={id}
                      className="card"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", id)}
                      onClick={() => onOpen(id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && onOpen(id)}
                    >
                      <strong>{l.name}</strong>
                      <small>{l.city} · {getTrade(l.tradeId)?.singular}</small>
                      {l.presence === "vieux" && <small className="kind-old">Site à refaire</small>}
                      {p.stage === "signe" && p.amount ? <small className="amount">{p.amount.toLocaleString("fr-FR")} €</small> : null}
                      {p.followUp && !["signe", "perdu"].includes(p.stage) && (
                        <small className={`due ${late ? "late" : ""}`}>
                          Relance {late ? "à faire" : "le"} {new Date(p.followUp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </small>
                      )}
                    </div>
                  );
                })}
                {!items.length && s.id === "a_contacter" && !ids.length && (
                  <p className="hint" style={{ padding: 8 }}>Lance un scan puis ajoute des entreprises : elles arrivent ici.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
