const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const api = window.chargeFlowApi;
let apiOnline = false;

const themeToggle = $("#themeToggle");

function setTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("chargeflow-theme", nextTheme);
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  themeToggle.setAttribute("aria-label", `Switch to ${nextTheme === "dark" ? "light" : "dark"} mode`);
  themeToggle.querySelector(".theme-icon").textContent = nextTheme.toUpperCase();
}

setTheme(document.documentElement.dataset.theme);
themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

const vehicleProfiles = {
  car: { label:"EV CAR", min:20, max:150, capacity:60, connector:"CCS2" },
  bike: { label:"EV BIKE", min:2, max:15, capacity:7, connector:"Type 2" },
  scooter: { label:"EV SCOOTER", min:1, max:8, capacity:4, connector:"Type 2" }
};

function applyVehicleType(type, closeLanding = true) {
  const profile = vehicleProfiles[type] || vehicleProfiles.car;
  $("#selectedVehicleLabel").textContent = profile.label;
  const capacity = $("#capacity");
  capacity.min = profile.min;
  capacity.max = profile.max;
  capacity.value = profile.capacity;
  $("#capacityOut").textContent = profile.capacity;
  $("#connector").value = profile.connector;
  document.body.dataset.vehicle = type;
  localStorage.setItem("chargeflow-vehicle", type);
  if (closeLanding) {
    setAppMode("driver");
    $("#vehicleLanding").classList.add("hidden");
    document.body.classList.remove("onboarding-open");
    toast(`${profile.label} profile loaded.`);
  }
}

function setAppMode(mode) {
  const nextMode = mode === "operator" ? "operator" : "driver";
  document.body.dataset.mode = nextMode;
  localStorage.setItem("voltway-mode", nextMode);
  $("#brandModeLabel").textContent = nextMode === "driver" ? "DRIVER CHARGE" : "CONTROL GRID";
  $(".command-kicker").textContent = nextMode === "driver" ? "VOLTWAY / DRIVER" : "VOLTWAY / OPERATIONS";
  $(".operator-profile strong").textContent = nextMode === "driver" ? "EV Driver" : "Station Operator";
  $(".operator-profile small").textContent = nextMode === "driver" ? "PERSONAL ACCOUNT" : "CONTROL LEVEL 2";
  $(".operator-profile>span").textContent = nextMode === "driver" ? "DR" : "OP";
  const target = nextMode === "driver" ? "charge" : "overview";
  document.querySelector(`.nav-item[data-target="${target}"]`).click();
}

const savedVehicle = localStorage.getItem("chargeflow-vehicle");
if (savedVehicle && vehicleProfiles[savedVehicle]) {
  applyVehicleType(savedVehicle, false);
}
document.body.classList.add("onboarding-open");
$$('.vehicle-choice').forEach(choice => choice.addEventListener('click', () => applyVehicleType(choice.dataset.vehicle)));
$("#driverEntry").addEventListener("click", () => {
  $("#driverEntry").classList.add("active");
  $("#operatorEntry").classList.remove("active");
  $(".vehicle-prompt").scrollIntoView({ behavior:"smooth", block:"center" });
});
$("#operatorEntry").addEventListener("click", () => {
  setAppMode("operator");
  $("#vehicleLanding").classList.add("hidden");
  document.body.classList.remove("onboarding-open");
  toast("Operator console ready.");
});
$("#switchMode").addEventListener("click", () => {
  $("#vehicleLanding").classList.remove("hidden");
  document.body.classList.add("onboarding-open");
});
$("#vehicleTypeButton").addEventListener("click", () => {
  $("#vehicleLanding").classList.remove("hidden");
  document.body.classList.add("onboarding-open");
});

