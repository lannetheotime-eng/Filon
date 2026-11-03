"use client";

export type Row = { name: string; char: string; culprit: string | null; motive: string | null; right: boolean; motiveRight: boolean; isKiller: boolean; missions: number; missionsTotal: number; points: number };

export function Leaderboard({ rows }: { rows: Row[] }) {
  return (
    <div className="eq-scroll">
      <table className="eq-results">
        <thead><tr><th>#</th><th>Joueur</th><th>Accusation</th><th>Missions</th><th>Points</th></tr></thead>
        <tbody>{rows.map((d, i) => (
          <tr key={d.name}>
            <td>{i + 1}</td>
            <td>{d.name}<br /><span className="eq-muted">{d.char}{d.isKiller ? " · coupable" : ""}</span></td>
            <td className={d.isKiller ? "eq-muted" : d.culprit ? (d.right ? "eq-yes" : "eq-no") : "eq-muted"}>{d.isKiller ? "—" : d.culprit || "pas de vote"}{!d.isKiller && d.motive ? <><br /><span className={d.motiveRight ? "eq-yes" : "eq-no"}>{d.motive}</span></> : null}</td>
            <td>{d.missions}/{d.missionsTotal}</td>
            <td><b>{d.points}</b></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
