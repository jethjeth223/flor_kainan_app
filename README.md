# Flor’s Kainan

A full-stack, mobile-first pilot for Flor's food business: dated menus, Flor-approved pickup preorders, fast walk-in sales, shared stock, manual cash/GCash verification, partial payments and utang, expenses, capital contributions, private image chat, reports, and exports.

## First use

Sign in and choose Start my real shop for an empty ledger, or Explore the sample shop for explicitly fictional orders and money records. The starter food catalog contains suggested dishes/prices and AI illustrative images. Review the catalog and Shop settings before publishing a real menu. Sample mode can be cleared from Settings after typing START FRESH.

The review deployment is private. Platform access and ChatGPT sign-in are separate from the app's owner permissions. The first authenticated setup establishes the owner; initialize while private before changing platform sharing. Customer rollout and Flor's account ownership still need an access decision. No passwords, payment credentials, or deployment tokens are stored in source.

## Develop

Use Node 22.13 or later. On a normal machine:

```sh
npm ci
npm run check
npm test
npm run build
```

Apply each pending SQL migration to the local D1 database once, using the built configuration:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_chilly_rhino.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_safe_bug.sql
npm run dev
```

Open the printed loopback URL. The maintained portable starter simulates sign-in at /signin-with-chatgpt?return_to=/ as local_seedy. The local database and uploads are ignored under .wrangler/. Hosted D1/R2 are separate and provisioned by Sites from .openai/hosting.json.

On this computer, global npm was incomplete. An ignored project-local npm installation was used; the application itself can be started without npm via node scripts/run-framework.mjs dev --hostname 127.0.0.1. The normal commands above work on a machine with a complete npm installation. Preserve the starter's Sites build integration when changing the stack.

## Tests

```sh
npm run check
npm test
npm run build
npm run test:api
```

The API suite boots an isolated Miniflare instance using the compiled production Worker, applies the real migrations, seeds fictional records, and disposes its own D1/R2 resources. It never points at the live shop. Build again after server changes before running it. On Windows, workerd may require permission outside a restricted sandbox.

See [VALIDATION.md](VALIDATION.md) for coverage and browser verification details.

## Data recovery

Download a full JSON data backup from Settings. To validate it and reconstruct a new offline recovery database:

```sh
node scripts/restore-backup.mjs downloaded-backup.json outputs/recovered.sqlite
```

The script validates all table references and integrity, preserves the original ledger/stock state and triggers, and refuses to overwrite an existing file. Image metadata is included; actual image objects must be backed up/recovered separately from R2. This is an offline recovery artifact, not an automatic overwrite of the live shop. Automated daily backups and production-specific restoration are operational work still to configure.

## Engineering notes

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, transaction rules, access control, and scale limits. [ASSETS.md](ASSETS.md) records the generated food asset and exact prompt. [docs/STARTER_RUNTIME.md](docs/STARTER_RUNTIME.md) retains the upstream runtime instructions.

Current boundaries: online saves, manual GCash verification/refunds, owner-only utang, 15-second chat polling, and recent-history screen limits. Detailed ingredient costing/profit, delivery, push/SMS, full offline selling, broader customer authentication, and unattended backups are not enabled. Treat this private version as a pilot until Flor's real-device and operational checks are complete.
