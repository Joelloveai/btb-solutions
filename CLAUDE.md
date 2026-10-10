# BTB JobCost Tracker

Job costing and progress billing for BTB Builders Sdn Bhd. Used by one non-technical person on a phone, on site.

- Next.js 14 App Router, TypeScript, Tailwind, Prisma 5 + SQLite, NextAuth v4 (credentials), Zod, React Hook Form.
- Currency is RM, shown as `RM 1,234.56`. Money is Decimal in the database. Sums use Prisma.Decimal in `lib/calculations.ts`.
- Enums are validated strings (SQLite has no enums). Values live in `lib/constants.ts`.
- Forms submit through server actions in `app/actions.ts`. Each action checks the session.
- Do not build features outside the MVP without asking.

Commands: `npm run dev`, `npm run build`, `npm test`, `npx playwright test`, `npx prisma db seed`, `npx prisma studio`.
Login (seed): boss@btb.my / btb12345 (change in `.env`).

Three kinds of sign-in, three guards (`lib/auth.ts`): `requireSession()` is STAFF only and gates every server action; `requireClient()` serves `/client/*` (read-only portal, separate `ClientUser` table, sign in at `/client/login`); `requireSub()` serves `/sub/tasks` (a `User` with a `subcontractorId`). Clients and subcontractors hold valid sessions, so never use a bare `getServerSession` as proof of staff. Photos live on disk (`UPLOAD_DIR`, default `./uploads`), are served only through `/api/photos/[id]`, and clients never see costs, claims, quotes or subcontractor names.

