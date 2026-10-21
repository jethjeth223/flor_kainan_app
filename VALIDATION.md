# Validation

The implementation has the following verification layers:

1. TypeScript no-emit compilation.
2. Production Worker/client build through the Sites build helper.
3. Fourteen database/domain tests against the actual SQL migrations and triggers.
4. An integration scenario against the compiled production Worker in isolated Miniflare, with separate in-memory D1/R2 resources and fictional identities. It verifies authorization, cross-site rejection, customer data isolation, competing last-portion acceptance, duplicate-request handling, partial credit sales, GCash proof/verification, private image access, CSV/JSON exports, and reconstruction of a JSON backup into an empty recovery database.
5. Browser QA of the running local app at desktop and Android-sized viewports, including setup, sample mode, a real saved walk-in workflow, menu date switching, and overflow checks.

Run database tests with npm test. Build before running npm run test:api because integration tests execute dist/server/index.js. The integration suite never connects to a live customer database. A Windows sandbox may need permission to start workerd. SQLite/type stripping may emit experimental-feature notices on Node 22.

Wrangler's HTTP development proxy produced misleading mid-request-restart responses during initial integration attempts. Direct isolated Worker dispatch was used to verify the application independently of that proxy. The development browser workflow and production build are checked separately.

Before business rollout, perform usability testing on Flor's physical Infinix, verify real GCash receipt handling with an agreed test transaction, configure pickup/location details, finalize account ownership/customer access, schedule backups, and rehearse platform-specific recovery. Simulated viewport testing does not replace testing the actual device and connection.
