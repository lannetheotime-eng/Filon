import { NextResponse, type NextRequest } from "next/server";

// Protection par mot de passe (Basic Auth) : sans elle, n'importe qui
// pourrait utiliser l'outil et consommer ta clé Google.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [, pass] = atob(auth.slice(6)).split(":");
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Accès protégé", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Filon"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