const fallback = {
  slots: [
    { id:"A1",status:"occupied",vehicle:"KA 01 EV 1001",soc:72,connector:"CCS2",source:"Solar + grid fallback" },
    { id:"A2",status:"occupied",vehicle:"KA 05 MX 2077",soc:44,connector:"CCS2",source:"Grid" },
    { id:"B1",status:"occupied",vehicle:"KA 03 AT 9012",soc:89,connector:"Type 2",source:"Solar" },
    { id:"B2",status:"available",vehicle:"",soc:0,connector:"CHAdeMO",source:"Grid" }
  ],
  queue: [
    { id:"REQ-1",rank:1,registration:"AMB EV 04",soc:8,emergency:true,priority:1340 },
    { id:"REQ-2",rank:2,registration:"KA 04 NX 8821",soc:12,emergency:false,priority:290 },
    { id:"REQ-3",rank:3,registration:"KA 02 EV 3105",soc:31,emergency:false,priority:55 }
  ]
};

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2800);
}

function setApiStatus(online) {
  apiOnline = online;
  let status = $(".api-status");
  if (!status) {
    status = document.createElement("span");
    status.className = "api-status";
    $(".station-card div").append(status);
  }
  status.classList.toggle("online", online);
  status.textContent = online ? "C++ API CONNECTED" : "DEMO MODE";
  const headerState = $(".header-system-state");
  headerState.classList.toggle("online", online);
  $("#headerApiStatus").textContent = online ? "C++ API ONLINE" : "DEMO MODE";
}

function updateClock() {
  const now = new Date();
  $("#clock").textContent = now.toLocaleTimeString("en-IN", { hour12:false });
  $("#headerClock").textContent = now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:false });
  $("#today").textContent = now.toLocaleDateString("en-IN", { day:"2-digit",month:"short",year:"numeric" }).toUpperCase();
}

function renderSlots(slots) {
  const host = $(".slot-list");
  host.innerHTML = slots.map(slot => {
    const available = slot.status === "available";
    const solar = String(slot.source).toLowerCase().includes("solar");
    return `<div class="slot-row ${available ? "muted" : ""}" style="--charge:${slot.soc}%">
      <span class="slot-number">${slot.id}</span>
      <div class="vehicle"><strong>${available ? "AVAILABLE" : slot.vehicle}</strong><small>${slot.connector} / ${slot.status.toUpperCase()}</small></div>
      <div class="charge-bar"><i style="width:${slot.soc}%"></i></div>
      <strong>${available ? "READY" : `${slot.soc}%`}</strong>
      <span class="source ${available ? "ready" : solar ? "solar" : "grid"}">${available ? "READY" : solar ? "SOLAR" : "GRID"}</span>
    </div>`;
  }).join("");
}

function renderQueue(items) {
  fallback.queue = items;
  $("#queueList").innerHTML = items.map(item => `<div class="queue-item">
    <span class="queue-rank">${String(item.rank).padStart(2,"0")}</span>
    <div><strong>${item.registration}</strong><small>${item.id} / PRIORITY ${Math.round(item.priority)}</small></div>
    <span>${item.soc}% SoC</span>
    <span class="priority ${item.emergency || item.soc < 20 ? "high" : ""}">${item.emergency ? "EMERGENCY" : item.soc < 20 ? "URGENT" : "NORMAL"}</span>
  </div>`).join("");
  $("#queueCount").textContent = String(items.length).padStart(2,"0");
}

async function refreshStation() {
  try {
    const data = await api.station();
    renderSlots(data.slots);
    $("#activePower").textContent = data.activePowerKW.toFixed(1);
    $("#solarShare").innerHTML = `${data.solarShare}<small>%</small>`;
    setApiStatus(true);
  } catch {
    renderSlots(fallback.slots);
    setApiStatus(false);
  }
}

async function refreshQueue() {
  try { renderQueue((await api.queue()).items); }
  catch { renderQueue(fallback.queue); }
}

$$('.nav-item').forEach(button => button.addEventListener('click', () => {
  $$('.nav-item').forEach(item => item.classList.remove('active'));
  $$('.panel').forEach(panel => panel.classList.remove('active-panel'));
  button.classList.add('active');
  $(`#${button.dataset.target}`).classList.add('active-panel');
  const titles = { charge:"Find a charger", session:"My charging session", history:"History & support", overview:"Station overview", schedule:"Plan a charge", queue:"Waiting queue", energy:"Energy usage", emergency:"Emergency control" };
  $("#currentViewTitle").textContent = titles[button.dataset.target] || "VoltWay";
  window.scrollTo({ top:0, behavior:'smooth' });
}));

