# BTB JobCost Tracker

Job costing and progress billing for BTB Builders Sdn Bhd. Used by one non-technical person on a phone, on site.

- Next.js 14 App Router, TypeScript, Tailwind, Prisma 5 + SQLite, NextAuth v4 (credentials), Zod, React Hook Form.
- Currency is RM, shown as `RM 1,234.56`. Money is Decimal in the database. Sums use Prisma.Decimal in `lib/calculations.ts`.
- Enums are validated strings (SQLite has no enums). Values live in `lib/constants.ts`.
- Forms submit through server actions in `app/actions.ts`. Each action checks the session.
- Do not build features outside the MVP without asking.

Commands: `npm run dev`, `npm run build`, `npm test`, `npx playwright test`, `npx prisma db seed`, `npx prisma studio`.
Login (seed): boss@btb.my / btb12345 (change in `.env`).
