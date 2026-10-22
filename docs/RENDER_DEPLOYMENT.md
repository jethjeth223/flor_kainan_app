# Render Free public test

Live URL: https://flors-kainan.onrender.com
Dashboard: https://dashboard.render.com/web/srv-dbcnuvbrjlhs73e4jfk0
Service: srv-dbcnuvbrjlhs73e4jfk0 in My Workspace, Singapore, Free.
The initial Docker deployment is live and the public HTTP checks pass.

The selected host is Render Free in Singapore. The app keeps its existing
Supabase PostgreSQL, Auth, and private Storage. It does not create a Render
database or rely on persistent server disk. Free instances sleep after idle
periods; upgrade to paid compute before relying on the app for daily sales.

## Recommended path

Connect the Render integration to the correct workspace and authorize GitHub
repository jethjeth223/flor_kainan_app. The root render.yaml defines the service.
Use the existing service if one has already been created; do not create a second
service or import the Blueprint on top of a separately created manual service.

Render receives these settings from its environment manager:

- NEXT_PUBLIC_SUPABASE_URL: the existing Supabase API address.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: public key from .env.local.
- DATABASE_URL: saved, verified session pooler URI, including encoded password.
- SUPABASE_SECRET_KEY: saved server-only Storage key.
- FLOR_OWNER_EMAIL: jethspogi@gmail.com.

The Blueprint prompts for credentials without storing them in Git. Do not paste
them into chat, commits, build commands, or Dockerfile arguments. Only the two
NEXT_PUBLIC_ variables are declared as Docker build arguments. The other values
are consumed at server runtime. The Docker build excludes local .env files.

## Manual dashboard alternative

Create a Web Service linked to main, choose Docker, Singapore, and Free. Use
Dockerfile at the repository root and /api/health as the health check path. Add
the environment settings above before building. Let the Dockerfile supply the
start command. No persistent disk is needed. Enable deployment after CI checks
pass when available.

For the default onrender.com address, the application uses Render's automatic
RENDER_EXTERNAL_URL for same-origin checks. Do not copy APP_URL=http://localhost:3000
from the local file into Render. If you add a custom domain later, set APP_URL
to that exact HTTPS origin.

## After the first deploy

1. Verify /api/health, login assets, anonymous menus, protected routes, and the
   cloud database connection at the real HTTPS address.
2. In Supabase Authentication > URL Configuration, set Site URL to that origin
   and permit its /auth/callback URL. Keep localhost only if development needs it.
3. Create and confirm the owner account using jethspogi@gmail.com. Configure
   email delivery if Supabase's test mail restrictions block confirmation.
4. Start the real shop, review catalog and shop details, and rehearse a customer
   preorder, acceptance, payment proof, pickup, chat image, and closeout.
5. Build the signed Android APK against the verified HTTPS origin.

The service was created through the Render integration and is not currently
managed by a Blueprint. Its auto-deploy trigger is commit and its platform
health check is the default TCP check; /api/health was verified over HTTPS.
The Blueprint records the preferred HTTP health check and checksPass trigger
for a future managed setup. Do not import it as an additional duplicate service.

Supabase's public Site URL and exact confirmation/reset callback URLs were saved
and verified in the dashboard. Owner account creation, shop setup, and actual
phone rehearsal remain user rollout steps.

References:

- https://render.com/docs/blueprint-spec
- https://render.com/docs/docker
- https://render.com/docs/free