let pendingCharge = null;
const actionModal = $("#actionModal");

function openChargeConfirmation(button) {
  const card = button.closest(".charger-card");
  pendingCharge = { bay:button.dataset.bay, power:button.dataset.power, price:button.dataset.price, connector:card.dataset.connector };
  $("#actionTitle").textContent = `Start at bay ${pendingCharge.bay}?`;
  $("#confirmConnector").textContent = pendingCharge.connector;
  $("#confirmPower").textContent = `${pendingCharge.power} kW`;
  $("#confirmPrice").textContent = `₹${pendingCharge.price}/kWh`;
  $("#connectedCheck").checked = false;
  $("#confirmStart").disabled = true;
  actionModal.classList.add("open");
  actionModal.setAttribute("aria-hidden", "false");
  $("#connectedCheck").focus();
}

function closeActionModal() {
  actionModal.classList.remove("open");
  actionModal.setAttribute("aria-hidden", "true");
}

$$('.start-charge').forEach(button => button.addEventListener('click', () => openChargeConfirmation(button)));
$("#connectedCheck").addEventListener("change", event => { $("#confirmStart").disabled = !event.target.checked; });
$("#closeAction").addEventListener("click", closeActionModal);
actionModal.addEventListener("click", event => { if (event.target === actionModal) closeActionModal(); });
$("#confirmStart").addEventListener("click", () => {
  if (!pendingCharge || !$("#connectedCheck").checked) return;
  $("#sessionBay").textContent = pendingCharge.bay;
  $("#sessionPower").textContent = pendingCharge.power;
  $("#sessionEmpty").hidden = true;
  $("#activeSession").hidden = false;
  localStorage.setItem("voltway-active-session", JSON.stringify(pendingCharge));
  closeActionModal();
  document.querySelector('.nav-item[data-target="session"]').click();
  toast(`Charging started at ${pendingCharge.bay}. Payment authorized successfully.`);
});
$("#changePayment").addEventListener("click", () => toast("Payment methods: UPI •••• 2841 is selected."));
$("#driverConnector").addEventListener("change", event => {
  $$(".charger-card").forEach(card => { card.hidden = event.target.value !== "all" && card.dataset.connector !== event.target.value; });
});
$$('.join-queue').forEach(button => button.addEventListener('click', () => {
  button.textContent = "QUEUE POSITION 1";
  button.disabled = true;
  toast(`Added to the ${button.dataset.bay} queue. Estimated wait: 18 minutes.`);
}));
$$('.report-fault').forEach(button => button.addEventListener('click', () => toast(`Issue for ${button.dataset.bay} has been sent to the station team.`)));
$$('.go-find').forEach(button => button.addEventListener('click', () => document.querySelector('.nav-item[data-target="charge"]').click()));
$("#notifyToggle").addEventListener("click", event => { event.currentTarget.textContent = "NOTIFICATION SET FOR 75% ✓"; toast("We will notify you when your battery reaches 75%."); });
$("#stopCharge").addEventListener("click", () => {
  if (!window.confirm("Stop charging now? Your final amount will be calculated and charged to the selected payment method.")) return;
  $("#activeSession").hidden = true;
  $("#sessionEmpty").hidden = false;
  localStorage.removeItem("voltway-active-session");
  toast("Charging stopped. Final invoice: ₹151.");
});
$$('.invoice-button').forEach(button => button.addEventListener('click', () => toast("Invoice prepared for download.")));
$("#supportIssue").addEventListener("click", () => toast("Support request opened. The station team will respond shortly."));
$("#callSupport").addEventListener("click", () => toast("Support number: 1800 123 8658"));
$("#getDirections").addEventListener("click", () => toast("Directions ready: GreenRoute Central is 1.2 km away."));
$(".operator-profile").addEventListener("click", () => toast(document.body.dataset.mode === "driver" ? "Signed in · Saved vehicle and UPI payment active." : "Operator account · Control level 2."));

try {
  const active = JSON.parse(localStorage.getItem("voltway-active-session"));
  if (active?.bay) {
    pendingCharge = active;
    $("#sessionBay").textContent = active.bay;
    $("#sessionPower").textContent = active.power;
    $("#sessionEmpty").hidden = true;
    $("#activeSession").hidden = false;
  }
} catch { localStorage.removeItem("voltway-active-session"); }

