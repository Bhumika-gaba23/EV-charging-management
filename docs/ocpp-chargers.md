# Connecting real chargers (OCPP 1.6J)

Pluggo can drive physical charging stations that speak **OCPP 1.6J** (OCPP 1.6 over
WebSocket/JSON). That covers most AC wallboxes and DC fast chargers sold in India. The
`ocpp-gateway/` service runs next to the C++ server in the same container. Customers keep
using the app: when they start charging, Pluggo tells the charger to start, bills from the
charger's own energy meter, and stops it when the target, budget or customer says so.

## What happens during a session

| Step | App / server | Charger (OCPP 1.6J) |
|---|---|---|
| Customer taps Start | Session created on a connector that is online and `Available` | `RemoteStartTransaction` (idTag tied to the session) |
| Cable plugged in | | `Authorize`, `StartTransaction` → accepted only for that session's idTag |
| Charging | Energy and cost come from the charger's meter | `MeterValues` (`Energy.Active.Import.Register`, every 10 s) |
| Target, budget or customer stop | Session ends | `RemoteStopTransaction`, then `StopTransaction` (final reading billed) |
| Driver unplugs or presses stop at the charger | Session ends: "Cable unplugged at the charger" | `StopTransaction` |
| Charger refuses or nobody plugs in within 90 s | Session ends with no charge | |
| Charger offline or `Faulted` | Connector shown unavailable; cannot be booked | `StatusNotification` / disconnect |

RFID cards are refused: charging starts only from the app, so every kWh has a paying customer.
The simulator never touches connectors that belong to real chargers.

## Configure the server

Set `PLUGGO_OCPP_CHARGERS` on Render (Environment) as one line of JSON. Map each charger's
connector numbers to Pluggo connector IDs from `database/seed/customer_catalog.json`:

```json
{"PLUGGO-CP-01": {"password": "a-random-16-to-40-char-secret", "connectors": {"1": "CP-01"}},
 "PLUGGO-MH-01": {"password": "another-random-secret-value", "connectors": {"1": "MH-01", "2": "MH-02"}}}
```

- The charge point ID may contain letters, digits, `.`, `_` and `-` (up to 48 characters).
- Passwords must be 16–40 characters (OCPP 1.6 Security Profile requirement). Generate them
  with `python -c "import secrets; print(secrets.token_urlsafe(24))"`.
- Deploy. The logs show `OCPP 1.6J gateway on: …` and `/api/ready` keeps working.
- To add a new site, also add its station and connectors to `customer_catalog.json`
  (name, location, connector type, power, tariff).

## Configure the charger

In the charger's installer app or web page (names vary by vendor):

| Setting | Value |
|---|---|
| Central System / OCPP server URL | `wss://pluggo-customer-demo.onrender.com/ocpp/` (some chargers want the ID appended: `…/ocpp/PLUGGO-CP-01`) |
| Charge Point ID / Identity | `PLUGGO-CP-01` (must match the JSON key) |
| OCPP version | 1.6J (JSON) |
| Security profile | 1 or 2 (Basic authentication over TLS) |
| Password / AuthorizationKey | the password from the JSON |
| Heartbeat | leave the default; the server sets 60 s at boot |

When the charger connects, the operator dashboard shows its connector with source
**OCPP 1.6J** and the charger's live status.

## Buying a charger for a pilot

Look for **"OCPP 1.6J"** (not only "OCPP-ready" or a vendor cloud) and the ability to set a
custom Central System URL. A 3.3–7.4 kW AC wallbox with a Type 2 socket is the cheapest way
to run a real pilot. Ask the vendor to confirm `RemoteStartTransaction`,
`RemoteStopTransaction` and `MeterValues` with `Energy.Active.Import.Register`.

## Testing without hardware

`tests/api/ocpp16_test.py` runs the real server and gateway against an emulated charger built
on the open-source `ocpp` library, which checks every message against the official OCPP 1.6
schemas. Before a pilot, you can also point a third-party simulator (for example
[EVerest](https://everest.github.io) or any OCPP 1.6J charge point simulator) at the URL
above.

## Limits today

- OCPP 1.6J only. OCPP 2.0.1 and smart charging profiles are not implemented yet.
- One active transaction per Pluggo connector. Reservations and local authorization lists
  are not used.
- Firmware updates and diagnostics are done in the vendor's tools.
