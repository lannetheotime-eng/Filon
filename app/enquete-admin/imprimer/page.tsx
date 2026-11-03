import { CHARACTERS, EVIDENCE, TITLE, VENUE } from "../../../lib/enquete/scenario";
import "./print.css";

export const metadata = { title: "Pièces à imprimer · La dernière bouteille" };

function Piece({ e }: { e: (typeof EVIDENCE)[number] }) {
  if (e.kind === "ticket") {
    return (
      <div className="pr-ticket">
        {e.lines.map((l, i) => <p key={i} className={i === 0 ? "pr-ticket-head" : l.startsWith("TOTAL") ? "pr-ticket-total" : ""}>{l}</p>)}
        <p className="pr-ticket-foot">Merci de votre visite</p>
      </div>
    );
  }
  if (e.kind === "badge") {
    return (
      <div className="pr-sheet pr-mono">
        <p className="pr-small">SÉCURITÉ ACCÈS · EXPORT DU SAMEDI</p>
        <h3>{e.title}</h3>
        <table><tbody>{e.lines.slice(0, -1).map((l) => { const [t, ...rest] = l.split(/\s{2,}/); return <tr key={l}><td>{t}</td><td>{rest.join("  ")}</td></tr>; })}</tbody></table>
        <p className="pr-small">{e.lines[e.lines.length - 1]}</p>
      </div>
    );
  }
  if (e.kind === "sms") {
    return (
      <div className="pr-phone">
        <p className="pr-small">{e.title} · photo jointe au dossier</p>
        <div className="pr-phone-screen">
          <p className="pr-phone-from">{e.lines[0]}</p>
          <p className="pr-phone-time">{e.lines[1]}</p>
          <p className="pr-bubble">{e.lines[2]}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="pr-sheet">
      <p className="pr-small">{e.kind === "labo" ? "POLICE NATIONALE · LABORATOIRE DE TOULOUSE · CONFIDENTIEL" : "POLICE JUDICIAIRE · COMMISSAIRE GARNIER"}</p>
      <h3>{e.title}</h3>
      <ol>{e.lines.map((l) => <li key={l}>{l}</li>)}</ol>
      {e.kind === "labo" && <p className="pr-sign">Signé : Dr A. Mercier, expert</p>}
    </div>
  );
}

export default function Print() {
  return (
    <main className="pr">
      <section className="pr-help">
        <h1>{TITLE} · pièces à imprimer</h1>
        <p>Imprimez en A4, en couleur si possible (menu Partager ou Imprimer de votre navigateur). Pliez les chevalets en deux et posez-les devant chaque joueur. Glissez chaque série de pièces dans une enveloppe, avec sa couverture collée dessus.</p>
      </section>

      <section className="pr-page">
        <p className="pr-small pr-center">CHEVALETS · découpez sur les pointillés, pliez au milieu</p>
        <div className="pr-tents">
          {CHARACTERS.map((c) => (
            <div className="pr-tent" key={c.id}>
              <div className="pr-tent-half pr-flip"><b>{c.name}</b><span>{c.role}</span></div>
              <div className="pr-tent-half"><b>{c.name}</b><span>{c.role}</span></div>
            </div>
          ))}
        </div>
        <p className="pr-small pr-center">Paul Vidal ne sert qu'à 4 joueurs.</p>
      </section>

      {[2, 3].map((n) => (
        <section className="pr-page" key={n}>
          <div className="pr-cover">
            <p className="pr-small">{VENUE} · dossier du commissaire Garnier</p>
            <p className="pr-env">Enveloppe {n}</p>
            <p className="pr-seal">Ne pas ouvrir avant l'acte {n}</p>
          </div>
          <div className="pr-grid">
            {EVIDENCE.filter((e) => e.envelope === n).map((e) => <Piece e={e} key={e.id} />)}
          </div>
        </section>
      ))}
    </main>
  );
}
