import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: bounce requests without a session cookie to /login.
// The session itself is validated against Postgres in the (app) layout.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("ps_session")) {
    // Behind nginx, req.nextUrl carries Next's own bind address (localhost:7006), not the
    // public domain, so build the redirect from the host the browser actually used.
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    return NextResponse.redirect(`${proto}://${host}/login`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/sync|_next/static|_next/image|favicon.ico|logo.png).*)"],
};
