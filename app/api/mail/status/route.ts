import { NextResponse } from "next/server";
import { mailEnabled, mailStatus } from "../../../../lib/mail";

export async function GET(req: Request) {
  if (!mailEnabled()) return NextResponse.json({ statuses: {} });
  const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 20);
  const out: Record<string, string | null> = {};
  await Promise.all(ids.map(async (id) => { out[id] = await mailStatus(id).catch(() => null); }));
  return NextResponse.json({ statuses: out });
}
