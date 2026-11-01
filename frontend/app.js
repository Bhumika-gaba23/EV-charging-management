const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  storage: 136,
  queue: [
    { registration: "AMB EV 04", soc: 8, urgency: "emergency", arrival: 1 },
    { registration: "KA 04 NX 8821", soc: 12, urgency: "urgent", arrival: 2 },
    { registration: "KA 02 EV 3105", soc: 31, urgency: "normal", arrival: 3 }
  ]
};

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function updateClock() {
  const now = new Date();
  $("#clock").textContent = now.toLocaleTimeString("en-IN", { hour12: false });
  $("#today").textContent = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}
updateClock();
setInterval(updateClock, 1000);

$$('.nav-item').forEach(button => button.addEventListener('click', () => {
  $$('.nav-item').forEach(item => item.classList.remove('active'));
  $$('.panel').forEach(panel => panel.classList.remove('active-panel'));
  button.classList.add('active');
  $(`#${button.dataset.target}`).classList.add('active-panel');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

['capacity', 'soc', 'target'].forEach(id => {
  $(`#${id}`).addEventListener('input', event => $(`#${id}Out`).textContent = event.target.value);
});

$('#planForm').addEventListener('submit', event => {
  event.preventDefault();
  const capacity = +$('#capacity').value;
  const soc = +$('#soc').value;
  const target = +$('#target').value;
  const hours = +$('#hours').value;
  const budget = +$('#budget').value;
  const tariff = +$('#tariff').value;
  const connector = $('#connector').value;
  if (target <= soc) return showToast('Target SoC must be above current SoC.');
  const energy = capacity * (target - soc) / 100;
  const inputEnergy = energy / .9;
  const power = inputEnergy / hours;
  const affordableEnergy = budget / tariff;
  const budgetOkay = affordableEnergy >= inputEnergy;
  const maxPower = connector === 'Type 2' ? 22 : connector === 'CHAdeMO' ? 50 : 150;
  const feasible = power <= maxPower && budgetOkay;
  const slot = connector === 'Type 2' ? 'AC-SOLAR' : connector === 'CHAdeMO' ? 'CHA-GRID' : power <= 60 ? 'DC-GRID' : 'DC-SOLAR';
  const result = $('#planResult');
  result.querySelector('.result-status strong').textContent = feasible ? 'PLAN FEASIBLE' : budgetOkay ? 'MORE TIME REQUIRED' : 'BUDGET LIMIT ACTIVE';
  result.querySelector('.result-main strong').innerHTML = `${Math.min(power,maxPower).toFixed(1)}<small> kW</small>`;
  const values = result.querySelectorAll('dd');
  values[0].textContent = `${inputEnergy.toFixed(1)} kWh`;
  values[1].textContent = `₹${Math.min(inputEnergy,affordableEnergy).toFixed(1) * tariff}`;
  values[2].textContent = slot;
  values[3].textContent = feasible ? `${hours.toFixed(2)} hours` : `${(inputEnergy/maxPower).toFixed(2)} hours`;
  result.querySelector('.result-note').textContent = feasible ? 'Power is throttled to finish at your departure time.' : !budgetOkay ? `Charging stops at ${affordableEnergy.toFixed(1)} kWh to protect your budget.` : 'The fastest compatible slot is assigned, but the requested deadline is too short.';
  showToast('Charging plan calculated.');
});

function score(item) {
  const urgency = item.urgency === 'emergency' ? 1000 : item.urgency === 'urgent' ? 350 : 0;
  const lowBattery = item.soc < 10 ? 300 : item.soc < 20 ? 150 : 0;
  return urgency + lowBattery + Math.max(0, 50 - item.arrival);
}

function renderQueue() {
  state.queue.sort((a,b) => score(b) - score(a) || a.arrival - b.arrival);
  $('#queueList').innerHTML = state.queue.map((item,index) => `<div class="queue-item"><span class="queue-rank">0${index+1}</span><div><strong>${item.registration}</strong><small>ARRIVAL #${item.arrival}</small></div><span>${item.soc}% SoC</span><span class="priority ${item.urgency !== 'normal' ? 'high' : ''}">${item.urgency.toUpperCase()}</span></div>`).join('');
  $('#queueCount').textContent = String(state.queue.length).padStart(2,'0');
}
renderQueue();

$('#queueForm').addEventListener('submit', event => {
  event.preventDefault();
  state.queue.push({ registration: $('#qReg').value.toUpperCase(), soc: +$('#qSoc').value, urgency: $('#qUrgency').value, arrival: Date.now() });
  renderQueue();
  event.target.reset();
  $('#qSoc').value = 20;
  showToast('Vehicle added and queue reordered.');
});

$('#serveNext').addEventListener('click', () => {
  if (!state.queue.length) return showToast('The queue is already empty.');
  const next = state.queue.shift();
  renderQueue();
  showToast(`${next.registration} moved to charging.`);
});

function updateSolar() {
  const sunlight = +$('#sunRange').value;
  const output = 80 * sunlight / 100;
  $('#sunOut').textContent = sunlight;
  $('#solarOutput').textContent = output.toFixed(1);
  $('#solarShare').innerHTML = `${sunlight}<small>%</small>`;
  $('#gridValue').textContent = `${100-sunlight}%`;
  $('.sun').style.transform = `translateY(${(100-sunlight)*.65}px) scale(${.72+sunlight/350})`;
}
$('#sunRange').addEventListener('input', updateSolar);
$('#storeEnergy').addEventListener('click', () => {
  state.storage = Math.min(200, state.storage + 80 * +$('#sunRange').value / 100);
  $('#storageValue').textContent = `${state.storage.toFixed(1)} kWh`;
  $('#storageBar').style.width = `${state.storage/2}%`;
  showToast(state.storage >= 200 ? 'Battery storage is full.' : 'One hour of solar generation stored.');
});

$('#emergencyForm').addEventListener('submit', event => {
  event.preventDefault();
  const registration = $('#eReg').value.toUpperCase();
  $('#emergencyResult').innerHTML = `<span class="protocol-icon">✓</span><div><p class="eyebrow emergency-copy">OVERRIDE AUTHORIZED</p><h2>${registration} assigned to DC-SOLAR</h2><p>Regular session KA 01 EV 1001 is safely paused, protected at the front of the queue, and receives a ₹50 fairness credit.</p></div>`;
  showToast('Emergency access granted. Fairness protection applied.');
});

setInterval(() => {
  const value = 78 + Math.random() * 10;
  $('#activePower').textContent = value.toFixed(1);
}, 2400);
