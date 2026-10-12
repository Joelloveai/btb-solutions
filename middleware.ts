import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { can } from "@/lib/permissions";

type Role = "staff" | "client" | "sub";

// Match whole path segments: "/sub" is the subcontractor area, but "/subcons" is a staff page,
// and "/client" is the portal while "/clients" is a staff page.
/** Screens about money: someone without financial access never lands on them. */
const FINANCIAL_PATH = /^\/(dashboard|quotes|receivables|subcons|clients)(\/|$)|^\/projects\/[^/]+\/claims(\/|$)/;

const within = (path: string, area: string) => path === area || path.startsWith(`${area}/`);

/**
 * Coarse routing by role, so each kind of user only ever lands on their own area:
 *   staff   -> everything except /client and /sub
 *   client  -> /client/*   (sign in at /client/login)
 *   sub     -> /sub/*
 * This is a convenience, not the security boundary: every page, action and API route
 * re-checks the role (and the database) itself.
 */
export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    if (path.startsWith("/api/")) return NextResponse.next(); // API routes check the session themselves
    const token = req.nextauth.token;
    const role = (token ? (token.role ?? "staff") : null) as Role | null;

    if (path === "/client/login") {
      return role === "client" ? NextResponse.redirect(new URL("/client/projects", req.url)) : NextResponse.next();
    }
    if (within(path, "/client")) {
      return role === "client" ? NextResponse.next() : NextResponse.redirect(new URL("/client/login", req.url));
    }
    if (within(path, "/sub")) {
      return role === "sub" ? NextResponse.next() : NextResponse.redirect(new URL("/login", req.url));
    }
    // Everything else is the staff app.
    if (role === "staff" || role === null) {
      const staffRole = token?.staffRole;
      // Choosing your own password comes before anything else.
      if (token?.mustChange && !within(path, "/settings/profile")) return NextResponse.redirect(new URL("/settings/profile", req.url));
      // The roles a person holds are re-checked by every page and action; this just keeps them off screens that are not theirs.
      if (staffRole && !can(staffRole, "financials.view") && FINANCIAL_PATH.test(path)) return NextResponse.redirect(new URL("/projects", req.url));
      if (staffRole && !can(staffRole, "users.manage") && within(path, "/settings/users")) return NextResponse.redirect(new URL("/projects", req.url));
    }
    if (role === "client") return NextResponse.redirect(new URL("/client/projects", req.url));
    if (role === "sub") return NextResponse.redirect(new URL("/sub/tasks", req.url));
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      // /client pages decide for themselves (to send visitors to /client/login, not /login), and API
      // routes answer 401 on their own rather than redirecting a request to an HTML page.
      authorized: ({ token, req }) =>
        within(req.nextUrl.pathname, "/client") || req.nextUrl.pathname.startsWith("/api/") || !!token,
    },
  },
);

export const config = {
  // The service worker, manifest and offline page must be reachable without signing in
  // (a service-worker script cannot be served through a redirect).
  matcher: ["/((?!login|join/|api/auth|_next|favicon.ico|logo.svg|sw.js|manifest.webmanifest|offline).*)"],
};
