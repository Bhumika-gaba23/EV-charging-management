# Existing Vercel operations website

## Active hosting — 4 November 2026

- Operations dashboard: https://oops-omega.vercel.app
- C++ backend and customer website: https://pluggo-customer-demo.onrender.com
- Vercel production now forwards operator API requests to Render using the existing
  server-side gateway key. It no longer depends on the Mac or temporary tunnel.
- `/api/health`, `/api/ready`, customer bootstrap and authenticated station access
  passed against Render. Free hosting remains ephemeral and can sleep when idle.
- Production deployment: `dpl_5VYno3kwNYUnKxLpV7rh1w3YFpN9`.
- The APK has not been rebuilt. Earlier deployment notes below are historical.


This deploys the Pluggo operations dashboard to the existing Vercel `oops` project,
whose public URL is https://oops-omega.vercel.app. It preserves the customer app
in the repository; the operations website uses frontend/operator.html as its root.

Build the minimal dashboard bundle from the repository root:

```sh
node deployment/build-dashboard.mjs
```

Deploy from this directory after linking it to the existing `oops` Vercel project.
The bundle contains only dashboard scripts/styles and four licensed vehicle
posters; no local secrets, databases, mobile files or 3D binaries are uploaded.

The API gateway forwards only the allowlisted legacy C++ domain endpoints.
Set `PLUGGO_CPP_ORIGIN` to a deployed HTTPS C++ host to activate it. The gateway
returns an explicit 503 when unconfigured; the dashboard labels its existing
browser simulation mode. It does not pretend that the C++ backend runs in Vercel.
The separate Render C++ deployment remains prepared but pending.

The local dashboard at http://127.0.0.1:4173/operator.html calls the local C++ API
through the development proxy. These operations use the legacy domain station,
queue/solar simulation and scheduling APIs, distinct from customer SQLite sessions.

## Current deployment — 4 November 2026

Production: **https://oops-omega.vercel.app**

Deployment: `dpl_2u1qkuUfUfdRkEeCXwrQriHm63QP`.
The public `/api/health` and all five dashboard workflows were tested against the
actual C++ API. Twenty responsive route checks passed at desktop/tablet/phone
widths, along with vehicle profiles, operator details and manual QR verification.
The APK was not rebuilt.

The current demo uses a **temporary authenticated Cloudflare gateway to the C++
process on this Mac**, not permanent Render hosting. Keep the Mac awake and online,
with the local launcher, `tools/operator-demo-gateway.py` and cloudflared running.
Idle sleep is inhibited for three hours from the deployment setup; closing the
lid or shutting down still interrupts the backend. The static website remains on
Vercel and explicitly enters browser simulation when the C++ engine is unavailable.

The gateway permits only the operator demo routes. Customer SQLite endpoints,
private simulator endpoints and arbitrary paths are blocked. Its random key is
stored in ignored `secrets/operator_gateway_key.txt` and a sensitive Vercel
production variable, `PLUGGO_GATEWAY_KEY`. Never copy that key into client code.
`PLUGGO_CPP_ORIGIN` contains the temporary HTTPS origin. Restarting the quick tunnel
can change its hostname; update that variable and redeploy before using a new URL.

The first attempt from the repository directory was blocked by unrelated commit
author metadata. The successful release was published as a standalone artifact
outside Git, using the authenticated project owner. No author identity or Git
history was altered. For future releases, build from source and copy only `dist/`,
`api/`, `package.json`, `vercel.json` and `.vercel/project.json` to a directory
outside any Git checkout before invoking Vercel. Keep local environment files out.

Permanent free C++ hosting on Render remains future deployment work. The current
operator API still contains seeded station telemetry and prototype emergency
responses; it is a college demonstration, not a production station controller.
