import { summarizeSessions, chargingDuration } from "./session-summary.js?v=20261123-pay1";
import { performanceProfile } from "./performance-profile.js?v=20261104-summary1";
import { CustomerApi } from "./customer-api.js?v=20261124-features1";
import { normalizeIndianPhone, sendOtp, confirmOtp, signOutFirebase, friendlyAuthError, payWithRazorpay, firebaseSignInAge, deleteFirebaseUser } from "./account.js?v=20261123-legal1";
import { findGoogleStations } from "./google-stations.js?v=20261104-server9";
import { greenImpact, BAND_NAMES, bandAt, rateAt, nextOffPeak, BOOKING_MINUTES, bookingSlots, overlaps, istTime, istDay, CITIES, findCity, tripMapsLink } from "./extras.js?v=20261124-features1";
import { placeName, findPlaces, savedPlace, savePlace, currentPosition, locationAllowed } from "./places.js?v=20261125-places3";
import { alertsSupported, alertsOn, enableAlerts, disableAlerts, notify, syncSchedule } from "./alerts.js?v=20261124-features1";
import {
  vehicles,
  stations,
  stationById,
  compatible,
  available,
  distance,
  energyLimit as previewEnergyLimit,
  updateSession,
  validSession,
} from "./demo-data.js?v=20261104-server9";

document.documentElement.dataset.visibility = document.hidden ? "hidden" : "visible";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const paths = {
  settings: '<path d="m9 3-.5 2.1-1.8 1.1-2.1-.5-2 3.5 1.6 1.6v2.4l-1.6 1.6 2 3.5 2.1-.5 1.8 1.1L9 21h6l.5-2.1 1.8-1.1 2.1.5 2-3.5-1.6-1.6v-2.4l1.6-1.6-2-3.5-2.1.5-1.8-1.1L15 3Z"/><circle cx="12" cy="12" r="3"/>',
  back: '<path d="M19 12H5m7 7-7-7 7-7"/>',
  home: '<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  "arrow-up-right": '<path d="M6 18 18 6M6 6h12v12"/>',
  car: '<path d="m4 9 2-5h12l2 5M3 10h18v9h-3v-3H6v3H3Z"/><path d="M6 12h2m8 0h2M5 9h14"/>',
  scooter:
    '<circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M7 18h7l4-13h-4m1 10h4l-1-10M4 14V9h6"/>',
  bike: '<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-8h5l4 8M9 17h6M10 9l-1-4H6m9 4 1-4h3"/>',
  cargo: '<path d="M3 9h11v10H3ZM14 13h4l3 4v2h-7M5 9V6h7v3"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>',
  battery:
    '<rect x="2" y="6" width="18" height="12" rx="2"/><path d="M23 10v4M5 9v6m3-6v6m3-6v6"/>',
  plug: '<path d="M8 3v6m8-6v6M6 9h12v4a6 6 0 0 1-12 0Zm6 10v3"/>',
  station:
    '<path d="M4 21V4h11v17M2 21h15M7 7h5v5H7m8-6 5 4v7a2 2 0 0 0 4 0V9l-3-3"/><path d="m10 14-2 3h3l-2 3"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  rotate: '<path d="M20 7a9 9 0 1 0 1 9M20 3v5h-5"/>',
  pause: '<path d="M9 5v14m6-14v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  locate:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2Zm6-2v15m6-12v15"/>',
  flask: '<path d="M9 3h6m-5 0v7L4 20h16l-6-10V3M7 15h10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  bolt: '<path d="m13 2-9 12h8l-1 8 9-12h-8Z"/>',
  qr: '<path d="M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3Zm12 0h3v3h3v3h-6Zm6-3v3M12 3v9H3m9 3v6"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  receipt: '<path d="M5 3h14v19l-3-2-4 2-4-2-3 2ZM8 7h8m-8 4h8m-8 4h5"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',
  share: '<path d="M12 3v12m0-12-4 4m4-4 4 4M5 12v8h14v-8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h8"/>',
  leaf: '<path d="M5 21c0-9 5-15 15-16-1 10-7 15-15 16Z"/><path d="m5 21 9-9"/>',
  wallet: '<path d="M3 7h17v13H3Z"/><path d="m3 7 12-4v4m1 6h3"/>',
  alert: '<path d="M12 3 2 21h20Z"/><path d="M12 10v5m0 3h.01"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9Z"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.bolt}</svg>`;
function icons(root = document) {
  root
    .querySelectorAll("i[data-icon]")
    .forEach((el) => (el.outerHTML = icon(el.dataset.icon)));
}
icons();
// Keep the existing browser key so the Pluggo rename preserves saved sessions.
const storageKey = "chargeflow.web.v1";
const localPreview = new URL(location.href).searchParams.get("demo") === "1";
const customerApi = new CustomerApi();
let backendReady = false, backendConnected = false, backendSyncing = false, backendMutations = 0, preferencePending = 0;
let preferenceQueue = Promise.resolve(), lastPreferences = "", catalogSignature = "", backendRevision = 0;
let state = { vehicle: "car", saved: [], sessions: [] };
let account = { signedIn: false, phone: "" };
let backendConfig = { authRequired: false, payments: "none" };
// Bookings, fault reports, wallet and the time-of-use tariff come from the server (none in the preview).
let bookings = [], reports = [], wallet = { balance: 0, history: [] }, tariff = null;
const stationRate = (station) => station.currentRate ?? station.rate;
const rateText = (n) => Number.isInteger(Number(n)) ? String(n) : Number(n).toFixed(2);
const activeBooking = () => bookings.find((b) => b.status === "booked");
let storageOkay = true;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (saved) {
    state.vehicle = Object.hasOwn(vehicles, saved.vehicle)
      ? saved.vehicle
      : "car";
    state.saved = Array.isArray(saved.saved)
      ? saved.saved.filter((id) => stations.some((s) => s.id === id))
      : [];
    state.sessions = localPreview && Array.isArray(saved.sessions)
      ? saved.sessions.filter(validSession).slice(0, 100)
      : [];
    // Reconcile restored sessions before showing any live figures.
    state.sessions.forEach((s) => updateSession(s));
  }
} catch {
  storageOkay = false;
}
// Where distances, station searches and trips start: the driver's GPS or a place they picked.
// Until then, Connaught Place in New Delhi (where the Pluggo network stations are).
let origin = { lat: 28.6315, lng: 77.2167, device: false, name: "New Delhi" };
{ const place = savedPlace(); if (place) origin = { lat: place.lat, lng: place.lng, device: true, name: place.name, gps: place.gps }; }
let filters = { available: false, saved: false, search: "", sort: "distance" };
let page = "home";
let dialogSession = null;
let toastTimer;
let sceneController;
let modelPosterTimer, posterHideTimer, stageLoadingTimer;
let animationAllowed = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let mediaStream = null,
  scannerFrame = null,
  cameraGeneration = 0;
let selectedStationId = null, selectedPlaceId = null;
let stationSource = "demo", realPlaces = [], realSearchState = "idle", realSearchGeneration = 0, locationRequested = false, locationPending = false;
let googleMap = null,
  googleMarkers = [],
  mapsFailed = false;
