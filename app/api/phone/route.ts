import { NextResponse } from "next/server";
import { findPhone } from "../../../lib/scan";
import { companiesOf } from "../../../lib/holdings";
import { accountsEnabled, getSession } from "../../../lib/auth";
import { assertBudget, record } from "../../../lib/quota";

export const runtime = "nodejs";

// Retire les formes juridiques et parenthèses, que Google ne connaît pas : « SELARL DUPONT (CABINET) » → « Dupont »
const clean = (s: string) => s.replace(/\([^)]*\)/g, " ").replace(/\b(SARL|SAS|SASU|SELARL|SELAS|SELAFA|SCP|SCI|EURL|SA|SNC|SCM|SEL|EI|EIRL|HOLDING)\b/gi, " ").replace(/\s+/g, " ").trim();

export async function GET(req: Request) {
  const u = new URL(req.url);
  const name = u.searchParams.get("name") || "", city = u.searchParams.get("city") || "";
  const brand = u.searchParams.get("brand") || "", person = u.searchParams.get("person") || "", address = u.searchParams.get("address") || "";
  const holding = u.searchParams.get("holding") === "1", dept = u.searchParams.get("dept") || undefined;
  if (!name) return NextResponse.json({ error: "Nom manquant." }, { status: 400 });
  try {
    const s = accountsEnabled() ? await getSession(req) : null;
    const live = !!process.env.GOOGLE_PLACES_API_KEY;
    // Candidats, du plus précis au plus large ; au plus 2 requêtes Google
    const cands: { q: string; city: string; via?: string }[] = [];
    if (holding && person) for (const c of await companiesOf(person, dept)) cands.push({ q: c.name, city: c.city || city, via: c.name });
    if (brand) cands.push({ q: brand, city });
    if (clean(name)) cands.push({ q: `${clean(name)} ${address}`.trim(), city: "" });
    const seen = new Set<string>();
    const list = cands.filter((c) => (seen.has(c.q.toLowerCase()) ? false : (seen.add(c.q.toLowerCase()), true))).slice(0, 2);
    if (!list.length) return NextResponse.json({ phone: undefined, calls: 0 });
    if (live) await assertBudget(s, list.length);
    let calls = 0;
    for (const c of list) {
      const r = await findPhone(c.q, c.city);
      if (live && !r.demo) calls++;
      if (r.phone) {
        if (live) await record(s, calls);
        return NextResponse.json({ ...r, via: c.via, calls });
      }
    }
    if (live && calls) await record(s, calls);
    return NextResponse.json({ phone: undefined, calls, tried: list.map((c) => c.via || c.q) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
