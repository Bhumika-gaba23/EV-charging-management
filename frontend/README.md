# Pluggo web app

Black and silver browser app with Montserrat, a floating glass navigation inspired
by the Grain reference, and three imported, optimized 3D vehicles. The customer
app is now the default `index.html`; the previous operator dashboard is preserved
at `operator.html`.

## Run locally

From the repository root:

```sh
python3 -m pip install -r ocpp-simulator/requirements.txt
python3 tools/run-local.py --build
```

Open http://127.0.0.1:4173/#home. This runs the frontend, C++ API and WebSocket
simulator together. Normal mode requires the API; failures show an offline banner
with Retry. It does not silently create browser-local charging sessions.

The server owns station/vehicle profiles, connector occupancy, session energy,
battery state, budgets, receipts and selected/saved preferences. SQLite preserves
these across server restarts. An HttpOnly visitor cookie separates browser profiles;
this is local demo identity, not account login. See the [backend guide](../docs/customer-backend.md).

For a UI-only static preview, run `python3 -m http.server 4173 --directory frontend`
and open `http://127.0.0.1:4173/?demo=1`. This explicitly uses localStorage and does
not connect to the backend. Static Vercel hosting requires this preview mode or a
separately deployed same-origin API proxy.

Charging, station names, battery values and prices are fictional. Checkout collects
no money and no physical charger is controlled. Demo AC compatibility is an
explicit simulation assumption for the scooter/bike profiles.

## Included journey

- **Home:** choose a car, scooter or bike and view its clean depth animation with
  its name behind the model. The card has no visible controls, hints, captions or
  spec labels. One charging action and two compact nearby stations complete the
  page. Keyboard arrows rotate the focused canvas; plus/minus zoom. Reduced motion
  is respected, and **My garage → Animate vehicle previews** turns animation off.
  A matching poster appears when WebGL is unavailable.
- **Stations:** compatible station list, locality search, availability/saved filters,
  price/distance sorting, optional device location and illustrative Delhi map.
  Distances use a clearly labelled Connaught Place demo origin until the user
  grants location access. Distances are straight-line, not driving distances.
- **Connect:** select a compatible connector, enter a demo ID such as `CP-01` or
  `PLUGGO:CP-01` (legacy `CHARGEFLOW:` codes also work), or scan a QR in browsers supporting BarcodeDetector.
  For scooter/bike use `CP-03`. Camera starts only after pressing Start camera;
  permission denial and unsupported scanning have a manual fallback. Closing the
  dialog stops the camera stream. Camera frames stay in the browser.
- **Charge:** set a target and budget; demo starts at 25% and runs at 60× speed.
  One real second equals one simulated charging minute. Target/budget limits stop
  it automatically. Live sessions are restored from the server after a reload.
- **Checkout:** stop charging or wait for completion, then complete a ₹0 demo
  payment. Receipts explicitly state no real money was charged and are not tax
  invoices. Only one active charge or pending checkout is allowed per visitor.
- **My garage:** switch fictional profiles, configure Google Maps or reset your server
  demo data. Vehicle choices and saved stations persist on the server; motion and
  other presentation settings remain local. Clearing cookies loses access to the
  previous visitor history.

## Optional Google Maps

The default real street map uses fictional demo station pins and requires no
Google key. To search real stations, configure your own browser key in My garage
with Maps JavaScript API and Places API (New) enabled. The app displays setup
instructions. No paid Google requests are made without a configured key. Keys
remain in sessionStorage for the current tab; restrict them to your website.

## Assets, mobile layout and rendering

- `vehicle-scene.js` loads local GLBs with GLTFLoader: a realistic 2024 Tesla Model 3,
  silver urban scooter and sci-fi motorcycle. Full authorship, source links and
  reuse licences are in [assets/models/CREDITS.md](assets/models/CREDITS.md) and the
  app's **3D model credits** dialog. These are visual previews; the demonstration
  battery profiles do not claim to describe the actual models.
- Geometry is merged and simplified to approximately 117,300 / 85,400 / 66,300
  triangles. Materials/textures are optimized, and textures are limited to 2048px
  WebP. Models load on selection and are cached. The default car is about 3.4 MB.
- The selected model name sits behind the vehicle in two oversized text layers.
  The foreground canvas occludes the lettering, while pointer/orbit movement shifts
  the text more slowly to create parallax depth. Transforms are composited without
  layout reads in the frame loop. Reduced-motion preferences disable parallax.
  Tesla names identify the visual asset; all charging specifications remain demo data.
- A matching poster appears while each model loads and when WebGL is unavailable.
  Shaders are prepared before the 3D model crossfades into view.
- The renderer runs on display-synchronized requestAnimationFrame with elapsed-time
  animation, replacing the previous hard 30 FPS cap. Adaptive pixel ratio reduces
  GPU fill cost when sustained frame times exceed the target. HTML text stays sharp.
  Baked AO and a contact shadow avoid per-frame shadow-map rendering.