const currency = (n) => `₹${n.toFixed(2)}`;
// Charging & payment preferences from Settings. They shape the charge sheet defaults and the
// goals behind the activity rings; they stay on this device.
const PREF_OPTIONS = {
  target: [60, 70, 80, 90, 100],
  budget: [100, 200, 300, 500, 750, 1000],
  monthlyBudget: [500, 1000, 2000, 3000, 5000],
  energyGoal: [25, 50, 100, 150, 250],
  chargesGoal: [4, 8, 12, 16, 24],
};
const prefs = { target: 80, budget: 300, monthlyBudget: 2000, energyGoal: 100, chargesGoal: 8 };
try {
  const saved = JSON.parse(localStorage.getItem("pluggo.prefs") || "{}");
  for (const key of Object.keys(prefs)) if (PREF_OPTIONS[key].includes(Number(saved[key]))) prefs[key] = Number(saved[key]);
} catch {}
function savePrefs() { try { localStorage.setItem("pluggo.prefs", JSON.stringify(prefs)); } catch {} }
// Typical efficiency per vehicle type, used for an estimated (not measured) range.
const KM_PER_KWH = { car: 6.5, scooter: 30, bike: 25, cargo: 7.5 };
function batteryLevel(id) {
  const session = state.sessions.find(item => item.vehicle === id);
  return Math.min(100, Math.max(0, session ? soc(session) : 25));
}
function estimatedRange(id) { return Math.round(batteryLevel(id) / 100 * vehicles[id].capacity * (KM_PER_KWH[id] || 6)); }
const activeSession = () => state.sessions.find((s) => !s.ended);
const pendingSession = () => state.sessions.find((s) => s.ended && !s.settled);
const total = (s) => s.backendOwned ? s.cost : s.energy * stationById(s.station).rate;
const energyLimit = (s) => s.backendOwned ? s.limit : previewEnergyLimit(s);
const soc = (s) => s.backendOwned ? s.currentSoc : 25 + (s.energy / vehicles[s.vehicle].capacity) * 100;
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({...state,sessions:localPreview ? state.sessions : []})); }
  catch { storageOkay = false; }
  if (localPreview || !backendReady) return;
  const prefs = {vehicle:state.vehicle,saved:[...state.saved]};
  const signature = JSON.stringify(prefs);
  if (signature === lastPreferences) return;
  lastPreferences = signature; preferencePending++; backendRevision++;
  preferenceQueue = preferenceQueue.then(() => customerApi.preferences(prefs)).catch(error => {
    lastPreferences = ""; toast(`Could not save your preferences: ${error.message}`);
  }).finally(() => { preferencePending--; });
}
function backendStatus(connected, message = "") {
  backendConnected = connected;
  $("#connectionMode").textContent = localPreview ? "PREVIEW" : connected ? "LIVE" : "OFFLINE";
  $("#backendBanner").hidden = localPreview || connected;
  $("#backendMessage").textContent = message || "Charging server unavailable. Start the backend or retry.";
}
function applyBackend(payload, keepPreferences = true) {
  if (!payload.state || !payload.catalog || !Array.isArray(payload.state.sessions) || !Array.isArray(payload.catalog.stations)) throw new Error("Invalid charging server response");
  const oldVehicle = state.vehicle, oldSessions = JSON.stringify(state.sessions);
  const nextCatalog = JSON.stringify(payload.catalog.stations);
  const catalogChanged = nextCatalog !== catalogSignature;
  catalogSignature = nextCatalog;
  stations.splice(0,stations.length,...payload.catalog.stations);
  // The server owns battery and connector data; the app owns how vehicles look. A server that still lists
  // an older picture (with its baked-in shadow) must never override the one shipped with this app.
  for (const [id,{image,...profile}] of Object.entries(payload.catalog.vehicles)) if (Object.hasOwn(vehicles,id)) Object.assign(vehicles[id],profile);
  const previous = { sessions: state.sessions, bookings, reports, wallet };
  state.sessions = payload.state.sessions;
  bookings = Array.isArray(payload.state.bookings) ? payload.state.bookings : [];
  reports = Array.isArray(payload.state.reports) ? payload.state.reports : [];
  wallet = payload.wallet || { balance: 0, history: [] };
  tariff = payload.tariff || null;
  account = payload.account || account;
  backendConfig = payload.backend || backendConfig;
  renderAccount();
  if (backendReady) announceChanges(previous);
  scheduleAlerts();
  renderHomeBooking();
  renderSettingsExtras();
  if (!keepPreferences) { state.vehicle = payload.state.vehicle; state.saved = payload.state.saved; lastPreferences = JSON.stringify({vehicle:state.vehicle,saved:state.saved}); }
  backendStatus(true);
  if (catalogChanged || oldVehicle !== state.vehicle) { renderVehicle(); renderStations(); renderMap(); }
  if (oldVehicle !== state.vehicle) { renderGarage(); sceneController?.setVehicle(state.vehicle); }
  renderHomeWidgets();
  if (oldSessions !== JSON.stringify(state.sessions)) { renderSessions(); updateSessionDialog(); if (page === "garage") renderGarage(); }
  window.pluggoBackend = {connected:true,storage:payload.backend.storage,simulationMode:payload.backend.simulationMode,simulatorConnected:payload.backend.simulatorConnected};
}
// The last reply from the server, kept on this phone so the app opens with your data straight away:
// offline, or while a free server wakes up. Nothing can be changed until the server answers.
const LAST_SERVER_KEY = "pluggo.lastServer";
let lastSaved = { at: 0, sessions: "" }, showingSaved = false;
function rememberServer(payload) {
  const sessions = JSON.stringify(payload.state?.sessions || []);
  if (sessions === lastSaved.sessions && Date.now() - lastSaved.at < 15000) return;
  lastSaved = { at: Date.now(), sessions };
  try { localStorage.setItem(LAST_SERVER_KEY, JSON.stringify({ at: Date.now(), payload })); } catch {}
}
function showSavedServer() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_SERVER_KEY) || "null");
    if (!saved?.payload) return false;
    applyBackend(saved.payload, false);
    showingSaved = true;
    backendStatus(false, `Connecting… showing your data from ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(saved.at))}.`);
    return true;
  } catch { return false; }
}
async function refreshBackend() {
  if (localPreview || backendSyncing || backendMutations || preferencePending) return;
  backendSyncing = true;
  const revision = backendRevision;
  try {
    const initial = !backendReady;
    const payload = initial ? await customerApi.bootstrap() : await customerApi.state();
    if (revision !== backendRevision) return;
    backendReady = true; showingSaved = false; applyBackend(payload,false); rememberServer(payload);
  } catch (error) {
    if (error.status === 401) backendReady = false;
    backendStatus(false,showingSaved ? "Waking up the charging server… showing your last saved data. You can charge once it connects." : error.status === 503 ? "The local charging server is offline. Start it, then retry." : "Cannot reach the charging server. Your server history will return when it reconnects.");
    window.pluggoBackend = {connected:false,error:error.message};
  } finally { backendSyncing = false; }
}
async function backendAction(button, operation, keepPreferences = true) {
  if (!backendReady || !backendConnected) { toast("Connect to the charging server before continuing."); return null; }
  backendMutations++; backendRevision++;
  const html = button?.innerHTML;
  if (button) { button.disabled=true; button.setAttribute("aria-busy","true"); }
  try { const payload = await operation(); applyBackend(payload,keepPreferences); rememberServer(payload); return payload; }
  catch (error) { toast(error.message); if (!error.status || error.status >= 500) backendStatus(false,"Connection lost. Retry before continuing."); return null; }
  finally { backendMutations--; if (button?.isConnected) {button.disabled=false;button.removeAttribute("aria-busy");button.innerHTML=html;} }
}
$("#retryBackend").onclick = () => refreshBackend();
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
function orderedStations() {
  return stations
    .filter(
      (s) =>
        compatible(s, state.vehicle) &&
        (!filters.available || available(s, state.vehicle)) &&
        (!filters.saved || state.saved.includes(s.id)) &&
        `${s.name} ${s.area}`
          .toLowerCase()
          .includes(filters.search.toLowerCase().trim()),
    )
    .sort((a, b) =>
      filters.sort === "price"
        ? a.rate - b.rate
        : distance(a, origin) - distance(b, origin),
    );
}
function card(station) {
  const plugs = station.connectors.filter((c) =>
    vehicles[state.vehicle].connectors.includes(c.type),
  );
  const count = plugs.filter((c) => c.available).length;
  return `<article class="station-card"><div class="station-card-top"><div><h3>${station.name}</h3><p class="station-area">${station.area} · ${distance(station, origin).toFixed(1)} km away</p></div><button class="save-button" data-save="${station.id}" aria-label="${state.saved.includes(station.id) ? "Unsave" : "Save"} ${station.name}" aria-pressed="${state.saved.includes(station.id)}">${icon("bookmark")}</button></div><span class="station-status ${count ? "" : "busy"}"><span class="status-pip"></span>${count ? `${count} compatible plug${count === 1 ? "" : "s"} available` : "Compatible plugs in use"}</span><p class="station-connectors">${[...new Set(plugs.map((c) => c.type))].join(" · ")} · up to ${Math.max(...plugs.map((c) => c.power))} kW</p><div class="station-card-bottom"><span class="rate">₹${rateText(stationRate(station))} <small>/ kWh</small>${station.rating?.count ? ` · ★ ${station.rating.average.toFixed(1)}` : ""}</span><button class="secondary-button" data-station="${station.id}" aria-label="View ${station.name}">View station ${icon("arrow-up-right")}</button></div></article>`;
}
function updateLens() {
  const selected = $(".glass-nav a[aria-current]");
  if (!selected) return;
  const lens = $(".nav-lens");
  lens.style.transform = `translate3d(${selected.offsetLeft}px, 0, 0)`;
  lens.style.width = `${selected.offsetWidth}px`;
}
function navigate() {
  const [next, settingsPage = ""] = (location.hash.slice(1) || "home").split("/");
  showSettingsPage(next === "settings" ? settingsPage : "");
  page = ["home", "stations", "sessions", "garage", "settings"].includes(next)
    ? next
    : "home";
  if ($("#flowDialog").open) $("#flowDialog").close();
  $$(".page").forEach((el) => {
    el.hidden = el.id !== `page-${page}`;
    el.classList.toggle("active", !el.hidden);
  });
  $$(".glass-nav a").forEach((a) =>
    a.dataset.page === page
      ? a.setAttribute("aria-current", "page")
      : a.removeAttribute("aria-current"),
  );
  document.body.dataset.page = page;
  updateLens();
  // One live 3D stage: it moves into Garage there and back to Home everywhere else.
  const stage = $("#vehicleStage"), stageHome = page === "garage" ? $("#garageStage") : $(".vehicle-wallet");
  if (stage.parentElement !== stageHome) stageHome.prepend(stage);
  sceneController?.setVisible(page === "home" || page === "garage");
  if (page === "stations") {
    renderStations();
    renderMap();
    // First visit: real public chargers around the driver (the Pluggo chip shows the bookable network).
    if (!locationRequested) { locationRequested = true; if (!localPreview) setStationSource("real"); if (!origin.device) requestDeviceLocation(); }
  }
  if (page === "sessions") renderSessions();
  if (page === "garage") renderGarage();
  if (page === "settings" && stationSource === "real") $("#mapSettings").open = true;
  window.scrollTo({ top: 0, behavior: "instant" });
  animatePage($("#page-" + page));
  $("#vehicleDropdown").open = false;
  if (page === "home") { renderHomeWidgets(); playPluggoAnimation(); }
  else stopPluggoAnimation();
  document.title = `Pluggo — ${{ home: "Your next charge, closer.", stations: "Find your spot", sessions: "Your charging story", garage: "My garage", settings: "Settings" }[page]}`;
}
function animatePage(section) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off") return;
  section.getAnimations({subtree:true}).forEach(animation => { if (animation.id === "page-arrival") animation.cancel(); });
  const elements = section.id === "page-stations"
    ? section.querySelectorAll(".map-top-controls,.station-selection:not([hidden])")
    : section.id === "page-home"
      ? section.querySelectorAll(".home-vehicle-heading,.vehicle-wallet,.home-widgets,.lower-heading,.home-stations")
      : [...section.children].filter(element => !element.hidden);
  [...elements].forEach((element,index) => {
    const animation = element.animate([{opacity:.15,transform:"translate3d(0,10px,0)"},{opacity:1,transform:"none"}], {duration:450,delay:Math.min(index*32,128),easing:"cubic-bezier(.22,1,.36,1)"});
    animation.id = "page-arrival";
  });
}
// The light follows the pointer within a control; press feedback stays on the GPU.
if (matchMedia("(hover: hover)").matches) document.addEventListener("pointermove", event => {
  const control = event.target.closest(".primary-button,.secondary-button,.filter-chip,.text-link");
  if (!control || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bounds = control.getBoundingClientRect();
  control.style.setProperty("--pointer-x", `${((event.clientX-bounds.left)/bounds.width*100).toFixed(1)}%`);
  control.style.setProperty("--pointer-y", `${((event.clientY-bounds.top)/bounds.height*100).toFixed(1)}%`);
}, {passive:true});
window.addEventListener("hashchange", navigate);
window.addEventListener("resize", updateLens);
document.fonts.ready.then(updateLens);

function selectVehicle(id, notify = false) {
  if (!Object.hasOwn(vehicles, id)) return;
  const previous = state.vehicle;
  state.vehicle = id;
  save();
  renderVehicle();
  renderStations();
  renderGarage();
  renderMap();
  sceneController?.setVehicle(id);
  if (previous !== id && animationAllowed && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const direction = Object.keys(vehicles).indexOf(id) > Object.keys(vehicles).indexOf(previous) ? 1 : -1;
    $("#vehicleStage").getAnimations().forEach(animation => {if(animation.id === "vehicle-select")animation.cancel();});
    const vehicleAnimation = $("#vehicleStage").animate([{opacity:.5,transform:`translateX(${direction * 12}px)`},{opacity:1,transform:"none"}],{duration:360,easing:"cubic-bezier(.16,1,.3,1)"});
    vehicleAnimation.id = "vehicle-select";
  }
  if (previous !== id && page === "home") playPluggoAnimation();
  if (notify) toast(`${vehicles[id].label} selected. Your kind of electric.`);
}
const vehicleOrder = Object.keys(vehicles);
const pagination = $("#vehiclePagination");
let vehicleGesture = null, suppressDotClick = false;
function stepVehicle(direction) {
  const index = vehicleOrder.indexOf(state.vehicle);
  selectVehicle(vehicleOrder[(index + direction + vehicleOrder.length) % vehicleOrder.length]);
}
for (const swipeArea of [pagination, $(".home-vehicle-picker")]) {
swipeArea.addEventListener("pointerdown", event => {
  if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
  suppressDotClick = false;
  vehicleGesture = {id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};
});
swipeArea.addEventListener("pointermove", event => {
  if (!vehicleGesture || event.pointerId !== vehicleGesture.id) return;
  const dx = event.clientX - vehicleGesture.x, dy = event.clientY - vehicleGesture.y;
  if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    vehicleGesture.horizontal = true;
    swipeArea.setPointerCapture(event.pointerId);
    if (event.cancelable) event.preventDefault();
  }
});
swipeArea.addEventListener("pointerup", event => {
  if (!vehicleGesture || event.pointerId !== vehicleGesture.id) return;
  const dx = event.clientX - vehicleGesture.x, dy = event.clientY - vehicleGesture.y;
  const swiped = Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.4;
  suppressDotClick = vehicleGesture.horizontal;
  vehicleGesture = null;
  if (swipeArea.hasPointerCapture(event.pointerId)) swipeArea.releasePointerCapture(event.pointerId);
  if (swiped) stepVehicle(dx < 0 ? 1 : -1);
});
swipeArea.addEventListener("pointercancel", () => { vehicleGesture = null; suppressDotClick = false; });
swipeArea.addEventListener("click", event => {
  if (!suppressDotClick || event.detail === 0) { suppressDotClick = false; return; }
  event.stopPropagation(); event.preventDefault(); suppressDotClick = false;
}, true);
swipeArea.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") selectVehicle(vehicleOrder[0]);
  else if (event.key === "End") selectVehicle(vehicleOrder.at(-1));
  else stepVehicle(event.key === "ArrowRight" ? 1 : -1);
  if (event.target.matches("button[data-vehicle]")) pagination.querySelector(`[data-vehicle="${state.vehicle}"]`).focus({preventScroll:true});
});
}
const vehicleDropdown = $("#vehicleDropdown");
const vehicleSummary = vehicleDropdown.querySelector("summary");
const vehicleOptions = [...vehicleDropdown.querySelectorAll("[data-choose-vehicle]")];
let dropdownAnimation = null, dropdownClosing = false, dropdownEpoch = 0;
function menuMotionEnabled() { return animationAllowed && !matchMedia("(prefers-reduced-motion: reduce)").matches; }
function closeVehicleDropdown(returnFocus = false) {
  if (returnFocus) vehicleSummary.focus({preventScroll:true});
  if (!vehicleDropdown.open || dropdownClosing) return;
  const epoch = ++dropdownEpoch;
  dropdownAnimation?.cancel();
  if (!menuMotionEnabled()) { vehicleDropdown.open = false; return; }
  dropdownClosing = true;
  dropdownAnimation = $("#vehicleMenu").animate(
    [{opacity:1,transform:"translateY(0) scale(1)"},{opacity:0,transform:"translateY(-5px) scale(.975)"}],
    {duration:150,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"},
  );
  dropdownAnimation.finished.then(() => {
    if (epoch !== dropdownEpoch) return;
    vehicleDropdown.open = false;dropdownClosing = false;dropdownAnimation?.cancel();dropdownAnimation = null;
  }).catch(() => {});
}
function openVehicleDropdown() {
  ++dropdownEpoch;dropdownClosing = false;dropdownAnimation?.cancel();
  vehicleDropdown.open = true;
  vehicleSummary.setAttribute("aria-expanded","true");
  if (menuMotionEnabled()) dropdownAnimation = $("#vehicleMenu").animate(
    [{opacity:0,transform:"translateY(-7px) scale(.96)"},{opacity:1,transform:"translateY(0) scale(1)"}],
    {duration:300,easing:"cubic-bezier(.22,1,.36,1)"},
  );
}
vehicleSummary.addEventListener("click", event => {
  event.preventDefault();
  if (vehicleDropdown.open && !dropdownClosing) closeVehicleDropdown();
  else openVehicleDropdown();
});
vehicleDropdown.addEventListener("toggle", () => {
  vehicleSummary.setAttribute("aria-expanded",String(vehicleDropdown.open));
  if (!vehicleDropdown.open) {++dropdownEpoch;dropdownClosing = false;dropdownAnimation?.cancel();dropdownAnimation = null;}
});
vehicleOptions.forEach(option => option.addEventListener("click", () => {
  selectVehicle(option.dataset.chooseVehicle);
  closeVehicleDropdown(true);
}));
vehicleSummary.addEventListener("keydown", event => {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault(); openVehicleDropdown();
  vehicleOptions[event.key === "ArrowUp" ? vehicleOptions.length - 1 : 0].focus();
});
$("#vehicleMenu").addEventListener("keydown", event => {
  const index = vehicleOptions.indexOf(document.activeElement);
  if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeVehicleDropdown(true); return; }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? vehicleOptions.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + vehicleOptions.length) % vehicleOptions.length;
  vehicleOptions[next].focus();
});
vehicleDropdown.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); closeVehicleDropdown(true); } });
vehicleDropdown.addEventListener("focusout", event => {
  if (vehicleDropdown.contains(event.relatedTarget)) return;
  requestAnimationFrame(() => { if (!vehicleDropdown.contains(document.activeElement)) closeVehicleDropdown(); });
});
document.addEventListener("pointerdown", event => { if (vehicleDropdown.open && !vehicleDropdown.contains(event.target)) closeVehicleDropdown(); }, {passive:true});
function renderHomeWidgets() {
  // While a charge runs, Home follows the vehicle that is charging, even if another one is selected.
  const live = activeSession(), shownId = live ? live.vehicle : state.vehicle;
  const vehicle = vehicles[shownId];
  const session = state.sessions.find(item => item.vehicle === shownId);
  const level = Math.min(100, Math.max(0, session ? soc(session) : 25));
  const charging = !!session && !session.ended;
  const power = charging ? session.power : 0;
  $("#homeBatteryValue").replaceChildren(document.createTextNode(String(Math.round(level))), Object.assign(document.createElement("span"), {textContent:"%"}));
  $("#homeBatteryCapacity").textContent = `${(level / 100 * vehicle.capacity).toFixed(1)} of ${vehicle.capacity} kWh`;
  $("#homeBatteryProgress").value = level;
  $("#homeBatteryProgress").textContent = `${Math.round(level)}%`;
  $("#homeBatteryLabel").textContent = shownId === state.vehicle ? "Battery" : `${vehicle.name} battery`;
  // While charging this widget shows live power; otherwise the more useful estimated range.
  $("#homePowerLabel").textContent = charging ? "Charging power" : "Estimated range";
  $("#homePowerValue").replaceChildren(document.createTextNode(String(charging ? power : estimatedRange(shownId))), Object.assign(document.createElement("span"), {textContent: charging ? " kW" : " km"}));
  $("#homePowerStatus").textContent = charging ? "Charging now" : `Typical · charges up to ${vehicle.power} kW`;
  const blocking = activeSession() || pendingSession();
  $("#homeCtaLabel").textContent = activeSession() ? "View live charge" : blocking ? "Pay for your charge" : "Start charging";
}
// One clear action on Home: resume what is in progress, or go straight to the nearest free charger.
$("#homeStartCharging").onclick = () => {
  const blocking = activeSession() || pendingSession();
  if (blocking) { openSession(blocking); return; }
  // A booking that is holding its charger now goes straight to that charger.
  const booking = activeBooking(), booked = booking && stationById(booking.station);
  if (booked && Date.now() >= booking.starts - HOLD_BEFORE) { openSetup(booked, booked.connectors.find(c => c.id === booking.connector)); return; }
  const nearest = stations
    .filter(s => compatible(s, state.vehicle) && available(s, state.vehicle))
    .sort((a, b) => distance(a, origin) - distance(b, origin))[0];
  if (nearest) openStation(nearest); else location.hash = "stations";
};
function stopPluggoAnimation() {
  $("#pluggoMotion").getAnimations({subtree:true}).forEach(animation => animation.cancel());
}
function playPluggoAnimation() {
  stopPluggoAnimation();
  if (!animationAllowed || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const connector = $("#pluggoMotion .pluggo-connector");
  const pulse = $("#pluggoMotion .pluggo-pulse");
  connector.animate([{transform:"translateX(-9px)",offset:0},{transform:"translateX(-9px)",offset:.12},{transform:"translateX(0)",offset:.4},{transform:"translateX(0)",offset:1}],{duration:2400,easing:"cubic-bezier(.16,1,.3,1)"});
  pulse.animate([{opacity:0,transform:"translateX(-3px)",offset:0},{opacity:0,transform:"translateX(-3px)",offset:.38},{opacity:.85,transform:"translateX(0)",offset:.56},{opacity:0,transform:"translateX(5px)",offset:.76},{opacity:.65,transform:"translateX(0)",offset:.87},{opacity:0,transform:"translateX(5px)",offset:1}],{duration:2400,easing:"ease-out"});
}
function renderVehicle() {
  const v = vehicles[state.vehicle];
  renderHomeWidgets();
  vehicleOptions.forEach(option => option.setAttribute("aria-checked", String(option.dataset.chooseVehicle === state.vehicle)));
  $("#selectedVehicleName").textContent = v.name;
  vehicleSummary.setAttribute("aria-label", `Pick your vehicle. ${v.name} selected`);
  $("#selectedVehicleProfile").textContent = `${v.capacity} kWh · ${v.connectors.join(" / ")}`;
  $$("[data-vehicle]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.vehicle === state.vehicle)),
  );
  $("#stageWatermark").replaceChildren(
    ...v.depthName.map((line) => {
      const word = document.createElement("span");
      word.textContent = line;
      return word;
    }),
  );
  $("#vehicleStage").dataset.vehicleKind = state.vehicle;
  $("#vehicleCanvas").setAttribute(
    "aria-label",
    `Interactive ${v.name} 3D model. Drag to rotate, scroll to zoom.`,
  );
  if ($("#vehicleFallback").getAttribute("src") !== v.image || !sceneController?.getStats().ready) {
    $("#vehicleFallback").hidden = false;
    $("#vehicleFallback").style.opacity = "1";
  }
  $("#vehicleFallback").src = v.image;
  $("#vehicleFallback").alt = `${v.name} vehicle preview`;
  $("#homeStations").innerHTML = stations
    .filter((s) => compatible(s, state.vehicle))
    .sort((a, b) => distance(a, origin) - distance(b, origin))
    .filter((s) => available(s, state.vehicle))
    .slice(0, 1)
    .map(homeStation)
    .join("");
}
function homeStation(station) {
  return `<button id="findStations" class="home-station" data-map-station="${station.id}" aria-label="Find a charger"><span class="nearest-station-copy"><span class="nearest-station-label">${icon("station")} Nearest available station</span><strong>${station.name}</strong><small>${station.area}</small><span class="home-availability"><span class="availability-dot" aria-hidden="true"></span>Available · ${distance(station, origin).toFixed(1)} km</span></span><span class="nearest-map-preview" aria-hidden="true"><svg viewBox="0 0 110 100"><path d="M-10 20 120 70M35-10 65 120M-10 78 120 36"/><path class="map-street-small" d="M-10 38 120 90M5-10 25 120M80-10 90 110"/><circle cx="67" cy="46" r="8"/><circle class="map-marker-center" cx="67" cy="46" r="3"/></svg><span>${icon("arrow-up-right")}</span></span></button>`;
}
function renderStations() {
  if (stationSource === "real") { renderRealStations(); return; }
  const list = orderedStations();
  $("#mapCaption").textContent = "Pluggo network · live availability";
  const count = list.filter(station => available(station, state.vehicle)).length;
  $("#resultCount").textContent = `${count} available · ${list.length} compatible stations`;
  $("#mapEmpty").hidden = list.length > 0;
  $("#stationSelection").hidden = !list.length;
  if (!list.some(station => station.id === selectedStationId)) selectedStationId = list[0]?.id || null;
  const station = list.find(station => station.id === selectedStationId);
  if (station) renderSelectedStation(station);
}
function stationDirections(station) {
  return "https://www.google.com/maps/dir/?" + new URLSearchParams({api:"1",destination:`${station.lat},${station.lng}`,travelmode:"driving"});
}
function renderSelectedStation(station) {
  const previous = $("#stationSelection").dataset.stationId;
  $("#stationSelection").dataset.stationId = station.id;
  const plugs = station.connectors.filter(connector => vehicles[state.vehicle].connectors.includes(connector.type));
  const free = plugs.filter(connector => connector.available).length;
  $("#stationSelection").innerHTML = `<button type="button" class="station-sheet-handle" aria-label="Show or hide station details"></button><div class="station-sheet-heading"><span class="sheet-station-icon">${icon("station")}</span><div><h2>${station.name}</h2><p>${station.area} · Pluggo station</p></div><span class="sheet-distance">${distance(station, origin).toFixed(1)} km</span></div><div class="sheet-availability"><span class="availability-dot ${free ? "" : "busy"}" aria-hidden="true"></span>${free ? `${free} compatible plug${free === 1 ? "" : "s"} available` : "Compatible plugs in use"}</div><dl class="station-sheet-stats"><div><dt>Power</dt><dd>${Math.max(...plugs.map(connector => connector.power))} kW</dd></div><div><dt>Plugs</dt><dd>${free} / ${plugs.length}</dd></div><div><dt>${station.rating?.count ? `★ ${station.rating.average.toFixed(1)} · ` : ""}Tariff</dt><dd>₹${rateText(stationRate(station))}/kWh</dd></div></dl><div class="station-sheet-actions"><button class="primary-button" data-station="${station.id}" aria-label="View ${station.name}">View chargers</button><a href="${stationDirections(station)}" target="_blank" rel="noopener noreferrer" class="secondary-button">Directions ↗</a></div>`;
  if (previous && previous !== station.id && animationAllowed && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const sheet = $("#stationSelection");
    sheet.getAnimations({subtree:true}).forEach(a => {if(a.id === "station-change")a.cancel();});
    sheet.querySelectorAll(".station-sheet-heading,.sheet-availability,.station-sheet-stats,.station-sheet-actions").forEach((element,index) => {
      const animation = element.animate([{opacity:.3,transform:"translateY(5px)"},{opacity:1,transform:"none"}],{duration:260,delay:index*14,easing:"cubic-bezier(.22,1,.36,1)"});
      animation.id = "station-change";
    });
  }

}
function selectMapStation(station) {
  if (!station) return;
  setSheetCollapsed(false);
  selectedStationId = station.id;
  renderStations();
}
// The station card collapses to a single row so more of the map shows: tap the handle or swipe it.
// The station sheet pulls up over the map like Uber's: "peek" shows the title and a row or two,
// "half" the list, "full" nearly the whole screen. Drag the handle, or tap it to step up.
const SHEET_STATES = ["peek", "half", "full"];
function setSheetState(next) {
  const sheet = $("#stationSelection");
  sheet.dataset.sheet = next;
  sheet.classList.toggle("is-collapsed", next === "peek");
  sheet.querySelector(".station-sheet-handle")?.setAttribute("aria-expanded", String(next !== "peek"));
  sheet.querySelector(".station-sheet-handle")?.setAttribute("aria-label", next === "full" ? "Lower the list" : "Pull up the list");
  if (next !== "full") sheet.scrollTop = 0;
}
function setSheetCollapsed(collapsed) { setSheetState(collapsed ? "peek" : "half"); }
setSheetState("half");
$("#stationSelection").addEventListener("click", event => {
  if (!event.target.closest(".station-sheet-handle")) return;
  const current = SHEET_STATES.indexOf($("#stationSelection").dataset.sheet);
  setSheetState(SHEET_STATES[(current + 1) % SHEET_STATES.length]);
});
let sheetDragStart = null;
$("#stationSelection").addEventListener("pointerdown", event => {
  if (event.target.closest(".station-sheet-handle, .station-sheet-heading, .sheet-list-head")) sheetDragStart = event.clientY;
});
$("#stationSelection").addEventListener("pointerup", event => {
  if (sheetDragStart === null) return;
  const moved = event.clientY - sheetDragStart; sheetDragStart = null;
  if (Math.abs(moved) < 36) return;
  const current = SHEET_STATES.indexOf($("#stationSelection").dataset.sheet);
  setSheetState(SHEET_STATES[Math.max(0, Math.min(2, current + (moved < 0 ? 1 : -1)))]);
});
const sheetResizeObserver = new ResizeObserver(entries => {
  const height = $("#stationSelection").getBoundingClientRect().height;
  $("#page-stations").style.setProperty("--station-sheet-height", `${height}px`);
});
sheetResizeObserver.observe($("#stationSelection"));
function renderGarage() {
  $("#garageVehicles").innerHTML = Object.entries(vehicles)
    .map(
      ([id, v]) =>
        `<button class="garage-vehicle" data-vehicle="${id}" aria-pressed="${state.vehicle === id}"><img src="${v.image}" alt="" loading="lazy"><span class="garage-vehicle-text"><strong>${v.name}</strong><small>${v.capacity} kWh · ${v.power} kW · ${v.connectors.join(" / ")}</small><span class="garage-battery"><span class="garage-battery-bar" aria-hidden="true"><span style="width:${Math.round(batteryLevel(id))}%"></span></span><span>${Math.round(batteryLevel(id))}%</span><span>~${estimatedRange(id)} km</span></span></span><span class="garage-check" aria-hidden="true">${state.vehicle === id ? icon("check") : ""}</span></button>`,
    )
    .join("");
}
document.addEventListener("click", (event) => {
  if (event.target.closest("#clearStationFilters")) {
    filters = { available: false, saved: false, search: "", sort: "distance" };
    $("#stationSearch").value = "";
    $("#availableFilter").setAttribute("aria-pressed", "false");
    renderStations();
    renderMap();
  }
  const vehicle = event.target.closest("button[data-vehicle]");
  if (vehicle) selectVehicle(vehicle.dataset.vehicle);
  const mapStation = event.target.closest("[data-map-station]");
  if (mapStation) { if (stationSource !== "demo") setStationSource("demo"); selectedStationId = mapStation.dataset.mapStation; location.hash = "stations"; }
  const station = event.target.closest("[data-station]");
  if (station) openStation(stationById(station.dataset.station));
  const favourite = event.target.closest("[data-save]");
  if (favourite) {
    const id = favourite.dataset.save;
    state.saved = state.saved.includes(id)
      ? state.saved.filter((s) => s !== id)
      : [...state.saved, id];
    save();
    renderVehicle();
    renderStations();
  }
  const session = event.target.closest("[data-session]");
  if (session)
    openSession(state.sessions.find((s) => s.id === session.dataset.session));
});
$("#modelCredits").onclick = () =>
  showDialog(
    "MODEL CREDITS",
    `<h2 id="dialogTitle">Designed by talented people.</h2><p class="dialog-subtitle">These vehicles are visual previews. Battery sizes and connectors are typical profiles for each vehicle type.</p><div class="credits-list"><h3>Tesla Model 3 (2024)</h3><p>Model by RBLXSupercars; download-page uploader brandonleong28. <a href="https://sketchfab.com/3d-models/2024-tesla-model-3-fd22be415215453693d67e33aa7812d0" target="_blank" rel="noopener noreferrer">Original source · CC BY 4.0</a>. Downloaded from the credited public copy in erictfree/Carbon-Footprint-AI-Visualizer. This is an independent visualization, not a Tesla-endorsed app.</p><h3>Urban scooter</h3><p>Original unbranded model by Innerscene. <a href="https://www.innerscene.com/tools/library/3d-parts/urban-motor-scooter-9dd945f9" target="_blank" rel="noopener noreferrer">Source · CC0</a>.</p><h3>Pluggo Cargo</h3><p>Original Pluggo design: an enclosed electric delivery three-wheeler, built for this project. Battery and charging specifications are typical values.</p><h3>Concept motorcycle</h3><p>Cyberpunk Bike Concept Design by Berk Gedik, via Objaverse and Renderlyst. <a href="https://sketchfab.com/3d-models/99290272e69d4cd8a56af2d2e1274e0d" target="_blank" rel="noopener noreferrer">Source · CC BY 4.0</a>.</p><p>Models adapted for Pluggo: simplified geometry, reduced textures, white finishes and preview images. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 terms</a>.</p></div>`,
  );
$("#stationSearch").oninput = (event) => {
  if (stationSource === "real") return;
  filters.search = event.target.value;
  renderStations();
  renderMap();
};
$("#availableFilter").onclick = () => {
  filters.available = !filters.available;
  $("#availableFilter").setAttribute("aria-pressed", String(filters.available));
  renderStations();
  renderMap();
};
const locationMessage = document.createElement("p");
locationMessage.id = "locationMessage";
locationMessage.className = "location-message";
locationMessage.setAttribute("role", "status");
locationMessage.hidden = true;
$(".stations-controls").after(locationMessage);
let locationMessageTimer = 0;
function reportLocation(message) {
  locationMessage.hidden = false;
  locationMessage.textContent = message;
  locationMessage.title = message;
  clearTimeout(locationMessageTimer);
  locationMessageTimer = setTimeout(() => { locationMessage.hidden = true; }, 5000);
}
// Settings → Charging & payment.
const PREF_FORMAT = { target: v => `${v}%`, budget: v => `₹${v}`, monthlyBudget: v => `₹${v.toLocaleString("en-IN")}`, energyGoal: v => `${v} kWh`, chargesGoal: v => `${v} charges` };
document.querySelectorAll("select[data-pref]").forEach(select => {
  const key = select.dataset.pref;
  select.innerHTML = PREF_OPTIONS[key].map(value => `<option value="${value}"${value === prefs[key] ? " selected" : ""}>${PREF_FORMAT[key](value)}</option>`).join("");
  select.addEventListener("change", () => {
    prefs[key] = Number(select.value);
    savePrefs();
    if (page === "sessions") renderSessionSummary();
    toast("Saved.");
  });
});
const INFO_PAGES = {
  help: ["HELP & SUPPORT", "How can we help?", `<div class="credits-list info-list"><h3>Start a charge</h3><p>Tap Start charging on Home, or pick a station on the map. Choose a free charger that fits your vehicle, set a target and budget, then start.</p><h3>Stop and pay</h3><p>Stop any time from the live session. Pay with UPI, card or netbanking through Razorpay. Charges under ₹1 are free.</p><h3>Receipts</h3><p>Every finished charge is in Sessions. Open a receipt to share it.</p><h3>Sign in</h3><p>Sign in with your mobile number to keep your charges and receipts on every device. We text a one-time code.</p></div>`],
  privacy: ["PRIVACY", "Your data, simply.", `<div class="credits-list info-list"><h3>What we keep</h3><p>Your charging sessions and receipts, and your mobile number if you sign in, so your history follows you across devices.</p><h3>Location</h3><p>Your location is used on your phone to sort nearby stations. If you turn on Google Maps search, your search area is sent to Google.</p><h3>Payments</h3><p>Razorpay processes payments. Pluggo never sees your card or UPI details; we keep only the payment ID for your receipt.</p><h3>On this device</h3><p>Your style, language and charging preferences are saved on this phone. Clear my history removes your sessions here.</p><h3>Your rights</h3><p>Settings → Delete my account and data erases your number and history at any time.</p><p><a href="privacy.html" target="_blank" rel="noopener">Read the full Privacy Policy ↗</a></p></div>`],
  terms: ["TERMS OF USE", "The short version.", `<div class="credits-list info-list"><h3>Pilot release</h3><p>Pluggo network stations and chargers are simulated while partner chargers are onboarded, and charging runs faster than real time.</p><h3>Payments</h3><p>Payments run in Razorpay test mode during the pilot, so no real money moves.</p><h3>Estimates</h3><p>Range, time and cost estimates are typical values, not guarantees.</p><p><a href="terms.html" target="_blank" rel="noopener">Read the full Terms of Use ↗</a></p></div>`],
};
document.querySelectorAll("[data-info]").forEach(button => button.addEventListener("click", () => {
  const [eyebrow, title, body] = INFO_PAGES[button.dataset.info];
  showDialog(eyebrow, `<h2 id="dialogTitle">${title}</h2>${body}`);
}));
function applyAppStyle(style) {
  if (!["dark", "light"].includes(style)) style = "dark";
  document.documentElement.dataset.style = style;
  try { localStorage.setItem("pluggo.style", style); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", style === "light" ? "#ffffff" : "#000000");
  document.querySelectorAll("[data-app-style]").forEach(option => option.setAttribute("aria-checked", String(option.dataset.appStyle === style)));
  sceneController?.setShadowStrength(shadowStrength());
}
function shadowStrength() { return document.documentElement.dataset.style === "light" ? 0 : 0.85; }
document.querySelectorAll("[data-app-style]").forEach(option => option.addEventListener("click", () => applyAppStyle(option.dataset.appStyle)));
// Frosted-glass transparency, 0 (clear) to 100 (frosted). The blur stays 20px; only the tint changes.
function applyGlass(level, persist = true) {
  level = Math.min(100, Math.max(0, Math.round(Number(level))));
  if (!Number.isFinite(level)) level = 60;
  document.documentElement.style.setProperty("--glass-t", (level / 100).toFixed(2));
  $("#glassLevel").value = String(level);
  if (persist) { try { localStorage.setItem("pluggo.glass", String(level)); } catch {} }
}
$("#glassLevel").addEventListener("input", event => applyGlass(event.target.value));
{ let saved = 60; try { const value = parseInt(localStorage.getItem("pluggo.glass"), 10); if (value >= 0 && value <= 100) saved = value; } catch {} applyGlass(saved, false); }
applyAppStyle(document.documentElement.dataset.style);
$("#useLocation").onclick = requestDeviceLocation;
function requestDeviceLocation() {
  if (locationPending) return;
  locationRequested = true;
  const button = $("#useLocation");
  locationPending = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  reportLocation("Finding your location…");
  currentPosition().then(async (position) => {
    locationPending = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (!position) {
      reportLocation(origin.device ? `Location is off · using ${origin.name}` : "Location is off · tap the place name at the top to choose a town");
      return;
    }
    let name = "Your location";
    try { name = await placeName(position.lat, position.lng); } catch {}
    setPlace({ ...position, name, gps: true });
  });
}
// The place everything starts from. Saved on this phone; re-centres the map and searches again.
function setPlace(place) {
  origin = { lat: place.lat, lng: place.lng, device: true, name: place.name, gps: !!place.gps };
  savePlace(origin);
  renderLocationLabel();
  reportLocation(`Using ${place.gps ? "your location" : place.name} · ${place.name}`);
  renderVehicle();
  renderStations();
  renderMap();
  streetMap?.setView([origin.lat, origin.lng], 11);
  googleMap?.setCenter({ lat: origin.lat, lng: origin.lng });
  if (stationSource === "real" && page === "stations") { $("#stationSearch").value = ""; $("#stationSearchForm").requestSubmit(); }
}
function renderLocationLabel() {
  $("#headerLocation span").textContent = origin.name || "Choose location";
  $("#headerLocation").setAttribute("aria-label", `Location: ${origin.name || "not set"}. Change location`);
}
function openLocationPicker() {
  showDialog("YOUR LOCATION", `<h2 id="dialogTitle">Where are you?</h2><p class="dialog-subtitle">Pluggo finds chargers and plans trips from here. Now: ${escapeText(origin.name)}.</p><button type="button" class="secondary-button dialog-full" id="pickGps">${icon("locate")} Use my current location</button><form id="placeForm" class="place-form"><label class="field-label" for="placeQuery">Or search a town or area</label><div class="place-search"><input id="placeQuery" class="field-text" placeholder="For example: Kasol" autocomplete="off" enterkeyhint="search"><button type="submit" class="primary-button">Search</button></div></form><div id="placeResults" class="place-results" aria-live="polite"></div><p class="green-note">Place names © OpenStreetMap contributors. Your location is rounded to about 100 m before a name is looked up.</p>`);
  $("#pickGps").onclick = async () => {
    const button = $("#pickGps");
    button.disabled = true; button.setAttribute("aria-busy", "true");
    const position = await currentPosition();
    button.disabled = false; button.removeAttribute("aria-busy");
    if (!position) { toast("Location is off. Allow location for Pluggo, or search a town."); return; }
    let name = "Your location";
    try { name = await placeName(position.lat, position.lng); } catch {}
    $("#flowDialog").close();
    setPlace({ ...position, name, gps: true });
    toast(`Location set to ${name}.`);
  };
  $("#placeForm").onsubmit = async (event) => {
    event.preventDefault();
    const results = $("#placeResults");
    results.innerHTML = `<p class="dialog-subtitle">Searching…</p>`;
    try {
      const places = await findPlaces($("#placeQuery").value);
      results.innerHTML = places.length
        ? `<ul class="charger-list">${places.map((p, i) => `<li><button type="button" class="charger-row" data-pick-place="${i}"><span class="row-icon">${icon("pin")}</span><span class="row-main"><strong>${escapeText(p.name)}</strong><small>${escapeText(p.detail)}</small></span></button></li>`).join("")}</ul>`
        : `<p class="dialog-subtitle">No place found in India with that name. Try a nearby town.</p>`;
      results.querySelectorAll("[data-pick-place]").forEach((row) => row.onclick = () => {
        const place = places[Number(row.dataset.pickPlace)];
        $("#flowDialog").close();
        setPlace({ ...place, gps: false });
        toast(`Location set to ${place.name}.`);
      });
    } catch { results.innerHTML = `<p class="dialog-subtitle">Place search is unavailable right now. Check your connection and try again.</p>`; }
  };
}
$("#headerLocation").addEventListener("click", (event) => { event.preventDefault(); openLocationPicker(); });
renderLocationLabel();
// With location already allowed, refresh the place quietly on start (no prompt).
locationAllowed().then(async (allowed) => {
  if (!allowed || (origin.device && !origin.gps)) return;
  const position = await currentPosition({ timeout: 15000 });
  if (!position) return;
  const moved = !origin.device || Math.abs(position.lat - origin.lat) + Math.abs(position.lng - origin.lng) > 0.01;
  if (!moved) return;
  let name = origin.name;
  try { name = await placeName(position.lat, position.lng); } catch {}
  setPlace({ ...position, name, gps: true });
});
function googlePin(station) {
  const pin = document.createElement("div");
  pin.className = `google-charge-pin ${available(station, state.vehicle) ? "is-available" : "is-busy"}`;
  pin.innerHTML = `${icon("bolt")}<span class="availability-dot ${available(station, state.vehicle) ? "" : "busy"}" aria-hidden="true"></span><span>${available(station, state.vehicle) ? "Available" : "In use"}</span>`;
  return pin;
}
let streetMap = null, streetMarkers = null, streetTiles = null, mapResizeObserver = null, streetList = [];
function renderStreetMap(list) {
  if (page !== "stations") return;
  if (!window.L) {
    $("#mapNetworkStatus").hidden = false;
    return;
  }
  if (!streetMap) {
    $("#stationMap").replaceChildren();
    streetMap = L.map("stationMap", {zoomControl: false, scrollWheelZoom: false, attributionControl: true});
    // Phones pinch to zoom; only mouse users get +/- buttons.
    if (matchMedia("(pointer: fine)").matches) L.control.zoom({position: "bottomright"}).addTo(streetMap);
    streetTiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(streetMap);
    streetTiles.on("tileerror", () => { $("#mapNetworkStatus").hidden = false; });
    streetTiles.on("tileload", () => { $("#mapNetworkStatus").hidden = true; });
    streetMarkers = L.layerGroup().addTo(streetMap);
    streetMap.on("zoomend", () => { if (stationSource === "demo") drawStreetMarkers(streetList); });
    streetMap.fitBounds(stations.map(s => [s.lat, s.lng]), {paddingTopLeft:[35,150],paddingBottomRight:[35,320]});
    mapResizeObserver = new ResizeObserver(() => streetMap?.invalidateSize());
    mapResizeObserver.observe($("#stationMap"));
  }
  streetList = list;
  drawStreetMarkers(list);
  requestAnimationFrame(() => streetMap?.invalidateSize());
}
function drawStreetMarkers(list) {
  streetMarkers.clearLayers();
  const groups = [];
  for (const station of list) {
    const point = streetMap.latLngToLayerPoint([station.lat, station.lng]);
    const group = groups.find(g => g.some(s => point.distanceTo(streetMap.latLngToLayerPoint([s.lat, s.lng])) < 50));
    if (group) group.push(station); else groups.push([station]);
  }
  for (const group of groups) {
    const station = group[0], clustered = group.length > 1;
    const lat = group.reduce((sum, s) => sum + s.lat, 0) / group.length;
    const lng = group.reduce((sum, s) => sum + s.lng, 0) / group.length;
    const free = group.some(s => available(s, state.vehicle));
    const title = clustered ? `${group.length} stations · click to zoom` : `${station.name} · ${free ? "Available" : "In use"}`;
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({className: "street-marker", html: `<span class="street-marker-core ${free ? "" : "busy"} ${clustered ? "cluster" : ""}">${clustered ? group.length : icon("bolt")}${!clustered ? `<i class="pin-availability-dot ${free ? "" : "busy"}" aria-hidden="true"></i><b class="pin-price">₹${station.rate}</b>` : ""}</span>`, iconSize: [44, 44], iconAnchor: [22, 22]}),
      title, alt: title, keyboard: true,
    }).addTo(streetMarkers);
    marker.bindTooltip(title, {direction: "top", offset: [0, -22]});
    marker.on("click", () => clustered ? streetMap.fitBounds(group.map(s => [s.lat, s.lng]), {paddingTopLeft:[40,150],paddingBottomRight:[40,320],maxZoom:15}) : selectMapStation(station));
  }
}
$("#retryMapTiles").onclick = () => streetTiles?.redraw();
function renderMap() {
  if (stationSource === "real") { renderRealMap(); return; }
  const list = orderedStations();
  if (googleMap && !mapsFailed) {
    $("#mapModeLabel").textContent = "GOOGLE MAPS · PLUGGO NETWORK";
    googleMarkers.forEach((m) => (m.map = null));
    googleMarkers = [];
    for (const station of list) {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: googleMap,
        position: { lat: station.lat, lng: station.lng },
        title: station.name + (available(station, state.vehicle) ? " · Available" : " · In use"),
        content: googlePin(station),
        gmpClickable: true,
      });
      marker.addListener("click", () => selectMapStation(station));
      googleMarkers.push(marker);
    }
    const bounds = new google.maps.LatLngBounds();
    (list.length ? list : stations).forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
    googleMap.fitBounds(bounds, 55);
  } else {
    renderStreetMap(list);
  }
}
let mapsKey = "";
try {
  mapsKey = sessionStorage.getItem("chargeflow.maps.key") || "";
} catch {}
$("#openMapSettings").onclick = () => { location.hash = "settings/maps"; $("#mapSettings").open = true; };
$("#mapsKeyForm").onsubmit = (event) => {
  event.preventDefault();
  const key = $("#mapsApiKey").value.trim();
  if (!/^AIza[\w-]{20,}$/.test(key)) {
    toast("Enter a valid Google Maps browser API key.");
    return;
  }
  try {
    sessionStorage.setItem("chargeflow.maps.key", key);
    location.hash = "stations";
    location.reload();
  } catch {
    toast("Tab storage is unavailable; use the street map instead.");
  }
};
$("#clearMapsKey").onclick = () => {
  try {
    sessionStorage.removeItem("chargeflow.maps.key");
  } catch {}
  location.hash = "stations";
  location.reload();
};
async function loadMaps() {
  if (!mapsKey) return;
  $("#mapConnectionSummary").textContent = "Connecting…";
  $("#mapsStatus").textContent = "Loading Google Maps…";
  $("#mapModeLabel").textContent = "LOADING GOOGLE MAPS…";
  $("#stationMap").setAttribute("aria-busy", "true");
  const fallback = () => {
    $("#stationMap").setAttribute("aria-busy", "false");
    $("#mapConnectionSummary").textContent = "Connection needs attention";
    mapsFailed = true;
    googleMap = null;
    $("#mapModeLabel").textContent = "OPENSTREETMAP";
    $("#mapCaption").textContent =
      "Google Maps unavailable · using OpenStreetMap";
    $("#mapsStatus").textContent =
      "Google Maps could not load. Check key restrictions, Maps JavaScript API and billing. The Pluggo street map is still available.";
    renderMap();
    if (stationSource === "real") showRealNotice("Google Maps could not load. Check your key, allowed websites, enabled APIs and billing in My garage.", true);
  };
  window.gm_authFailure = fallback;
  const timeout = setTimeout(fallback, 18000);
  window.pluggoMapsReady = () => {
    clearTimeout(timeout);
    if (mapsFailed) return;
    try {
      if (streetMap) { mapResizeObserver?.disconnect(); streetMap.remove(); streetMap = null; }
      $("#stationMap").innerHTML = "";
      googleMap = new google.maps.Map($("#stationMap"), {
        center: { lat: origin.lat, lng: origin.lng },
        zoom: 12,
        mapId: "DEMO_MAP_ID",
        colorScheme: google.maps.ColorScheme.DARK,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
      });
      $("#stationMap").setAttribute("aria-busy", "false");
      $("#mapModeLabel").textContent = "GOOGLE MAPS";
      $("#mapCaption").textContent =
        "Google Maps · all station pins are fictional";
      $("#mapsStatus").textContent =
        "Google Maps is configured for this browser tab.";
      $("#mapConnectionSummary").textContent = "Connected for this tab";
      renderMap();
      if (stationSource === "real") showRealNotice("Google Maps is ready. Search nearby to find chargers.");
    } catch {
      fallback();
    }
  };
  const script = document.createElement("script");
  const query = new URLSearchParams({
    key: mapsKey,
    loading: "async",
    callback: "pluggoMapsReady",
    libraries: "marker,places",
    v: "weekly",
  });
  script.src = `https://maps.googleapis.com/maps/api/js?${query}`;
  script.async = true;
  script.onerror = () => {
    clearTimeout(timeout);
    fallback();
  };
  document.head.append(script);
}
const escapeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function showRealNotice(message, setup = false) {
  const panel = $("#realStationNotice");
  panel.hidden = false;
  panel.replaceChildren(document.createTextNode(message));
  if (setup) {
    const link = document.createElement("a"); link.href = "#settings"; link.textContent = "Open Map settings ↗"; panel.append(link);
  }
}
function setStationSource(source) {
  stationSource = source; ++realSearchGeneration; realPlaces = []; realSearchState = "idle";
  if (origin.device) reportLocation(source === "real" ? `Chargers near ${origin.name}` : `Distances from ${origin.name}`);
  $("#realStationSearch").disabled = false; $("#realStationSearch").textContent = "Search";
  $("#stationSelection").removeAttribute("aria-busy");
  $("#demoStationSource").setAttribute("aria-pressed", String(source === "demo"));
  $("#realStationSource").setAttribute("aria-pressed", String(source === "real"));
  $("#availableFilter").hidden = source === "real";
  $("#realStationSearch").hidden = source === "demo";
  $(".map-legend").hidden = source === "real";
  $(".map-interaction-hint").hidden = source === "real";
  $("#stationSearch").value = ""; filters.search = "";
  $("#stationSearch").placeholder = source === "real" ? "City, area, or charger name" : "Search a station or locality";
  $("#realStationNotice").hidden = source === "demo";
  if (source === "real") {
    showRealNotice(googleMap && !mapsFailed ? "Search chargers within 5 km of your location, or enter a city or station name. Live plug availability is not provided." : "Real charging stations from Open Charge Map and OpenStreetMap. Search near you, or enter an area, city or operator. Live plug availability is not provided.");
  }
  renderStations(); renderMap();
  // Without Google, the directory needs no key: search straight away when the location is known.
  if (source === "real" && usingDirectory() && origin.device && !locationPending) $("#stationSearchForm").requestSubmit();
}
// Real stations come from Google Places when a Maps key is configured, otherwise from the
// server's OpenStreetMap / Open Charge Map directory.
const usingDirectory = () => !googleMap || mapsFailed;
let directorySources = [], searchLabel = "", searchCentre = null, sheetDetail = false;
const realFilters = new Set();
const REAL_FILTERS = [["fast", "Fast 25 kW+"], ["CCS2", "CCS2"], ["Type 2", "Type 2"], ["CHAdeMO", "CHAdeMO"], ["3-pin socket", "3-pin"]];
// Results after the filter chips: every selected filter must match.
const filteredPlaces = () => realPlaces.filter((p) => [...realFilters].every((f) => f === "fast" ? Number(p.powerKW) >= 25 : (p.sockets || []).includes(f)));
function directoryPlace(s) {
  return {
    id: s.id, directory: true, displayName: s.name, operator: s.operator, sockets: s.sockets || [],
    formattedAddress: s.address || [s.city, s.state].filter(Boolean).join(", "),
    location: {lat: s.lat, lng: s.lng}, distanceKm: s.distanceKm, hours: s.hours, capacity: s.capacity,
    powerKW: s.powerKW, price: s.price, status: s.status, verifiedAt: s.verifiedAt,
  };
}
// Chargers around a point. In the hills the nearest charger can be 100 km away, so the search
// widens (25, 100, then 300 km) until it finds a handful. Positions are rounded to about 100 m.
async function searchDirectory(query, centre = origin.device ? origin : null) {
  const radii = query ? [1000] : [25, 100, 300];
  let reply = { stations: [] };
  for (const radius of radii) {
    const params = { limit: 60 };
    if (query) params.q = query;
    if (centre) Object.assign(params, { lat: centre.lat.toFixed(3), lng: centre.lng.toFixed(3), radius });
    if (!query && !centre) break;
    reply = await customerApi.publicStations(params);
    if ((reply.stations || []).length >= 5) break;
  }
  directorySources = reply.sources || [];
  return (reply.stations || []).map(directoryPlace);
}
$("#demoStationSource").onclick = () => setStationSource("demo");
$("#realStationSource").onclick = () => setStationSource("real");
$("#stationSearchForm").onsubmit = async event => {
  event.preventDefault();
  if (stationSource !== "real") return;
  if (locationPending) { showRealNotice("Waiting for your location. You can enter a city or area if location is unavailable."); return; }
  if (!origin.device && !$("#stationSearch").value.trim()) { showRealNotice("Allow location or enter a city or locality so the search knows where to look."); return; }
  const directory = usingDirectory();
  const token = ++realSearchGeneration, button = $("#realStationSearch");
  button.disabled = true; button.textContent = "Searching…";
  $("#stationSelection").setAttribute("aria-busy", "true");
  realPlaces = []; realSearchState = "loading"; renderRealMap(); renderRealStations();
  showRealNotice(directory ? "Searching real charging stations…" : "Searching Google Places for charging stations…");
  try {
    const query = $("#stationSearch").value.trim();
    let found;
    if (directory) {
      // A town or area ("Kasol") moves the search there; anything else is matched against charger names.
      let centre = origin.device ? origin : null, nameQuery = "";
      searchLabel = origin.device ? origin.name : "";
      if (query) {
        const places = await findPlaces(query, 1, { placesOnly: true }).catch(() => []);
        if (places.length) { centre = places[0]; searchLabel = places[0].name; } else nameQuery = query;
      }
      found = await searchDirectory(nameQuery, nameQuery ? (origin.device ? origin : null) : centre);
      if (centre && !nameQuery) { searchCentre = centre; streetMap?.setView([centre.lat, centre.lng], 11); }
      if (nameQuery) searchLabel = `“${nameQuery}”`;
    } else found = await findGoogleStations(google, {query, origin});
    if (token !== realSearchGeneration || stationSource !== "real") return;
    realPlaces = found; realSearchState = "done"; sheetDetail = false; renderRealStations(); renderRealMap();
    if (found.length) $("#realStationNotice").hidden = true;
    else showRealNotice("No chargers found. Try a nearby town or a charger name.");
  } catch {
    if (token === realSearchGeneration && stationSource === "real") {
      realSearchState = "error"; renderRealStations();
      if (directory) showRealNotice("Real station search is unavailable right now. Check your connection and try again.");
      else showRealNotice("Google charger search failed. Check Places API (New), key restrictions, billing and quota, then try again.", true);
    }
  } finally {
    if (token === realSearchGeneration) {
      button.disabled = false; button.textContent = "Search";
      $("#stationSelection").removeAttribute("aria-busy");
    }
  }
};
function placeMapsLink(place) {
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({api:"1", query:place.displayName || "EV charging station", query_place_id:place.id});
  return url.href;
}
function renderRealStations() {
  const directory = usingDirectory(), list = directory ? filteredPlaces() : realPlaces;
  $("#resultCount").textContent = realSearchState === "idle" ? "Search for real chargers" : realSearchState === "loading" ? "Searching real chargers…" : `${list.length} real charging stations`;
  $("#mapCaption").textContent = directory ? "Open Charge Map & OpenStreetMap · availability unknown" : "Google Places · availability unknown";
  $("#mapEmpty").hidden = true;
  $("#stationSelection").hidden = false;
  if (!list.some(place => place.id === selectedPlaceId)) { selectedPlaceId = list[0]?.id || null; if (!selectedPlaceId) sheetDetail = false; }
  const place = list.find(place => place.id === selectedPlaceId);
  const handle = '<button type="button" class="station-sheet-handle" aria-label="Show or hide station details"></button>';
  if (!place && !(directory && realPlaces.length)) {
    const hint = realSearchState === "loading" ? "Searching real charging stations…" : realSearchState === "done" ? "No chargers found. Try a nearby town or a charger name." : realSearchState === "error" ? "Search is unavailable right now. Try again in a moment." : "Type a town or area above, or tap the location button.";
    $("#stationSelection").innerHTML = `${handle}<h2>Find a charger.</h2><p class="sheet-empty-copy">${hint}</p>${directory ? "" : '<a href="#settings" class="secondary-button">Map settings ↗</a>'}`;
    return;
  }
  // The list: every charger found, nearest first, with filter chips.
  if (directory && !sheetDetail) {
    const chips = REAL_FILTERS.map(([key, label]) => `<button type="button" class="filter-chip" data-real-filter="${escapeText(key)}" aria-pressed="${realFilters.has(key)}">${label}</button>`).join("");
    const rows = list.map((p) => {
      const sockets = (p.sockets || []).slice(0, 3).join(" · ") || "Plugs not listed";
      return `<li><button type="button" class="charger-row" data-place="${escapeText(p.id)}"><span class="row-icon">${icon("bolt")}</span><span class="row-main"><strong>${escapeText(p.displayName || "EV charging station")}</strong><small>${escapeText(sockets)}${p.powerKW ? ` · ${Math.round(p.powerKW)} kW` : ""}</small></span><span class="row-side">${p.distanceKm != null ? `<strong>${p.distanceKm < 10 ? p.distanceKm.toFixed(1) : Math.round(p.distanceKm)} km</strong>` : ""}${Number(p.powerKW) >= 25 ? "<small>Fast</small>" : ""}</span></button></li>`;
    }).join("");
    $("#stationSelection").innerHTML = `${handle}<div class="sheet-list-head"><h2>${list.length} charger${list.length === 1 ? "" : "s"}${searchLabel ? ` near ${escapeText(searchLabel)}` : ""}</h2></div><div class="sheet-filters" role="group" aria-label="Filter chargers">${chips}</div>${list.length ? `<ul class="charger-list">${rows}</ul>` : `<p class="sheet-empty-copy">No charger matches these filters.</p>`}`;
    return;
  }
  const back = directory ? `<button type="button" class="sheet-back" data-sheet-back>${icon("back")} All chargers</button>` : "";
  if (place.directory) {
    const facts = [
      place.distanceKm != null ? `${place.distanceKm.toFixed(1)} km${searchLabel ? ` from ${searchLabel}` : " away"}` : "",
      place.operator && place.operator !== place.displayName ? place.operator : "",
      place.sockets.length ? place.sockets.join(" · ") : "Plugs not listed",
      place.powerKW ? `Up to ${Math.round(place.powerKW)} kW` : "",
      place.capacity ? `${place.capacity} charging point${place.capacity === 1 ? "" : "s"}` : "",
      place.price ? `Price: ${place.price}` : "",
      place.status && place.status !== "Operational" ? place.status : "",
      place.verifiedAt ? `Verified ${place.verifiedAt.slice(0, 7)}` : "",
      place.hours ? `Hours: ${place.hours}` : "",
    ].filter(Boolean);
    const attribution = directorySources.map(s => `© ${s.name} (${s.license})`).join(" · ") || "© OpenStreetMap contributors (ODbL)";
    $("#stationSelection").innerHTML = `${handle}${back}<div class="station-sheet-heading"><span class="sheet-station-icon">${icon("station")}</span><div><h2>${escapeText(place.displayName || "Charging station")}</h2><p>${escapeText(place.formattedAddress || "Address not mapped")}</p></div></div><ul class="real-station-facts">${facts.map(f => `<li>${escapeText(f)}</li>`).join("")}</ul><p class="sheet-availability"><span class="availability-dot unknown" aria-hidden="true"></span>Live availability not provided · not a Pluggo network station</p><a class="primary-button real-station" href="${escapeText(stationDirections(place.location))}" target="_blank" rel="noopener noreferrer">Get directions ↗</a><p class="real-station-attribution">${escapeText(attribution)}</p>`;
    return;
  }
  $("#stationSelection").innerHTML = `${handle}<div class="station-sheet-heading"><span class="sheet-station-icon">${icon("station")}</span><div><h2>${escapeText(place.displayName || "Charging station")}</h2><p>${escapeText(place.formattedAddress)}</p></div></div><p class="sheet-availability"><span class="availability-dot unknown" aria-hidden="true"></span>Availability and pricing not provided</p><a class="primary-button real-station" href="${escapeText(placeMapsLink(place))}" target="_blank" rel="noopener noreferrer">View in Google Maps ↗</a>`;
}
$("#stationSelection").addEventListener("click", (event) => {
  if (stationSource !== "real") return;
  const row = event.target.closest("[data-place]");
  if (row) {
    selectedPlaceId = row.dataset.place; sheetDetail = true; renderRealStations(); renderDirectoryMap(false);
    const p = realPlaces.find((x) => x.id === selectedPlaceId);
    if (p) streetMap?.setView([p.location.lat, p.location.lng], Math.max(streetMap.getZoom(), 13));
    return;
  }
  if (event.target.closest("[data-sheet-back]")) { sheetDetail = false; renderRealStations(); renderDirectoryMap(false); return; }
  const chip = event.target.closest("[data-real-filter]");
  if (chip) {
    const key = chip.dataset.realFilter;
    if (realFilters.has(key)) realFilters.delete(key); else realFilters.add(key);
    sheetDetail = false; renderRealStations(); renderDirectoryMap();
  }
});
function renderDirectoryMap(fit = true) {
  if (!window.L) { $("#mapNetworkStatus").hidden = false; return; }
  if (!streetMap) renderStreetMap([]);
  if (!streetMap) return;
  streetMarkers.clearLayers();
  $("#mapModeLabel").textContent = "OPENSTREETMAP · REAL STATIONS";
  const list = filteredPlaces();
  if (origin.device) L.marker([origin.lat, origin.lng], { icon: L.divIcon({ className: "street-marker", html: '<span class="you-marker" aria-hidden="true"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: origin.name, keyboard: false, interactive: false }).addTo(streetMarkers);
  for (const place of list) {
    const title = place.displayName || "Charging station";
    const marker = L.marker([place.location.lat, place.location.lng], {
      icon: L.divIcon({className: "street-marker", html: `<span class="street-marker-core real-marker ${place.id === selectedPlaceId && sheetDetail ? "selected" : ""}">${icon("bolt")}</span>`, iconSize: [44, 44], iconAnchor: [22, 22]}),
      title, alt: title, keyboard: true,
    }).addTo(streetMarkers);
    marker.bindTooltip(title, {direction: "top", offset: [0, -22]});
    marker.on("click", () => { selectedPlaceId = place.id; sheetDetail = true; setSheetCollapsed(false); renderRealStations(); renderDirectoryMap(false); });
  }
  if (!fit) return;
  // Frame the nearest few chargers and the search centre, not every result 300 km away.
  const points = list.slice(0, 6).map(p => [p.location.lat, p.location.lng]);
  const centre = searchCentre || (origin.device ? origin : null);
  if (centre) points.push([centre.lat, centre.lng]);
  if (points.length > 1) streetMap.fitBounds(points, {paddingTopLeft:[35,170],paddingBottomRight:[35,360],maxZoom:14});
  else if (points.length === 1) streetMap.setView(points[0], 13);
}
function renderRealMap() {
  if (streetMarkers) streetMarkers.clearLayers();
  googleMarkers.forEach(marker => marker.map = null); googleMarkers = [];
  if (!googleMap || mapsFailed) { renderDirectoryMap(); return; }
  $("#mapModeLabel").textContent = "GOOGLE MAPS · REAL STATIONS";
  const bounds = new google.maps.LatLngBounds();
  for (const place of realPlaces) {
    const pin = document.createElement("div"); pin.className = "google-charge-pin"; pin.innerHTML = icon("bolt");
    const marker = new google.maps.marker.AdvancedMarkerElement({map:googleMap,position:place.location,title:place.displayName,content:pin,gmpClickable:true});
    marker.addListener("click", () => { selectedPlaceId = place.id; renderRealStations(); });
    googleMarkers.push(marker); bounds.extend(place.location);
  }
  if (realPlaces.length) { googleMap.fitBounds(bounds, 60); if (realPlaces.length === 1) googleMap.setZoom(15); }
}
function layoutDialogActions() {
  const candidate = $("#dialogBody").querySelector(
    '#chargePlan button[type="submit"], #bookingForm button[type="submit"], #reviewForm button[type="submit"], #reportForm button[type="submit"], #tripForm button[type="submit"], #sessionActions > button, #completePayment, #confirmReset, #selectCharger, #receiptDone',
  );
  if (!candidate) return;
  if (candidate.form?.id) candidate.setAttribute("form", candidate.form.id);
  $("#dialogActions").replaceChildren(candidate);
  $("#dialogActions").hidden = false;
}
// modal:false is for the phone sign-in sheet. A modal dialog sits in the browser's top layer, above everything
// on the page, so Google's reCAPTCHA box (added to the page itself) would open *behind* it, and tapping that box
// would count as tapping outside the sheet. A plain sheet keeps the CAPTCHA above it and keeps the sheet open.
function showDialog(eyebrow, html, { modal = true } = {}) {
  stopCamera();
  dialogSession = null;
  $("#dialogEyebrow").textContent = eyebrow;
  $("#dialogActions").replaceChildren();
  $("#dialogActions").hidden = true;
  $("#dialogBody").innerHTML = html;
  layoutDialogActions();
  document.body.classList.add("dialog-open");
  sceneController?.setVisible(false);
  const dialog = $("#flowDialog");
  let wasOpen = dialog.open;
  if (wasOpen && dialog.classList.contains("is-nonmodal") === modal) {
    // Switching between the two kinds (for example sign-in finishing into the charge sheet) means re-opening.
    dialog.close();
    wasOpen = false;
  }
  if (!wasOpen) {
    dialog.classList.toggle("is-nonmodal", !modal);
    $("#dialogScrim").hidden = modal;
    if (modal) dialog.showModal(); else dialog.show();
  }
  const body = $("#dialogBody");
  body.getAnimations().forEach(animation => {if(animation.id === "dialog-step")animation.cancel();});
  if (wasOpen && animationAllowed && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const animation = body.animate([{opacity:.25,transform:"translateY(7px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,1,.36,1)"});
    animation.id = "dialog-step";
  }
  body.scrollTop = 0;
}
$("#closeDialog").onclick = () => $("#flowDialog").close();
const dialogScrim = Object.assign(document.createElement("div"), { id: "dialogScrim", hidden: true });
document.body.append(dialogScrim);
document.addEventListener("keydown", event => {
  const dialog = $("#flowDialog");
  if (event.key === "Escape" && dialog.open && dialog.classList.contains("is-nonmodal")) dialog.close();
});
$("#flowDialog").addEventListener("close", () => {
  // close() followed straight away by a re-open (see showDialog) queues this event; the dialog is open again by now.
  if ($("#flowDialog").open) return;
  dialogScrim.hidden = true;
  stopCamera();
  dialogSession = null;
  document.body.classList.remove("dialog-open");
  sceneController?.setVisible((page === "home" || page === "garage") && !document.hidden);
});
$("#flowDialog").addEventListener("click", (event) => {
  if (event.target === $("#flowDialog")) {
    const r = event.target.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      event.target.close();
  }
});
const notice = (message) =>
  `<p class="dialog-note">${icon("shield")}<span>${message}</span></p>`;
function openStation(station) {
  if (!station) return;
  const v = vehicles[state.vehicle];
  const destination = new URL("https://www.google.com/maps/dir/");
  destination.search = new URLSearchParams({
    api: "1",
    destination: `${station.lat},${station.lng}`,
    travelmode: "driving",
  });
  const supported = (c) => v.connectors.includes(c.type);
  const ready = station.connectors.filter((c) => supported(c) && c.available);
  const rating = station.rating;
  const plugStatus = (c) => !supported(c) ? "Incompatible with selected vehicle" : c.bookedByYou ? "Booked by you" : c.available ? "Available" : c.reserved ? "Reserved for a booking" : "In use";
  const cheaperAt = tariff?.enabled && station.band !== "off-peak" ? nextOffPeak(Date.now(), tariff) : 0;
  const actions = [
    !localPreview && `<button type="button" class="secondary-button" data-station-action="book" data-station-id="${station.id}">${icon("calendar")} Book a slot</button>`,
    rating?.canReview && `<button type="button" class="secondary-button" data-station-action="rate" data-station-id="${station.id}">${icon("star")} ${rating.mine ? "Edit rating" : "Rate"}</button>`,
    !localPreview && `<button type="button" class="secondary-button" data-station-action="report" data-station-id="${station.id}">${icon("alert")} Report a problem</button>`,
  ].filter(Boolean).join("");
  showDialog(
    "PLUGGO STATION · NEW DELHI",
    `<h2 id="dialogTitle">${station.name}</h2><p class="dialog-subtitle">${station.area} · ${distance(station, origin).toFixed(1)} km straight-line distance</p><p class="station-rating">${rating?.count ? `${stars(rating.average)} <strong>${rating.average.toFixed(1)}</strong> · ${rating.count} rating${rating.count === 1 ? "" : "s"}` : localPreview ? "" : "No ratings yet"}</p><div class="detail-tariff"><div><strong>₹${rateText(stationRate(station))}</strong><small> / kWh</small> ${bandChip(station.band)}</div><span><span class="availability-dot ${ready.length ? "" : "busy"}" aria-hidden="true"></span> ${ready.length} compatible plug${ready.length === 1 ? "" : "s"} available<br>${cheaperAt ? `₹${rateText(rateAt(station.rate, cheaperAt, tariff))}/kWh off-peak from ${istTime(cheaperAt)}` : "No idle fees"}</span></div><fieldset class="connector-picker"><legend>Charger for your ${v.name}</legend>${station.connectors.map((c) => `<label class="connector-choice ${supported(c) && c.available ? "" : "unavailable"}"><input type="radio" name="connector" value="${c.id}" data-connector="${c.id}" ${c === ready[0] ? "checked" : ""} ${supported(c) && c.available ? "" : "disabled"}><span><strong>${c.type}<span>${c.power} kW</span></strong><small><span class="availability-dot ${!supported(c) ? "unknown" : c.available ? "" : "busy"}" aria-hidden="true"></span> ${c.id} · ${plugStatus(c)}${c.openReports ? ` · <span class="issue-flag">issue reported</span>` : ""}</small></span></label>`).join("")}</fieldset><div class="amenities">${station.amenities.map((a) => `<span class="pill">${a}</span>`).join("")}</div>${rating?.recent?.length ? `<div class="review-list">${rating.recent.map((r) => `<blockquote>${stars(r.rating)}<p>${escapeText(r.comment)}</p></blockquote>`).join("")}</div>` : ""}${actions ? `<div class="station-extra-actions">${actions}</div>` : ""}<div class="dialog-links"><button class="text-link" id="scanConnector">${icon("qr")} Scan or enter code</button><a href="${destination}" target="_blank" rel="noopener noreferrer" class="text-link">Google Maps directions ${icon("arrow-up-right")}</a></div><button id="selectCharger" class="primary-button dialog-full" ${ready.length ? "" : "disabled"}>Select charger ${icon("arrow-up-right")}</button>`,
  );
  $("#selectCharger").onclick = () =>
    openSetup(
      station,
      station.connectors.find(
        (c) => c.id === $("input[name=connector]:checked")?.value,
      ),
    );
  $("#scanConnector").onclick = () => openScanner(station);
}
function openSetup(station, connector) {
  const v = vehicles[state.vehicle];
  if (!connector?.available || !v.connectors.includes(connector.type)) {
    toast("Choose an available, compatible connector.");
    return;
  }
  const blocking = activeSession() || pendingSession();
  if (blocking) {
    openSession(blocking);
    toast(
      "Finish your current charge or payment before starting another.",
    );
    return;
  }
  showDialog(
    "YOUR CHARGE, YOUR WAY",
    `<h2 id="dialogTitle">A little more ready.</h2><p class="dialog-subtitle">${station.name} · ${connector.id} · ${v.label}<br>Starting from 25% battery.</p><form id="chargePlan"><div class="slider-field"><label for="chargeTarget">Charge target <output id="targetOutput">${prefs.target}%</output></label><input id="chargeTarget" type="range" min="30" max="100" step="5" value="${prefs.target}"></div><div class="slider-field"><label for="chargeBudget">Budget cap <output id="budgetOutput">₹${prefs.budget}</output></label><input id="chargeBudget" type="range" min="50" max="1000" step="50" value="${prefs.budget}"></div><p class="dialog-subtitle">Stops at your target or budget, whichever comes first.</p><div class="bill-summary" id="chargeEstimate"></div><div id="chargeTip"></div><button type="submit" class="primary-button dialog-full">Start charging ${icon("bolt")}</button></form>`,
  );
  function estimate() {
    const target = Number($("#chargeTarget").value),
      budget = Number($("#chargeBudget").value),
      power = Math.min(v.power, connector.power),
      rate = stationRate(station);
    const energy = Math.min(
      ((target - 25) / 100) * v.capacity,
      budget / rate,
    );
    $("#targetOutput").textContent = `${target}%`;
    $("#budgetOutput").textContent = `₹${budget}`;
    $("#chargeEstimate").innerHTML =
      billRow("Energy to add", `${energy.toFixed(2)} kWh`) +
      billRow("Charging power", `${power} kW`) +
      billRow("Estimated time", `~${Math.max(1, Math.ceil((energy / power) * 60))} min`) +
      billRow("Rate now", `₹${rateText(rate)} / kWh ${bandChip(station.band)}`) +
      billRow("Estimated bill", currency(energy * rate), "total");
    // Time-of-use: point out a cheaper off-peak slot, and the wallet credit that will be used.
    const cheaperAt = tariff?.enabled && station.band !== "off-peak" ? nextOffPeak(Date.now(), tariff) : 0;
    const saving = cheaperAt ? energy * (rate - rateAt(station.rate, cheaperAt, tariff)) : 0;
    $("#chargeTip").innerHTML =
      (saving >= 1 ? `<p class="tariff-tip">${icon("calendar")}<span>Off-peak from ${istTime(cheaperAt)} costs ₹${rateText(rateAt(station.rate, cheaperAt, tariff))}/kWh, about ${currency(saving)} less for this charge. <button type="button" class="text-link" data-station-action="book" data-station-id="${station.id}">Book an off-peak slot</button></span></p>` : "") +
      (wallet.balance > 0 && !localPreview ? notice(`${currency(Math.min(wallet.balance, energy * rate))} of your wallet credit will be used at checkout.`) : "");
  }
  $("#chargeTarget").oninput = estimate;
  $("#chargeBudget").oninput = estimate;
  estimate();
  const startKey = crypto.randomUUID();
  $("#chargePlan").onsubmit = async (event) => {
    event.preventDefault();
    if (activeSession() || pendingSession()) {
      toast("There is already a session to finish.");
      return;
    }
    if (!localPreview && backendConfig.authRequired && !account.signedIn) {
      openSignIn(() => openSetup(station, stationById(station.id).connectors.find(c => c.id === connector.id) || connector));
      return;
    }
    if (!localPreview) {
      const reply = await backendAction($("#dialogActions button"), () => customerApi.start({station:station.id,connector:connector.id,vehicle:state.vehicle,target:Number($("#chargeTarget").value),budget:Number($("#chargeBudget").value)},startKey));
      if (reply) openSession(state.sessions.find(session => session.id === reply.sessionId));
      return;
    }
    const started = Date.now();
    const session = {
      id: `PG-${started}`,
      station: station.id,
      connector: connector.id,
      vehicle: state.vehicle,
      started,
      target: Number($("#chargeTarget").value),
      budget: Number($("#chargeBudget").value),
      power: Math.min(v.power, connector.power),
      energy: 0,
      ended: null,
      settled: false,
      reason: "",
    };
    state.sessions.unshift(session);
    save();
    renderSessions();
    openSession(session);
  };
}
function billRow(label, value, extra = "") {
  return `<div class="bill-row ${extra}"><span>${label}</span><span>${value}</span></div>`;
}
function openSession(session) {
  if (!session) return;
  updateSession(session);
  save();
  const station = stationById(session.station);
  const ended = !!session.ended;
  showDialog(
    session.settled
      ? "RECEIPT"
      : ended
        ? "CHARGE COMPLETE"
        : "LIVE SESSION",
    `<h2 id="dialogTitle">${station.name}</h2><p class="dialog-subtitle">${session.connector} · ${vehicles[session.vehicle].label}</p>${!session.settled ? `<img class="session-vehicle-preview" src="${vehicles[session.vehicle].image}" alt="${vehicles[session.vehicle].name}">` : ""}${session.settled ? `<div class="receipt-hero"><div class="receipt-symbol">${icon("check")}</div><h3>${paidAmount(session) > 0 ? "Payment received" : "Checkout complete"}</h3><div class="receipt-amount"><small>AMOUNT PAID</small><strong>${currency(paidAmount(session))}</strong></div><p>${session.receipt?.paymentId ? `Paid via Razorpay · ${session.receipt.paymentId}` : "No payment was needed for this charge."}${refundedAmount(session) > 0 ? ` · ${currency(refundedAmount(session))} refunded to your original payment method` : ""}</p></div>` : ""}<div class="charge-ring" id="chargeRing" ${session.settled ? "hidden" : ""}><div>${icon(session.settled ? "check" : ended ? "receipt" : "bolt")}<strong id="liveSoc">${soc(session).toFixed(0)}%</strong><small>BATTERY</small></div></div><div class="bill-summary" id="sessionSummary"></div>${session.settled ? `<details class="receipt-details"><summary>Session details</summary>${billRow("Charging power used", `${session.power} kW`)}${billRow("Completed", session.reason)}<p class="receipt-id">${session.receipt?.id || session.id}<br>${new Intl.DateTimeFormat("en-IN", {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(session.started))} IST<br>Pluggo charging receipt</p></details>` : ""}<div id="sessionActions"></div>`,
  );
  dialogSession = session.id;
  updateSessionDialog();
}
function updateSessionDialog() {
  if (!dialogSession) return;
  const s = state.sessions.find((s) => s.id === dialogSession);
  if (!s) return;
  $("#liveSoc").textContent = `${soc(s).toFixed(0)}%`;
  $("#chargeRing").style.setProperty("--progress", `${soc(s)}%`);
  $("#chargeRing").classList.toggle("is-charging", !s.ended);
  $("#sessionSummary").classList.toggle("charging-metrics", !s.settled);
  $("#sessionSummary").innerHTML = s.settled
    ? billRow("Energy delivered", `${s.energy.toFixed(2)} kWh`) +
      billRow(
        "Charging time",
        (s.energy > 0 && (s.energy / s.power) * 60 < 1) ? "Less than 1 min" : `${Math.floor((s.energy / s.power) * 60)} min`,
      ) +
      billRow("Total", currency(total(s))) +
      (s.walletUsed > 0 ? billRow("Wallet credit used", `−${currency(s.walletUsed)}`) : "") +
      billRow("Amount paid", currency(paidAmount(s)), "total")
    : `<div><span>Energy added</span><strong>${s.energy.toFixed(2)}<small> kWh</small></strong></div><div><span>Charging time</span><strong>${Math.floor((s.energy / s.power) * 60)}<small> min</small></strong></div><div><span>Cost</span><strong>${currency(total(s))}</strong></div><p class="charge-context">${s.ended ? s.reason : `${s.power} kW`} · Target ${s.target}%</p>`;
  if (s.settled) {
    const rating = stationById(s.station)?.rating;
    $("#sessionActions").innerHTML =
      `<button id="receiptDone" class="primary-button dialog-full">Back to sessions</button><button id="shareReceipt" class="secondary-button dialog-full">${icon("share")} Share receipt</button>${rating?.canReview && !rating.mine ? `<button type="button" class="secondary-button dialog-full" data-station-action="rate" data-station-id="${s.station}">${icon("star")} Rate this station</button>` : ""}`;
    $("#shareReceipt").onclick = () => shareReceipt(s);
    $("#receiptDone").onclick = () => {
      $("#flowDialog").close();
      location.hash = "sessions";
    };
  } else if (s.ended) {
    $("#dialogEyebrow").textContent = "CHARGE COMPLETE";
    $("#sessionActions").innerHTML =
      `<button class="primary-button dialog-full" id="checkoutButton">Continue to payment ${icon("arrow-up-right")}</button>`;
    $("#checkoutButton").onclick = () => openCheckout(s);
  } else {
    if (!$("#stopCharge")) {
      $("#sessionActions").innerHTML =
        `<p class="dialog-subtitle">Charging continues if you leave this page.</p><button class="secondary-button dialog-full" id="stopCharge">${icon("stop")} Stop charging</button>`;
      $("#stopCharge").onclick = async () => {
        if (!localPreview) { const reply=await backendAction($("#stopCharge"),()=>customerApi.stop(s.id)); if(reply) openSession(state.sessions.find(item=>item.id===s.id)); return; }
        updateSession(s);
        if (!s.ended) {
          s.ended = Date.now();
          s.reason = "Stopped by you";
        }
        save();
        renderSessions();
        openSession(s);
      };
    }
  }
  layoutDialogActions();
}
const paidAmount = (s) => Math.max(0, Number(s.receipt?.netCollected ?? s.receipt?.amountCollected) || 0);
const refundedAmount = (s) => Math.max(0, Number(s.receipt?.refunded) || 0);
function openCheckout(s) {
  if (!s.ended) return;
  const station = stationById(s.station);
  const due = sessionDue(s);
  const credit = Number(s.walletUse) || 0;
  const online = !localPreview && backendConfig.payments === "razorpay" && due >= 1;
  showDialog(
    "CHECKOUT",
    `<div class="receipt-symbol">${icon("receipt")}</div><h2 id="dialogTitle">All charged.</h2><p class="dialog-subtitle">${station.name} · ${s.connector}</p><div class="bill-summary">${billRow("Energy delivered", `${s.energy.toFixed(2)} kWh`)}${billRow("Rate", `₹${s.rate ?? station.rate} / kWh ${s.band ? bandChip(s.band) : ""}`)}${credit > 0 ? billRow("Charging cost", currency(total(s))) + billRow("Wallet credit", `−${currency(credit)}`) : ""}${billRow("Amount due", currency(due), "total")}</div>${online ? notice("Secure payment by Razorpay · UPI, cards and netbanking.") : credit > 0 && due < 1 ? notice("Your wallet credit covers this charge.") : due < 1 ? notice("Charges under ₹1 are on us.") : ""}<button class="primary-button dialog-full" id="completePayment">${online ? `Pay ${currency(due)}` : "Complete checkout"} ${icon("check")}</button>`,
  );
  $("#completePayment").onclick = async () => {
    const button = $("#completePayment");
    if (localPreview) {
      s.settled = true;
      save();
      renderSessions();
      openSession(s);
      toast("Checkout complete.");
      return;
    }
    let payment = {};
    if (online) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      try {
        const order = await customerApi.paymentOrder(s.id);
        // Razorpay already has this payment (for example the app closed after paying): no second charge.
        if (!order.settled) payment = await payWithRazorpay(order, { description: `Charging at ${station.name}` });
      } catch (error) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        toast(error.cancelled ? "Payment cancelled. You can pay whenever you're ready." : error.message);
        return;
      }
    }
    const reply = await backendAction(button, () => customerApi.checkout(s.id, payment));
    if (reply) {
      openSession(state.sessions.find((item) => item.id === s.id));
      toast(online ? "Payment received. Thank you!" : "Checkout complete.");
    }
  };
}
function renderAccount() {
  const card = $("#accountCard");
  if (!card) return;
  card.hidden = localPreview || !backendConfig.authRequired;
  $("#accountLabel").hidden = card.hidden;
  document.querySelector('[data-settings-link="account"]')?.toggleAttribute("hidden", card.hidden);
  if (card.hidden) return;
  const html = account.signedIn
    ? `<div class="settings-heading">${icon("shield")}<h2>Signed in</h2></div><p>${account.phone || "Phone account"} · your charges and receipts are saved to this number on every device.</p><button class="secondary-button" id="signOutButton" type="button">Sign out</button><button class="text-link danger-link" id="deleteAccountButton" type="button">Delete my account and data</button>`
    : `<div class="settings-heading">${icon("shield")}<h2>Sign in</h2></div><p>Use your mobile number to start charging and keep your receipts on every device.</p><button class="primary-button" id="signInButton" type="button">Sign in with phone ${icon("arrow-up-right")}</button>`;
  if (card.innerHTML === html) return;
  card.innerHTML = html;
  $("#signInButton")?.addEventListener("click", () => openSignIn());
  $("#signOutButton")?.addEventListener("click", async () => {
    const reply = await backendAction($("#signOutButton"), () => customerApi.signOut(), false);
    if (!reply) return;
    await signOutFirebase(backendConfig.firebase);
    renderGarage();
    toast("Signed out.");
  });
  $("#deleteAccountButton")?.addEventListener("click", () => confirmDeleteAccount());
}
// Right to erasure: removes the phone account, preferences and history. Paid receipts are kept
// for tax records without any link to the person. Firebase requires a recent sign-in to delete
// the phone sign-in record too, so an older sign-in is verified again first.
function confirmDeleteAccount() {
  showDialog(
    "DELETE ACCOUNT",
    `<h2 id="dialogTitle">Delete your account?</h2><p class="dialog-subtitle">This removes your mobile number, saved stations, vehicle choice and charging history from Pluggo. Receipts for payments you made are kept only as anonymous accounting records, as tax law requires. This cannot be undone.</p><p class="form-error" id="deleteError" role="alert"></p><button type="button" class="primary-button dialog-full danger-button" id="confirmDelete">Delete my account</button><button type="button" class="text-link" id="cancelDelete">Keep my account</button>`,
  );
  $("#cancelDelete").onclick = () => $("#flowDialog").close();
  $("#confirmDelete").onclick = async () => {
    const button = $("#confirmDelete");
    let age = 0;
    try { age = backendConfig.firebase ? await firebaseSignInAge(backendConfig.firebase) : 0; } catch { /* sign-in service unreachable: still erase Pluggo's data */ }
    if (age > 4 * 60 * 1000) {
      toast("For your security, verify your number once more.");
      openSignIn(() => confirmDeleteAccount());
      return;
    }
    const reply = await backendAction(button, () => customerApi.deleteAccount(), false);
    if (!reply) return;
    try { await deleteFirebaseUser(backendConfig.firebase); } catch { await signOutFirebase(backendConfig.firebase); }
    $("#flowDialog").close();
    renderGarage();
    toast("Your account and data were deleted.");
  };
}
function openSignIn(after) {
  if (!backendConfig.firebase) { toast("Phone sign-in is not available right now."); return; }
  showDialog(
    "SIGN IN",
    `<h2 id="dialogTitle">Your number,<br>your receipts.</h2><p class="dialog-subtitle">We'll text a one-time code to verify your mobile number.</p><form id="phoneForm" class="sign-in-form" novalidate><label for="phoneInput">Mobile number</label><div class="phone-field"><span>+91</span><input id="phoneInput" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="98765 43210" required></div><label class="consent-check"><input type="checkbox" id="consentInput"><span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>, and to Pluggo using my number to sign me in and keep my receipts.</span></label><p class="form-error" id="signInError" role="alert"></p><button type="submit" class="primary-button dialog-full" id="sendCode">Send code ${icon("arrow-up-right")}</button></form><div id="recaptchaBox"></div>`,
    { modal: false },
  );
  $("#phoneInput").focus();
  $("#phoneForm").onsubmit = async (event) => {
    event.preventDefault();
    const phone = normalizeIndianPhone($("#phoneInput").value);
    if (!phone) { $("#signInError").textContent = "Enter a valid 10-digit Indian mobile number."; return; }
    if (!$("#consentInput").checked) { $("#signInError").textContent = "Please agree to the Terms of Use and Privacy Policy to continue."; return; }
    const button = $("#sendCode");
    button.disabled = true;
    $("#signInError").textContent = "";
    try {
      await sendOtp(backendConfig.firebase, phone, $("#recaptchaBox"));
    } catch (error) {
      button.disabled = false;
      $("#signInError").textContent = friendlyAuthError(error);
      return;
    }
    $("#phoneForm").innerHTML = `<label for="codeInput">6-digit code sent to ${phone}</label><input id="codeInput" class="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required><p class="form-error" id="signInError" role="alert"></p><button type="submit" class="primary-button dialog-full" id="verifyCode">Verify and continue ${icon("check")}</button><button type="button" class="text-link" id="changeNumber">Use a different number</button>`;
    $("#codeInput").focus();
    $("#changeNumber").onclick = () => openSignIn(after);
    $("#phoneForm").onsubmit = async (submitEvent) => {
      submitEvent.preventDefault();
      const code = $("#codeInput").value.replace(/\D/g, "");
      if (code.length !== 6) { $("#signInError").textContent = "Enter the 6-digit code from the SMS."; return; }
      const verifyButton = $("#verifyCode");
      verifyButton.disabled = true;
      let token;
      try {
        token = await confirmOtp(code);
      } catch (error) {
        verifyButton.disabled = false;
        $("#signInError").textContent = friendlyAuthError(error);
        return;
      }
      const reply = await backendAction(verifyButton, () => customerApi.signIn(token), false);
      if (!reply) return;
      renderGarage();
      toast(`Signed in as ${account.phone || phone}.`);
      if (after) after();
      else $("#flowDialog").close();
    };
  };
}
let summaryPeriod = "month";
async function shareReceipt(session) {
  const station = stationById(session.station);
  const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(session.started));
  const text = [`Pluggo charging receipt ${session.receipt?.id || session.id}`, `${station.name} · ${session.connector}`, `${when} IST`,
    `Energy: ${session.energy.toFixed(2)} kWh`, `Total: ${currency(total(session))}`, `Paid: ${currency(paidAmount(session))}${session.receipt?.paymentId ? ` (Razorpay ${session.receipt.paymentId})` : ""}${refundedAmount(session) > 0 ? `, after ${currency(refundedAmount(session))} refunded` : ""}`].join("\n");
  try {
    if (navigator.share) { await navigator.share({ title: "Pluggo receipt", text }); return; }
    await navigator.clipboard.writeText(text);
    toast("Receipt copied.");
  } catch (error) {
    if (error?.name !== "AbortError") toast("Could not share the receipt.");
  }
}
function renderSessionSummary() {
  const summary = summarizeSessions(state.sessions,{period:summaryPeriod,cost:total});
  const periodLabel = {week:"this week",month:"this month",all:"across all time"}[summaryPeriod];
  $("#summaryCaption").textContent = `Completed charges ${periodLabel} · India time`;
  // Goals are monthly (Settings); scale them to the selected period.
  const firstEnded = Math.min(...state.sessions.map(item => Number(item.ended)).filter(n => n > 0), Date.now());
  const scale = summaryPeriod === "week" ? 7 / 30 : summaryPeriod === "month" ? 1 : Math.max(1, (Date.now() - firstEnded) / (30 * 864e5));
  const rings = [
    {key:"energy", label:"Energy", value:summary.energy, goal:prefs.energyGoal * scale, text:`${summary.energy.toFixed(1)} / ${Math.round(prefs.energyGoal * scale)} kWh`},
    {key:"spend", label:"Spend", value:summary.cost, goal:prefs.monthlyBudget * scale, text:`₹${Math.round(summary.cost)} / ₹${Math.round(prefs.monthlyBudget * scale)}`},
    {key:"charges", label:"Charges", value:summary.completed, goal:Math.max(1, Math.round(prefs.chargesGoal * scale)), text:`${summary.completed} / ${Math.max(1, Math.round(prefs.chargesGoal * scale))}`},
  ];
  const radii = [52, 38, 24];
  const ringSvg = rings.map((ring, index) => {
    const r = radii[index], c = 2 * Math.PI * r, ratio = ring.goal > 0 ? ring.value / ring.goal : 0;
    const shown = Math.min(1, ratio);
    return `<g class="ring ring-${ring.key}"><title>${ring.label}: ${ring.text} (${Math.round(ratio * 100)}%)</title><circle class="ring-track" cx="60" cy="60" r="${r}"/>${shown > 0 ? `<circle class="ring-fill" cx="60" cy="60" r="${r}" stroke-dasharray="${(shown * c).toFixed(2)} ${c.toFixed(2)}"/>` : ""}</g>`;
  }).join("");
  const legend = rings.map(ring => `<li><span class="ring-swatch ring-${ring.key}" aria-hidden="true"></span><span><small>${ring.label}</small><strong>${ring.text}</strong></span><span class="ring-percent">${Math.round(ring.goal > 0 ? ring.value / ring.goal * 100 : 0)}%</span></li>`).join("");
  const html = `<div class="activity-rings"><svg viewBox="0 0 120 120" role="img" aria-label="Energy, spend and charges against your goals">${ringSvg}</svg><ul class="ring-legend">${legend}</ul></div><div class="activity-strip"><span><small>Time on charger</small><strong>${chargingDuration(summary.minutes)}</strong></span><span><small>Paid</small><strong>${currency(summary.collected)}</strong></span><span><small>Average</small><strong>${summary.completed ? `₹${(summary.cost / summary.completed).toFixed(0)}` : "—"}</strong></span></div>`;
  if ($("#sessionSummaryCards").innerHTML !== html) $("#sessionSummaryCards").innerHTML = html;
  renderWeekChart();
  renderGreenImpact();
}
// Energy added per day for the last seven India days: one series, so no legend; the title names it.
function renderWeekChart() {
  const key = (value) => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date(value));
  const days = [...Array(7)].map((_, index) => {
    const date = new Date(Date.now() - (6 - index) * 864e5);
    return {key:key(date), label:new Intl.DateTimeFormat("en-IN",{weekday:"narrow",timeZone:"Asia/Kolkata"}).format(date), name:new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"numeric",month:"short",timeZone:"Asia/Kolkata"}).format(date), energy:0};
  });
  for (const item of state.sessions) if (Number(item.ended) > 0) { const day = days.find(d => d.key === key(Number(item.ended))); if (day) day.energy += Math.max(0, Number(item.energy) || 0); }
  const max = Math.max(...days.map(d => d.energy));
  const peak = max > 0 ? days.findIndex(d => d.energy === max) : -1;
  const bars = days.map((day, index) => {
    const height = max > 0 ? Math.max(day.energy > 0 ? 4 : 0, day.energy / max * 64) : 0;
    const x = 8 + index * 40;
    return `<g class="week-bar${index === 6 ? " is-today" : ""}" tabindex="0"><title>${day.name}: ${day.energy.toFixed(2)} kWh</title><rect class="week-hit" x="${x - 4}" y="0" width="32" height="96"/><rect class="week-base" x="${x}" y="76" width="24" height="2" rx="1"/>${height ? `<rect class="week-fill" x="${x}" y="${78 - height}" width="24" height="${height}" rx="4"/>` : ""}${index === peak ? `<text class="week-peak" x="${x + 12}" y="${70 - height}">${day.energy.toFixed(1)}</text>` : ""}<text class="week-day" x="${x + 12}" y="93">${day.label}</text></g>`;
  }).join("");
  const html = `<div class="week-head"><h3>Energy · last 7 days</h3><small>kWh per day</small></div><svg viewBox="0 0 288 98" role="img" aria-label="Energy added per day for the last seven days">${bars}</svg>`;
  if ($("#weekChart").innerHTML !== html) $("#weekChart").innerHTML = html;
}
document.querySelectorAll("[data-summary-period]").forEach(button => button.addEventListener("click", () => {
  summaryPeriod = button.dataset.summaryPeriod;
  document.querySelectorAll("[data-summary-period]").forEach(option => option.setAttribute("aria-pressed",String(option === button)));
  renderSessionSummary();
}));
function renderSessions() {
  $("#sessionDot").hidden = !activeSession() && !pendingSession();
  if (page !== "sessions") return;
  // An all-zero overview is noise: show it only once there is something to sum up.
  $("#sessionOverview").hidden = $("#sessionListLabel").hidden = !state.sessions.length;
  renderSessionSummary();
  // A charge in progress (or awaiting payment) is pinned above everything else.
  const live = activeSession() || pendingSession();
  $("#liveBanner").hidden = !live;
  if (live) {
    const html = `<button type="button" class="live-banner" data-session="${live.id}"><span class="live-pulse" aria-hidden="true"></span><span class="live-copy"><small>${live.ended ? "Payment due" : "Charging now"}</small><strong>${stationById(live.station).name}</strong><span>${Math.round(soc(live))}% · ${live.energy.toFixed(2)} kWh · ${currency(total(live))}</span></span><span class="live-action">${live.ended ? "Pay" : "Open"} ${icon("arrow-up-right")}</span></button>`;
    if ($("#liveBanner").innerHTML !== html) $("#liveBanner").innerHTML = html;
  }
  const monthName = (value) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
  let lastMonth = "";
  const listHtml = state.sessions.length
    ? state.sessions
        .map(
          (s) => {
            const month = monthName(s.started);
            const heading = month !== lastMonth ? `<h3 class="month-label">${month}</h3>` : "";
            lastMonth = month;
            return heading +
            `<article class="session-card"><span class="session-symbol">${icon(s.settled ? "receipt" : s.ended ? "check" : "bolt")}</span><div class="session-info"><p class="eyebrow">${s.settled ? `COMPLETED · ${currency(paidAmount(s))} PAID` : s.ended ? "PAYMENT DUE" : "CHARGING"}</p><h2>${stationById(s.station).name}</h2><p>${vehicles[s.vehicle].label} · ${s.connector} · ${s.energy.toFixed(2)} kWh<br>${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(s.started))} · ${s.reason || "Charging in progress"}</p>${!s.ended ? `<div class="session-bar"><span style="width:${(s.energy / energyLimit(s)) * 100}%"></span></div>` : ""}</div><div class="session-bill"><span class="session-cost-label">Bill</span><strong>${currency(total(s))}</strong><button class="secondary-button" data-session="${s.id}">${s.settled ? "View receipt" : s.ended ? "Pay now" : "View live session"} ${icon("arrow-up-right")}</button></div></article>`;
          },
        )
        .join("")
    : `<div class="empty-state session-empty">${icon("bolt")}<div><h2>No sessions yet.</h2><p>Your charges and receipts will appear here.</p></div><a href="#stations" class="primary-button">Find a station ${icon("arrow-up-right")}</a></div>`;
  if ($("#sessionList").innerHTML !== listHtml) $("#sessionList").innerHTML = listHtml;
}
function parseCode(raw) {
  const text = raw.trim();
  try {
    const url = new URL(text);
    if (["https:", "http:"].includes(url.protocol))
      return (
        url.searchParams.get("chargerId") ||
        url.pathname.split("/").filter(Boolean).pop() ||
        ""
      )
        .trim()
        .toUpperCase();
  } catch {}
  return text
    .replace(/^(?:PLUGGO|CHARGEFLOW):/i, "")
    .trim()
    .toUpperCase();
}
function openScanner(station) {
  showDialog(
    "SCAN / MANUAL VERIFICATION",
    `<h2 id="dialogTitle">Meet your connector.</h2><p class="dialog-subtitle">Scan the charger's QR or enter its code at ${station.name}. Camera access is optional.</p><video id="scanVideo" class="camera-video" autoplay playsinline muted hidden></video><button class="secondary-button dialog-full" id="startCamera">${icon("camera")} Start camera</button><p class="dialog-subtitle" id="cameraStatus" role="status"></p><form id="manualCodeForm"><label class="eyebrow" for="chargerCode">CHARGER CODE</label><div class="code-input"><input id="chargerCode" placeholder="e.g. ${station.connectors[0].id}" required maxlength="120" autocomplete="off"><button class="primary-button" type="submit">Verify ${icon("arrow-up-right")}</button></div></form><p id="codeError" class="form-error" role="alert"></p><p class="dialog-subtitle">Charger IDs: ${station.connectors.map((c) => c.id).join(" · ")}<br>Camera frames stay on your device.</p>${notice("Only available connectors compatible with your selected vehicle can start a demo charge.")}`,
  );
  async function verify(raw) {
    if (!localPreview) {
      try { await customerApi.verify({station:station.id,connector:parseCode(raw),vehicle:state.vehicle}); }
      catch (error) { $("#codeError").textContent=error.message; return false; }
    }
    const connector = station.connectors.find((c) => c.id === parseCode(raw));
    if (!connector) {
      $("#codeError").textContent =
        "Unknown code for this station. Check the ID printed on the charger.";
      return false;
    }
    if (
      !connector.available ||
      !vehicles[state.vehicle].connectors.includes(connector.type)
    ) {
      $("#codeError").textContent =
        "This connector is occupied or incompatible with your vehicle.";
      return false;
    }
    openSetup(station, connector);
    return true;
  }
  $("#manualCodeForm").onsubmit = (e) => {
    e.preventDefault();
    verify($("#chargerCode").value);
  };
  $("#startCamera").onclick = async () => {
    if (
      !("BarcodeDetector" in window) ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      $("#cameraStatus").textContent =
        "QR camera scanning is unavailable in this browser. Enter the charger code below.";
      return;
    }
    const button = $("#startCamera");
    button.disabled = true;
    const generation = cameraGeneration;
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      if (generation !== cameraGeneration) return;
      if (!supported.includes("qr_code")) throw new Error("QR unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (generation !== cameraGeneration || !$("#scanVideo")) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStream = stream;
      const video = $("#scanVideo");
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      $("#cameraStatus").textContent =
        "Camera active. Align the charger's QR code in the frame.";
      async function scan() {
        if (!mediaStream || !$("#scanVideo")) return;
        try {
          if (video.readyState >= 2) {
            const found = await detector.detect(video);
            if (found[0] && await verify(found[0].rawValue)) return;
          }
        } catch {}
        scannerFrame = setTimeout(scan, 500);
      }
      scan();
    } catch {
      if (generation !== cameraGeneration) return;
      if ($("#cameraStatus"))
        $("#cameraStatus").textContent =
          "Camera unavailable or permission denied. Enter the charger code below.";
      stopCamera();
      if (button.isConnected) button.disabled = false;
    }
  };
}
function stopCamera() {
  cameraGeneration++;
  clearTimeout(scannerFrame);
  mediaStream?.getTracks().forEach((t) => t.stop());
  mediaStream = null;
}
$("#resetDemo").onclick = () => {
  showDialog(
    "START FRESH",
    `<h2 id="dialogTitle">Start fresh?</h2><p class="dialog-subtitle">Clear your charging history and saved stations, including any active charge.</p><button id="confirmReset" class="primary-button dialog-full">Clear my history ${icon("reset")}</button>`,
  );
  $("#confirmReset").onclick = async () => {
    if (!localPreview) { const reply=await backendAction($("#confirmReset"),()=>customerApi.reset(),false); if(reply) { $("#flowDialog").close(); renderGarage(); location.hash="home"; toast("Your history has been cleared."); } return; }
    state = { vehicle: "car", saved: [], sessions: [] };
    save();
    $("#flowDialog").close();
    selectVehicle("car", false);
    renderSessions();
    location.hash = "home";
    toast("All cleared.");
  };
};
// The phone's reduce-motion setting (also switched on by many Android battery savers) only
// picks the default. An explicit choice in Settings always wins, so rotation can be turned back on.
let savedMotion = null;
try { savedMotion = localStorage.getItem("pluggo.preview-motion"); } catch {}
if (savedMotion !== null) animationAllowed = savedMotion === "true";
document.documentElement.dataset.motion = animationAllowed ? "on" : "off";
$("#previewMotion").checked = animationAllowed;
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", event => {
  if (savedMotion !== null) return;
  animationAllowed = !event.matches;
  document.documentElement.dataset.motion = animationAllowed ? "on" : "off";
  $("#previewMotion").checked = animationAllowed;
  sceneController?.setMotion(animationAllowed);
  if (event.matches) document.getAnimations().forEach(animation => animation.cancel());
});
$("#previewMotion").onchange = (event) => {
  animationAllowed = event.target.checked;
  document.documentElement.dataset.motion = animationAllowed ? "on" : "off";
  sceneController?.setMotion(animationAllowed);
  if (!animationAllowed) stopPluggoAnimation();
  try {
    localStorage.setItem("pluggo.preview-motion", String(animationAllowed));
    savedMotion = String(animationAllowed);
  } catch {}
};
// permanent = the 3D view cannot work here (no WebGL, lost context). A slow load is not permanent.
function useFallback(permanent = true) {
  clearTimeout(modelPosterTimer);
  // The still picture is only for phones that cannot show 3D; while 3D loads, a spinner shows instead.
  $("#vehicleStage").classList.add("poster-mode");
  if (permanent !== false) $("#stageLoading").hidden = true;
  $("#vehicleFallback").style.opacity = "1";
  $("#vehicleCanvas").classList.remove("model-ready");
  $("#vehicleFallback").hidden = false;
  $("#vehicleCanvas").hidden = true;
}
(performanceProfile === "poster" ? Promise.reject(new Error("Low-memory poster preview")) : import("./vehicle-scene.js?v=20261125-preload1"))
  .then(({ createShowroom }) => {
    sceneController = createShowroom(
      $("#vehicleCanvas"),
      () => useFallback(true),
      (status, id) => {
        if (id !== state.vehicle) return;
        const ready = status === "ready";
        clearTimeout(modelPosterTimer);
        // Swap only after the first 3D frame is drawn; overlapping poster/canvas
        // fades create double outlines as the continuously rotating model moves.
        clearTimeout(stageLoadingTimer);
        if (ready) $("#stageLoading").hidden = true;
        else stageLoadingTimer = setTimeout(() => { $("#stageLoading").hidden = false; }, 120);
        $("#vehicleFallback").style.opacity = "1";
        clearTimeout(posterHideTimer);
        // The picture stays under the fading-in 3D view and is removed once the 3D view is fully opaque.
        if (ready) posterHideTimer = setTimeout(() => { $("#vehicleFallback").hidden = true; }, 360);
        else $("#vehicleFallback").hidden = false;
        if (!ready) modelPosterTimer = setTimeout(() => useFallback(false), 30000);
        $("#vehicleCanvas").hidden = false;
        $("#vehicleCanvas").classList.toggle("model-ready", ready);
      },
    );
    Object.defineProperty(window, "pluggoPerformance", {
      configurable: true,
      value: () => sceneController.getStats(),
    });
    sceneController.setVehicle(state.vehicle);
    sceneController.setMotion(animationAllowed);
    sceneController.setShadowStrength(shadowStrength());
    sceneController.setVisible(page === "home" || page === "garage");
  })
  .catch(() => useFallback(true));
