"use client";
import { useMemo, useState } from "react";
import type { HoldingLead } from "../../lib/holdings-shared";
import { EFFECTIF, EFFECTIF_LABEL, NAF_LABEL, SECTORS, fmtEur, score, signals } from "../../lib/holdings-shared";
import { toCsv, download } from "../../lib/store";

type Res = { leads: HoldingLead[]; scanned: number; total: number };

export default function Dirigeants() {
  const [sector, setSector] = useState(0);
  const [custom, setCustom] = useState("");
  const [zone, setZone] = useState("31");
  const [effectif, setEffectif] = useState("");
  const [holdingOnly, setHoldingOnly] = useState(true);
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<(Res & { demo?: boolean }) | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const naf = custom.trim() ? custom.split(/[,\s]+/).filter(Boolean) : SECTORS[sector].naf;

  async function go(demo = false) {
    setBusy(true); setErr(""); setOpen(null);
    try {
      const r = await fetch("/api/holdings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ naf, zone, effectif, holdingOnly, pages: deep ? 4 : 2, demo }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes({ ...j, demo });
    } catch (e: any) {
      setErr(e.message || "La recherche a échoué.");
    } finally {
      setBusy(false);
    }
  }

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (res?.leads || [])
      .filter((l) => !t || `${l.name} ${l.city} ${l.holdings.map((h) => h.name + h.owners.map((o) => o.name).join(" ")).join(" ")} ${l.people.map((p) => p.name).join(" ")}`.toLowerCase().includes(t))
      .sort((a, b) => score(b) - score(a));
  }, [res, q]);

  function exportCsv() {
    download(`dirigeants-holdings-${zone || "france"}.csv`, toCsv(list.map((l) => ({
      Entreprise: l.name, SIREN: l.siren, "Code NAF": l.naf, Activité: NAF_LABEL[l.naf] || "", Adresse: l.address, Ville: l.city,
      Création: l.created || "", Effectif: l.effectif ? EFFECTIF_LABEL[l.effectif] || l.effectif : "", "Chiffre d'affaires": l.ca ?? "", "Résultat net": l.net ?? "", Exercice: l.finYear || "",
      Holding: l.holdings.map((h) => `${h.name} (${h.siren})`).join(" / "),
      "Dirigeant via la holding": l.holdings.flatMap((h) => h.owners.map((o) => `${o.name} (${o.role})`)).join(" / "),
      "Autres dirigeants": l.people.map((p) => `${p.name} (${p.role})`).join(" / "),
      Fiche: `https://annuaire-entreprises.data.gouv.fr/entreprise/${l.siren}`,
    }))));
  }

  return (
    <main className="nf-main">
      <header className="nf-top">
        <span className="nf-logo"><i /><i /><i />nafy</span>
        <span className="nf-tag">Prospection · exemple</span>
      </header>

      <section className="nf-hero">
        <h1>Les dirigeants qui ont <em>structuré</em> leur patrimoine.</h1>
        <p>Les entreprises détenues par une holding, par secteur et par territoire, avec la personne qui est derrière. Données publiques du registre national des entreprises.</p>
      </section>

      <form className="nf-form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label className="wide"><span>Secteur</span>
          <select value={sector} onChange={(e) => { setSector(+e.target.value); setCustom(""); }}>
            {SECTORS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          </select>
        </label>
        <label><span>Ou codes NAF</span><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ex. 86.23Z, 47.73Z" /></label>
        <label><span>Zone</span><input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="31, 31000 ou Toulouse" /></label>
        <label><span>Taille</span>
          <select value={effectif} onChange={(e) => setEffectif(e.target.value)}>{EFFECTIF.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select>
        </label>
        <div className="nf-opts">
          <label className="nf-check"><input type="checkbox" checked={holdingOnly} onChange={(e) => setHoldingOnly(e.target.checked)} /> Seulement les sociétés détenues par une holding</label>
          <label className="nf-check"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Recherche élargie (100 entreprises analysées)</label>
        </div>
        <div className="nf-actions">
          <button className="nf-btn" disabled={busy}>{busy ? "Recherche…" : "Rechercher"}</button>
          <button type="button" className="nf-btn ghost" disabled={busy} onClick={() => go(true)}>Voir un exemple</button>
        </div>
      </form>
      {err && <p className="nf-err">{err}</p>}
      {busy && <p className="nf-muted">On interroge le registre, puis on remonte chaque holding jusqu'à son dirigeant : 10 à 40 secondes.</p>}

      {res && !busy && (
        <section className="nf-res">
          <div className="nf-res-head">
            <div>
              <h2><b>{list.length}</b> {holdingOnly ? "entreprises détenues par une holding" : "entreprises"}</h2>
              <p className="nf-muted">{res.demo ? "Exemple fictif · " : ""}{res.scanned} analysées sur {res.total.toLocaleString("fr-FR")} correspondant à la recherche{naf.length ? ` · ${naf.map((n) => NAF_LABEL[n] || n).join(", ")}` : ""}</p>
            </div>
            <div className="nf-res-tools">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer : nom, ville, dirigeant…" />
              <button className="nf-btn ghost" onClick={exportCsv} disabled={!list.length}>Exporter CSV</button>
            </div>
          </div>

          <ul className="nf-list">
            {list.map((l) => {
              const owners = l.holdings.flatMap((h) => h.owners);
              const lead = owners[0] || l.people[0];
              const isOpen = open === l.siren;
              return (
                <li key={l.siren} className={isOpen ? "open" : ""}>
                  <button className="nf-row" onClick={() => setOpen(isOpen ? null : l.siren)}>
                    <span className="nf-score">{score(l)}</span>
                    <span className="nf-main-col">
                      <b>{lead ? lead.name : l.name}</b>
                      <small>{lead ? `${lead.role || "Dirigeant"} · ${l.name}` : "Dirigeant non renseigné"}</small>
                    </span>
                    <span className="nf-col"><small>Activité</small>{NAF_LABEL[l.naf] || l.naf}<em>{l.naf}</em></span>
                    <span className="nf-col"><small>Lieu</small>{l.city || "—"}<em>{l.cp}</em></span>
                    <span className="nf-col"><small>Holding</small>{l.holdings[0]?.name || "—"}</span>
                  </button>
                  {isOpen && (
                    <div className="nf-detail">
                      <div className="nf-tags">{signals(l).map((s) => <span key={s}>{s}</span>)}</div>
                      <div className="nf-grid">
                        <div><small>Société</small><b>{l.name}</b><span>SIREN {l.siren}</span><span>{l.address}</span></div>
                        <div><small>Activité</small><b>{NAF_LABEL[l.naf] || "Code NAF"} · {l.naf}</b><span>{l.created ? `Créée en ${new Date(l.created).getFullYear()}` : ""}{l.effectif ? ` · ${EFFECTIF_LABEL[l.effectif] || l.effectif} salariés` : ""}</span><span>{l.ca != null ? `CA ${fmtEur(l.ca)}` : "CA non publié"}{l.net != null ? ` · résultat ${fmtEur(l.net)}` : ""}{l.finYear ? ` (${l.finYear})` : ""}</span></div>
                        {l.holdings.map((h) => (
                          <div key={h.siren}><small>Holding · {h.role || "associée"}</small><b>{h.name}</b><span>SIREN {h.siren}{h.created ? ` · créée en ${new Date(h.created).getFullYear()}` : ""}</span><span>{h.owners.length ? h.owners.map((o) => `${o.name} (${o.role})`).join(", ") : "Dirigeant de la holding non renseigné"}</span></div>
                        ))}
                        {l.people.length > 0 && <div><small>Autres dirigeants</small>{l.people.slice(0, 4).map((p) => <span key={p.name}><b>{p.name}</b> · {p.role}</span>)}</div>}
                      </div>
                      <div className="nf-links">
                        <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${l.siren}`} target="_blank" rel="noreferrer">Fiche officielle</a>
                        {l.holdings[0] && <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${l.holdings[0].siren}`} target="_blank" rel="noreferrer">Fiche de la holding</a>}
                        <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${lead?.name || ""} ${l.name}`)}`} target="_blank" rel="noreferrer">Chercher sur LinkedIn</a>
                        <a href={`https://www.google.com/maps/search/${encodeURIComponent(l.address)}`} target="_blank" rel="noreferrer">Voir sur la carte</a>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {!list.length && <li className="nf-muted nf-empty">Aucune entreprise ne correspond. Élargis la zone, change de secteur ou décoche « holding ».</li>}
          </ul>
          <p className="nf-note">Sources : registre national des entreprises (INSEE, INPI) via l'Annuaire des entreprises de l'État. Le score combine la présence d'une holding, l'ancienneté et les comptes publiés. Prospection B2B : les dirigeants doivent pouvoir s'opposer facilement à vos messages (RGPD).</p>
        </section>
      )}
    </main>
  );
}
