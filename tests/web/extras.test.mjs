import test from "node:test";
import assert from "node:assert/strict";
import { greenImpact, bandAt, rateAt, nextOffPeak, bookingSlots, overlaps, findCity, tripMapsLink, KM_PER_KWH, PETROL_KM_PER_LITRE } from "../../frontend/extras.js";

const tariff = { enabled: true, bands: [{ band: "off-peak", multiplier: 0.8 }, { band: "standard", multiplier: 1 }, { band: "peak", multiplier: 1.2 }] };
// 2026-11-24 at the given India time (UTC+5:30).
const ist = (h, m = 0) => Date.UTC(2026, 10, 24, h, m) - 19800000;

test("time-of-use bands follow India time", () => {
  assert.equal(bandAt(ist(5, 59), tariff).band, "off-peak");
  assert.equal(bandAt(ist(6), tariff).band, "standard");
  assert.equal(bandAt(ist(17, 59), tariff).band, "standard");
  assert.equal(bandAt(ist(18), tariff).band, "peak");
  assert.equal(bandAt(ist(22), tariff).band, "off-peak");
  assert.equal(bandAt(ist(19), { enabled: false }).band, "standard");
  assert.equal(rateAt(18, ist(19), tariff), 21.6);
  assert.equal(rateAt(18, ist(23), tariff), 14.4);
});

test("next off-peak start", () => {
  assert.equal(nextOffPeak(ist(19, 30), tariff), ist(22));
  assert.equal(nextOffPeak(ist(9, 15), tariff), ist(22));
  assert.equal(nextOffPeak(ist(23), tariff), ist(23));
  assert.equal(nextOffPeak(ist(9), { enabled: false }), ist(9));
});

test("booking slots start now, then every half hour for a day", () => {
  const now = ist(10, 7);
  const slots = bookingSlots(now);
  assert.equal(slots[0].start, now);
  assert.ok(slots[0].now);
  assert.equal(slots[1].start, ist(10, 30));
  assert.equal(slots[2].start - slots[1].start, 30 * 60000);
  assert.ok(slots.at(-1).start <= now + 24 * 3600000 - 30 * 60000);
  const booked = [{ starts: ist(11), ends: ist(12) }];
  assert.equal(overlaps(ist(10, 30), 30, booked), false);
  assert.equal(overlaps(ist(10, 30), 60, booked), true);
  assert.equal(overlaps(ist(12), 60, booked), false);
});

test("green impact compares with a similar petrol vehicle", () => {
  const now = ist(20);
  const sessions = [
    { vehicle: "car", energy: 10, power: 50, ended: ist(9), cost: 180, settled: true },
    { vehicle: "scooter", energy: 2, power: 1.5, ended: ist(10), cost: 36, settled: true },
    { vehicle: "car", energy: 99, power: 50, ended: null, cost: 0 },
  ];
  const g = greenImpact(sessions, { now, period: "month" });
  const carKm = 10 * KM_PER_KWH.car, scooterKm = 2 * KM_PER_KWH.scooter;
  const litres = carKm / PETROL_KM_PER_LITRE.car + scooterKm / PETROL_KM_PER_LITRE.scooter;
  assert.equal(g.energy, 12);
  assert.ok(Math.abs(g.km - (carKm + scooterKm)) < 1e-9);
  assert.ok(Math.abs(g.litres - litres) < 1e-9);
  assert.ok(Math.abs(g.saved - (litres * 95 - 216)) < 1e-9);
  assert.ok(Math.abs(g.co2Avoided - (litres * 2.31 - 12 * 0.71)) < 1e-9);
  assert.equal(greenImpact([], { now }).co2Avoided, 0);
});

test("trip destinations and route link", () => {
  assert.equal(findCity("jaipur").name, "Jaipur");
  assert.equal(findCity("delhi").name, "Delhi");
  assert.equal(findCity("New Delhi").name, "New Delhi");
  assert.equal(findCity("Bengal").name, "Bengaluru");
  assert.equal(findCity("Ja"), undefined);
  const link = new URL(tripMapsLink({ lat: 28.6, lng: 77.2 }, { lat: 26.9, lng: 75.8 }, [{ lat: 28, lng: 76.9 }, { lat: 27.5, lng: 76.4 }]));
  assert.equal(link.searchParams.get("waypoints"), "28,76.9|27.5,76.4");
  assert.equal(link.searchParams.get("destination"), "26.9,75.8");
});
