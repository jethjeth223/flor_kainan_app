# Flor’s Kainan

Mobile-first food ordering and shop management: daily menus, pickup preorders,
walk-in sales, shared portions, cash/GCash verification, utang, expenses, owner
capital, private image chat, closeouts, and exports.

Flor manages one persistent **All dishes** list: turn dishes on/off, edit portions,
and publish or pause the menu. These changes reach open browsers and the Android
app through Supabase Realtime. Pickup dates still separate inventory and accounting;
each new day starts with the saved daily quantity. **Available portions today**
and **Refill today** preserve reserved, sold, and wasted counts.

New preorders create an order summary in both participants' chat in the same
transaction. The chat card shows the saved order lines, total, pickup, and live status.
Catalog broadcasts carry only a refresh signal; private order/accounting signals
use participant-only channels. Clients refetch authorized snapshots, reconcile
on reconnect, and retain the 15-second poll as a connection fallback.

Both roles have an in-app notification bell and red Menu/Orders/Chat badges.
Notifications persist per account and update across devices. Draft dishes notify
only Flor; published menu news reaches confirmed customer accounts. Visiting a
section marks its earlier notifications read, and the feed also supports marking
everything read. Chat notifications open the conversation; order notifications
open the order when it is in the active history.

The owner order list shows 10 recent matching orders by default. Choosing a pickup
date retrieves that date's orders, including dates beyond the recent 500. Review
order scrolls and focuses the checkout section and respects reduced motion.

## Cloud architecture

- Server: Next.js 16 on Node.js 22, with a standalone container build.
- Database: Supabase PostgreSQL, project soeptuxxgxvluorkhkgt.
- Login: Supabase Auth with confirmed email and password.
- Images: private Supabase Storage bucket kainan-files.
- Source: https://github.com/jethjeth223/flor_kainan_app

Public test: https://flors-kainan.onrender.com (Render Free, Singapore).
The existing private Sites deployment is a separate legacy pilot. The Android
10+ client connects to the same hosted app and Supabase backend:
[Download signed APK v0.1.1](https://soeptuxxgxvluorkhkgt.supabase.co/storage/v1/object/public/app-releases/flors-kainan-0.1.1.apk?download=flors-kainan-0.1.1.apk).
Render Free sleeps when idle; this affects both the browser and Android client.

## Local setup

Use Node.js 22.13 or later and a working npm installation. Run npm ci, then copy
.env.example to .env.local. Keep credentials out of Git and chat.

| Variable                             | Purpose                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL             | Supabase project API URL                                       |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | API Keys: publishable browser key                              |
| SUPABASE_SECRET_KEY                  | API Keys: secret server key, used for private Storage          |
| DATABASE_URL                         | Connect: Session pooler PostgreSQL URI, with database password |
| FLOR_OWNER_EMAIL                     | Initial verified owner email: jethspogi@gmail.com              |
| APP_URL                              | Canonical origin; http://localhost:3000 locally                |

DATABASE_URL starts with postgresql://, not https://. Use the exact host supplied
by Supabase and URL-encode special characters in the database password. Keep
TLS certificate verification enabled.

Run npm test, npm run verify:cloud, then npm run dev. Open http://localhost:3000.
Create and confirm the owner account, sign in, then choose Start my real shop or
the explicitly fictional sample shop. Review prices, photos, pickup hours,
location, and GCash details before publishing a menu.

Configure the application origin and /auth/callback under Supabase
Authentication > URL Configuration. Customer email confirmation and password
recovery require working email delivery. Supabase's built-in test mail service
has recipient and rate restrictions; configure custom SMTP before rollout.

## Database migrations

supabase/migrations/ is the authoritative PostgreSQL history. The migrations
have been applied to the project above and filenames match remote history.
Use the Supabase CLI for future versioned migrations. Never apply the old
SQLite migrations in drizzle/ to PostgreSQL.

Business records live in the private kainan schema. The backend drops to the
restricted kainan_server role, which can modify records but cannot create or
drop tables. RLS is enabled on all 17 tables. Public API roles have no schema
access; every customer-facing operation also checks ownership on the server.
Do not expose this schema through the Data API or grant customers the backend role.

## Build and host

Run npm run build, npm run check, then npm start. Set the public Supabase
variables before building: Next.js embeds these in browser assets. Set database
and Storage secrets in the hosting service's server environment. Never prefix
secrets with NEXT_PUBLIC_. Set APP_URL to the final HTTPS origin.

Dockerfile builds a standalone, non-root server. Supply both public Supabase
variables as build arguments and secrets at runtime. PORT defaults to 3000;
/api/health reports process health. The server stores no durable business records
or uploads on its local disk. See docs/RENDER_DEPLOYMENT.md for the active service.

## Checks and recovery

npm test runs PostgreSQL business triggers and permissions in PGlite.
tests/cloud-smoke.sql exercises actual Supabase stock/payment/pickup behavior
inside a rolled-back transaction. npm run verify:cloud checks the pooler and
private Storage without displaying credentials. CI runs tests, build, and types.

Settings exports JSON records and CSV reports. JSON includes image metadata,
not image bytes. Database backups do not include Storage objects: arrange and
rehearse both recovery processes. The old restore-backup.mjs script creates an
offline SQLite recovery copy; it does not restore Supabase.

See ARCHITECTURE.md, VALIDATION.md, and docs/CLOUD_MIGRATION.md. Original starter
files and legacy tests remain for reference; default commands use Node/Supabase.

## Current boundaries

Pickup only; online saves; fixed portions; owner-approved preorders; manual
GCash verification; owner-only utang; private live chat; profile photos and a
full-screen image viewer. Delivery, detailed
food costing, push notifications, full offline selling, and unattended backups
are not enabled. The APK build, signature, and lint checks pass; actual-phone
testing is still required. Rehearse owner/customer workflows and
recovery before inviting customers.
