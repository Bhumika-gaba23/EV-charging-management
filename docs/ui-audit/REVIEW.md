# Home widgets and Pluggo motion — 4 November 2026

The requested Home additions are implemented while preserving the approved layout.
Latest gallery version: **Latest Home widgets**.

- Three widgets: Battery, Charging power, and the existing nearest-station card.
  Battery is explicitly marked simulated. It starts at the demo's 25% baseline and
  follows the most recent session for the selected vehicle. Power is zero when idle
  and the session's simulated kW while charging; its maximum demo rate remains visible.
- Pick your vehicle now opens a small in-page menu. It supports click/touch selection,
  arrow/Home/End navigation, Escape, focus return and outside-click dismissal. It
  updates the preview, dots, widget values and nearest compatible station together.
- The custom SVG Pluggo animation connects a plug and socket, then emits a short
  charging pulse. It plays on Home entry and vehicle changes. It stops when leaving
  Home or hiding the tab, and respects both the animation switch and reduced motion.
  It is decorative and does not claim a physical connection has been established.

Validation: dedicated tests cover widget values for different vehicles, active and
stopped sessions, dropdown keyboard/dismissal behavior, responsive bounds and motion
preferences. The existing responsive, touch, map and charging checks remain in place.

Recommended next work: (1) configure the prepared Google Maps/Places browser key for
real station discovery; (2) connect this browser-local charging flow to the repository's
C++ API and simulator for server-owned availability/session state; (3) test location,
QR scanning and gestures on a physical phone before wider use. Real vehicle battery
telemetry would require a separate supported integration; these widgets remain demo data.

---

# Reference placement update — 4 November 2026

The supplied three-screen reference is used for placement, while preserving the
black, white and silver theme. The user's selected preferences are implemented:
Home has only one nearest-station card; navigation retains its current silhouette;
Stations is a viewport map with one selected-station card at the bottom.

- Home: vehicle picker at top left, map shortcut at top right, open vehicle preview
  beneath, page dots underneath, then a nearest-station card with a small illustrative
  map thumbnail. The nearest card opens the map. Extra telemetry and balance cards
  were not added. Swipe the name or dots to change; drag the model to rotate.
- Stations: compact floating search/source controls, full-screen grayscale street
  map, and selected-station sheet with distance, availability, power, demo tariff,
  View chargers and Directions. Selecting a pin updates the sheet rather than
  opening a dialog immediately. Groups still zoom in. Filtering retains a valid
  selected station and handles no matches. Real Google results have a distinct
  sheet with unknown availability; no demo charging action is attached to them.
- Charging: vehicle image above charging information, horizontal battery progress,
  metrics below, and a pinned stop action. All battery and charging data remain simulated.
- Glass: the existing navbar shape now uses translucent neutral tint, background
  blur, layered edge highlights and a smoothly moving active pill. It is a web
  approximation; Apple's native Liquid Glass rendering is not reproduced identically.
- Visibility: tested map controls, selected sheet, navbar and attribution at 390×844,
  320×568 and 1440×900. The selected sheet stays above navigation on phones. Street
  tiles loaded successfully in Chrome; a visible retry state remains available.

Latest images are in `reference-layout/` and selected by default in the gallery.
A new `tests/web/reference-layout-browser.mjs` verifies placement, map geometry,
pin-to-sheet selection, busy/available dots and charger actions. Updated browser
checks retain charging/receipt, discovery, motion and touch coverage. Google live
credentials and physical-device GPS still require separate verification.

---

# Wallet-inspired redesign — current implementation

The agreed design is now implemented. The gallery defaults to **Latest Wallet design**.

- Home has one charcoal vehicle card, the selected name/specification beneath the
  preview, three accessible page dots and one white Find a charger action. The
  previous Car/Scooter/Bike segmented bar has been removed.
- Horizontal swipes on the name/dots footer switch vehicles. Dragging the model
  itself rotates it. Vertical gestures over the footer scroll the page. Page dots
  support tap/click and keyboard selection, with 44px touch targets.
- White vehicles keep slow automatic rotation, with short directional transitions
  when selected. Reduced motion and the animation preference remain supported.
- Availability is indicated by small green/red dots beside written Available / In
  use labels, in station lists and details. Map pins keep neutral surfaces and a
  small status dot; clusters are neutral because they can contain mixed states.
- Real Google results are not assigned invented availability; unknown states stay
  neutral. The Google account/key requirement is unchanged.
- Glass is limited to navigation and overlays. Content cards have solid charcoal
  fills, understated borders and quiet secondary actions. The palette remains
  black, white and silver, with colour reserved for availability.

