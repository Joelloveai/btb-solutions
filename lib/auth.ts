import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { clearPinFailures, pinLocked, recordPinFailure } from "./pin-throttle";
import { prisma } from "./prisma";
import { whatsappNumber } from "./whatsapp";

import { can, isStaffRole, type Capability } from "./permissions";
import type { Role } from "./roles";

export { homeFor } from "./roles";
export type { Role } from "./roles";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    // Staff, and subcontractors (a User with a subcontractorId), sign in here.
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        // A deactivated person is refused even with the right password.
        if (!valid || !user.isActive) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.subcontractorId ? "sub" : "staff",
          staffRole: user.subcontractorId ? undefined : isStaffRole(user.role) ? user.role : "VIEWER",
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    // Subcontractors who set up their own login from an invite link: phone number + 6-digit PIN.
    Credentials({
      id: "sub-pin",
      name: "Subcontractor phone and PIN",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        const phone = whatsappNumber(credentials?.phone);
        const pin = credentials?.pin ?? "";
        if (!phone || !/^\d{6}$/.test(pin)) return null;
        // A locked phone number is refused even with the right PIN, so guessing gains nothing.
        if (await pinLocked(phone)) throw new Error("LOCKED");
        const user = await prisma.user.findUnique({ where: { phone } });
        const valid = !!user?.subcontractorId && user.isActive && (await bcrypt.compare(pin, user.passwordHash));
        if (!valid || !user) {
          await recordPinFailure(phone);
          if (await pinLocked(phone)) throw new Error("LOCKED");
          return null;
        }
        await clearPinFailures(phone);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, role: "sub" };
      },
    }),
    // Clients of the contractor sign in to the read-only portal here (a separate table).
    Credentials({
      id: "client-credentials",
      name: "Client portal",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.clientUser.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: "client" };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role ?? "staff";
        token.staffRole = user.staffRole;
        token.mustChange = user.mustChangePassword ?? false;
      }
      // After choosing a new password the page asks for a refresh, so the "change your password" gate lifts at once.
      if (trigger === "update" && token.uid && token.role === "staff") {
        const fresh = await prisma.user.findUnique({ where: { id: token.uid }, select: { mustChangePassword: true, role: true } });
        token.mustChange = fresh?.mustChangePassword ?? false;
        token.staffRole = isStaffRole(fresh?.role) ? fresh.role : undefined;
      }
      return token;
    },
    /**
     * Runs every time the session is read, so a person who is deactivated (or deleted) mid-session is
     * signed out on their very next request: the session simply has no user any more.
     */
    async session({ session, token }) {
      if (!session.user || !token.uid) return session;
      if (token.role === "client") {
        const client = await prisma.clientUser.findUnique({ where: { id: token.uid }, select: { id: true } });
        if (!client) return { expires: session.expires } as Session;
      } else {
        const user = await prisma.user.findUnique({ where: { id: token.uid }, select: { isActive: true, role: true, mustChangePassword: true, name: true, subcontractorId: true } });
        if (!user || !user.isActive) return { expires: session.expires } as Session;
        if (!user.subcontractorId) {
          session.user.staffRole = isStaffRole(user.role) ? user.role : "VIEWER";
          session.user.mustChangePassword = user.mustChangePassword;
          session.user.name = user.name ?? session.user.name;
        }
      }
      session.user.id = token.uid;
      session.user.role = token.role;
      return session;
    },
  },
};

/** Sessions issued before roles existed belonged to staff, the only kind of user then. */
export const roleOf = (session: Session | null): Role | null =>
  session?.user ? (session.user.role ?? "staff") : null;

/**
 * Server actions are public endpoints, so each one must confirm the session itself.
 * This is the STAFF guard: clients and subcontractors hold valid sessions too, and must not pass it.
 */
export async function requireSession(capability: Capability = "money.write", options: { allowMustChange?: boolean } = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || roleOf(session) !== "staff") throw new Error("Not signed in");
  // A temporary password must be replaced before anything else can be done.
  if (session.user.mustChangePassword && !options.allowMustChange) throw new Error("Change password first");
  if (!can(session.user.staffRole, capability)) throw new Error("Not allowed");
  return session;
}

/** For reading pages: any office role that has the capability, or null (the page then redirects). */
export async function staffCan(capability: Capability) {
  const session = await getServerSession(authOptions);
  return roleOf(session) === "staff" && can(session?.user?.staffRole, capability);
}

/** A signed-in client of the contractor. Checked against the database so revoking access takes effect at once. */
export async function requireClient() {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "client" || !session?.user?.id) throw new Error("Not signed in");
  const user = await prisma.clientUser.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("Not signed in");
  return { session, clientUser: user, clientId: user.clientId };
}

/** A signed-in subcontractor (a User with a subcontractorId). Re-read from the database on every call. */
export async function requireSub() {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "sub" || !session?.user?.id) throw new Error("Not signed in");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.subcontractorId) throw new Error("Not signed in");
  return { session, user, subcontractorId: user.subcontractorId };
}
