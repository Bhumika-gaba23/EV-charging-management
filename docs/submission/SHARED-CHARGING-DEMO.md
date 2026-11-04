# Phone-to-dashboard charging demonstration

The customer app and operator Overview now share the same C++/SQLite customer
sessions. The simulator sends authenticated meter readings; the operator reads
an aggregate snapshot through the existing protected `/api/station` gateway.
No visitor cookies, owner identifiers or idempotency keys are returned to the
operator. This remains a public college demo, not production operator login.

1. Open https://oops-omega.vercel.app/#overview on the presentation computer.
2. Open the latest APK online. It should load https://pluggo-customer-demo.onrender.com.
   If it shows offline preview, Android Back → Connection settings → enter that
   Render URL → Connect. Offline-only sessions cannot appear on the website.
3. Choose the car. Open Stations, select Central Circle and an available CCS2
   connector (CP-01), then start a simulated session. A high target and budget
   give more time to demonstrate the accelerated simulator.
4. Within roughly three seconds plus network latency, the dashboard shows that
   connector occupied, the same vehicle, battery percentage, power, energy and
   estimated cost. Recent sessions shows the matching connector.
5. Stop charging in the app. The connector becomes available, power drops, and
   the recent entry changes to Finished while retaining delivered energy/cost.
6. Complete checkout in the app to show the simulated receipt. No money is taken.

The dashboard aggregates the five demo stations rather than mapping their sessions
onto the unrelated A1/A2/B1/B2 planner bays. Schedule, queue and solar remain
separate demonstrations; serving the queue does not start a customer session.
Energy and estimated spend totals include saved active and finished sessions.
Free Render data can reset on deployment/restart, and first access can need warmup.
Reload the dashboard after deployment; it polls while visible every three seconds.

Validation: `python3 tests/api/customer_integration.py` verifies shared session
readings, automatic completion, connector release and privacy of owner metadata.
`node tests/web/shared-session-browser.mjs` starts a dedicated customer visitor,
checks live Vercel dashboard updates against Render, stops charging and verifies
release/history. It resets only its own visitor data afterwards. The broader
five-page dashboard checks also passed at four viewport sizes. No physical
charger is involved and this change does not require rebuilding the hosted APK.
