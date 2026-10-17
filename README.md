# LearnHub — e-learning platform

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 (SQLite)

Features: email/password auth with an admin approval gate, user management, a course builder
(courses → modules → lessons with Markdown + YouTube/Vimeo video), a student portal filtered by
proficiency level with progress tracking, auto-issued PDF certificates, and email notifications.

## Quick start

Requires Node.js 20+.

```bash
cp .env.example .env        # then set AUTH_SECRET to a long random string
npm install                 # also generates the Prisma client
npm run setup               # creates prisma/dev.db, seeds an admin + 2 sample courses
npm run dev                 # http://localhost:3000
```

Log in as the seeded admin: **admin@example.com / admin12345** (change via `SEED_ADMIN_*` in `.env`
before running `setup`, and change the password afterwards in production).

## How it works

| Flow | Where |
|---|---|
| Register → status `PENDING` → `/pending` holding page; admin gets an alert email | `src/app/actions/auth.ts` |
| Admin approves (picks Beginner / Intermediate / Advanced), rejects or deletes; student gets an approval email | `/admin/users`, `src/app/actions/admin-users.ts` |
| Create/edit courses, add/rename/reorder/delete modules and lessons, publish | `/admin/courses`, `src/app/actions/admin-courses.ts` |
| Students see only **published** courses matching their level; admins can preview everything | `/dashboard`, `src/lib/courses.ts` |
| Course player: video, Markdown reading, mark complete, % progress | `/courses/[id]` |
| Last lesson completed → certificate issued + completion email with download link | `src/lib/progress.ts` |
| PDF certificate (owner or admin only) | `/certificates/[id]`, `src/lib/certificate-pdf.ts` |

Access control: `src/middleware.ts` blocks signed-out users; each layout re-checks role and
approval status against the database, so approving or rejecting someone takes effect on their next click.

## Email

Set **one** of these in `.env`:

- **Resend** — `RESEND_API_KEY` (and a verified `EMAIL_FROM` domain)
- **SMTP** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (e.g. Gmail with an app password)

With neither set, emails are printed to the server console — handy in development.
`ADMIN_EMAIL` receives new-registration alerts; `APP_URL` is used for links inside emails.

## Production notes

- Set `APP_URL` to your `https://` domain — session cookies become `Secure` automatically.
- For hosted deployments, switch to PostgreSQL: change `provider` in `prisma/schema.prisma`,
  swap the libSQL adapter in `src/lib/prisma-client.ts` for `@prisma/adapter-pg`, and run `npx prisma db push`.
- `npm run build && npm start` for a production server.