- Rendering pauses when the showroom leaves the viewport, a dialog opens, the page
  is hidden or the user opens another app page. Reduced motion disables rotation.
- Mobile controls use 44px or larger touch targets, icon-based glass navigation,
  safe-area spacing and a main action below the vehicle. Stations offer a List/Map
  switch. Charging/checkout dialogs use scrollable bottom sheets with fixed action
  bars; a form's submit button retains its form association when pinned.
- `vendor/` contains self-hosted Three.js 0.180.0, OrbitControls, GLTFLoader,
  BufferGeometryUtils and RoomEnvironment, under the included MIT licence.
  Montserrat retains its included SIL Open Font License.
- The glass nav's active indicator animates with a transform. Browsers without
  backdrop-filter receive an opaque readable fallback.

### Performance verification

Chrome on the development Mac's **Apple M2 GPU** measured **60 FPS** for all three
models after loading, with frame-time p95 approximately **16.7–16.8 ms** at a
1440px desktop viewport and device pixel ratio 1. The car uses 17 draw calls, the
scooter 14 and the bike 2, including the contact shadow.

This is a measured development result and a 60 FPS target, not a guarantee for
all phones, refresh rates, thermal states or software renderers. A 390×844 phone viewport also measured 60 FPS on that same desktop GPU. Physical
Android performance still needs device testing. In the browser console,
`pluggoPerformance()` returns the current rendering diagnostics without placing
technical details in the app's interface.

## Validation and previews

```sh
node --test tests/web/demo.test.mjs
node --check frontend/chargeflow.js
node --check frontend/vehicle-scene.js
```

Run these commands from the repository root. Unit checks cover compatibility,
distance calculation, target/budget caps, two-wheeler simulation and restored-state
validation. Chrome browser checks also exercised the full charging/receipt journey,
reload persistence, search/saved filters, denied geolocation, WebGL fallback and
all four pages at 320, 390, 768, 1024 and 1440 pixel widths. They also check
model-name layering, parallax, reduced motion, the uncluttered showroom and its
separate motion preference. Phone checks also verify
44px touch targets, the main action clearing bottom navigation at 320×568 through
430×932, List/Map selection and form submission through the pinned action bar.

With the local preview server running, reproduce browser checks using installed
Google Chrome:

```sh
npm ci --prefix tests/web
npm test --prefix tests/web
# Optional, only on a machine suitable for the measured rendering target:
ENFORCE_60_FPS=1 npm test --prefix tests/web
```

The optional performance check allows a small measurement tolerance (at least 55
measured FPS, p95 frame interval below 23ms). Browser test dependencies are separate
from the buildless app; Vercel does not need them. Existing browser-local demo
history remains available after the Pluggo rename.

Review images: [phone viewport](../docs/web-preview/pluggo-mobile.png),
[charge setup](../docs/web-preview/mobile-charge-plan.png),
[checkout](../docs/web-preview/mobile-checkout.png),
[desktop home](../docs/web-preview/home-desktop.png),
[mobile home](../docs/web-preview/home-mobile.png),
[stations](../docs/web-preview/stations.png),
[demo receipt](../docs/web-preview/receipt.png).

Embedded Google Maps with a real key and scanning on a physical phone camera
require device/account testing; those were not verified by the local browser checks.

The visual flow now includes simplified station cards, a single pinned charger
selection action, three live charging metrics, a prominent ₹0 receipt confirmation,
clear-filter recovery, inline location recovery guidance, and an accessible Maps
loading state. The vehicle stage remains free of visible controls and helper copy.

## Revised station discovery (November 2026)

Stations uses a real OpenStreetMap street map through locally vendored Leaflet
1.9.4, with fictional demo stations and a compact station list beneath it. Nearby
pins group at low zoom; select the number to zoom in. Search and availability
filter both the map and rows. Street tiles need internet; rows remain usable when
tiles fail, with a retry action. Existing Google Maps configuration is optional.
Leaflet licence: `vendor/LEAFLET-LICENSE.txt`. Tile attribution remains visible.
See the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).

Detailed source vehicle models are restored with white finishes and regenerated
posters. Cache-versioned entry assets prevent an earlier cached script from
running against changed markup. Posters are visible before the 3D renderer loads.

Use http://127.0.0.1:4173 for the existing local server. Another project currently
owns the IPv6 localhost address on port 4173; localhost:4174 also serves this app.

Additional map checks: `node tests/web/map-check.mjs`.

## Location and real station search

The first visit to Stations requests browser geolocation permission. The device
location is held in memory; Home does not request it. Denial leaves the demo usable.
Google search is separate from simulated charging: choose Real stations · Google,
then search nearby or enter a city/locality. Real results have Google Maps links;
prices, connector compatibility and live plug availability are not fabricated.

