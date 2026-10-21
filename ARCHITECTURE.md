# Architecture and business rules

## Application layers

- app/kainan.tsx: responsive shell, owner/customer presentation, connection state.
- components/: screen components, reusable controls, and forms. shop-context.tsx owns fetching, refresh sequencing, save status, and notifications.
- app/api/[...path]/route.ts: HTTP routing and error boundary.
- lib/server.ts: authenticated use cases, validation, authorization, D1 queries, and private file handling.
- lib/domain.ts: pure Manila date, stock, money formatting, and status helpers.
- lib/types.ts: client-facing data contracts.
- db/schema.ts and drizzle/: relational model, versioned SQL migrations, constraints, and stock/payment triggers.
- worker/index.ts and maintained Sites starter scripts: production Worker entrypoint and build/deployment integration.

The app uses React and TypeScript, the supplied Vinext/Vite server integration, Cloudflare D1 for SQLite-compatible records, and R2 for images. There is no browser-local business database. An in-progress form remains on screen when saving fails; successful server responses determine saved state.

## Identity and access

Sites supplies verified ChatGPT identity headers. The initial deployment is owner-private. The first authenticated setup saves the owner's stable Site user ID; every later owner action compares server-side identity against that saved ID. Establish ownership before changing the platform audience. A client-side customer preview does not grant or revoke permissions.

Customers are linked to verified account IDs. Matching an existing phone number or customer name never claims a manual utang record. Walk-ins need no account. Customer snapshots exclude other customers, the owner ID, the utang ledger, audit records, and shop financial reports. All mutations and image reads apply server-side authorization. Same-origin checks reject cross-site writes.

The portable development starter simulates one local account. The isolated production-Worker integration suite injects synthetic identity headers directly to the local Worker; these headers are normally supplied and protected by the hosting platform. Do not expose an unprotected raw Worker that trusts arbitrary public identity headers.

## Transaction boundary

Each multi-step operation uses D1 batch(), with constraints and triggers in the same database transaction. All currency amounts are integer centavos. The server calculates totals using menu snapshots and checks the client's reviewed total before creating an order.

- Pending requests do not reserve stock.
- Accepting reserves every order line atomically. A failed line rolls back the entire acceptance.
- Picking up moves reserved portions to served portions. It requires full verified payment or explicit credit for a named customer.
- Cancellation releases reservations. The owner decides whether portions return to availability or become unavailable/waste.
- Food and order-line prices are separate snapshots. Future catalog/menu edits do not rewrite order history.
- Verified GCash reference numbers are unique and normalized to uppercase.
- Payment verification rejects an amount beyond the remaining balance, including a race between two payment proofs.
- Verified payment details are immutable. Refunds are separate outgoing records, bounded by the verified amount still owed back.
- UUID request identifiers prevent repeated taps or retries from duplicating orders, payments, and money entries.

SQL triggers use parenthesized CASE expressions and LF line endings because the D1 statement splitter is stricter than SQLite's parser. Migrations have been applied successfully through Wrangler as well as exercised by SQLite tests. Applied migration files and snapshots must remain immutable.

## Sales and money

Benta uses the fulfillment date of food actually handed over. Collections use the date cash was recorded or GCash was verified. Old utang repayment and tomorrow's advance payment can increase collections without increasing today's sales. Capital contributions are neither sales nor operating expenses. The app deliberately does not display a profit estimate without consumption-based ingredient costing.

Customer utang is derived from opening charges and unpaid credit-authorized collected orders, less verified payments. Creating an opening balance does not create a sale. A payment must target one specific order or opening charge; a transfer covering multiple charges is recorded against those balances separately. A future payment-allocation screen would be needed to split a single GCash reference across several charges without duplicate entry.

Daily cash closeout is calculated server-side from opening cash, cash collections, cash expenses, contributions, withdrawals, transfers, and refunds. Unresolved orders must be cleared before closing. Closed days reject further financial entries until the owner reopens them with a reason.

## Files, exports, and recovery

JPEG, PNG, and WebP uploads are limited to 5 MB and checked by file signature. Chat/payment images have customer-scoped private reads. Owner-uploaded food images are intentionally public at the application layer. Responses prevent MIME sniffing; private files use no-store caching. Unsuccessful metadata writes clean up their newly uploaded file.

CSV exports escape spreadsheet formula prefixes. JSON backups include all relational data and file metadata. scripts/restore-backup.mjs reconstructs a new SQLite recovery file only after validating the relational graph and integrity in memory. It refuses to overwrite an existing file. Original image objects require a separate file-storage recovery process.

## Scale and operational boundaries

This is a single-shop pilot. Reports and exports aggregate all persisted records; the screen displays up to 500 recent orders/payments and 500 recent owner messages. Pagination and on-demand historical ledger loading are required before that cap becomes routine. Chat uses 15-second polling while the page is visible. No SMS or phone push service is configured.

The deployed review remains private, uses platform ChatGPT sign-in, and has a separate database from the local sample shop. Production access/sharing, how Flor receives ownership, automated backup scheduling and file retention, application monitoring, and a recovery rehearsal against the chosen production platform must be finalized before customer rollout. Manual backup and isolated recovery verification are implemented; unattended daily backup scheduling is not configured.
