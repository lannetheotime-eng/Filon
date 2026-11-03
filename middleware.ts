import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/token";

// Pages accessibles sans connexion : le rapport envoyé aux prospects, la connexion, l'icône de l'appli, le radar Vendu loué
const PUBLIC = [/^\/rapport/, /^\/ia(\/|$)/, /^\/api\/ia$/, /^\/connexion/, /^\/loue$/, /^\/api\/loue$/, /^\/api\/auth\//, /^\/manifest\.webmanifest$/, /^\/icon/, /^\/apple-icon/];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((r) => r.test(path))) return NextResponse.next();

  // Mode comptes : actif dès qu'une base Redis est branchée au projet
  const accounts = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  if (accounts) {
    const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (s) return NextResponse.next();
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Session expirée : reconnecte-toi." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Mode simple : un mot de passe unique (APP_PASSWORD)
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [, pass] = atob(auth.slice(6)).split(":");
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Accès protégé", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Filon"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
