# ChargeFlow Android college demonstration

Black and silver Flutter app for electric cars, scooters and bikes in New Delhi.
The app runs independently of Docker, the C++ API, Keycloak and Vercel. All station
names, connector availability, battery profiles and prices are fictional. No real
charger or payment service is connected.

## Run on Android

Install Flutter stable and Android Studio with an Android SDK. This checkout was
verified with Flutter 3.47.9 / Dart 3.13.7. Dependencies are pinned in pubspec.lock.

```sh
cd mobile
flutter pub get
flutter run
```

Choose a connected Android phone (USB debugging enabled) or an Android emulator.
The committed `android/` project supplies the native host. The default demo needs
neither a Google API key nor a running backend. The illustrative offline map is
explicitly labelled and does not claim to show real GPS or roads.

Build an APK for sideloading during the presentation:

```sh
flutter build apk --debug
```

Install `build/app/outputs/flutter-apk/app-debug.apk` on an Android device. This is
a development build, not a Play Store release. A real release needs your signing
configuration; the generated release configuration currently uses debug signing.

## Enable embedded Google Maps (optional)

1. Create a Google Cloud project, enable **Maps SDK for Android**, configure the
   required billing account and create an Android Maps API key.
2. Restrict the key to package `com.chargeflow.chargeflow_mobile` and your signing
   certificate SHA-1. Restrict its API access to Maps SDK for Android. Get the
   debug certificate fingerprint using `cd android && ./gradlew signingReport`.
3. Copy `config/maps.example.json` to `config/maps.local.json` and replace the
   placeholder with your key. The local file is ignored by Git.
4. Build/run with that file:

```sh
flutter run --dart-define-from-file=config/maps.local.json
# Or:
flutter build apk --debug --dart-define-from-file=config/maps.local.json
```

One define configures both the native Android manifest and Flutter's map widget.
Fully rebuild after changing the key. Do not use the example placeholder itself.
Invalid keys/billing restrictions can result in blank Google tiles: fix the Cloud
configuration, or omit the define to return to the offline illustration.

Google Maps tiles and external directions need internet. The app's location button
requests foreground location permission only when tapped, accepts approximate
location and handles denial or disabled location services. Without permission,
distance uses the labelled Connaught Place demo origin. Distances are straight-line,
not travel distances. Actual station data is never fetched from Google Places.

Directions open Google Maps externally for a fictional coordinate. The station
screen explicitly warns that no actual charger is advertised there.

Official setup reference: https://developers.google.com/maps/flutter-package/config
External link integration: https://pub.dev/packages/url_launcher

## Presentation walkthrough

1. Select **EV Car**, **EV Scooter** or **EV Bike**. The app remembers your choice.
2. Discover compatible fictional stations, search by locality, filter availability
   and save favourites. Switch vehicle from the selector or My garage.
3. Tap a map marker or station card. Inspect connector types, availability and tariff.
4. Select **Try demo charging**, or open **Scan or enter charger code**. Codes such
   as `CP-01`, `CHARGEFLOW:CP-01`, or an HTTPS URL ending in `/charger/CP-01` work.
   The code must belong to that station and an available compatible connector.
   Scooter/bike demo charging uses `CP-03`. Camera scanning is optional and starts
   only when requested. Manual entry is available when camera access is denied.
5. Choose a target and budget. The fictional battery starts at 25%. The simulation
   runs at **60× speed**: one real second equals one simulated charging minute.
   Available power is capped by the fictional vehicle's input power.
6. Stop the charge or let its target/budget limit stop it. The simulation uses
   timestamps, so reopening the app reconciles any time spent in the background.
7. Complete checkout with **Complete demo payment · ₹0**. It collects no money and
   never asks for payment credentials. The resulting receipt is not a tax invoice.
8. Revisit Sessions for live sessions, pending checkout and saved receipts. One
   active charge is allowed, and a pending checkout must finish before a new one.
9. Use **My garage → Reset demonstration** to clear local demo data for the next run.

Vehicle selection, favourites, active sessions and receipts use device-local
preferences. No user login is needed and no payment or location is sent to the
project's backend. Google services handle map/direction requests when used.

## Validation

```sh
flutter analyze
flutter test
```

Tests cover connector compatibility, occupied connectors, target/budget limits,
exclusive sessions, checkout order, saved state restoration, QR payload parsing,
onboarding and the full charging-to-receipt UI flow.

Screen previews are under [docs/screenshots](docs/screenshots). Files prefixed
`android-` were captured from the running Pixel 7a emulator; numbered files are
Flutter-rendered previews. Regenerate numbered previews with:

```sh
flutter test tool/capture_preview.dart --update-goldens
```

The existing `lib/core/` API/OIDC scaffolding is retained for future backend work;
it is not invoked by this demo. This version intentionally uses a local simulator,
so C++ domain behavior is not being exercised by Android demo sessions.
