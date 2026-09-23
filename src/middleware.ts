import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: bounce requests without a session cookie to /login.
// The session itself is validated against Postgres in the (app) layout.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("ps_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/sync|_next/static|_next/image|favicon.ico|logo.png).*)"],
};
