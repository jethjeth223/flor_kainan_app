# Architecture

## Runtime boundaries

React screens call Next.js route handlers. lib/server.ts contains authenticated
use cases and validation. lib/postgres.ts provides bound queries, transactions,
and a small process-wide connection pool. lib/supabase/server.ts verifies
sessions with Supabase Auth; lib/supabase/storage.ts uses a server-only key for
private objects. No production data is stored on the application server disk.

The previous Sites deployment is separate. Its SQLite schema and starter
integration files are retained as history/reference, not the cloud runtime.

## Authorization

Identity comes from Supabase Auth getUser(), including email confirmation.
Browser-selected roles and untrusted identity headers never grant permissions.
Only FLOR_OWNER_EMAIL can initialize settings. Thereafter settings.owner_id is
the authoritative owner account ID; display names and user metadata never grant
owner access. Customer rows are linked to verified account IDs; a matching name
or phone number never claims manual utang records.

Customers see their own orders, payments, and chat. Anonymous users see only
published menus and food photos. The private kainan schema is unavailable to
Supabase anon/authenticated/service_role Data API roles. RLS allows only the
backend role; server operations additionally enforce account ownership. Runtime
connections drop to kainan_server and cannot perform DDL.

Same-origin mutation checks use the configured APP_URL, including behind a
reverse proxy. Set that value to the final public HTTPS origin before rollout.

## Transactions and money

Every action, including its validation reads, runs in one PostgreSQL transaction.
A single-shop advisory transaction lock serializes mutations across replicas.
This trades write throughput for simple consistency in a small food shop.
Triggers also lock affected menu rows in stable ID order and payment targets
before checking balances. Failed actions roll back all stock, money, and audit
changes. Bound parameters never interpolate browser input into SQL.

Amounts use integer centavos. PostgreSQL aggregate int8/numeric values are
converted only if safe integers; values that would lose precision are rejected.
UUID request IDs make retries idempotent. Whole-action serialization prevents
double acceptance, duplicate payments, closeout races, and stale capacity edits.

Pending requests do not reserve portions. Acceptance reserves the complete order.
Pickup moves reserved to sold and requires full verified payment or explicit
credit for a named customer. Cancellation returns portions or records waste.
Catalog and ordered prices are separate snapshots. Verified GCash references
are uppercase and unique. Verified payments are immutable; refunds are separate
bounded outgoing records. Utang exists only for opening balances and unpaid
credit-authorized pickups, less verified payments.

Sales use fulfillment dates; collections use verified payment dates. Capital,
expenses, transfers, and withdrawals remain separate. Old debt repayment does
not create a new sale. No unsupported profit estimate is displayed. Closeouts
block further changes until the owner reopens a day with a reason.

## Files and recovery

The bucket is private and has no customer-direct access policies. Uploads are
checked for JPG/PNG/WebP signatures and limited to 5 MB. File metadata links
private images to a customer. API downloads verify the customer or owner;
food photos intentionally have public application access. Private responses use
no-store; image responses prevent MIME sniffing. Failed metadata writes remove
newly uploaded objects. A later retention job is needed for unattached uploads.

CSV formula prefixes are escaped. JSON exports include records and file
metadata, not image bytes. Configure database and Storage backups separately;
the legacy offline SQLite restore tool does not restore PostgreSQL.
Cloud exports use flors-kainan-cloud-backup-v2 and include private profiles and
avatar references. Avatar uploads are linked to the verified uploader. Customers
can view their own photos and Flor's active profile photo; Flor can view customer
photos. Reusing another account's avatar file in a profile is rejected.

## Live chat and interface

An AFTER INSERT/UPDATE trigger broadcasts committed message rows to two private
Supabase Realtime topics: the shop owner and the conversation's linked account.
The private trigger has a fixed search path and no public execution grant. The
Realtime SELECT policy requires the authenticated JWT subject's exact own topic;
there is no client INSERT policy, so browsers cannot forge broadcasts. The
business schema remains private. Clients deduplicate WebSocket/HTTP echoes,
preserve read receipts, and refresh after reconnect to recover missed events.

The image viewer stays inside chat, with pointer pinch/drag, bounded 1–5x zoom,
accessible buttons, reset, and history-backed Back behavior. Interface text uses
system sans-serif fonts, visible selected navigation states, persistent mobile
tabs for both roles, and reduced-motion-aware transitions. Profile photos use
the existing private Storage and authenticated image route.

## Operational boundaries

Chat receives messages immediately over private WebSockets. A 15-second snapshot
refresh remains as a recovery fallback and to refresh non-chat shop records.
Screens display recent history with 500-row limits;
reports and exports query all records. Pagination is needed before these limits
become routine. Render Free now hosts the public test at https://flors-kainan.onrender.com.
Production email delivery, monitoring, backup operations, and real-device
rehearsal remain rollout work. The signed Android client and HTTPS service
share the same Supabase backend. See docs/ANDROID_RELEASE.md.