// ===== Bookings, alerts, ratings, fault reports, trips, wallet and green impact =================
const stars = (value) => `<span class="stars" role="img" aria-label="${value} out of 5 stars">${[1, 2, 3, 4, 5].map((n) => `<span class="${n <= Math.round(value) ? "on" : ""}" aria-hidden="true">★</span>`).join("")}</span>`;
const bandChip = (band) => tariff?.enabled ? `<span class="band-chip band-${band}">${BAND_NAMES[band] || band}</span>` : "";
const sessionDue = (s) => Number.isFinite(s.due) ? s.due : total(s);
const durationLabel = (minutes) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ""}`;
const HOLD_BEFORE = 15 * 60000, HOLD_AFTER = 10 * 60000;
let synced = false;
// Tells the driver about things that changed on the server: a finished charge, an expired booking,
// a resolved report or new wallet credit. A system notification when Pluggo is in the background.
function announceChanges(previous) {
  if (!synced) { synced = true; return; }
  const tell = (tag, title, message) => { if (document.hidden) notify(tag, title, message); else toast(message); };
  for (const s of state.sessions) {
    const before = previous.sessions.find((p) => p.id === s.id);
    if (before && !before.ended && s.ended) tell(`charge-${s.id}`, "Charging complete", `${s.energy.toFixed(2)} kWh added at ${stationById(s.station)?.name || "the station"}. ${currency(sessionDue(s))} to pay.`);
  }
  for (const b of bookings) {
    if (previous.bookings.find((p) => p.id === b.id)?.status === "booked" && b.status === "no-show")
      tell(`booking-${b.id}`, "Booking expired", `Your ${istTime(b.starts)} slot at ${stationById(b.station)?.name} was released because charging did not start.`);
  }
  for (const r of reports) {
    if (previous.reports.find((p) => p.id === r.id)?.status === "open" && r.status === "resolved")
      tell(`report-${r.id}`, "Your report was resolved", `${stationById(r.station)?.name}: ${r.resolution || "fixed"}.`);
  }
  for (const entry of wallet.history) {
    if (entry.amount > 0 && Date.now() - entry.created < 120000 && !previous.wallet.history.some((p) => p.id === entry.id))
      tell(`wallet-${entry.id}`, "Credit added", `${currency(entry.amount)} added to your Pluggo wallet. ${entry.reason}.`);
  }
}
// Alerts the phone can show on its own, even if Pluggo is closed: charge complete and booking reminders.
function scheduleAlerts() {
  const desired = new Map();
  for (const s of state.sessions) if (!s.ended && s.expectedEnd)
    desired.set(`charge-${s.id}`, { at: s.expectedEnd, title: "Charging complete", body: `Your ${vehicles[s.vehicle]?.name || "vehicle"} is charged at ${stationById(s.station)?.name}. Open Pluggo to pay.` });
  const b = activeBooking();
  if (b) desired.set(`booking-${b.id}`, { at: b.starts - HOLD_AFTER, title: `Your charging slot starts at ${istTime(b.starts)}`, body: `${stationById(b.station)?.name} · ${b.connector}. We hold the charger until ${istTime(b.starts + HOLD_AFTER)}.` });
  syncSchedule(desired);
}
function bookingCard(b) {
  const station = stationById(b.station);
  const ready = Date.now() >= b.starts - HOLD_BEFORE;
  return `<div class="booking-card"><span class="booking-icon">${icon("calendar")}</span><div class="booking-copy"><small>Booked · ${istDay(b.starts)} ${istTime(b.starts)}–${istTime(b.ends)}</small><strong>${station?.name || b.station}</strong><span>${b.connector} · ₹${rateText(b.rate)}/kWh ${bandChip(b.band)}</span></div><div class="booking-actions">${ready ? `<button type="button" class="primary-button" data-booking-start="${b.id}">Start ${icon("bolt")}</button>` : ""}<button type="button" class="secondary-button" data-booking-cancel="${b.id}">Cancel</button></div></div>`;
}
function renderHomeBooking() {
  const b = activeBooking();
  for (const el of [$("#homeBooking"), $("#sessionBooking")]) {
    if (!el) continue;
    el.hidden = !b;
    const html = b ? bookingCard(b) : "";
    if (el.innerHTML !== html) el.innerHTML = html;
  }
}
function openBooking(station, preferred = "") {
  if (localPreview) { toast("Booking needs the live Pluggo app."); return; }
  if (backendConfig.authRequired && !account.signedIn) { openSignIn(() => openBooking(stationById(station.id), preferred)); return; }
  if (activeBooking()) { toast("You already have a booking. Cancel it to book another slot."); return; }
  const v = vehicles[state.vehicle];
  const plugs = station.connectors.filter((c) => v.connectors.includes(c.type));
  if (!plugs.length) { toast("No charger here fits your vehicle."); return; }
  const slots = bookingSlots(Date.now());
  showDialog("BOOK A CHARGER", `<h2 id="dialogTitle">Book your slot.</h2><p class="dialog-subtitle">${station.name} · ${v.name}<br>We hold the charger from 15 minutes before your slot until 10 minutes after it starts. Booking is free.</p><form id="bookingForm"><fieldset class="connector-picker"><legend>Charger</legend>${plugs.map((c, i) => `<label class="connector-choice"><input type="radio" name="bookConnector" value="${c.id}" ${(preferred ? c.id === preferred : i === 0) ? "checked" : ""}><span><strong>${c.type}<span>${c.power} kW</span></strong><small>${c.id}${c.bookings?.length ? ` · ${c.bookings.length} booked slot${c.bookings.length === 1 ? "" : "s"} today` : " · no bookings yet"}</small></span></label>`).join("")}</fieldset><label class="field-label" for="bookingStart">Start</label><select id="bookingStart" class="field-select"></select><p class="field-label" id="bookingLengthLabel">How long</p><div class="duration-choice" role="radiogroup" aria-labelledby="bookingLengthLabel">${BOOKING_MINUTES.map((m) => `<label><input type="radio" name="bookMinutes" value="${m}" ${m === 60 ? "checked" : ""}><span>${durationLabel(m)}</span></label>`).join("")}</div><div class="bill-summary" id="bookingSummary"></div><button type="submit" class="primary-button dialog-full">Book this slot ${icon("calendar")}</button></form>`);
  const chosenConnector = () => station.connectors.find((c) => c.id === $("input[name=bookConnector]:checked")?.value) || plugs[0];
  function refresh() {
    const connector = chosenConnector(), minutes = Number($("input[name=bookMinutes]:checked")?.value || 60), previous = $("#bookingStart").value;
    const options = slots.map((slot) => {
      const start = slot.now ? Date.now() : slot.start;
      const taken = overlaps(start, minutes, connector.bookings) || (slot.now && !connector.available);
      return { value: slot.now ? "now" : String(slot.start), taken, label: `${slot.now ? "Now" : `${istDay(slot.start)} ${istTime(slot.start)}`} · ${BAND_NAMES[bandAt(start, tariff).band]}${taken ? " · taken" : ""}` };
    });
    $("#bookingStart").innerHTML = options.map((o) => `<option value="${o.value}" ${o.taken ? "disabled" : ""}>${o.label}</option>`).join("");
    const keep = options.find((o) => o.value === previous && !o.taken) || options.find((o) => !o.taken);
    if (keep) $("#bookingStart").value = keep.value;
    $("#dialogActions button")?.toggleAttribute("disabled", !keep);
    summarize();
  }
  function summarize() {
    const value = $("#bookingStart").value, start = value === "now" ? Date.now() : Number(value);
    if (!start) { $("#bookingSummary").innerHTML = notice("Every slot in the next 24 hours is taken on this charger. Try another charger."); return; }
    const minutes = Number($("input[name=bookMinutes]:checked")?.value || 60), band = bandAt(start, tariff).band;
    $("#bookingSummary").innerHTML = billRow("When", `${istDay(start)} ${istTime(start)}–${istTime(start + minutes * 60000)}`) + billRow("Rate at that time", `₹${rateText(rateAt(station.rate, start, tariff))} / kWh ${bandChip(band)}`) + billRow("Booking fee", "Free", "total");
  }
  $("#bookingForm").addEventListener("change", (event) => { if (event.target.id === "bookingStart") summarize(); else refresh(); });
  refresh();
  $("#bookingForm").onsubmit = async (event) => {
    event.preventDefault();
    const value = $("#bookingStart").value, start = value === "now" ? Date.now() : Number(value);
    const reply = await backendAction($("#dialogActions button"), () => customerApi.book({ station: station.id, connector: chosenConnector().id, vehicle: state.vehicle, start, minutes: Number($("input[name=bookMinutes]:checked").value) }));
    if (!reply) return;
    $("#flowDialog").close();
    toast(`Booked ${istDay(start).toLowerCase()} at ${istTime(start)}, ${station.name}.${alertsSupported() && !alertsOn() ? " Turn on charging alerts in Settings for a reminder." : ""}`);
  };
}
function openReview(station) {
  const mine = station.rating?.mine;
  showDialog("RATE THIS STATION", `<h2 id="dialogTitle">How was ${station.name}?</h2><form id="reviewForm"><div class="star-input" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="stars" value="${n}" ${mine?.rating === n ? "checked" : ""} required><span aria-hidden="true">★</span><span class="visually-hidden">${n} star${n === 1 ? "" : "s"}</span></label>`).join("")}</div><label class="field-label" for="reviewComment">Comment <small>(optional)</small></label><textarea id="reviewComment" class="field-text" maxlength="280" rows="3" placeholder="Was it easy to find? Did the charger work well?">${escapeText(mine?.comment || "")}</textarea><p class="dialog-subtitle">Other drivers see your stars and comment, never your name or number.</p><button type="submit" class="primary-button dialog-full">${mine ? "Update rating" : "Post rating"}</button></form>`);
  const paint = () => { const value = Number($("input[name=stars]:checked")?.value || 0); $$(".star-input label").forEach((label, i) => label.classList.toggle("on", i < value)); };
  $(".star-input").addEventListener("change", paint);
  paint();
  $("#reviewForm").onsubmit = async (event) => {
    event.preventDefault();
    const reply = await backendAction($("#dialogActions button"), () => customerApi.review(station.id, { rating: Number($("input[name=stars]:checked").value), comment: $("#reviewComment").value.trim() }));
    if (!reply) return;
    toast(`Thanks for rating ${station.name}.`);
    openStation(stationById(station.id));
  };
}
const REPORT_KINDS = [["not-working", "Charger is not working"], ["blocked", "Bay is blocked by another vehicle"], ["damaged", "Cable or plug is damaged"], ["payment", "Problem with payment or the bill"], ["other", "Something else"]];
function openReport(station, connectorId = "") {
  if (localPreview) { toast("Reporting needs the live Pluggo app."); return; }
  showDialog("REPORT A PROBLEM", `<h2 id="dialogTitle">What went wrong?</h2><p class="dialog-subtitle">${station.name}. The station operator sees your report straight away, and we tell you when it is fixed.</p><form id="reportForm"><fieldset class="connector-picker report-kinds"><legend class="visually-hidden">Problem</legend>${REPORT_KINDS.map(([kind, label], i) => `<label class="connector-choice"><input type="radio" name="reportKind" value="${kind}" ${i === 0 ? "checked" : ""}><span><strong>${label}</strong></span></label>`).join("")}</fieldset><label class="field-label" for="reportConnector">Charger</label><select id="reportConnector" class="field-select"><option value="">Whole station or not sure</option>${station.connectors.map((c) => `<option value="${c.id}" ${c.id === connectorId ? "selected" : ""}>${c.id} · ${c.type}</option>`).join("")}</select><label class="field-label" for="reportNote">Details <small>(optional)</small></label><textarea id="reportNote" class="field-text" maxlength="280" rows="3" placeholder="For example: the screen is blank"></textarea><button type="submit" class="primary-button dialog-full">Send report</button></form>`);
  $("#reportForm").onsubmit = async (event) => {
    event.preventDefault();
    const reply = await backendAction($("#dialogActions button"), () => customerApi.report({ station: station.id, connector: $("#reportConnector").value, kind: $("input[name=reportKind]:checked").value, note: $("#reportNote").value.trim() }));
    if (!reply) return;
    $("#flowDialog").close();
    toast("Thanks. The operator has been told, and we will let you know when it is fixed.");
  };
}
function openTrip() {
  if (localPreview) { toast("Trip planning needs the live Pluggo app."); return; }
  const v = vehicles[state.vehicle], level = Math.max(5, Math.round(batteryLevel(state.vehicle) / 5) * 5);
  // Rounded to about 100 m before it leaves the phone, as for the real-station search.
  const from = { lat: Math.round(origin.lat * 1000) / 1000, lng: Math.round(origin.lng * 1000) / 1000 };
  showDialog("PLAN A TRIP", `<h2 id="dialogTitle">Where to?</h2><p class="dialog-subtitle">From ${escapeText(origin.name)} in your ${v.name}. We find charging stops along the way.</p><form id="tripForm"><label class="field-label" for="tripTo">Destination city</label><input id="tripTo" class="field-text" list="tripCities" autocomplete="off" placeholder="For example: Jaipur" required><datalist id="tripCities">${CITIES.map((c) => `<option value="${c.name}"></option>`).join("")}</datalist><div class="slider-field"><label for="tripBattery">Battery now <output id="tripBatteryOut">${level}%</output></label><input id="tripBattery" type="range" min="5" max="100" step="5" value="${level}"></div><button type="submit" class="primary-button dialog-full">Plan charging stops ${icon("route")}</button></form><div id="tripResult" aria-live="polite"></div>`);
  $("#tripBattery").oninput = () => { $("#tripBatteryOut").textContent = `${$("#tripBattery").value}%`; };
  $("#tripForm").onsubmit = async (event) => {
    event.preventDefault();
    const to = findCity($("#tripTo").value);
    if (!to) { toast("Pick a city from the list."); return; }
    const button = $("#dialogActions button");
    button.disabled = true; button.setAttribute("aria-busy", "true");
    $("#tripResult").innerHTML = `<p class="dialog-subtitle">Finding chargers between here and ${to.name}…</p>`;
    try {
      const plan = await customerApi.trip({ fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng, vehicle: state.vehicle, battery: $("#tripBattery").value });
      $("#tripResult").innerHTML = tripResult(plan, from, to);
      $("#tripResult").scrollIntoView({ behavior: animationAllowed ? "smooth" : "auto", block: "start" });
    } catch (error) { $("#tripResult").innerHTML = notice(escapeText(error.message)); }
    finally { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } }
  };
}
function tripResult(plan, from, to) {
  const stops = plan.stops || [];
  const head = billRow("Distance by road", `~${Math.round(plan.distanceKm)} km`) + billRow("Driving", `~${chargingDuration(plan.driveMinutes)}`) + billRow("Charging stops", stops.length ? `${stops.length} · ${chargingDuration(plan.chargeMinutes)}` : "None needed") + (stops.length ? billRow("Charging cost", `~${currency(plan.chargeCostEstimate)}`) : "") + (plan.feasible ? billRow(`Arrive in ${to.name} with`, `${Math.round(plan.arrivalBattery)}%`, "total") : "");
  const list = stops.map((s, i) => `<li><span class="trip-index">${i + 1}</span><div><strong>${escapeText(s.name)}</strong><small>${escapeText(s.address || "")}</small><span>${Math.round(s.legKm)} km on · arrive ${Math.round(s.arriveBattery)}% · charge to ${Math.round(s.leaveBattery)}% in ~${chargingDuration(s.minutes)}</span><span class="trip-meta">${s.network === "pluggo" ? "Pluggo station" : `Public charger · ${s.powerKnown ? `${Math.round(s.powerKW)} kW` : "power not listed, assumed 7.4 kW"}`} · ~${currency(s.costEstimate)}</span><a class="text-link" href="${stationDirections(s)}" target="_blank" rel="noopener noreferrer">Directions ${icon("arrow-up-right")}</a></div></li>`).join("");
  return `<h3 class="trip-heading">${plan.feasible ? `Your trip to ${to.name}` : "We could not plan this trip"}</h3>${plan.feasible ? "" : notice(escapeText(plan.note))}<div class="bill-summary">${head}</div>${list ? `<ol class="trip-stops">${list}</ol>` : ""}${plan.feasible ? `<a class="secondary-button dialog-full" href="${tripMapsLink(from, to, stops)}" target="_blank" rel="noopener noreferrer">Open the route in Google Maps ${icon("arrow-up-right")}</a>` : ""}<p class="green-note">${escapeText(plan.assumptions)}</p>`;
}
function renderGreenImpact() {
  const g = greenImpact(state.sessions, { period: summaryPeriod, cost: total });
  const html = g.energy > 0 ? `<div class="week-head"><h3>${icon("leaf")} Green impact</h3><small>vs a similar petrol vehicle</small></div><div class="green-grid"><span><small>CO₂ avoided</small><strong>${g.co2Avoided.toFixed(1)} kg</strong></span><span><small>Petrol saved</small><strong>${g.litres.toFixed(1)} L</strong></span><span><small>Money saved</small><strong>${currency(Math.max(0, g.saved))}</strong></span><span><small>Distance powered</small><strong>${Math.round(g.km)} km</strong></span></div><p class="green-note">About ${g.treeYears.toFixed(1)} tree-years of CO₂ absorption. Assumes petrol at ₹95/L (2.31 kg CO₂/L) and India's grid at 0.71 kg CO₂/kWh.</p>` : "";
  $("#greenImpact").hidden = !html;
  if ($("#greenImpact").innerHTML !== html) $("#greenImpact").innerHTML = html;
}
function renderSettingsExtras() {
  if (!$("#walletButton")) return;
  $("#walletButton").hidden = localPreview;
  $("#walletSummary").textContent = wallet.balance > 0 ? `${currency(wallet.balance)} credit · used automatically at checkout` : "No credit yet";
  $("#reportsButton").hidden = !reports.length;
  const open = reports.filter((r) => r.status === "open").length;
  $("#reportsSummary").textContent = open ? `${open} open · we will tell you when ${open === 1 ? "it is" : "they are"} fixed` : `${reports.length} resolved`;
  $("#alertsRow").hidden = !alertsSupported();
  $("#chargingAlerts").checked = alertsOn();
}
const KIND_LABELS = Object.fromEntries(REPORT_KINDS);
const when = (ms) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(ms));
$("#walletButton").onclick = () => showDialog("PLUGGO WALLET", `<div class="receipt-symbol">${icon("wallet")}</div><h2 id="dialogTitle">${currency(wallet.balance)}</h2><p class="dialog-subtitle">Credit from Pluggo, for example after a faulty charger. It pays for your next charges automatically at checkout.</p>${wallet.history.length ? `<div class="bill-summary wallet-history">${wallet.history.map((h) => billRow(`${escapeText(h.reason)}<small>${when(h.created)}</small>`, `${h.amount > 0 ? "+" : "−"}${currency(Math.abs(h.amount))}`)).join("")}</div>` : notice("No credit yet.")}`);
$("#reportsButton").onclick = () => showDialog("REPORTED PROBLEMS", `<h2 id="dialogTitle">Your reports</h2><div class="bill-summary wallet-history">${reports.map((r) => billRow(`${KIND_LABELS[r.kind] || r.kind}<small>${stationById(r.station)?.name || r.station}${r.connector ? ` · ${r.connector}` : ""} · ${when(r.created)}${r.status === "resolved" && r.resolution ? ` · ${escapeText(r.resolution)}` : ""}</small>`, r.status === "open" ? "Open" : `Resolved${r.credit > 0 ? ` · +${currency(r.credit)}` : ""}`)).join("")}</div>`);
$("#chargingAlerts").addEventListener("change", async (event) => {
  if (!event.target.checked) { disableAlerts(); toast("Charging alerts are off."); return; }
  const granted = await enableAlerts();
  event.target.checked = granted;
  if (!granted) { toast("Notifications are blocked. Allow them for Pluggo in your phone or browser settings."); return; }
  scheduleAlerts();
  toast("Charging alerts are on.");
});
$("#openTripPlanner").onclick = openTrip;
// Settings is a short menu; each section opens as its own page with a back arrow (#settings/<section>).
const SETTINGS_SECTIONS = {
  Account: ["account", "shield", "Phone sign-in and your data"],
  Appearance: ["appearance", "settings", "Language, style and motion"],
  "Charging & payment": ["charging", "bolt", "Defaults, budgets, wallet and alerts"],
  Advanced: ["maps", "map", "Google Maps search"],
  About: ["about", "receipt", "Help, privacy, terms and credits"],
};
(function buildSettingsMenu() {
  const root = $("#page-settings .garage-settings");
  const labels = [...root.querySelectorAll(":scope > h2.list-label")];
  const menu = document.createElement("nav");
  menu.className = "settings-group settings-menu";
  menu.setAttribute("aria-label", "Settings sections");
  for (const label of labels) {
    const title = label.textContent.trim();
    const [id, iconName, summary] = SETTINGS_SECTIONS[title] || [title.toLowerCase().replace(/\W+/g, "-"), "settings", ""];
    const section = document.createElement("section");
    section.className = "settings-sub";
    section.dataset.sub = id;
    section.hidden = true;
    section.innerHTML = `<header class="settings-sub-head"><a href="#settings" class="icon-button" aria-label="Back to Settings">${icon("back")}</a><h2>${title}</h2></header>`;
    label.before(section);
    // Move the heading and everything up to the next heading into the section.
    let node = label;
    while (node && !(node !== label && node.matches?.("h2.list-label, .app-version"))) { const following = node.nextElementSibling; section.append(node); node = following; }
    const link = document.createElement("a");
    link.className = "settings-row settings-link";
    link.href = `#settings/${id}`;
    link.dataset.settingsLink = id;
    link.innerHTML = `<span class="settings-link-icon">${icon(iconName)}</span><span>${title}<small>${summary}</small></span><span class="settings-chevron" aria-hidden="true">›</span>`;
    if (id === "account") link.hidden = label.hidden;
    menu.append(link);
  }
  root.prepend(menu);
})();
function showSettingsPage(id) {
  const known = id && $(`.settings-sub[data-sub="${id}"]`);
  $$(".settings-sub").forEach((section) => { section.hidden = section.dataset.sub !== id; });
  $(".settings-menu").hidden = !!known;
  $(".app-version").hidden = !!known;
  $("#page-settings").toggleAttribute("data-sub", !!known);
}
// Home: "Where to charge?" opens the station search; the suggestion tiles are one-tap shortcuts.
$("#whereTo").addEventListener("click", (event) => {
  event.preventDefault();
  location.hash = "stations";
  setTimeout(() => $("#stationSearch")?.focus(), 350);
});
document.querySelectorAll("[data-quick]").forEach((tile) => tile.addEventListener("click", () => {
  const nearest = () => stations.filter((s) => compatible(s, state.vehicle)).sort((a, b) => distance(a, origin) - distance(b, origin))[0];
  ({
    charge: () => $("#homeStartCharging").click(),
    book: () => { const station = nearest(); if (station) openBooking(station); else toast("No Pluggo station fits your vehicle yet."); },
    trip: openTrip,
    wallet: () => localPreview ? toast("The wallet needs the live Pluggo app.") : $("#walletButton").click(),
  })[tile.dataset.quick]();
}));
document.addEventListener("click", async (event) => {
  const start = event.target.closest("[data-booking-start]");
  if (start) {
    const b = bookings.find((item) => item.id === start.dataset.bookingStart), station = b && stationById(b.station);
    if (station) openSetup(station, station.connectors.find((c) => c.id === b.connector));
  }
  const cancel = event.target.closest("[data-booking-cancel]");
  if (cancel && await backendAction(cancel, () => customerApi.cancelBooking(cancel.dataset.bookingCancel))) toast("Booking cancelled.");
  const extra = event.target.closest("[data-station-action]");
  if (extra) {
    const station = stationById(extra.dataset.stationId);
    ({ book: () => openBooking(station), rate: () => openReview(station), report: () => openReport(station) })[extra.dataset.stationAction]?.();
  }
});
let hiddenTicks = 0;
const tick = setInterval(() => {
  if (document.hidden) {
    // In a background browser tab, check every 20 s so a finished charge can still raise an alert.
    if (!localPreview && alertsOn() && (activeSession() || activeBooking()) && ++hiddenTicks % 20 === 0) refreshBackend();
    return;
  }
  if (!localPreview) { if (!document.hidden) refreshBackend(); return; }
  const current = activeSession();
  if (current) {
    const completed = updateSession(current);
    if (completed) {
      save();
      toast("Your charge is complete. Continue to payment.");
    }
    renderSessions();
    renderHomeWidgets();
    updateSessionDialog();
  }
}, 1000);
window.addEventListener("pagehide", () => {
  stopCamera();
  const s = activeSession();
  if (s) updateSession(s);
  save();
});
document.addEventListener("visibilitychange", () => {
  document.documentElement.dataset.visibility = document.hidden ? "hidden" : "visible";
  sceneController?.setVisible(!document.hidden && (page === "home" || page === "garage"));
  if (document.hidden) { stopCamera(); stopPluggoAnimation(); }
  else {
    if (!localPreview) { refreshBackend(); return; }
    state.sessions.forEach((s) => updateSession(s));
    renderSessions();
    renderHomeWidgets();
    updateSessionDialog();
    save();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key !== storageKey || !localPreview) return;
  try {
    const incoming = JSON.parse(event.newValue);
    if (!incoming) return;
    state.sessions = Array.isArray(incoming.sessions)
      ? incoming.sessions.filter(validSession)
      : [];
    state.saved = Array.isArray(incoming.saved)
      ? incoming.saved.filter((id) => stations.some((s) => s.id === id))
      : [];
    if ($("#flowDialog").open) $("#flowDialog").close();
    renderVehicle();
    renderSessions();
    renderStations();
  } catch {}
});
renderVehicle();
renderGarage();
renderStations();
renderSessions();
renderMap();
navigate();
loadMaps();
if (localPreview) backendStatus(false);
else { showSavedServer(); refreshBackend(); }
if (!storageOkay)
  setTimeout(
    () =>
      toast(
        localPreview ? "Browser storage is unavailable. Your preview may not survive a reload." : "Local preference caching is unavailable. Connected history is stored by the server.",
      ),
    600,
  );
