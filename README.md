# EV Charging Station Management System (C++17)

A modular console demonstration of range safety, deadline-based charging,
budget caps, dynamic queuing, solar/grid allocation, and emergency overrides.

## Portfolio platform quick start

The repository now includes a PostgreSQL schema, Keycloak realm, Flutter customer
application, OCPP 2.0.1 simulator, OpenAPI contract, Docker images and CI workflow.

1. Copy the example secrets and replace their contents:

```powershell
Copy-Item secrets\db_password.example secrets\db_password.txt
Copy-Item secrets\keycloak_admin_password.example secrets\keycloak_admin_password.txt
```

2. Start the complete stack from a machine with Docker Desktop:

```powershell
docker compose up --build
```

3. Open the operator dashboard at `http://localhost:8088`, Keycloak at
   `http://localhost:8080`, and the API at `http://localhost:18080`.

Demo identities are `driver` and `operator`; change the seeded passwords before
sharing a deployment. The API currently keeps runtime sessions in memory while the
database schema and container are ready for the repository migration. The checked-in
Keycloak realm and OIDC client are integration scaffolding; JWT validation must replace
the development bearer token before public deployment.

The Flutter project is under `mobile/`:

```powershell
cd mobile
flutter pub get
flutter test
flutter run
```

## Build

```powershell
cmake -S . -B build
cmake --build build --config Release
```

Run on Windows with a multi-configuration generator:

```powershell
.\build\Release\ev_charging.exe
```

With a single-configuration generator, the executable is usually at
`build/ev_charging` or `build/ev_charging.exe`.

### Windows MSVC / NMake

After installing the Desktop development with C++ workload, open Developer
PowerShell for Visual Studio. Run each command separately and stop on failure:

```powershell
cd "D:\ev charging"
cmake -S . -B build-msvc -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build build-msvc
ctest --test-dir build-msvc --output-on-failure
.\build-msvc\ev_charging.exe
```

If CMake is not on PATH, use `& "C:\Program Files\CMake\bin\cmake.exe"`
in place of `cmake`. A missing `cl` or `nmake` means the compiler workload
has not finished installing or the developer environment is not activated.

The CTest executable checks range boundaries, feasible and impossible deadlines,
connector compatibility, all pricing overloads, remaining budget, queue order
and FIFO ties, solar fallback, and emergency preemption and rejection.

## Design highlights

- Classes encapsulate vehicles, users, chargers, sessions, and stations.
- Default, parameterized, copy constructors and destructors are explicitly demonstrated.
- `PricingEngine::calculateCost` has flat-rate, time-of-use, and solar overloads.
- `SmartPriorityQueue<T, ScorePolicy>` is a reusable class template with FIFO tie-breaking.
- `logEvent<T>` is a small function-template example.
- Public operations validate their inputs and report invalid states with exceptions.
- Emergency preemption excludes emergency sessions and compensates the paused user.

The project is an in-memory simulation. In production, persist sessions and queue
events in a database and serialize station allocation changes through transactions
or a per-station command queue.

## Full-stack web dashboard

The optional Crow server exposes the C++ domain logic as JSON endpoints and serves
the frontend from the same process. CMake downloads Crow 1.3.4 and standalone Asio
the first time the web target is configured.

From the **MSYS2 MINGW64** terminal:

```bash
cd "/c/D Drive Backup/ev charging"
cmake -S . -B build-web -G "MinGW Makefiles" -DEV_BUILD_WEB_API=ON -DBUILD_TESTING=ON
cmake --build build-web -j 4
./build-web/ev_web_api.exe
```

Open `http://localhost:18080`. Keep the terminal open while using the portal.

Run the automated C++ checks in another MINGW64 terminal:

```bash
cd "/c/D Drive Backup/ev charging"
./build-web/ev_tests.exe
```

### API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Connection status |
| `GET` | `/api/station` | Slot, power and sustainability metrics |
| `POST` | `/api/plan` | Deadline charging plan |
| `POST` | `/api/budget` | Budget-capped energy calculation |
| `GET/POST` | `/api/queue` | Read or add smart queue requests |
| `POST` | `/api/queue/serve` | Allocate the next queued vehicle |
| `POST` | `/api/solar/simulate` | Simulate solar generation and storage |
| `POST` | `/api/emergency` | Apply the fair emergency override |

The browser client checks `/api/health` at startup. If the C++ server is not
available, the frontend clearly displays **DEMO MODE** and continues with local
simulation data.

