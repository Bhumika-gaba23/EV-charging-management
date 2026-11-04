import { summarizeSessions, chargingDuration } from "./session-summary.js?v=20261104-summary1";
import { performanceProfile } from "./performance-profile.js?v=20261104-summary1";
import { CustomerApi } from "./customer-api.js?v=20261104-server9";
import { findGoogleStations } from "./google-stations.js?v=20261104-server9";
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
let origin = { lat: 28.6315, lng: 77.2167, device: false };
let filters = { available: false, saved: false, search: "", sort: "distance" };
let page = "home";
let dialogSession = null;
let toastTimer;
let sceneController;
let modelPosterTimer;
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
  $("#connectionMode").textContent = localPreview ? "PREVIEW DEMO" : connected ? "SERVER DEMO" : "OFFLINE";
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
  for (const [id,profile] of Object.entries(payload.catalog.vehicles)) if (Object.hasOwn(vehicles,id)) Object.assign(vehicles[id],profile);
  state.sessions = payload.state.sessions;
  if (!keepPreferences) { state.vehicle = payload.state.vehicle; state.saved = payload.state.saved; lastPreferences = JSON.stringify({vehicle:state.vehicle,saved:state.saved}); }
  backendStatus(true);
  if (catalogChanged || oldVehicle !== state.vehicle) { renderVehicle(); renderStations(); renderMap(); }
  if (oldVehicle !== state.vehicle) { renderGarage(); sceneController?.setVehicle(state.vehicle); }
  renderHomeWidgets();
  if (oldSessions !== JSON.stringify(state.sessions)) { renderSessions(); updateSessionDialog(); }
  window.pluggoBackend = {connected:true,storage:payload.backend.storage,simulationMode:payload.backend.simulationMode,simulatorConnected:payload.backend.simulatorConnected};
}
async function refreshBackend() {
  if (localPreview || backendSyncing || backendMutations || preferencePending) return;
  backendSyncing = true;
  const revision = backendRevision;
  try {
    const initial = !backendReady;
    const payload = initial ? await customerApi.bootstrap() : await customerApi.state();
    if (revision !== backendRevision) return;
    backendReady = true; applyBackend(payload,false);
  } catch (error) {
    if (error.status === 401) backendReady = false;
    backendStatus(false,error.status === 503 ? "The local charging server is offline. Start it, then retry." : "Cannot reach the charging server. Your server history will return when it reconnects.");
    window.pluggoBackend = {connected:false,error:error.message};
  } finally { backendSyncing = false; }
}
async function backendAction(button, operation, keepPreferences = true) {
  if (!backendReady || !backendConnected) { toast("Connect to the charging server before continuing."); return null; }
  backendMutations++; backendRevision++;
  const html = button?.innerHTML;
  if (button) { button.disabled=true; button.setAttribute("aria-busy","true"); }
  try { const payload = await operation(); applyBackend(payload,keepPreferences); return payload; }
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
  return `<article class="station-card"><div class="station-card-top"><div><h3>${station.name}</h3><p class="station-area">${station.area} · ${distance(station, origin).toFixed(1)} km away</p></div><button class="save-button" data-save="${station.id}" aria-label="${state.saved.includes(station.id) ? "Unsave" : "Save"} ${station.name}" aria-pressed="${state.saved.includes(station.id)}">${icon("bookmark")}</button></div><span class="station-status ${count ? "" : "busy"}"><span class="status-pip"></span>${count ? `${count} compatible plug${count === 1 ? "" : "s"} available` : "Compatible plugs in use"}</span><p class="station-connectors">${[...new Set(plugs.map((c) => c.type))].join(" · ")} · up to ${Math.max(...plugs.map((c) => c.power))} kW</p><div class="station-card-bottom"><span class="rate">₹${station.rate} <small>/ kWh · demo</small></span><button class="secondary-button" data-station="${station.id}" aria-label="View ${station.name}">View station ${icon("arrow-up-right")}</button></div></article>`;
}
function updateLens() {
  const selected = $(".glass-nav a[aria-current]");
  if (!selected) return;
  const lens = $(".nav-lens");
  lens.style.transform = `translate3d(${selected.offsetLeft}px, 0, 0)`;
  lens.style.width = `${selected.offsetWidth}px`;
}
function navigate() {
  const next = location.hash.slice(1) || "home";
  page = ["home", "stations", "sessions", "garage"].includes(next)
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
  sceneController?.setVisible(page === "home");
  if (page === "stations") {
    renderStations();
    renderMap();
    if (!locationRequested) { locationRequested = true; requestDeviceLocation(); }
  }
  if (page === "sessions") renderSessions();
  if (page === "garage" && stationSource === "real") $("#mapSettings").open = true;
  window.scrollTo({ top: 0, behavior: "instant" });
  animatePage($("#page-" + page));
  $("#vehicleDropdown").open = false;
  if (page === "home") { renderHomeWidgets(); playPluggoAnimation(); }
  else stopPluggoAnimation();
  document.title = `Pluggo — ${{ home: "Your next charge, closer.", stations: "Find your spot", sessions: "Your charging story", garage: "My garage" }[page]}`;
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
  const vehicle = vehicles[state.vehicle];
  const session = state.sessions.find(item => item.vehicle === state.vehicle);
  const level = Math.min(100, Math.max(0, session ? soc(session) : 25));
  const charging = !!session && !session.ended;
  const power = charging ? session.power : 0;
  $("#homeBatteryValue").replaceChildren(document.createTextNode(String(Math.round(level))), Object.assign(document.createElement("span"), {textContent:"%"}));
  $("#homeBatteryCapacity").textContent = `${(level / 100 * vehicle.capacity).toFixed(1)} of ${vehicle.capacity} kWh`;
  $("#homeBatteryProgress").value = level;
  $("#homeBatteryProgress").textContent = `${Math.round(level)}%`;
  $("#homePowerValue").replaceChildren(document.createTextNode(String(power)), Object.assign(document.createElement("span"), {textContent:" kW"}));
  $("#homePowerStatus").textContent = charging ? "Simulated charging session" : `Up to ${vehicle.power} kW · demo`;
}
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
  $("#mapCaption").textContent = "Demo availability · not live";
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
  $("#stationSelection").innerHTML = `<div class="station-sheet-handle" aria-hidden="true"></div><div class="station-sheet-heading"><span class="sheet-station-icon">${icon("station")}</span><div><h2>${station.name}</h2><p>${station.area} · Demo station</p></div><span class="sheet-distance">${distance(station, origin).toFixed(1)} km</span></div><div class="sheet-availability"><span class="availability-dot ${free ? "" : "busy"}" aria-hidden="true"></span>${free ? `${free} compatible plug${free === 1 ? "" : "s"} available` : "Compatible plugs in use"}</div><dl class="station-sheet-stats"><div><dt>Power</dt><dd>${Math.max(...plugs.map(connector => connector.power))} kW</dd></div><div><dt>Plugs</dt><dd>${free} / ${plugs.length}</dd></div><div><dt>Demo tariff</dt><dd>₹${station.rate}/kWh</dd></div></dl><div class="station-sheet-actions"><button class="primary-button" data-station="${station.id}" aria-label="View ${station.name}">View chargers</button><a href="${stationDirections(station)}" target="_blank" rel="noopener noreferrer" class="secondary-button">Directions ↗</a></div>`;
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
  selectedStationId = station.id;
  renderStations();
}
const sheetResizeObserver = new ResizeObserver(entries => {
  const height = $("#stationSelection").getBoundingClientRect().height;
  $("#page-stations").style.setProperty("--station-sheet-height", `${height}px`);
});
sheetResizeObserver.observe($("#stationSelection"));
function renderGarage() {
  $("#garageVehicles").innerHTML = Object.entries(vehicles)
    .map(
      ([id, v]) =>
        `<button class="garage-vehicle" data-vehicle="${id}" aria-pressed="${state.vehicle === id}"><span class="pill">${state.vehicle === id ? "SELECTED" : "DEMO PROFILE"}</span><img src="${v.image}" alt="White ${v.label.toLowerCase()}" loading="lazy"><h2>${v.name}</h2><p>${v.capacity} kWh · ${v.power} kW<br>${v.connectors.join(" / ")} · demo profile</p></button>`,
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
    `<h2 id="dialogTitle">Designed by talented people.</h2><p class="dialog-subtitle">These vehicles are visual previews. Battery sizes and connectors are fictional demo profiles.</p><div class="credits-list"><h3>Tesla Model 3 (2024)</h3><p>Model by RBLXSupercars; download-page uploader brandonleong28. <a href="https://sketchfab.com/3d-models/2024-tesla-model-3-fd22be415215453693d67e33aa7812d0" target="_blank" rel="noopener noreferrer">Original source · CC BY 4.0</a>. Downloaded from the credited public copy in erictfree/Carbon-Footprint-AI-Visualizer. This is an independent visualization, not a Tesla-endorsed app.</p><h3>Urban scooter</h3><p>Original unbranded model by Innerscene. <a href="https://www.innerscene.com/tools/library/3d-parts/urban-motor-scooter-9dd945f9" target="_blank" rel="noopener noreferrer">Source · CC0</a>.</p><h3>Pluggo Cargo</h3><p>Original Pluggo design: an enclosed electric delivery three-wheeler, built for this project. Battery and charging specifications are simulated.</p><h3>Concept motorcycle</h3><p>Cyberpunk Bike Concept Design by Berk Gedik, via Objaverse and Renderlyst. <a href="https://sketchfab.com/3d-models/99290272e69d4cd8a56af2d2e1274e0d" target="_blank" rel="noopener noreferrer">Source · CC BY 4.0</a>.</p><p>Models adapted for Pluggo: simplified geometry, reduced textures, white finishes and preview images. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 terms</a>.</p></div>`,
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
function reportLocation(message) {
  locationMessage.hidden = false;
  locationMessage.textContent = message;
  locationMessage.title = message;
}
$("#useLocation").onclick = requestDeviceLocation;
function requestDeviceLocation() {
  if (locationPending) return;
  locationRequested = true;
  if (!navigator.geolocation) {
    reportLocation(
      "Location unavailable · browsing demo stations in New Delhi.",
    );
    return;
  }
  const button = $("#useLocation");
  locationPending = true;
  button.disabled = true;
  button.innerHTML = icon("locate");
  button.setAttribute("aria-busy", "true");
  reportLocation("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      origin = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        device: true,
      };
      reportLocation(
        stationSource === "real" ? "Using your location · Google charger search." : "Using your device location · demo distances are straight-line.",
      );
      renderVehicle();
      renderStations();
      renderMap();
      streetMap?.setView([origin.lat, origin.lng], 13);
      googleMap?.setCenter({lat: origin.lat, lng: origin.lng});
      if (stationSource === "real") { realPlaces = []; realSearchState = "idle"; ++realSearchGeneration; renderRealStations(); renderRealMap(); showRealNotice("Location updated. Search nearby to find chargers around you."); }
      toast(
        "Location updated.",
      );
      finish();
    },
    () => {
      reportLocation(
        "Location blocked or unavailable · allow it in browser settings, or search a city.",
      );
      finish();
    },
    { timeout: 12000, maximumAge: 60000 },
  );
  function finish() {
    locationPending = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.innerHTML = icon("locate");
  }
};
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
    L.control.zoom({position: "topright"}).addTo(streetMap);
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
      icon: L.divIcon({className: "street-marker", html: `<span class="street-marker-core ${free ? "" : "busy"} ${clustered ? "cluster" : ""}">${clustered ? group.length : icon("bolt")}${!clustered ? `<i class="pin-availability-dot ${free ? "" : "busy"}" aria-hidden="true"></i>` : ""}</span>`, iconSize: [44, 44], iconAnchor: [22, 22]}),
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
    $("#mapModeLabel").textContent = "GOOGLE MAPS · DEMO STATIONS";
    googleMarkers.forEach((m) => (m.map = null));
    googleMarkers = [];
    for (const station of list) {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: googleMap,
        position: { lat: station.lat, lng: station.lng },
        title: station.name + (available(station, state.vehicle) ? " · Available" : " · In use") + " · fictional demo station",
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
$("#openMapSettings").onclick = () => { location.hash = "garage"; $("#mapSettings").open = true; };
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
    toast("Tab storage is unavailable; use the illustrated map for this demo.");
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
      "Google Maps could not load. Check key restrictions, Maps JavaScript API and billing. The illustrated demo is still available.";
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
    const link = document.createElement("a"); link.href = "#garage"; link.textContent = "Open Map settings ↗"; panel.append(link);
  }
}
function setStationSource(source) {
  stationSource = source; ++realSearchGeneration; realPlaces = []; realSearchState = "idle";
  if (origin.device) reportLocation(source === "real" ? "Using your location · Google charger search." : "Using your device location · demo distances are straight-line.");
  $("#realStationSearch").disabled = false; $("#realStationSearch").textContent = "Search nearby";
  $("#stationSelection").removeAttribute("aria-busy");
  $("#demoStationSource").setAttribute("aria-pressed", String(source === "demo"));
  $("#realStationSource").setAttribute("aria-pressed", String(source === "real"));
  $("#availableFilter").hidden = source === "real";
  $("#realStationSearch").hidden = source === "demo";
  $(".map-legend").hidden = source === "real";
  $(".map-interaction-hint").hidden = source === "real";
  $(".demo-tag").textContent = source === "real" ? "Google Places" : "Demo stations";
  $("#stationSearch").value = ""; filters.search = "";
  $("#stationSearch").placeholder = source === "real" ? "City, area, or charger name" : "Search a demo station or locality";
  $("#realStationNotice").hidden = source === "demo";
  if (source === "real") {
    showRealNotice(googleMap && !mapsFailed ? "Search chargers within 5 km of your location, or enter a city or station name. Live plug availability is not provided." : "Google charger search needs a configured API key. Enable Maps JavaScript API, Places API (New), and billing in My garage.", !googleMap || mapsFailed);
  }
  renderStations(); renderMap();
}
$("#demoStationSource").onclick = () => setStationSource("demo");
$("#realStationSource").onclick = () => setStationSource("real");
$("#stationSearchForm").onsubmit = async event => {
  event.preventDefault();
  if (stationSource !== "real") return;
  if (!googleMap || mapsFailed) { showRealNotice("Configure Google Maps before searching for real chargers.", true); return; }
  if (locationPending) { showRealNotice("Waiting for your location. You can enter a city or area if location is unavailable."); return; }
  if (!origin.device && !$("#stationSearch").value.trim()) { showRealNotice("Allow location or enter a city or locality so the search knows where to look."); return; }
  const token = ++realSearchGeneration, button = $("#realStationSearch");
  button.disabled = true; button.textContent = "Searching…";
  $("#stationSelection").setAttribute("aria-busy", "true");
  realPlaces = []; realSearchState = "loading"; renderRealMap(); renderRealStations();
  showRealNotice("Searching Google Places for charging stations…");
  try {
    const found = await findGoogleStations(google, {query: $("#stationSearch").value, origin});
    if (token !== realSearchGeneration || stationSource !== "real") return;
    realPlaces = found; realSearchState = "done"; renderRealStations(); renderRealMap();
    showRealNotice(found.length ? "Google Places results. Check connector support, prices and availability with the operator. Demo charging is available in the Demo charging tab." : "No chargers found. Try a nearby city, locality or charger name.");
  } catch {
    if (token === realSearchGeneration && stationSource === "real") { realSearchState = "error"; renderRealStations(); showRealNotice("Google charger search failed. Check Places API (New), key restrictions, billing and quota, then try again.", true); }
  } finally {
    if (token === realSearchGeneration) {
      button.disabled = false; button.textContent = "Search nearby";
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
  $("#resultCount").textContent = realSearchState === "idle" ? "Search for real chargers" : realSearchState === "loading" ? "Searching Google Places…" : `${realPlaces.length} real charging stations`;
  $("#mapCaption").textContent = "Google Places · availability unknown";
  $("#mapEmpty").hidden = true;
  $("#stationSelection").hidden = false;
  if (!realPlaces.some(place => place.id === selectedPlaceId)) selectedPlaceId = realPlaces[0]?.id || null;
  const place = realPlaces.find(place => place.id === selectedPlaceId);
  if (!place) {
    $("#stationSelection").innerHTML = `<div class="station-sheet-handle" aria-hidden="true"></div><h2>Find a real charger.</h2><p class="sheet-empty-copy">${realSearchState === "loading" ? "Searching Google Places…" : realSearchState === "done" ? "No chargers found. Try a city or charger name." : "Search nearby or enter a city above. Real search needs a Google Maps key."}</p><a href="#garage" class="secondary-button">Map settings ↗</a>`;
    return;
  }
  $("#stationSelection").innerHTML = `<div class="station-sheet-handle" aria-hidden="true"></div><div class="station-sheet-heading"><span class="sheet-station-icon">${icon("station")}</span><div><h2>${escapeText(place.displayName || "Charging station")}</h2><p>${escapeText(place.formattedAddress)}</p></div></div><p class="sheet-availability"><span class="availability-dot unknown" aria-hidden="true"></span>Availability and pricing not provided</p><a class="primary-button real-station" href="${escapeText(placeMapsLink(place))}" target="_blank" rel="noopener noreferrer">View in Google Maps ↗</a>`;
}
function renderRealMap() {
  if (streetMarkers) streetMarkers.clearLayers();
  googleMarkers.forEach(marker => marker.map = null); googleMarkers = [];
  if (!googleMap || mapsFailed) return;
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
    '#chargePlan button[type="submit"], #sessionActions > button, #completePayment, #confirmReset, #selectCharger, #receiptDone',
  );
  if (!candidate) return;
  if (candidate.form?.id) candidate.setAttribute("form", candidate.form.id);
  $("#dialogActions").replaceChildren(candidate);
  $("#dialogActions").hidden = false;
}
function showDialog(eyebrow, html) {
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
  const wasOpen = dialog.open;
  if (!wasOpen) dialog.showModal();
  const body = $("#dialogBody");
  body.getAnimations().forEach(animation => {if(animation.id === "dialog-step")animation.cancel();});
  if (wasOpen && animationAllowed && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const animation = body.animate([{opacity:.25,transform:"translateY(7px)"},{opacity:1,transform:"none"}],{duration:260,easing:"cubic-bezier(.22,1,.36,1)"});
    animation.id = "dialog-step";
  }
  body.scrollTop = 0;
}
$("#closeDialog").onclick = () => $("#flowDialog").close();
$("#flowDialog").addEventListener("close", () => {
  stopCamera();
  dialogSession = null;
  document.body.classList.remove("dialog-open");
  sceneController?.setVisible(page === "home" && !document.hidden);
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
  `<p class="dialog-note">${icon("flask")}<span>${message}</span></p>`;
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
  showDialog(
    "DEMO STATION · NEW DELHI",
    `<h2 id="dialogTitle">${station.name}</h2><p class="dialog-subtitle">${station.area} · ${distance(station, origin).toFixed(1)} km straight-line distance</p><div class="detail-tariff"><div><strong>₹${station.rate}</strong><small> / kWh</small></div><span><span class="availability-dot ${ready.length ? "" : "busy"}" aria-hidden="true"></span> ${ready.length} compatible plug${ready.length === 1 ? "" : "s"} available<br>Demo tariff · no extra fees</span></div><fieldset class="connector-picker"><legend>Charger for your ${v.name}</legend>${station.connectors.map((c) => `<label class="connector-choice ${supported(c) && c.available ? "" : "unavailable"}"><input type="radio" name="connector" value="${c.id}" data-connector="${c.id}" ${c === ready[0] ? "checked" : ""} ${supported(c) && c.available ? "" : "disabled"}><span><strong>${c.type}<span>${c.power} kW</span></strong><small><span class="availability-dot ${!supported(c) ? "unknown" : c.available ? "" : "busy"}" aria-hidden="true"></span> ${c.id} · ${!supported(c) ? "Incompatible with selected vehicle" : c.available ? "Available" : "In use"}</small></span></label>`).join("")}</fieldset><div class="amenities">${station.amenities.map((a) => `<span class="pill">${a}</span>`).join("")}</div><div class="dialog-links"><button class="text-link" id="scanConnector">${icon("qr")} Scan or enter code</button><a href="${destination}" target="_blank" rel="noopener noreferrer" class="text-link">Google Maps directions ${icon("arrow-up-right")}</a></div>${notice("Fictional demo station · not a real charging destination.")}<button id="selectCharger" class="primary-button dialog-full" ${ready.length ? "" : "disabled"}>Select charger ${icon("arrow-up-right")}</button>`,
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
      "Finish your current charge or demo checkout before starting another.",
    );
    return;
  }
  showDialog(
    "YOUR CHARGE, YOUR WAY",
    `<h2 id="dialogTitle">A little more ready.</h2><p class="dialog-subtitle">${station.name} · ${connector.id} · ${v.label}<br>Starting at a simulated 25% battery.</p><form id="chargePlan"><div class="slider-field"><label for="chargeTarget">Charge target <output id="targetOutput">80%</output></label><input id="chargeTarget" type="range" min="30" max="100" step="5" value="80"></div><div class="slider-field"><label for="chargeBudget">Budget cap <output id="budgetOutput">₹300</output></label><input id="chargeBudget" type="range" min="50" max="1000" step="50" value="300"></div><p class="dialog-subtitle">Stops at your target or budget, whichever comes first.</p><div class="bill-summary" id="chargeEstimate"></div>${notice("60× demo speed · no physical charger connected.")}<button type="submit" class="primary-button dialog-full">Start simulated charging ${icon("bolt")}</button></form>`,
  );
  function estimate() {
    const target = Number($("#chargeTarget").value),
      budget = Number($("#chargeBudget").value),
      power = Math.min(v.power, connector.power);
    const energy = Math.min(
      ((target - 25) / 100) * v.capacity,
      budget / station.rate,
    );
    $("#targetOutput").textContent = `${target}%`;
    $("#budgetOutput").textContent = `₹${budget}`;
    $("#chargeEstimate").innerHTML =
      billRow("Energy to add", `${energy.toFixed(2)} kWh`) +
      billRow("Charging power", `${power} kW`) +
      billRow(
        "Demo duration (60×)",
        `~${Math.ceil((energy / power) * 60)} seconds`,
      ) +
      billRow("Estimated demo bill", currency(energy * station.rate)) +
      billRow("Real amount charged", "₹0.00", "total");
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
      ? "DEMO RECEIPT"
      : ended
        ? "CHARGE COMPLETE"
        : "LIVE SESSION / 60× DEMO SPEED",
    `<h2 id="dialogTitle">${station.name}</h2><p class="dialog-subtitle">${session.connector} · ${vehicles[session.vehicle].label}</p>${!session.settled ? `<img class="session-vehicle-preview" src="${vehicles[session.vehicle].image}" alt="${vehicles[session.vehicle].name}">` : ""}${session.settled ? `<div class="receipt-hero"><div class="receipt-symbol">${icon("check")}</div><h3>Demo payment completed</h3><div class="receipt-amount"><small>ACTUAL AMOUNT COLLECTED</small><strong>₹0.00</strong></div><p>No real money was charged.</p></div>` : ""}<div class="charge-ring" id="chargeRing" ${session.settled ? "hidden" : ""}><div>${icon(session.settled ? "check" : ended ? "receipt" : "bolt")}<strong id="liveSoc">${soc(session).toFixed(0)}%</strong><small>SIMULATED BATTERY</small></div></div><div class="bill-summary" id="sessionSummary"></div>${session.settled ? `<details class="receipt-details"><summary>Session details</summary>${billRow("Charging power used", `${session.power} kW`)}${billRow("Completed", session.reason)}<p class="receipt-id">${session.receipt?.id || session.id}<br>${new Intl.DateTimeFormat("en-IN", {dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(session.started))} IST<br>Demo receipt · not a tax invoice</p></details>` : ""}<div id="sessionActions"></div>${session.settled ? "" : notice("Simulated battery and energy · no real payment.")}`,
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
        "Simulated charging time",
        (s.energy > 0 && (s.energy / s.power) * 60 < 1) ? "Less than 1 min" : `${Math.floor((s.energy / s.power) * 60)} min`,
      ) +
      billRow("Demo total", currency(total(s))) +
      billRow("Amount collected", "₹0.00", "total")
    : `<div><span>Energy added</span><strong>${s.energy.toFixed(2)}<small> kWh</small></strong></div><div><span>Charging time</span><strong>${Math.floor((s.energy / s.power) * 60)}<small> min</small></strong></div><div><span>Demo cost</span><strong>${currency(total(s))}</strong></div><p class="charge-context">${s.ended ? s.reason : `${s.power} kW · 60× simulation`} · Target ${s.target}%</p>`;
  if (s.settled) {
    $("#sessionActions").innerHTML =
      `<button id="receiptDone" class="primary-button dialog-full">Back to sessions</button>`;
    $("#receiptDone").onclick = () => {
      $("#flowDialog").close();
      location.hash = "sessions";
    };
  } else if (s.ended) {
    $("#dialogEyebrow").textContent = "CHARGE COMPLETE";
    $("#sessionActions").innerHTML =
      `<button class="primary-button dialog-full" id="checkoutButton">Continue to demo checkout ${icon("arrow-up-right")}</button>`;
    $("#checkoutButton").onclick = () => openCheckout(s);
  } else {
    if (!$("#stopCharge")) {
      $("#sessionActions").innerHTML =
        `<p class="dialog-subtitle">60× demo speed. Charging continues if you leave this page.</p><button class="secondary-button dialog-full" id="stopCharge">${icon("stop")} Stop demo charging</button>`;
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
function openCheckout(s) {
  if (!s.ended) return;
  showDialog(
    "DEMO CHECKOUT / NO PAYMENT GATEWAY",
    `<div class="receipt-symbol">${icon("shield")}</div><h2 id="dialogTitle">All charged.<br>No real charges.</h2><p class="dialog-subtitle">Your demo session is complete.</p><div class="bill-summary">${billRow("Station", stationById(s.station).name)}${billRow("Energy delivered", `${s.energy.toFixed(2)} kWh`)}${billRow("Demo bill", currency(total(s)))}${billRow("Amount collected", "₹0.00", "total")}</div>${notice("Demo checkout · no payment details required.")}<button class="primary-button dialog-full" id="completePayment">Complete demo payment · ₹0 ${icon("check")}</button>`,
  );
  $("#completePayment").onclick = async () => {
    if (!localPreview) { const reply=await backendAction($("#completePayment"),()=>customerApi.checkout(s.id)); if(reply) openSession(state.sessions.find(item=>item.id===s.id)); return; }
    s.settled = true;
    save();
    renderSessions();
    openSession(s);
    toast("Demo payment complete. ₹0 collected.");
  };
}
let summaryPeriod = "month";
function renderSessionSummary() {
  const summary = summarizeSessions(state.sessions,{period:summaryPeriod,cost:total});
  const periodLabel = {week:"this week",month:"this month",all:"across all time"}[summaryPeriod];
  $("#summaryCaption").textContent = `Completed charges ${periodLabel} · India time`;
  const html = `<article class="summary-stat"><span>Estimated spend</span><strong>${currency(summary.cost)}</strong><small>${currency(summary.collected)} actually collected</small></article><article class="summary-stat"><span>Energy added</span><strong>${summary.energy.toFixed(2)}<small> kWh</small></strong><small>Across completed charges</small></article><article class="summary-stat"><span>Charging time</span><strong>${chargingDuration(summary.minutes)}</strong><small>Simulated duration</small></article><article class="summary-stat"><span>Completed sessions</span><strong>${summary.completed}</strong><small>${summary.completed === 1 ? "One charge finished" : "Charges finished"}</small></article>`;
  if ($("#sessionSummaryCards").innerHTML !== html) $("#sessionSummaryCards").innerHTML = html;
}
document.querySelectorAll("[data-summary-period]").forEach(button => button.addEventListener("click", () => {
  summaryPeriod = button.dataset.summaryPeriod;
  document.querySelectorAll("[data-summary-period]").forEach(option => option.setAttribute("aria-pressed",String(option === button)));
  renderSessionSummary();
}));
function renderSessions() {
  $("#sessionDot").hidden = !activeSession() && !pendingSession();
  if (page !== "sessions") return;
  renderSessionSummary();
  $("#sessionList").innerHTML = state.sessions.length
    ? state.sessions
        .map(
          (s) =>
            `<article class="session-card"><span class="session-symbol">${icon(s.settled ? "receipt" : s.ended ? "check" : "bolt")}</span><div class="session-info"><p class="eyebrow">${s.settled ? "COMPLETED · ₹0 PAID" : s.ended ? "CHECKOUT READY" : "CHARGING · DEMO"}</p><h2>${stationById(s.station).name}</h2><p>${vehicles[s.vehicle].label} · ${s.connector} · ${s.energy.toFixed(2)} kWh<br>${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(s.started))} · ${s.reason || "Simulated charging in progress"}</p>${!s.ended ? `<div class="session-bar"><span style="width:${(s.energy / energyLimit(s)) * 100}%"></span></div>` : ""}</div><div class="session-bill"><span class="session-cost-label">Demo bill</span><strong>${currency(total(s))}</strong><button class="secondary-button" data-session="${s.id}">${s.settled ? "View receipt" : s.ended ? "Demo checkout" : "View live session"} ${icon("arrow-up-right")}</button></div></article>`,
        )
        .join("")
    : `<div class="empty-state session-empty">${icon("bolt")}<div><h2>No sessions yet.</h2><p>Your charges and receipts will appear here.</p></div><a href="#stations" class="primary-button">Explore demo stations ${icon("arrow-up-right")}</a></div>`;
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
    `<h2 id="dialogTitle">Meet your connector.</h2><p class="dialog-subtitle">Scan a demo QR or enter a code at ${station.name}. Camera access is optional.</p><video id="scanVideo" class="camera-video" autoplay playsinline muted hidden></video><button class="secondary-button dialog-full" id="startCamera">${icon("camera")} Start camera</button><p class="dialog-subtitle" id="cameraStatus" role="status"></p><form id="manualCodeForm"><label class="eyebrow" for="chargerCode">CHARGER CODE</label><div class="code-input"><input id="chargerCode" placeholder="e.g. ${station.connectors[0].id}" required maxlength="120" autocomplete="off"><button class="primary-button" type="submit">Verify ${icon("arrow-up-right")}</button></div></form><p id="codeError" class="form-error" role="alert"></p><p class="dialog-subtitle">Demo codes: ${station.connectors.map((c) => c.id).join(" · ")}<br>Camera frames stay on your device.</p>${notice("Only available connectors compatible with your selected vehicle can start a demo charge.")}`,
  );
  async function verify(raw) {
    if (!localPreview) {
      try { await customerApi.verify({station:station.id,connector:parseCode(raw),vehicle:state.vehicle}); }
      catch (error) { $("#codeError").textContent=error.message; return false; }
    }
    const connector = station.connectors.find((c) => c.id === parseCode(raw));
    if (!connector) {
      $("#codeError").textContent =
        "Unknown code for this station. Try one of the listed demo IDs.";
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
        "QR camera scanning is unavailable in this browser. Enter a demo code below.";
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
        "Camera active. Align a demo QR code in the frame.";
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
          "Camera unavailable or permission denied. Enter a demo code below.";
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
    `<h2 id="dialogTitle">Ready for another run?</h2><p class="dialog-subtitle">Clear your demo sessions and saved stations, including any active simulated charge.</p><button id="confirmReset" class="primary-button dialog-full">Reset this demonstration ${icon("reset")}</button>`,
  );
  $("#confirmReset").onclick = async () => {
    if (!localPreview) { const reply=await backendAction($("#confirmReset"),()=>customerApi.reset(),false); if(reply) { $("#flowDialog").close(); renderGarage(); location.hash="home"; toast("Your server demo has been reset."); } return; }
    state = { vehicle: "car", saved: [], sessions: [] };
    save();
    $("#flowDialog").close();
    selectVehicle("car", false);
    renderSessions();
    location.hash = "home";
    toast("A fresh demo is ready.");
  };
};
try {
  const savedMotion = localStorage.getItem("pluggo.preview-motion");
  if (
    savedMotion !== null &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    animationAllowed = savedMotion === "true";
} catch {}
document.documentElement.dataset.motion = animationAllowed ? "on" : "off";
$("#previewMotion").checked = animationAllowed;
$("#previewMotion").disabled = matchMedia("(prefers-reduced-motion: reduce)").matches;
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", event => {
  const enabled = animationAllowed && !event.matches;
  document.documentElement.dataset.motion = enabled ? "on" : "off";
  $("#previewMotion").checked = enabled;
  $("#previewMotion").disabled = event.matches;
  sceneController?.setMotion(enabled);
  if (event.matches) document.getAnimations().forEach(animation => animation.cancel());
});
$("#previewMotion").onchange = (event) => {
  animationAllowed = event.target.checked;
  document.documentElement.dataset.motion = animationAllowed ? "on" : "off";
  sceneController?.setMotion(animationAllowed);
  if (!animationAllowed) stopPluggoAnimation();
  try {
    localStorage.setItem("pluggo.preview-motion", String(animationAllowed));
  } catch {}
};
function useFallback() {
  clearTimeout(modelPosterTimer);
  $("#vehicleFallback").style.opacity = "1";
  $("#vehicleCanvas").classList.remove("model-ready");
  $("#vehicleFallback").hidden = false;
  $("#vehicleCanvas").hidden = true;
}
(performanceProfile === "poster" ? Promise.reject(new Error("Low-memory poster preview")) : import("./vehicle-scene.js?v=20261104-summary1"))
  .then(({ createShowroom }) => {
    sceneController = createShowroom(
      $("#vehicleCanvas"),
      useFallback,
      (status, id) => {
        if (id !== state.vehicle) return;
        const ready = status === "ready";
        clearTimeout(modelPosterTimer);
        // Swap only after the first 3D frame is drawn; overlapping poster/canvas
        // fades create double outlines as the continuously rotating model moves.
        $("#vehicleFallback").hidden = ready;
        $("#vehicleFallback").style.opacity = "1";
        if (!ready) modelPosterTimer = setTimeout(useFallback, 12000);
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
    sceneController.setVisible(page === "home");
  })
  .catch(useFallback);
const tick = setInterval(() => {
  if (document.hidden) return;
  if (!localPreview) { if (!document.hidden) refreshBackend(); return; }
  const current = activeSession();
  if (current) {
    const completed = updateSession(current);
    if (completed) {
      save();
      toast("Your demo charge is complete. Continue to the ₹0 checkout.");
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
  sceneController?.setVisible(!document.hidden && page === "home");
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
else refreshBackend();
if (!storageOkay)
  setTimeout(
    () =>
      toast(
        localPreview ? "Browser storage is unavailable. Your preview may not survive a reload." : "Local preference caching is unavailable. Connected history is stored by the server.",
      ),
    600,
  );