Native touch checks cover footer swipes, dot taps, keyboard selection, independent
model dragging and vertical page scrolling. The existing charging, responsive,
map and discovery checks remain in place. Current renders are in `wallet/`.

---

# Monochrome Stations revision

Latest direction: black, white and silver, with restrained controls and a clear
map/list hierarchy. The gallery defaults to **Latest monochrome**.

Stations order: title and underlined Demo/Real tabs, one search/filter/location row,
location feedback, grayscale map, result summary, then flat station rows. Pins use
silver for available and dark fill for occupied, with written labels. Station rows
align name/locality, availability and price, with thin separators instead of cards.
The shared primary actions and navigation no longer use blue or green accents.

The showroom camera is 12% farther away, reducing apparent vehicle size by roughly
10% while preserving 360° rotation and exposing more of the background typography.
Matching posters have been regenerated. This pass concentrates on Stations; other
page structures retain the previous compact layouts.

Desktop/phone images are in `monochrome/`; earlier reviews below are historical.
Google live search still requires a configured key.

---

# Pluggo UI review — latest polish

The recommendations from the earlier review below have now been applied to the
four customer tabs and charging screens. Open the [latest screenshot gallery](index.html)
and choose **Latest polish** to compare desktop and phone renders.

- Home: smaller showroom, better model framing throughout 360° rotation, actual white
  body paint, a concise vehicle profile and clearer primary action.
- Stations: compact location feedback, shorter heading, cluster hint, larger supporting
  text, consistent controls and the existing compact station list. Google mode hides
  demo cluster hints and simulated availability.
- Sessions: compact empty state, explicit “Demo bill” amounts and completion labels.
- Garage: compact vehicle specifications, visible motion switch and expandable map setup
  and demo details. Google setup links open the relevant settings panel automatically.
- Dialogs: concise explanatory copy, larger connector metadata, consistent pinned
  actions and compact receipts with expandable metadata. Receipt details remain open
  across periodic updates; short durations display “Less than 1 min”.
- Shared UI: system typography, common glass button styles, stronger selected states,
  keyboard focus rings, press/hover feedback and denser surfaces.
- Motion: staggered upward page entrances and soft vehicle entrances informed by
  https://sharmaronit.vercel.app. Vehicles continuously rotate slowly; motion pauses
  offscreen or when dialogs open. The motion switch and runtime OS reduced-motion
  preference are respected.

Latest validation: browser journey, responsive map and discovery checks pass;
nine logic tests pass; motion/settings/receipt checks pass. The full browser suite
checks 20 responsive route layouts plus the phone charging flow. Every customer tab
and charging screen was re-rendered at desktop and phone sizes. The legacy operator
page was outside this redesign. Live Google results still require a configured key.

The previous findings below are retained as the before-state audit, not outstanding
work. Physical-device and live Google account testing remain outside these checks.

---

# Pluggo UI review — 3 November 2026

Reviewed the four customer tabs at 1440×1000 and 390×844, plus station details,
charge setup, active charging, checkout, receipts, and session history. The original
operator dashboard is a separate legacy interface and is not part of these four tabs.

[Open the screenshot gallery](index.html). Screenshots are saved in `before/` and
`after/`. Dialog screenshots in `after/` show the actual viewport; the earlier full-page
dialog captures included background content beyond the viewport and are not suitable
for judging modal placement. Real Google results in the gallery are **mocked test data**.

## What was wrong and what changed

- Location was only requested by the location button. It now requests browser
  permission on the first Stations visit in each page load. Navigation within that
  load does not repeatedly prompt; the button can retry. Denied location leaves the
  demo usable and asks the user to enable browser location or enter a city for Google.
- Search filtered five bundled demo stations. It did not call Google Places.
  Stations now separates **Demo charging** and **Real stations · Google**. Real search
  supports Nearby Search within 5 km of granted device coordinates and Text Search
  for a city, area, or charger name. It runs on submit, not on each keystroke.
- The shared glass tint was approximately 44% opaque. Shared panels are now about
  95% opaque and navigation about 97%, with restrained highlights. Search, buttons,
  map controls, dialogs, selected states, and pinned action bars have denser fills.
- Supporting text on station rows, tariffs, settings, and navigation was too small.
  Key supporting labels are now 11–13 px. Very small decorative labels remain.
- Garage described an illustrated map even though OpenStreetMap is the default.
  The text now describes the current providers and includes expandable key setup.
- Receipts incorrectly displayed “Power: 0 kW” for completed sessions. They now show
  the charging power used during the session.

