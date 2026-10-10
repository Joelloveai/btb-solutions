import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";

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
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.subcontractorId ? "sub" : "staff",
        };
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
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role ?? "staff";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid;
        session.user.role = token.role;
      }
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
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || roleOf(session) !== "staff") throw new Error("Not signed in");
  return session;
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
