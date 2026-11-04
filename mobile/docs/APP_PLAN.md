# Android demo scope and next steps

## Agreed scope

College demonstration, Android first, Flutter, black and silver throughout.
New Delhi is the initial discovery region. Cars, electric scooters and electric
bikes use separate generic fictional battery/connector profiles. No physical
chargers, providers, real payment collection or mandatory login.

## Implemented presentation journey

Vehicle selection → map/list discovery → compatible station details → connector
selection or optional QR/manual verification → target/budget setup → accelerated
charging session → zero-money demo checkout → local receipt/history.

An offline illustrated map keeps the demonstration usable without credentials.
Embedded Google Maps can be enabled using a restricted Android API key. Directions
launch externally rather than requiring a turn-by-turn navigation SDK. Foreground
location is optional; the labelled New Delhi starting point remains available.

## Next increments after reviewing this build

- Add custom vehicle names and editable demo battery profiles if needed.
- Add a seeded queue/waitlist demonstration, connected to the C++ priority logic.
- Add a fault simulation (charger offline, interrupted session) and recovery UI.
- Add station operator controls for the fictional availability data.
- Connect the Flutter flow to the existing C++ simulator API if the assessment
  requires demonstrating the C++ OOP components through the Android interface.
- Prepare screenshots, a short demo script and a signed distribution build once
  app identity and presentation requirements are settled.

## Outside this college demo

Actual charger control, live provider data, bank/UPI payments, reservations with
operators, battery telemetry and production authentication are separate future
integrations. Generic Demo AC is a simulation assumption, not a universal promise
of scooter/bike charger compatibility.
