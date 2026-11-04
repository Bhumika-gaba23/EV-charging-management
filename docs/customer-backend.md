# Pluggo customer backend

## Local run

From the repository root:

```sh
python3 -m pip install -r ocpp-simulator/requirements.txt
python3 tools/run-local.py --build
```

Open http://127.0.0.1:4173/#home. The launcher starts the same-origin frontend
proxy (4173), C++ API (18080), and Python WebSocket meter simulator. Ctrl+C stops
all three. Use `--port 4174 --api-port 18081` to change ports. A C++17 compiler,
SQLite development library, Git and Python are required; the script uses CMake
when present and clang++ otherwise. Dependencies are pinned in the build script.

The launcher creates an ignored random simulator credential in
`secrets/local_simulator_key.txt`. Do not commit it. SQLite state lives in
`data/pluggo.sqlite3`, including visitor preferences, sessions and receipts.
To back it up while running, use SQLite's backup command rather than copying only
the database file while WAL writes are active:

```sh
sqlite3 data/pluggo.sqlite3 '.backup data/pluggo-backup.sqlite3'
```

My garage → Reset affects only the current visitor. Clearing browser cookies
creates a new visitor; there is no account recovery or cross-device login yet.

## Connected behavior

- Home battery/power and Sessions use server-owned charging state.
- Stations receives server catalog data and live connector occupancy. Competing
  visitors cannot reserve the same connector. Baseline unavailable connectors in
  the fictional catalog remain unavailable.
- Selected vehicle and saved stations persist per visitor. UI motion, map key and
  device location remain browser settings. Device location is not uploaded.
- Connector verification, compatibility, target, budget and price calculations run
  on the server. Browser-provided energy, price and power are not trusted.
- Start uses a persisted idempotency key. Stop and zero-money checkout can be
  retried safely. Receipts have stable IDs and explicitly collect ₹0.
- The normal URL never falls back to local sessions. Network failures display a
  Retry banner. `?demo=1` explicitly enables the old standalone UI preview.

## API contract

See [OpenAPI customer contract](../openapi-customer.yaml). All paths below start
with `/api/customer`. Responses are JSON with `ok`; errors include `error`.
Bootstrap returns an HttpOnly, SameSite=Strict visitor cookie. All other customer
routes require it. Mutations require `X-Pluggo-Request: 1`; cross-origin requests
are rejected. Fetch uses same-origin credentials. Snapshot replies contain
`state`, `catalog` and `backend`; prices and energy in snapshots are authoritative.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/bootstrap` | Create/restore visitor and get snapshot |
| GET | `/state` | Current visitor state and station availability |
| PUT | `/preferences` | `{vehicle, saved: [stationId]}` |
| POST | `/verify` | Validate `{station, connector, vehicle}` |
| POST | `/sessions` | Start with `{station, connector, vehicle, target, budget}` and `Idempotency-Key` |
| POST | `/sessions/{id}/stop` | Stop your session |
| POST | `/sessions/{id}/checkout` | Settle your ended session, collecting zero |
| POST | `/reset` | Delete only your sessions and reset preferences |

`GET /api/ready` queries SQLite and reports actual local identity/storage mode.
This does not assert PostgreSQL or OIDC readiness. `/api/health` is process liveness.

## Simulator

The launcher defaults to `meter`: energy advances only through authenticated
OCPP-shaped WebSocket messages at `/ocpp/customer`. The simulator polls active
sessions using `X-Charger-Key`, emits boot/heartbeat/transaction frames and
reconnects after interruptions. Server-side targets/budgets clamp meter readings;
older readings cannot reduce energy. Starting requires a fresh simulator heartbeat.
If it disconnects, energy pauses and availability becomes unavailable when its
15-second heartbeat window expires; stop and checkout remain usable.

`python3 tools/run-local.py --mode clock` uses server elapsed time instead, useful
for standalone API development. Both modes default to 60× simulated time.

| Environment variable | Default / purpose |
| --- | --- |
| `CHARGEFLOW_CUSTOMER_DB` | `data/pluggo.sqlite3` |
| `CHARGEFLOW_SIMULATION_MODE` | `clock` for bare API; launcher selects `meter` |
| `CHARGEFLOW_SIMULATION_SPEED` | `60`, maximum `600` (UI copy assumes default 60×) |
| `CHARGEFLOW_SIMULATOR_KEY` | Launcher generates a private key; bare API development default is `local-simulator-key` |
| `CHARGEFLOW_PORT` | `18080` |
| `CHARGEFLOW_BIND_ADDRESS` | `127.0.0.1`; container uses `0.0.0.0` |
| `CHARGEFLOW_COOKIE_SECURE` | `0` locally; set `1` behind HTTPS |
| `CHARGEFLOW_CATALOG_FILE` | Build-time seeded catalog path |
| `PLUGGO_CUSTOMER_API` | Simulator API origin |
| `PLUGGO_CUSTOMER_WS` | Optional simulator WebSocket URL override |

This adapter is not a complete OCPP 2.0.1 implementation or physical charging
integration. The legacy operator simulator/routes are separate prototypes.

## Verification

```sh
sh tools/build-local.sh
build-web-demo/ev_tests
python3 tests/api/customer_integration.py
cd tests/web
npm install
npm run test:logic
npm run test:backend
npm run test:home
npm run test:layout
```

The API suite launches isolated real C++ processes and SQLite databases. It covers
restart persistence, visitor isolation, validation, CSRF/origin checks, idempotency,
concurrent connector contention, target caps, receipt retries, and a real Python
WebSocket simulator. Browser tests need Chrome and the local launcher running;
they cover preferences, live Home widgets, charging/checkout, local-storage tamper
rejection and outage recovery. UI-only suites explicitly use `?demo=1`.

## Deployment limits

This connects the customer web app, not the standalone Flutter demo or legacy
operator APIs. SQLite and local visitor cookies are the implemented local backend.
PostgreSQL migrations and Keycloak remain scaffolding; production account login,
JWT validation, payments, real vehicle telemetry and physical chargers require
separate integration. Google Places search still needs your restricted Maps key;
setup instructions remain in the app. No physical Android device was connected
for this validation.

Docker files include the customer store and simulator; Docker was unavailable in
the local environment, so that runtime is unverified. Override the shared
simulator key for API and simulator together before exposing a deployment. Static
hosting alone cannot run the C++ API; deploy a same-origin API proxy or use the
explicit UI preview.

## Latest local validation

The domain tests, real C++ API integration suite, nine JavaScript logic checks,
backend browser journey, Home widget checks and responsive reference-layout checks
passed. All four customer pages and the charging/checkout/receipt screens were
rendered at desktop and phone sizes using the connected backend. Page checks
reported no JavaScript errors or horizontal overflow. Small status labels on two
phone pages remain below 10 px; primary controls and text are larger.

Browse [the render gallery](ui-audit/index.html) with “Latest: connected backend”
selected, or inspect [the recorded layout metrics](ui-audit/backend-connected/metrics.json).
No live Google credential or physical-device validation was performed.
