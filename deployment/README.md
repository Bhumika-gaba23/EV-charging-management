## Latest downloadable APK — 4 November 2026

[Download APK](https://github.com/Bhumika-gaba23/EV-charging-management/releases/latest/download/pluggo-phone-test.apk)
| [Release and checksum](https://github.com/Bhumika-gaba23/EV-charging-management/releases/tag/v1.6.0)

Version 1.6-render-connected, version code 7, Android 8.0+. It opens
https://pluggo-customer-demo.onrender.com by default. Existing offline-default
installations migrate once to this hosted app; custom server URLs remain saved.
Offline preview remains selectable in Android Back → Connection settings and
contains the current frontend. This is a test-signed sideload APK, not a Play Store
release. Build, release lint, APK signature verification and bundled-file matching
passed; physical-phone testing remains pending. Historical build notes follow.

# Pluggo phone build and hosting

## Android APK — latest website UI

The Android test package is `apk/pluggo-phone-test.apk` (generated and ignored by
Git), approximately 8 MB. Copy it to your Android phone and open it, permitting
installation from that file source when Android asks. Requires Android 8 or newer
and a current Android System WebView. It uses an optimized release build with a development signing key for testing,
not a Play Store signing configuration. No real payment or charger is connected.

This APK packages the current `frontend/`, including the 20px Stations glass blur.
It is a WebView test shell, not the separate older Flutter interface in `mobile/`.
The shell follows Android's secure local-content loading pattern using
[WebViewAssetLoader](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content).
It bundles all frontend models, scripts and fonts, so the initial UI works without
a server. Street map tiles and directions still need internet.

The first launch explicitly uses the browser-only **PREVIEW DEMO**. Charging and
receipts in this mode are simulated and saved on the phone. It is not connected
to the C++ API until you configure a server address.

To connect to the backend: return to Home and press Android Back until the Pluggo
menu appears, then choose **Connection settings**, enter the full hosted HTTPS
app URL and press Connect. To test locally, connect the phone and computer to the
same Wi-Fi, make the local frontend accessible on the LAN and enter the computer's
Wi-Fi IP plus port. `127.0.0.1` on a physical phone refers to that phone, not your
computer. Cleartext HTTP is enabled only in this development shell for LAN tests;
GPS/camera web APIs should be tested using HTTPS. Android permission prompts occur
only when a page asks for the relevant feature. Camera scanning availability also
depends on the WebView's BarcodeDetector support; manual charger codes remain
available.

The native Android Back menu also offers Reload and Close. The existing Flutter
app and its package remain unchanged and can be installed alongside this shell.

Rebuild from the repository root:

```sh
sh deployment/build-apk.sh
```

The script uses the Android SDK and Gradle wrapper, copying current frontend assets
on every build. Android Studio's JDK is automatically selected on macOS if
`JAVA_HOME` is unset. Set `ANDROID_HOME` and `JAVA_HOME` on other systems. Verify
integrity using `shasum -a 256 -c pluggo-phone-test.apk.sha256` from
the APK directory (the checksum file names the APK relative to that directory).

## Free C++ backend hosting — selected, not deployed

`Dockerfile`, `host.py`, `nginx.conf.template` and `render.yaml` package the customer
frontend, original C++ backend, SQLite store and private Python meter simulator.
The public server exposes customer endpoints only; legacy prototype APIs and
simulator credentials are not exposed. HTTPS termination belongs to the hosting
provider. Cookies use Secure in this deployment.

**The selected default is Render's free web service plan, with no paid disk.**
SQLite lives in `/tmp/pluggo/pluggo.sqlite3`; the hosting filesystem is ephemeral,
so visitor preferences, sessions and receipts can be lost on service restarts or
redeployment. This is a disposable project demonstration. Run one instance.

The source is prepared locally, but no hosting service has been created. Publishing
requires an authenticated Render connection and the intended source files pushed
to the Git repository accessible to Render. Create a Blueprint using
`deployment/render.yaml`. Use the actual HTTPS URL returned by Render in the APK's
Android Back → Connection settings menu. The APK remains in explicit offline
preview until a server URL is configured.

See Render's [Blueprint configuration](https://render.com/docs/blueprint-spec).
The optional `render-persistent.yaml` template uses a paid plan and disk; it is
**not selected or authorized for deployment**. `render-demo.yaml` remains a free
configuration alias. No service or charges have been activated by preparing files.
Do not commit local database contents, simulator keys or APK build caches.

For local container verification (requires Docker):

```sh
docker build -f deployment/Dockerfile -t pluggo-customer .
docker run --rm -p 10000:10000 -e CHARGEFLOW_COOKIE_SECURE=0 -v pluggo-data:/data pluggo-customer
```

Then open http://127.0.0.1:10000. Secure cookies are disabled only for that HTTP
local container test. Docker was unavailable while preparing this package; its
container runtime has not yet been verified. Local C++/SQLite and simulator tests
are documented in `docs/customer-backend.md`.

Sites hosting cannot execute the original C++ server. A Sites deployment would
need a separately adapted cloud backend rather than merely uploading these files.

## Checks completed for this package

- Gradle `assembleRelease`, R8 shrinking, release lint and APK signature verification passed.
- The APK was installed and launched on the Pixel 7a Android emulator.
- The embedded WebView rendered the current 3D Home UI and completed scooter,
  station/connector selection, simulated start/stop, checkout and receipt actions.
- The packaged glass stylesheet exactly matches `frontend/reference-layout.css`.
- The separate existing Flutter app passed analysis and all nine tests.
- No physical phone was attached. Installation, gestures, GPS and performance on
  your own phone still need your test.
- The Render/Docker configuration has not been deployed or container-tested.

## Rendering and memory management (version 1.3)

The APK now contains only the customer app's required assets, reducing it from
roughly 20 MB to about 8 MB. Code and Android resources are shrunk with R8. It remains
development-signed and uses package `com.pluggo.preview`, version code 6, so it can
update the earlier APK while keeping app data.

Vehicle rendering now prioritizes sharpness: multisample antialiasing, pixel ratio
up to 2, full-resolution studio reflections and preserved material detail. Quality
adapts under sustained load with a higher minimum resolution, rather than forcing
all phone previews to a 1x canvas. The mobile cache retains at most two models;
evicted GPU resources are disposed.
The animation renders on every display callback, including faster displays. The
quality-adaptation goal is 60 FPS; there is no 30 FPS or 60 FPS software limiter.
Actual performance depends on hardware, WebView, thermal throttling and system load.
Low RAM hints alone no longer replace animated vehicles with posters; explicit
poster mode, WebGL failure and actual memory pressure retain that safety fallback.

Motion-off previews stop their rendering loop after controls settle. Previews
pause offscreen, on other pages and while the app is backgrounded. Android pauses
WebView timers in the background, and low-memory notifications free the 3D resources
and reveal the poster. Renderer-process termination offers a reload using posters.
The outer glass retains its 20px Stations blur; a redundant nested navbar blur is
removed in lite/poster modes. Charging logic and receipts remain functional.

These choices use Android's documented [memory hints](https://developer.android.com/reference/android/app/ActivityManager)
and [WebView lifecycle/renderer APIs](https://developer.android.com/reference/android/webkit/WebView).
The browser can also select profiles automatically using device hints; explicit
`performance=lite`, `performance=poster` or `performance=full` URL parameters are
available for reproducible checks. The APK adds the suitable hint when loading a
hosted server URL, so its performance policy also applies after connecting.

Run `node tests/web/performance-browser.mjs` against the local frontend to check
uncapped display-frame rendering, cache bounds, idle sleep, memory-pressure cleanup, poster mode without
Three/GLB downloads and the complete charging/receipt flow. No physical low-end
phone benchmark has been performed; test the APK on the intended device.

## Clear glass and cargo update

Home stats and station surfaces use a mostly transparent, lightly smoked material
with a 20px blur. Map panels use dark text over the lighter glass. The floating
navbar and active lens use complete capsule shapes. The top-right preview/server
badge is visually removed; connection errors still have their Retry banner.

The fourth vehicle is Pluggo Cargo, an original enclosed electric delivery
three-wheeler design. It is available in the dropdown, swipe/dot navigation,
garage, backend preferences, compatible station discovery and simulated charging.
Its 20 kWh / 6.6 kW values are fictional demonstration data; a Demo AC connector
still clamps charging to its own available power. Preview posters are regenerated
from the same models. The model-to-poster switch avoids overlapping ghost images.

`node tests/web/clear-glass-browser.mjs` checks the new glass, capsule geometry,
sharp rendering and cargo backend charging/receipt flow at phone/desktop widths.

## Soft edge and motion pass (version 1.4)

Panels use a softly blurred, fading rim instead of a strong continuous outline.
The effect is decorative and noninteractive; text and controls retain crisp
rendering. Navigation, page arrivals, selected station contents and dialog steps
use consistent short transform/opacity transitions. Motion preferences remain
respected; no FPS cap has been introduced. Labels and numeric stability were
reviewed across the four pages and the complete charging journey.

See `docs/ui-audit/FINAL-REVIEW.md` for findings and remaining delivery checks,
`docs/ui-audit/soft-edges/` for latest renders, and
`docs/submission/REPORT-OUTLINE.md` for the suggested academic report structure.

## Gaussian showroom fade and clearer glass (version 1.5)

A masked 16px Gaussian backdrop blur blends the bottom of the vehicle stage into
the black space above the cards. Its subtle motion animates opacity/position,
rather than the blur radius. It does not intercept gestures, stops with reduced
motion/the motion switch, and pauses when hidden. The showroom stays uncapped.
Home cards, the map station sheet and map navbar now use a 4% dark base tint with
lighter specular highlights; the Stations glass retains its 20px backdrop blur.