$("#notificationButton").addEventListener("click", event => {
  event.currentTarget.classList.remove("header-notice");
  void event.currentTarget.offsetWidth;
  event.currentTarget.classList.add("header-notice");
  toast("2 notices: Solar output is above target. Slot B2 is available.");
});

let scannerStream = null;
let scannerFrameRequest = null;
let barcodeDetector = null;
let lastDetectionAt = 0;

function chargerIdFromScan(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("charger") || url.searchParams.get("chargerId");
    if (fromQuery) return fromQuery.toUpperCase();
    return url.pathname.split("/").filter(Boolean).pop().toUpperCase();
  } catch {
    return value.replace(/^CHARGEFLOW:/i, "").split(/[\/]/).filter(Boolean).pop().toUpperCase();
  }
}

function scannerMessage(message, state = "") {
  const status = $("#scannerStatus");
  status.className = `scanner-status ${state}`;
  status.lastChild.textContent = ` ${message}`;
}

async function verifyCharger(rawValue) {
  const chargerId = chargerIdFromScan(rawValue);
  if (!chargerId) return scannerMessage("Enter or scan a charger ID.", "error");
  scannerMessage(`Verifying charger ${chargerId}...`, "scanning");
  try {
    const data = apiOnline ? await api.charger(chargerId) : fallback.slots.find(slot => slot.id === chargerId);
    if (!data) throw new Error("Charger not found");
    stopScanner();
    scannerMessage(`${chargerId} verified and ready for selection.`, "success");
    const result = $("#scannerResult");
    const available = data.available ?? data.status === "available";
    result.hidden = false;
    result.innerHTML = `<strong>Charger ${chargerId} / ${available ? "Available" : "Currently occupied"}</strong><small>${data.connector} / ${data.maximumPowerKW || data.powerKW || "--"} kW / ${data.source}</small><button id="useScannedCharger" type="button">USE THIS CHARGER</button>`;
    $("#useScannedCharger").addEventListener("click", () => {
      document.body.dataset.selectedCharger = chargerId;
      closeScanner();
      document.querySelector('.nav-item[data-target="schedule"]').click();
      toast(`Charger ${chargerId} selected for the next charging plan.`);
    });
  } catch (error) { scannerMessage(error.message || "Unable to verify this charger.", "error"); }
}

async function detectionLoop(timestamp) {
  if (!scannerStream || !barcodeDetector) return;
  if (timestamp - lastDetectionAt > 280 && $("#scannerVideo").readyState >= 2) {
    lastDetectionAt = timestamp;
    try {
      const codes = await barcodeDetector.detect($("#scannerVideo"));
      if (codes.length) { await verifyCharger(codes[0].rawValue); return; }
    } catch { /* Continue scanning transient camera frames. */ }
  }
  scannerFrameRequest = requestAnimationFrame(detectionLoop);
}

async function startScanner() {
  if (!navigator.mediaDevices?.getUserMedia) return scannerMessage("Camera scanning is unavailable. Enter the charger code below.", "error");
  if (!("BarcodeDetector" in window)) return scannerMessage("QR detection is unsupported in this browser. Enter the charger code below.", "error");
  try {
    barcodeDetector = new BarcodeDetector({ formats:["qr_code"] });
    scannerStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false });
    const video = $("#scannerVideo");
    video.srcObject = scannerStream;
    await video.play();
    $(".scanner-viewport").classList.add("streaming");
    $("#startScanner").disabled = true;
    scannerMessage("Scanning for a charger QR code...", "scanning");
    scannerFrameRequest = requestAnimationFrame(detectionLoop);
  } catch (error) {
    scannerMessage(error.name === "NotAllowedError" ? "Camera permission was declined. Use the manual charger code." : "The camera could not start. Use the manual charger code.", "error");
  }
}

function stopScanner() {
  if (scannerFrameRequest) cancelAnimationFrame(scannerFrameRequest);
  scannerFrameRequest = null;
  if (scannerStream) scannerStream.getTracks().forEach(track => track.stop());
  scannerStream = null;
  $("#scannerVideo").srcObject = null;
  $(".scanner-viewport").classList.remove("streaming");
  $("#startScanner").disabled = false;
}