## Page-by-page findings and recommended next changes

| Page / state | Current finding | Recommended next change | Priority |
| --- | --- | --- | --- |
| Home | Vehicle selection and CTA work, but the phone vehicle stage has substantial empty space. The car reads as metallic grey under the showroom lighting. | Reduce phone stage height and tune body paint/environment lighting for a clearer white finish. Retain the fallback image. | High |
| Stations | Map and compact rows work. Cluster numbers need a short explanation. On phone, source controls and location/setup notices push the map farther down. | Condense location into one short status line, add “Tap a number to zoom” once, and keep the map in the first screen where possible. | High |
| Stations — real results | Google search is prepared; no live account/key is available. Results provide names, addresses and Google Maps links, without invented prices, compatibility or live plug counts. | Enable a real project and verify real searches on desktop and a phone. Only add live availability when an operator integration supplies it. | High |
| Sessions — empty | Clear CTA and usable layout, but the large empty panel dominates desktop. | Reduce empty-state padding and shorten the introductory copy. | Medium |
| Sessions — history | Receipts are reachable, but simulated cost is visually prominent beside a ₹0 payment journey. | Label list amounts explicitly “Demo bill” and add a clear Paid / Stopped / Completed status. | Medium |
| My garage | Selection is clear, but three vehicle cards plus two verbose settings cards make the phone page long. | Move Google setup into an expandable Advanced settings area and shorten demo explanation. Keep selection and motion setting visible. | High |
| Station details | Pinned action works; incompatible connectors are correctly disabled. Amenities and connector IDs remain small and dim. | Increase metadata text and reduce space around amenities. Keep the selected connector distinct. | Medium |
| Charge setup | Target, budget, estimate and pinned start action work. Explanatory demo text is repetitive. | Keep one concise simulation note and emphasize the estimated duration/cost. | Medium |
| Active charging | Battery ring and three metrics are clear. Secondary explanations occupy considerable space on a phone. | Collapse detailed explanation; keep stop action and elapsed time visible. | Medium |
| Checkout | ₹0 action is clear and pinned. There are several repeated “no real payment” statements. | Keep a single strong ₹0 summary and a short explanatory note. | Medium |
| Receipt | ₹0 collected is prominent and power label is corrected. The long detail list requires scrolling. | Show energy, duration and amount first, with ID/time and technical details expandable. | Medium |
| Shared navigation | Denser tint now prevents content from visually bleeding through the floating bar. Fixed navigation still overlays content while scrolling, although bottom padding permits all content to be reached. | Consider a reserved bottom dock if you prefer content never to pass beneath navigation. | Preference |

## Google setup

1. Create a Google Cloud project and enable billing.
2. Enable **Maps JavaScript API** and **Places API (New)**.
3. Create a **website-restricted browser key**. Allow `http://127.0.0.1:4173/*`,
   any other local origin you use, and the deployed domain.
4. Restrict the key to the two APIs above. Configure quotas and billing alerts.
5. Open **My garage → Google Maps**, enter the key, and choose **Enable Maps**.
   It is stored in sessionStorage for that browser tab, not committed to the repository.
6. Open **Stations → Real stations · Google**. Allow location and click Search nearby,
   or enter a city/locality if location is unavailable.

An embedded browser key is visible to the browser by design; referrer/API restrictions
are essential. No key was added, no billing was enabled, and no paid API call was made
by this change. Google results stay in memory and appear on Google Maps, never on the
OpenStreetMap layer. No Google search results are persisted in demo history.

Official references: [location permission](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition),
[Nearby Search](https://developers.google.com/maps/documentation/javascript/nearby-search),
[Text Search](https://developers.google.com/maps/documentation/javascript/place-search),
[key setup](https://developers.google.com/maps/documentation/javascript/get-api-key),
[billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing).

## Validation and limits

- All four tabs rendered without horizontal overflow or page errors at desktop and phone sizes.
- Existing browser suite passes: vehicle switching, WebGL fallback, reduced motion,
  20 responsive route checks, mobile charging, session restoration, checkout and receipts.
- Map checks pass for search, availability filtering, empty-state recovery and details.
- New tests cover automatic location with granted permission, no prompt on Home,
  no repeated location request during in-app navigation, missing-key recovery,
  Google request fields, mocked success/error responses, stale-response rejection,
  safe rendering of external names and separation from demo charging.
- Nine logic tests pass. Live Google API credentials, billing and results have not
  been tested. Geolocation was simulated in Chrome; physical-device GPS and OS
  permission behavior still need testing. This is a visual review, not a complete
  accessibility or contrast compliance audit.
