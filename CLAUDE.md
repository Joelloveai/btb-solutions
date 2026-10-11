# BTB JobCost Tracker

Job costing and progress billing for BTB Builders Sdn Bhd. Used by one non-technical person on a phone, on site.

- Next.js 14 App Router, TypeScript, Tailwind, Prisma 5 + SQLite, NextAuth v4 (credentials), Zod, React Hook Form.
- Currency is RM, shown as `RM 1,234.56`. Money is Decimal in the database. Sums use Prisma.Decimal in `lib/calculations.ts`.
- Enums are validated strings (SQLite has no enums). Values live in `lib/constants.ts`.
- Forms submit through server actions in `app/actions.ts`. Each action checks the session.
- Do not build features outside the MVP without asking.

Commands: `npm run dev`, `npm run build`, `npm test`, `npx playwright test`, `npx prisma db seed`, `npx prisma studio`.
Login (seed): boss@btb.my / btb12345 (change in `.env`).

Three kinds of sign-in, three guards (`lib/auth.ts`): `requireSession()` is STAFF only and gates every server action; `requireClient()` serves `/client/*` (read-only portal, separate `ClientUser` table, sign in at `/client/login`); `requireSub()` serves `/sub/tasks` (a `User` with a `subcontractorId`). Clients and subcontractors hold valid sessions, so never use a bare `getServerSession` as proof of staff. Photos live in Cloudflare R2 when the `R2_*` variables are set (key `projects/{projectId}/{photoId}.{ext}`, derived, not stored) and on local disk (`UPLOAD_DIR`, default `./uploads`) otherwise; a partly-set `R2_*` config is an error on purpose. Run `npm run r2:check` to test credentials and `npm run photos:migrate-to-r2` to move existing photos. They are served only through `/api/photos/[id]` (streamed, so access is checked on every request), and clients never see costs, claims, quotes or subcontractor names.

Offline: a hand-written service worker (`public/sw.js`, runs in production builds, or in dev with `NEXT_PUBLIC_ENABLE_SW=1`) serves pages, photos and drawings already opened. Server actions cannot run offline, so adds go through an on-device outbox (`lib/offline/*`, IndexedDB via `idb`) and replay when signal returns. Every queued change carries its own id, sent as `requestId`; a nullable unique `clientRequestId` on CostEntry/Payment/Task/Photo makes a retried submission a no-op, so money is never entered twice. New forms that add data should use `useOfflineSubmit`, not `useSubmit`. Sign-out and a different person signing in wipe the saved data and caches (shared phones). Replay only happens while the app is open (no Background Sync).

Photo evidence: each Photo keeps `capturedAt` (the phone's clock, range-checked server-side), GPS, `trade`/`phase` tags (lists in `lib/constants.ts`), a `location` note, an optional `checklistItem` for the "before cover" list, and a `sha256` taken on arrival. `createdAt` is always the server's arrival time, so a late upload is visible, not hidden. `/api/projects/[id]/evidence` builds the staff-only ZIP. Clients never see GPS.

Punch list: `PunchItem` goes OPEN -> DONE (the assigned subcontractor, `resolvePunchItem`, with a fix photo) -> CLOSED (`closePunchItem`, contractor only). Its photos are `Photo.kind = "PUNCH"`: staff see all, a subcontractor sees only their own items', clients none. Raising and fixing items are queueable offline (`createPunch`, `resolvePunch`). The walk sheet is `/projects/[id]/punch/print`.

Documents: `Document` rows are versions. Uploading a name that already exists in the project (case and spacing ignored, `nameKey`) makes version N+1 and flips `isCurrent`; old versions are kept. Staff can open any version; a subcontractor can fetch only the CURRENT version of a Drawing, for their trade (or all trades), on a project they have a task or punch item on (`lib/document-access.ts`); clients get nothing. File types are checked by bytes (`lib/document-files.ts`) and non-image/PDF files are download-only.


Client portal: staff use the "For Client" tab (stage, payment schedule, selections, daily log) and "Send to client" on change orders. Clients approve/reject through `decideChangeOrder` / `approveSelection`; these need connectivity on purpose (the time is the server's). The payment schedule is derived from recorded payments, never entered separately.

Field UI: the cost form shows only Amount, Category, Description (plus Subcontractor for SUBCON); date, BOQ line, vendor and reference sit under "More". Description-style fields use `components/ui/voice-input.tsx` (native SpeechRecognition; hidden if unsupported). Shared controls are 48px tall on phones (`h-12 md:h-10`); keep that for new buttons and inputs.
