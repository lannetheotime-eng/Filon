import "server-only";
import { NextResponse } from "next/server";

export const baseUrl = (req: Request) => (process.env.ENQUETE_BASE_URL || new URL(req.url).origin).replace(/\/$/, "");
export const fail = (e: any, status = 400) => NextResponse.json({ error: e?.message || String(e) }, { status });
