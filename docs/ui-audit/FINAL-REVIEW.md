# Pluggo UI review — 4 November 2026

## Recommendation

Freeze new features after this visual pass and begin the report. Finish a physical
phone walkthrough and the planned free C++ hosting deployment before marking the
whole delivery complete. The local customer application is suitable for a college
project demonstration; final submission requirements depend on your rubric.

## Review scope

Home, Stations, Sessions and My garage were reviewed at desktop and phone sizes.
The review includes station details, charge setup, charging, checkout, receipt,
empty/history states, cargo selection, map settings, denied location, missing map
key, reduced motion and unavailable WebGL. The backend-connected screenshot run
uses 1440×1000 and 390×844 viewports; responsive checks also cover narrow screens.
This is a functional/visual review, not a formal accessibility certification.

## Findings addressed

| Finding | Result |
| --- | --- |
| Hard outlines around panels | Feathered, fading rim highlights with a small edge blur and softer shadows |
| Heavy card seams | Subtle dividers fade toward their ends; clearer separation without strong boxes |
| Abrupt dialog steps | Short opacity/position transitions between steps |
| Sudden station changes | Selected station contents enter gently when the selected station changes |
| Page motion felt long/uneven | Consistent easing and shorter staggered arrivals, including map controls/sheet |
| Small labels | Status/profile labels and page overlines use at least 10px in the updated rules |
| Changing metrics shifted visually | Tabular number spacing and smoothly updating battery/session bars |
| Risk of blurring text | Blur is applied to decorative edges/backdrops; primary content remains unfiltered |

The light transparent 20px Stations glass, complete pill navbar, hidden preview
badge, four vehicle types and sharp interactive previews are retained. There is
no software FPS limit. Reduced motion and the garage motion switch suppress the
new optional transitions; the 3D lifecycle still pauses offscreen/backgrounded.

## Evidence

The latest renders are in soft-edges/ and the gallery index.html. Metrics are
recorded in soft-edges/metrics.json. Browser checks cover the full charging
journey and 20 responsive route checks, cargo/backend checkout, Google search
configuration/error handling with mocked results, motion preferences, renderer
fallbacks and memory cleanup. The APK build includes release lint and signature
verification. Check the command logs for actual pass results; live Google results
and physical-device performance have not been tested.

## Remaining delivery work

1. Install the current APK on the presentation phone. Check vehicle rotation,
   scrolling, map permission/denial, text at your preferred font size, and a complete
   charging/receipt journey. Check sustained motion for several minutes.
2. Finish the free Render deployment with the original C++ backend. Verify the
   actual returned HTTPS URL and put it in the APK connection settings. Cloud
   deployment remains pending; no public backend URL is currently verified.
3. Prepare the report using ../submission/REPORT-OUTLINE.md. Include the actual
   architecture, OOP examples, test evidence, latest screenshots and limitations.
4. Rehearse the demo and retain a local startup/offline preview fallback. Make a
   final source snapshot and retain the APK/checksum used for the presentation.

A Google key is needed only if you plan to demonstrate live Google Places search.
The fictional station and charging journey works without it. Do not add more
features unless the rubric requires them or phone testing reveals a blocker.

## Operations website deployment update — 4 November 2026

The existing Vercel operations website at https://oops-omega.vercel.app is now
updated and tested through a temporary authenticated connection to the local C++
engine. Keep this Mac awake and online for the demo. Permanent Render hosting is
still pending. See ../../deployment/vercel-dashboard/README.md for the exact scope
and operational dependency. The customer app and its SQLite session summary are
separate from this legacy operations dashboard.
