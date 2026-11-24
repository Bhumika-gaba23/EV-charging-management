// Pure helpers for green impact, time-of-use bands, booking slots and trip destinations.
// No DOM access, so tests/web/extras.test.mjs can check them directly.
import { summarizeSessions } from "./session-summary.js?v=20261123-pay1";

// ---- Green impact ---------------------------------------------------------------------------
// Typical efficiency of each Pluggo vehicle, and of a similar petrol vehicle for comparison.
export const KM_PER_KWH = { car: 6.5, scooter: 30, bike: 25, cargo: 7.5 };
export const PETROL_KM_PER_LITRE = { car: 15, scooter: 45, bike: 40, cargo: 25 };
export const PETROL_PRICE = 95;      // ₹ per litre, Delhi, late 2026
export const PETROL_CO2_KG = 2.31;   // kg CO₂ from burning one litre of petrol
export const GRID_CO2_KG = 0.71;     // kg CO₂ per kWh on India's grid (CEA baseline)
export const TREE_CO2_KG_YEAR = 21;  // kg CO₂ a grown tree absorbs in a year

export function greenImpact(sessions, { period = "month", now = Date.now(), cost = (s) => s.cost } = {}) {
  const result = { energy: 0, km: 0, litres: 0, petrolCost: 0, chargeCost: 0, co2Petrol: 0, co2Grid: 0 };
  for (const vehicle of new Set(sessions.map((s) => s.vehicle))) {
    const sum = summarizeSessions(sessions.filter((s) => s.vehicle === vehicle), { period, now, cost });
    const km = sum.energy * (KM_PER_KWH[vehicle] || 6);
    const litres = km / (PETROL_KM_PER_LITRE[vehicle] || 15);
    result.energy += sum.energy;
    result.km += km;
    result.litres += litres;
    result.petrolCost += litres * PETROL_PRICE;
    result.chargeCost += sum.cost;
    result.co2Petrol += litres * PETROL_CO2_KG;
    result.co2Grid += sum.energy * GRID_CO2_KG;
  }
  result.saved = result.petrolCost - result.chargeCost;
  result.co2Avoided = result.co2Petrol - result.co2Grid;
  result.treeYears = Math.max(0, result.co2Avoided) / TREE_CO2_KG_YEAR;
  return result;
}

// ---- Time-of-use bands (mirrors the server: 22:00–06:00 off-peak, 18:00–22:00 peak, India time) --
const IST = 19800000;
export const BAND_NAMES = { "off-peak": "Off-peak", standard: "Standard", peak: "Peak" };
const minuteOfDay = (ms) => ((Math.floor((ms + IST) / 60000) % 1440) + 1440) % 1440;
export function bandAt(ms, tariff) {
  if (!tariff?.enabled) return { band: "standard", multiplier: 1 };
  const m = minuteOfDay(ms);
  const band = m < 360 || m >= 1320 ? "off-peak" : m >= 1080 ? "peak" : "standard";
  const multiplier = tariff.bands?.find((b) => b.band === band)?.multiplier ?? { "off-peak": 0.8, standard: 1, peak: 1.2 }[band];
  return { band, multiplier };
}
export const rateAt = (base, ms, tariff) => Math.round(base * bandAt(ms, tariff).multiplier * 100) / 100;
// The next moment off-peak pricing applies (now, if it already does).
export function nextOffPeak(now, tariff) {
  if (!tariff?.enabled || bandAt(now, tariff).band === "off-peak") return now;
  const m = minuteOfDay(now);
  return now - (((now + IST) % 60000) + 60000) % 60000 + (1320 - m) * 60000;
}

