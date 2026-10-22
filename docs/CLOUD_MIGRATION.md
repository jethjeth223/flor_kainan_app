# Cloud deployment status

Public test: https://flors-kainan.onrender.com
Source: https://github.com/jethjeth223/flor_kainan_app (main)
Database/Auth/Storage: Supabase project soeptuxxgxvluorkhkgt.

## Active infrastructure

- Render Free, Singapore, service srv-dbcnuvbrjlhs73e4jfk0, My Workspace.
- Node/Next.js standalone Docker server; no durable data on server disk.
- 16 business tables in private kainan schema, RLS, restricted backend role,
  parameterized queries, transactional stock/payment/closeout safeguards.
- Verified Supabase sessions and owner-only setup for jethspogi@gmail.com.
- Private customer images in kainan-files; separate public app-releases bucket
  contains only downloadable APKs and checksums. Anonymous uploads are denied.
- Supabase Site URL and exact confirmation/reset callback allowlist set for the
  public origin and localhost development.
- Signed Android WebView client v0.1.1, Android 10+, internet required. Native
  app-link certificate association is included in public/.well-known/assetlinks.json.

## Verification

All 17 PostgreSQL/API/Auth/chat/image tests pass. The real cloud rollback smoke test passes.
Production Docker build/deployment succeeded. Public health/menu/login endpoints
return 200; protected exports and spoofed owner headers return 401, cross-origin
writes return 403. Private image upload/download/access checks pass. Supabase
security advisor: no new database findings; existing Auth leaked-password
protection warning remains. Android release assembly, full release lint,
signature verification, and public download hash verification pass.

## Remaining rollout work

Review real catalog/shop details, rehearse two-account workflows on Flor’s actual phone,
and arrange/rehearse database plus image backups. Configure production mail
delivery before inviting customers beyond Supabase's test-mail allowance.
Choose paid compute before relying on the app for daily sales; Free sleeps idle.

Existing shop records are retained by the additive profile/live-chat migrations.
No pilot records were imported. The old Sites deployment remains separate.
The Android signing key and passwords stay in
ignored local files; back them up securely to preserve the ability to sign updates.

Private live chat is delivered directly by Supabase Realtime; the Render server
continues to authorize and persist sent messages. Profile pictures stay in private
Storage. The installed APK loads these website updates without a native rebuild.
