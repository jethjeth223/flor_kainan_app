# Cloud migration status

Source: jethjeth223/flor_kainan_app. Supabase: soeptuxxgxvluorkhkgt.
Railway deployment is on hold at the user's request.

Implemented: Next.js Node runtime, standalone Docker definition, PostgreSQL
schema/triggers/indexes/RLS, restricted backend role, verified Supabase Auth,
owner-email setup, private Storage, whole-action transactions, auth screens,
PostgreSQL tests, cloud rollback smoke test, CI, and environment template.

Applied and verified in Supabase: 15 private tables with RLS, private bucket,
stock/payment/pickup rules and runtime role. Storage upload, server download,
anonymous denial, and deletion of the temporary QA image passed. The security
advisor reported no findings. No pilot records have been imported.

The local TLS pooler connection and cloud-backed anonymous API checks also pass.

Pending: GitHub write access, hosted HTTPS
server, production email/redirect configuration, owner account, two-account and
real-device rehearsal, backup/recovery operations, and signed Android APK.

The existing Sites deployment is separate and unchanged. No APK is available.