// ---- Booking slots ----------------------------------------------------------------------------
export const BOOKING_MINUTES = [30, 60, 90, 120];
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const clock = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
export const istTime = (ms) => clock.format(new Date(ms));
export function istDay(ms, now = Date.now()) {
  const day = dayKey.format(new Date(ms));
  if (day === dayKey.format(new Date(now))) return "Today";
  if (day === dayKey.format(new Date(now + 864e5))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date(ms));
}
export const overlaps = (start, minutes, bookings = []) => bookings.some((b) => b.starts < start + minutes * 60000 && b.ends > start);
// Start times for the next 24 hours: "now", then every half hour.
export function bookingSlots(now = Date.now(), { hours = 24, step = 30 } = {}) {
  const first = Math.ceil((now + 5 * 60000) / (step * 60000)) * step * 60000;
  const slots = [{ start: now, now: true }];
  for (let t = first; t <= now + hours * 3600000 - step * 60000; t += step * 60000) slots.push({ start: t, now: false });
  return slots;
}

// ---- Trip destinations ------------------------------------------------------------------------
export const CITIES = [
  ["Agra", 27.1767, 78.0081], ["Ahmedabad", 23.0225, 72.5714], ["Ajmer", 26.4499, 74.6399], ["Amritsar", 31.634, 74.8723],
  ["Aurangabad", 19.8762, 75.3433], ["Bengaluru", 12.9716, 77.5946], ["Bhopal", 23.2599, 77.4126], ["Bhubaneswar", 20.2961, 85.8245],
  ["Chandigarh", 30.7333, 76.7794], ["Chennai", 13.0827, 80.2707], ["Coimbatore", 11.0168, 76.9558], ["Dehradun", 30.3165, 78.0322],
  ["Faridabad", 28.4089, 77.3178], ["Ghaziabad", 28.6692, 77.4538], ["Goa (Panaji)", 15.4909, 73.8278], ["Greater Noida", 28.4744, 77.504],
  ["Gurugram", 28.4595, 77.0266], ["Guwahati", 26.1445, 91.7362], ["Haridwar", 29.9457, 78.1642], ["Hyderabad", 17.385, 78.4867],
  ["Indore", 22.7196, 75.8577], ["Jaipur", 26.9124, 75.7873], ["Jammu", 32.7266, 74.857], ["Jodhpur", 26.2389, 73.0243],
  ["Kanpur", 26.4499, 80.3319], ["Kochi", 9.9312, 76.2673], ["Kolkata", 22.5726, 88.3639], ["Lucknow", 26.8467, 80.9462],
  ["Ludhiana", 30.901, 75.8573], ["Manali", 32.2432, 77.1892], ["Mathura", 27.4924, 77.6737], ["Meerut", 28.9845, 77.7064],
  ["Mumbai", 19.076, 72.8777], ["Mysuru", 12.2958, 76.6394], ["Nagpur", 21.1458, 79.0882], ["Nashik", 19.9975, 73.7898],
  ["Noida", 28.5355, 77.391], ["Patna", 25.5941, 85.1376], ["Puducherry", 11.9416, 79.8083], ["Pune", 18.5204, 73.8567],
  ["Raipur", 21.2514, 81.6296], ["Rishikesh", 30.0869, 78.2676], ["Shimla", 31.1048, 77.1734], ["Surat", 21.1702, 72.8311],
  ["Thiruvananthapuram", 8.5241, 76.9366], ["Udaipur", 24.5854, 73.7125], ["Vadodara", 22.3072, 73.1812], ["Varanasi", 25.3176, 82.9739],
  ["Visakhapatnam", 17.6868, 83.2185],
].map(([name, lat, lng]) => ({ name, lat, lng }));
export const findCity = (text) => CITIES.find((c) => c.name.toLowerCase() === String(text).trim().toLowerCase())
  || CITIES.find((c) => c.name.toLowerCase().startsWith(String(text).trim().toLowerCase()) && String(text).trim().length >= 3);
// Google Maps directions through every planned stop.
export function tripMapsLink(from, to, stops = []) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({ api: "1", origin: `${from.lat},${from.lng}`, destination: `${to.lat},${to.lng}`, travelmode: "driving",
    ...(stops.length ? { waypoints: stops.map((s) => `${s.lat},${s.lng}`).join("|") } : {}) });
  return url.toString();
}
