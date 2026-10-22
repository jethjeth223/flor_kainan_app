# Cloud deployment status

Public test: https://flors-kainan.onrender.com
Source: https://github.com/jethjeth223/flor_kainan_app (main)
Database/Auth/Storage: Supabase project soeptuxxgxvluorkhkgt.

## Active infrastructure

- Render Free, Singapore, service srv-dbcnuvbrjlhs73e4jfk0, My Workspace.
- Node/Next.js standalone Docker server; no durable data on server disk.
- 15 business tables in private kainan schema, RLS, restricted backend role,
  parameterized queries, transactional stock/payment/closeout safeguards.
- Verified Supabase sessions and owner-only setup for jethspogi@gmail.com.
- Private customer images in kainan-files; separate public app-releases bucket
  contains only downloadable APKs and checksums. Anonymous uploads are denied.
- Supabase Site URL and exact confirmation/reset callback allowlist set for the
  public origin and localhost development.
- Signed Android WebView client v0.1.1, Android 10+, internet required. Native
  app-link certificate association is included in public/.well-known/assetlinks.json.

## Verification

All 12 PostgreSQL/API tests pass. The real cloud rollback smoke test passes.
Production Docker build/deployment succeeded. Public health/menu/login endpoints
return 200; protected exports and spoofed owner headers return 401, cross-origin
writes return 403. Private image upload/download/access checks pass. Supabase
security advisor: no findings. Android release assembly, full release lint,
signature verification, and public download hash verification pass.

## Remaining rollout work

Create and confirm the owner app account, initialize the shop, configure real
catalog/shop details, rehearse two-account workflows on Flor’s actual phone,
and arrange/rehearse database plus image backups. Configure production mail
delivery before inviting customers beyond Supabase's test-mail allowance.
Choose paid compute before relying on the app for daily sales; Free sleeps idle.

The initial shop tables are empty. No pilot records were imported. The old Sites
deployment remains separate. The Android signing key and passwords stay in
ignored local files; back them up securely to preserve the ability to sign updates.