## Mobile application API

The server also exposes an app-ready simulation API. Obtain the development token:

```http
POST /api/auth/login
Content-Type: application/json

{"email":"driver@example.com","password":"demo"}
```

Send the returned token on protected calls:

```http
Authorization: Bearer chargeflow-demo-token
```

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Development login and bearer token |
| `GET` | `/api/stations` | Discover available charging stations |
| `GET` | `/api/chargers/{id}` | Charger connector, power and availability |
| `GET/POST` | `/api/vehicles` | Read or register user vehicle profiles |
| `POST` | `/api/charging/start` | Validate and start a charging session |
| `POST` | `/api/charging/stop` | Stop a charging session |
| `GET` | `/api/sessions/{id}` | Charging session summary |
| `GET` | `/api/sessions/{id}/live` | Current SoC, power, energy and cost |
| `POST` | `/api/charger-adapter/meter-values` | Simulated OCPP meter input |

The meter adapter uses `X-Charger-Key: development-charger-key` for local testing.
It represents the boundary where a production OCPP service would supply authenticated
`MeterValues` or `TransactionEvent` information. Do not use the development bearer
token or charger key in production. Replace them with OAuth/OIDC user authentication,
charger certificates and an audited OCPP implementation connected to certified EVSE
hardware. The web or mobile application must never control a high-voltage charging
circuit directly.

## Charger QR scanner

The portal header includes **Scan Charger**. On supported browsers it requests the
rear camera only after the user presses **Start Camera**, detects a QR code locally,
and verifies the resulting charger ID through `GET /api/chargers/{id}`. Camera frames
are not uploaded. A manual charger-code field is always available as a fallback.

Supported development QR payloads include:

```text
A1
CHARGEFLOW:A1
http://localhost:18080/charger/A1
http://localhost:18080/connect?chargerId=A1
```

Browser camera access requires a secure context. `localhost` is accepted for local
development; a deployed application must use HTTPS. The scanner uses the native
`BarcodeDetector` API when available and falls back to manual verification otherwise.

## Deploying the dashboard to Vercel

The root `vercel.json` explicitly builds the static files from `frontend/` into
`dist/`. This prevents Vercel from treating the Python OCPP simulator as the web
application. Import the repository in Vercel with the repository root selected and
redeploy; no framework preset or custom build settings are required.

Vercel hosts only the browser dashboard. The C++ API, PostgreSQL, Keycloak and OCPP
simulator must run on a container-capable host. Until an API URL is configured, the
deployed dashboard intentionally operates in demo mode.

## India charging station map

The driver page includes a Leaflet/OpenStreetMap map and an India-wide public
directory in `frontend/data/india-stations.json`. This is an ODbL snapshot of
OpenStreetMap charging-station listings, not a complete or live inventory. The UI
shows the snapshot date and attribution. Unlisted connector, price, phone and
opening-hours data remain unknown; live bay availability is not inferred.

Refresh the snapshot deliberately (requires Node 24 and network access), then
redeploy the frontend:

```powershell
node scripts/refresh-stations.mjs
```

The script queries the India administrative area via public Overpass once per
refresh, validates the result and preserves existing data on errors. It does not
send every visitor to Overpass. Leaflet assets come from unpkg and map tiles from
OpenStreetMap; production traffic must follow their service policies or use a
dedicated tile provider. Both station-list and map load failures have UI states.

Near me asks for browser location permission only on click. Coordinates are held
in memory, used for straight-line nearest-listing sorting and map centering, and
are not saved. Map tile requests reflect the viewed area. Directions opens Google
Maps with the destination coordinates. City shortcuts search nearby listings;
other queries match station metadata. The public-access filter includes only
listings explicitly tagged for public/permissive access.

`scripts/test-station-map.cjs` uses Playwright (available on NODE_PATH or installed
locally) and Chrome against a frontend server on port 4173 to check search,
location sorting, station details, directions, empty states and mobile overflow.

State search supports all 36 states/UTs, dropdown counts and typed state names.
Station state labels are derived from coordinate containment in district polygons
from https://github.com/udit-001/india-maps-data (no polygons are bundled in the
browser). Refresh those labels after updating station data:

```powershell
node scripts/enrich-station-states.mjs
```

Only listings in the directory are counted. A zero count means no matching
directory entries, not an absence of physical charging stations in that state.
