## Order review, date lookup, and activity notifications - 2026-10-22

- All 19 tests passed. Date-filtered snapshots include orders outside the recent
  500 while preserving buyer isolation. Notification reads cannot affect another
  account, and timestamp-bounded reads leave newer activity unread.
- Draft food changes notify only Flor; published menu news includes confirmed
  customers without profiles/orders and excludes unconfirmed accounts. Orders and
  messages target their participants only. Rolled-back writes emit no notifications.
- Supabase notification-trigger WebSocket delivery passed (153 ms in one probe).
  Test notification and Auth account were removed; no business orders/messages
  were created. Storage/database checks passed with 17 RLS-protected tables.
- Production build and TypeScript passed. Browser checks with fictional data at
  393 x 852 confirmed a visible customer bell/feed, unread badges, 10 default rows,
  date-specific results, cart clearance above mobile navigation, and review scroll
  to 90 px below the top with focus on the review section.
- Three notification migrations applied and filenames aligned with cloud history.
  The existing leaked-password-protection advisory remains unchanged; no new
  database security findings. Physical Android checks remain rollout work.

## Public test and Android release

Render Free is live at https://flors-kainan.onrender.com. Public health,
anonymous data, login assets, protected exports, owner-header impersonation
denial, and cross-site denial were checked against the HTTPS service. Supabase
Auth site/callback URLs were saved and verified. APK v0.1.1 release assembly,
full release lint, signature verification, public download hash, and anonymous
release upload denial passed. Physical-phone UI rehearsal remains pending.

# Cloud migration verification

Current stack: Node/Next.js, Supabase PostgreSQL/Auth/Storage. The production build
and TypeScript checks passed. All 17 PostgreSQL/API/Auth/chat/image tests passed. Cloud rollback smoke
checks passed under the restricted runtime role, and private Storage upload,
download, anonymous denial, and cleanup passed. Supabase security advisor: no new
database findings; existing Auth leaked-password protection warning remains.
The cloud-backed local API returned 200 for anonymous menus and 401 for
unauthenticated exports and spoofed owner headers. The phone-size login layout
was visually checked. Public hosting and signed Android packaging are complete
as described above. Physical-phone gesture and upload rehearsal remains pending.

Auth callback regression coverage simulates Render's internal request address.
Confirmation and reset redirects use the configured public origin, ignore
forwarded-host input, reject external return destinations, and are not cached.

## Readability, profiles, and live chat update

- Actual migration SQL is tested with PostgreSQL, including the private message
  trigger, exact-topic receive policy, rollback behavior, and denied client sends.
- Photo API tests verify uploader ownership, Flor/customer access, anonymous
  denial, persistence, removal, invalid image rejection, and complete v2 exports.
- Live Supabase WebSocket probe: private event delivered in 753 ms in this run;
  another private topic was denied, a public subscriber received nothing, and a
  client broadcast was denied. The temporary Auth account was removed and no
  shop messages were created. This measurement is not a latency guarantee.
- Production UI checked with isolated fictional-data previews at desktop and
  393x852 phone size. Navigation, photo save/reopen, image zoom buttons, reset,
  and history Back are exercised without modifying actual customer records.
- Pinch/drag code and bounded transforms are implemented; physical-device
  multitouch and keyboard behavior still require rehearsal on Flor's phone.
- Supabase Auth warning: leaked-password protection is disabled. See
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

The following is historical validation of the separate Sites pilot, not evidence
that the Supabase application has been deployed.

---

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
# Catalog and live system updates — 2026-10-22

- All 18 automated tests passed, including the catalog workflow, automatic next-day
  stock, manual available quantity, refilling without changing reservations,
  idempotent preorder chat summaries, buyer isolation, and committed-only broadcasts.
- Public catalog WebSocket delivery verified against Supabase (593 ms in one probe).
  Private delivery also verified (152 ms), with unrelated topics and client sending denied.
  Probe Auth accounts were removed; no business orders/messages were created.
- Both cloud migrations applied; local filenames match Supabase's recorded versions.
  No new database security advisories. The existing leaked-password-protection
  warning remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Owner All dishes and portion/refill dialog checked at 393 × 852 using fictional
  local fixtures; order card checked in the conversation. Physical Android testing
  remains separate from this browser check.