function openScanner() {
  $("#scannerModal").classList.add("active");
  $("#scannerModal").setAttribute("aria-hidden", "false");
  $("#scannerResult").hidden = true;
  $("#manualChargerId").value = "";
  scannerMessage("Ready to scan charger IDs such as A1, A2, B1, or B2.");
  $("#closeScanner").focus();
}

function closeScanner() {
  stopScanner();
  $("#scannerModal").classList.remove("active");
  $("#scannerModal").setAttribute("aria-hidden", "true");
  $("#openScanner").focus();
}

$("#openScanner").addEventListener("click", openScanner);
$("#closeScanner").addEventListener("click", closeScanner);
$("#startScanner").addEventListener("click", startScanner);
$("#scannerModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeScanner(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && $("#scannerModal").classList.contains("active")) closeScanner(); });
$("#manualChargerForm").addEventListener("submit", event => { event.preventDefault(); verifyCharger($("#manualChargerId").value); });

["capacity","soc","target"].forEach(id => $(`#${id}`).addEventListener("input", event => $(`#${id}Out`).textContent = event.target.value));

$("#planForm").addEventListener("submit", async event => {
  event.preventDefault();
  const values = {
    registration:"WEB-EV", capacity:+$("#capacity").value, soc:+$("#soc").value,
    target:+$("#target").value, hours:+$("#hours").value,
    connector:$("#connector").value, maxRate:150
  };
  if (values.target <= values.soc) return toast("Target SoC must be above current SoC.");
  try {
    let plan;
    if (apiOnline) plan = await api.plan(values);
    else {
      const energy = values.capacity * (values.target-values.soc)/100;
      const required = energy/(values.hours*.9);
      const maximum = values.connector === "Type 2" ? 22 : values.connector === "CHAdeMO" ? 50 : 150;
      plan = { energyKWh:energy,powerKW:Math.min(required,maximum),durationHours:energy/(Math.min(required,maximum)*.9),chargerId:values.connector === "Type 2"?"B1":values.connector === "CHAdeMO"?"B2":required<=60?"A2":"A1",feasible:required<=maximum,note:required<=maximum?"Power is throttled to finish at the requested deadline.":"Fastest compatible charger assigned." };
    }
    const budgetInput = { budget:+$("#budget").value, tariff:+$("#tariff").value, requestedEnergy:plan.energyKWh/.9 };
    const budget = apiOnline ? await api.budget(budgetInput) : { deliveredEnergyKWh:Math.min(budgetInput.requestedEnergy,budgetInput.budget/budgetInput.tariff),cost:Math.min(budgetInput.requestedEnergy,budgetInput.budget/budgetInput.tariff)*budgetInput.tariff,budgetLimited:budgetInput.requestedEnergy>budgetInput.budget/budgetInput.tariff };
    const result = $("#planResult");
    result.querySelector(".result-status strong").textContent = budget.budgetLimited ? "BUDGET LIMIT ACTIVE" : plan.feasible ? "PLAN FEASIBLE" : "DEADLINE AT RISK";
    result.querySelector(".result-main strong").innerHTML = `${plan.powerKW.toFixed(1)}<small> kW</small>`;
    const fields = result.querySelectorAll("dd");
    fields[0].textContent = `${plan.energyKWh.toFixed(1)} kWh`;
    fields[1].textContent = `INR ${budget.cost.toFixed(2)}`;
    fields[2].textContent = plan.chargerId;
    fields[3].textContent = `${plan.durationHours.toFixed(2)} hours`;
    result.querySelector(".result-note").textContent = budget.budgetLimited ? `Charging stops after ${budget.deliveredEnergyKWh.toFixed(1)} kWh to protect the budget.` : plan.note;
    toast(apiOnline ? "Plan calculated by the C++ engine." : "Plan calculated in demo mode.");
  } catch (error) { toast(error.message); }
});

$("#queueForm").addEventListener("submit", async event => {
  event.preventDefault();
  const item = { registration:$("#qReg").value.toUpperCase(),soc:+$("#qSoc").value,urgency:$("#qUrgency").value };
  try {
    if (apiOnline) renderQueue((await api.addToQueue(item)).items);
    else {
      fallback.queue.push({id:`REQ-${Date.now()}`,registration:item.registration,soc:item.soc,emergency:item.urgency==="emergency",priority:(item.urgency==="emergency"?1000:item.urgency==="urgent"?300:0)+(item.soc<10?300:item.soc<20?150:0)});
      fallback.queue.sort((a,b)=>b.priority-a.priority).forEach((entry,index)=>entry.rank=index+1);
      renderQueue(fallback.queue);
    }
    event.target.reset(); $("#qSoc").value=20; toast("Vehicle added and queue reprioritized.");
  } catch(error){ toast(error.message); }
});

$("#serveNext").addEventListener("click", async () => {
  try {
    if (apiOnline) { const data=await api.serveNext(); renderQueue(data.items); toast(`${data.served} moved to charging.`); }
    else { const served=fallback.queue.shift(); renderQueue(fallback.queue.map((x,i)=>({...x,rank:i+1}))); toast(served?`${served.registration} moved to charging.`:"Queue is empty."); }
  } catch(error){ toast(error.message); }
});

function previewSolar(){ const sunlight=+$("#sunRange").value; $("#sunOut").textContent=sunlight; $("#solarOutput").textContent=(80*sunlight/100).toFixed(1); $("#gridValue").textContent=`${100-sunlight}%`; $(".sun").style.transform=`translateY(${(100-sunlight)*.55}px) scale(${.72+sunlight/350})`; }
$("#sunRange").addEventListener("input",previewSolar);
$("#storeEnergy").addEventListener("click",async()=>{
  const sunlight=+$("#sunRange").value/100;
  try {
    const data=apiOnline?await api.simulateSolar({sunlight,hours:1,requestedPowerKW:60}):{outputKW:80*sunlight,storedKWh:Math.min(200,+$("#storageValue").textContent.split(" ")[0]+80*sunlight),gridDependencyPercent:100-sunlight*100,carbonOffsetKg:80*sunlight*.7};
    $("#solarOutput").textContent=data.outputKW.toFixed(1); $("#storageValue").textContent=`${data.storedKWh.toFixed(1)} kWh`; $("#storageBar").style.width=`${data.storedKWh/2}%`; $("#gridValue").textContent=`${data.gridDependencyPercent.toFixed(0)}%`; toast(`Solar simulation complete. ${data.carbonOffsetKg.toFixed(1)} kg CO2 offset.`);
  } catch(error){toast(error.message);}
});

$("#emergencyForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const registration=$("#eReg").value.toUpperCase();
  try {
    const data=apiOnline?await api.emergency({registration,soc:+$("#eSoc").value,reason:$("#eReason").value}):{vehicle:registration,chargerId:"A1",pausedVehicle:"KA 01 EV 1001",compensationCredit:50,message:"Emergency override applied."};
    $("#emergencyResult").innerHTML=`<span class="protocol-icon">OK</span><div><p class="eyebrow emergency-copy">OVERRIDE AUTHORIZED</p><h2>${data.vehicle} assigned to ${data.chargerId}</h2><p>${data.pausedVehicle} is paused safely, retains first queue position, and receives an INR ${data.compensationCredit} fairness credit.</p></div>`;
    $("#bannerMessage").textContent=`${data.vehicle} assigned to ${data.chargerId}. ${data.pausedVehicle} paused with fairness protection.`; $("#emergencyBanner").classList.add("active"); toast(data.message);
  } catch(error){toast(error.message);}
});
$("#dismissBanner").addEventListener("click",()=>$("#emergencyBanner").classList.remove("active"));

updateClock(); setInterval(updateClock,1000); previewSolar();
Promise.all([api.health(),api.station(),api.queue()]).then(([_,station,queue])=>{setApiStatus(true);renderSlots(station.slots);renderQueue(queue.items);}).catch(()=>{setApiStatus(false);renderSlots(fallback.slots);renderQueue(fallback.queue);});
setInterval(()=>{ if(apiOnline){refreshStation();refreshQueue();} },10000);
