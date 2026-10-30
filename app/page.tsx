"use client";
import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { TRADES, getTrade } from "../lib/trades";
import type { Lead, PipelineEntry, Profile, ScanResult, Stage } from "../lib/types";
import { DEFAULT_PROFILE } from "../lib/types";
import { usePersistent, toCsv, download } from "../lib/store";
import LeadDrawer from "../components/LeadDrawer";
import Board from "../components/Board";

const MapView = dynamic(() => import("../components/MapView"), { ssr: false, loading: () => <div className="map" /> });

type View = "scan" | "pipeline" | "reglages";

function Score({ value }: { value: number }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <div className="score" aria-label={`Priorité ${value} sur 100`}>
      <svg viewBox="0 0 46 46" width="46" height="46">
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--mark)" strokeWidth="3" strokeDasharray={`${(value / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      {value}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("scan");
  const [tradeId, setTradeId] = usePersistent("filon.trade", "boulangerie");
  const [city, setCity] = usePersistent("filon.city", "Toulouse");
  const [deep, setDeep] = usePersistent("filon.deep", false);
  const [result, setResult] = usePersistent<ScanResult | null>("filon.last", null);
  const [leads, setLeads] = usePersistent<Record<string, Lead>>("filon.leads", {});
  const [pipeline, setPipeline] = usePersistent<Record<string, PipelineEntry>>("filon.pipeline", {});
  const [profile, setProfile] = usePersistent<Profile>("filon.profile", DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState(0);
  const [withSocial, setWithSocial] = useState(true);

  async function runScan() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, tradeId, deep }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setResult(j);
      setLeads((prev) => {
        const next = { ...prev };
        for (const l of j.leads as Lead[]) next[l.id] = l;
        return next;
      });
    } catch (e: any) {
      setError(e.message || "Le scan a échoué.");
    } finally {
      setLoading(false);
    }
  }

  const shown = useMemo(() => {
    if (!result) return [];
    return result.leads.filter(
      (l) => (l.rating || 0) >= minRating && (l.reviews || 0) >= minReviews && (withSocial || l.presence === "aucun")
    );
  }, [result, minRating, minReviews, withSocial]);

  const updatePipeline = useCallback(
    (id: string, patch: Partial<PipelineEntry> | null) => {
      setPipeline((prev) => {
        const next = { ...prev };
        if (patch === null) delete next[id];
        else next[id] = { ...({ stage: "a_contacter", notes: "" } as PipelineEntry), ...prev[id], ...patch, updatedAt: new Date().toISOString() };
        return next;
      });
    },
    [setPipeline]
  );

  function addAll() {
    for (const l of shown) if (!pipeline[l.id]) updatePipeline(l.id, { stage: "a_contacter" });
  }

  function exportScan() {
    if (!result) return;
    const t = getTrade(result.tradeId)!;
    download(
      `${t.id}-${result.city.name}.csv`.toLowerCase(),
      toCsv(shown.map((l) => ({
        Nom: l.name, Adresse: l.address, Téléphone: l.phone || "", Note: l.rating ?? "", Avis: l.reviews ?? "",
        Présence: l.presence === "aucun" ? "Aucun site" : "Réseaux seulement", Score: l.score, "Fiche Google": l.mapsUrl || "",
      })))
    );
  }

  const openLead = openId ? leads[openId] : null;
  const trade = getTrade(result?.tradeId || tradeId)!;
  const pipelineCount = Object.keys(pipeline).length;

  return (
    <>
      <nav className="top">
        <div className="logo"><i aria-hidden />Filon<small>par Thot Studio</small></div>
        <div className="tabs">
          <button className="tab" aria-current={view === "scan" ? "page" : undefined} onClick={() => setView("scan")}>Scanner</button>
          <button className="tab" aria-current={view === "pipeline" ? "page" : undefined} onClick={() => setView("pipeline")}>
            Pipeline{pipelineCount > 0 && <b>{pipelineCount}</b>}
          </button>
          <button className="tab" aria-current={view === "reglages" ? "page" : undefined} onClick={() => setView("reglages")}>Réglages</button>
        </div>
        <div className="spacer" />
        {result?.demo && <span className="demo">Mode démo : données fictives tant que la clé Google n'est pas configurée</span>}
      </nav>

      {view === "scan" && (
        <main>
          <form className="query" onSubmit={(e) => { e.preventDefault(); runScan(); }}>
            <span className="fixed">Trouver des</span>
            <span className="pick">
              <span aria-hidden>{(getTrade(tradeId) || TRADES[0]).label.toLowerCase()}</span>
              <select value={tradeId} onChange={(e) => setTradeId(e.target.value)} aria-label="Métier">
                {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label.toLowerCase()}</option>)}
              </select>
            </span>
            <span className="mark">sans site</span>
            <span className="fixed">à</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="ville" aria-label="Ville ou code postal" size={Math.max(6, city.length)} />
          </form>
          <div className="run">
            <button className="btn" onClick={runScan} disabled={loading || !city.trim()}>
              {loading ? "Scan en cours…" : "Scanner la ville"}
            </button>
            <label className="check">
              <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
              Scan complet (quadrille la ville, plus de résultats, plus de requêtes)
            </label>
            {error && <span className="error">{error}</span>}
          </div>

          {result && (
            <section className="results">
              <div className="headline">
                <span className="n">{result.leads.length}</span>
                <p>
                  {trade.label.toLowerCase()} sans site à {result.city.name} ({result.city.dept}), sur {result.scanned} fiches Google analysées.
                  {result.withSite > 0 && ` ${result.withSite} ont déjà un site et sont écartées.`}
                  {!result.demo && ` ${result.calls} requête${result.calls > 1 ? "s" : ""} Google.`}
                </p>
              </div>

              <div className="split">
                <MapView leads={shown} center={[result.city.lat, result.city.lng]} activeId={openId || undefined} onSelect={setOpenId} />
                <div>
                  <div className="filters">
                    <label>Note min.{" "}
                      <select value={minRating} onChange={(e) => setMinRating(+e.target.value)}>
                        {[0, 3.5, 4, 4.5].map((v) => <option key={v} value={v}>{v ? `${String(v).replace(".", ",")}+` : "Toutes"}</option>)}
                      </select>
                    </label>
                    <label>Avis min.{" "}
                      <select value={minReviews} onChange={(e) => setMinReviews(+e.target.value)}>
                        {[0, 5, 10, 30, 100].map((v) => <option key={v} value={v}>{v ? `${v}+` : "Tous"}</option>)}
                      </select>
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={withSocial} onChange={(e) => setWithSocial(e.target.checked)} />
                      Inclure les « réseaux seulement »
                    </label>
                    <span className="spacer" style={{ flex: 1 }} />
                    <button className="btn ghost small" onClick={addAll} disabled={!shown.length}>Tout ajouter au pipeline</button>
                    <button className="btn ghost small" onClick={exportScan} disabled={!shown.length}>CSV</button>
                  </div>

                  {shown.length ? (
                    <ul className="list">
                      {shown.map((l) => {
                        const inPipe = pipeline[l.id];
                        return (
                          <li key={l.id} className="row" data-active={openId === l.id} onClick={() => setOpenId(l.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenId(l.id)}>
                            <Score value={l.score} />
                            <div>
                              <h3>{l.name}</h3>
                              <div className="meta">
                                <span>{l.address.replace(/, France$/, "")}</span>
                                {l.phone && <span>{l.phone}</span>}
                                {l.rating && <span>{String(l.rating).replace(".", ",")} ★ ({l.reviews})</span>}
                              </div>
                            </div>
                            <div className="side">
                              <span className={`tag ${l.presence === "aucun" ? "none" : "soc"}`}>{l.presence === "aucun" ? "Aucun site" : "Réseaux"}</span>
                              {inPipe ? (
                                <span className="tag in">Suivi</span>
                              ) : (
                                <button className="btn ghost small" onClick={(e) => { e.stopPropagation(); updatePipeline(l.id, { stage: "a_contacter" }); }}>
                                  Ajouter
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="list empty">
                      <strong>Aucune entreprise avec ces filtres</strong>
                      Baisse la note ou le nombre d'avis minimum, ou lance un scan complet.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {!result && !loading && (
            <section className="results">
              <div className="headline">
                <p>Choisis un métier et une ville. Filon liste les entreprises qui n'ont pas de site, avec leur téléphone, leur note Google et un score pour savoir qui appeler en premier.</p>
              </div>
            </section>
          )}
        </main>
      )}

      {view === "pipeline" && (
        <Board leads={leads} pipeline={pipeline} onOpen={setOpenId} onMove={(id, stage) => updatePipeline(id, { stage })} />
      )}

      {view === "reglages" && (
        <main className="settings">
          <h1>Réglages</h1>
          <p>Ces infos signent tes scripts, e-mails et messages. Elles restent dans ce navigateur.</p>
          <div className="row2">
            <label className="field">Prénom<input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></label>
            <label className="field">Studio<input value={profile.studio} onChange={(e) => setProfile({ ...profile, studio: e.target.value })} /></label>
            <label className="field">Téléphone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
            <label className="field">E-mail<input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
            <label className="field">Site<input value={profile.site} onChange={(e) => setProfile({ ...profile, site: e.target.value })} /></label>
            <label className="field">Prix annoncé (facultatif)<input value={profile.price} placeholder="ex. 890 € puis 39 €/mois" onChange={(e) => setProfile({ ...profile, price: e.target.value })} /></label>
          </div>
          <label className="field">Ton offre, en une phrase<textarea value={profile.offer} onChange={(e) => setProfile({ ...profile, offer: e.target.value })} /></label>
          <p className="hint">Le pipeline et les entreprises trouvées sont aussi enregistrés dans ce navigateur. Exporte régulièrement en CSV pour les garder ailleurs.</p>
          <button className="btn ghost small" onClick={() => { if (confirm("Effacer toutes les entreprises et le pipeline de ce navigateur ?")) { setLeads({}); setPipeline({}); setResult(null); } }}>
            Effacer les données
          </button>
        </main>
      )}

      {openLead && (
        <LeadDrawer
          lead={openLead}
          profile={profile}
          entry={pipeline[openLead.id]}
          onClose={() => setOpenId(null)}
          onPipeline={(patch) => updatePipeline(openLead.id, patch)}
        />
      )}
    </>
  );
}