Configure a website-restricted key in My garage with Maps JavaScript API, Places
API (New), and billing enabled. See [setup and UI audit](../docs/ui-audit/REVIEW.md)
and [render gallery](../docs/ui-audit/index.html). Live credential verification is
pending; mocked integration checks use no paid Google requests.

Run `node --test tests/web/discovery.test.mjs` and
`node tests/web/discovery-browser.mjs`. Recreate all tab and charging-screen
renders with `AUDIT_FOLDER=docs/ui-audit/after node tests/web/ui-audit.mjs`.

## Compact UI and motion pass

The latest UI uses system fonts, dense glass controls, compact layouts, expandable
advanced settings/receipt metadata, and a slowly rotating white 3D showroom. Page
entrances use short staggered upward movement inspired by the supplied portfolio
reference. OS reduced motion (including runtime changes) and the garage motion
switch disable motion. Rendering still pauses when hidden or offscreen.

See `docs/ui-audit/polished/` and the updated screenshot gallery. Verify motion,
settings and receipts with `node tests/web/polish-browser.mjs`.

## Wallet-inspired vehicle selection

The segmented vehicle bar is replaced by one card with name, specifications and
three 44px page-dot targets. Swipe the footer horizontally to choose a vehicle;
drag the actual preview to rotate it. The footer preserves vertical page scrolling.
Dots support click, touch and arrow/Home/End keyboard navigation. Screen readers
receive the selected name through a polite live region.

`wallet.css` contains the final scoped presentation rules. The C++ static server
also exposes it. Availability uses small labelled green/red dots; real Google
results retain unknown availability. Run `node tests/web/wallet-browser.mjs` for
native Chromium touch gesture checks. Latest screenshots: `docs/ui-audit/wallet/`.

## Reference placement (4 November 2026)

`reference-layout.css` places the vehicle picker above an open preview and one
nearest demo station card below. Stations is a full-screen map; selecting a pin
updates a bottom station sheet, with separate View chargers and Directions actions.
The current navbar shape is retained with a stronger layered glass treatment.
Charging uses a vehicle image, horizontal battery progress and metrics beneath.

All data remains demo data unless using Google Places search. Glass is implemented
with web blur/tint/highlights, not Apple's native renderer. Run
`node tests/web/reference-layout-browser.mjs` for geometry, selection and small-screen
checks. Latest renders: `docs/ui-audit/reference-layout/`.

## Home widgets and custom Pluggo motion

Home now shows simulated battery and charging-power widgets plus the nearest demo
station. Battery reflects the most recent session for the selected vehicle; power
is zero when idle and follows the active simulated session. The vehicle name opens
a compact keyboard-accessible dropdown. A short SVG plug connection/pulse animation
plays on Home entry and vehicle changes, respecting reduced motion and the motion
switch. No real vehicle telemetry is read.

Run `node tests/web/home-widgets-browser.mjs`. Latest renders:
`docs/ui-audit/home-widgets/`.

## Clear glass, sharper previews and delivery vehicles

The top-right preview badge is removed from the visual UI. Home stats and Stations
use lightly smoked, mostly transparent 20px glass; map text switches to dark ink.
The navbar and selected item are fully pill shaped. Four vehicle profiles are
available, including the enclosed Pluggo Cargo electric three-wheeler. Its model
is an original category illustration; specifications are fictional demo values.

3D now uses antialiasing, up to 2x canvas density and restored material/reflection
detail. Adaptive resolution and bounded caching remain; there is no software FPS
cap. Posters swap to the first drawn 3D frame without ghosted crossfades.

Run `npm run test:glass` from `tests/web/` for the real backend cargo journey and
new layout checks. Rebuild the Android package with `sh deployment/build-apk.sh`.

## Floating vehicle menu

The vehicle picker overlays the showroom instead of participating in page layout.
Its menu has transparent blurred glass, eased opening and closing transitions,
keyboard selection, Escape/outside dismissal and reduced-motion support. The
shared panel-position rule excludes this absolute-positioned menu. Run
`node tests/web/vehicle-menu-browser.mjs` to verify zero layout movement, input
layering, viewport fit and repeated opening/closing.

APK rebuilding is deferred at the user's request while UI changes continue.
The browser source is current; the previously generated APK remains the earlier
build until the user requests the final APK compilation.

## Session spending and charging totals

Sessions includes Week, Month and All time summaries for estimated charging cost,
energy added, simulated charging duration and completed charging-session count.
Periods use completion dates in Asia/Kolkata; the week starts Monday. Stopped
sessions count as completed charging even when checkout is pending; active and
future-dated sessions are excluded. Actual money collected is displayed separately
from the estimated bill, and remains zero for demo receipts. Server mode derives
these values from the visitor's authoritative session snapshot; standalone preview
uses its own local sessions. Reloading restores server history and recalculates the
summary; resetting the visitor clears the totals.

Run `npm run test:summary` from `tests/web/`. APK compilation remains deferred.
