import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vehicles,
  stations,
  compatible,
  available,
  distance,
  updateSession,
  validSession,
  energyLimit,
} from "../../frontend/demo-data.js";
function session(overrides = {}) {
  const started = Date.now() - 1000;
  return {
    id: `CF-${started}`,
    station: "CP",
    connector: "CP-01",
    vehicle: "car",
    started,
    target: 80,
    budget: 300,
    power: 50,
    energy: 0,
    ended: null,
    settled: false,
    reason: "",
    ...overrides,
  };
}
test("cars and two-wheelers have different compatible stations", () => {
  assert.equal(stations.filter((s) => compatible(s, "car")).length, 5);
  assert.equal(stations.filter((s) => compatible(s, "scooter")).length, 4);
  assert.equal(available(stations[2], "car"), false);
  assert.equal(available(stations[4], "scooter"), false);
});
test("distance uses supplied origin, not a hardcoded claimed travel distance", () => {
  assert.equal(distance(stations[0], stations[0]), 0);
  assert.ok(distance(stations[0], { lat: 28.6315, lng: 77.2167 }) < 0.4);
});
test("budget stops an accelerated session without exceeding the cap", () => {
  const s = session({ budget: 50 });
  updateSession(s, s.started + 60000);
  assert.ok(Math.abs(s.energy * 18 - 50) < 1e-8);
  assert.equal(s.reason, "Budget limit reached");
  assert.ok(s.ended);
  assert.equal(s.settled, false);
});
test("target stops exactly and preserves completion time across long absences", () => {
  const s = session({ budget: 1000 });
  updateSession(s, s.started + 3600000);
  assert.equal(s.energy, 22);
  assert.equal(s.reason, "Charge target reached");
  assert.equal(s.ended, s.started + 26400);
  const end = s.ended;
  updateSession(s, s.started + 7200000);
  assert.equal(s.ended, end);
});
test("two-wheeler demo uses its own power and capacity", () => {
  const s = session({
    vehicle: "scooter",
    connector: "CP-03",
    power: vehicles.scooter.power,
    budget: 50,
  });
  updateSession(s, s.started + 10000);
  assert.equal(s.energy, 0.25);
  assert.ok(energyLimit(s) < 2);
});
test("invalid persisted records cannot become charge sessions", () => {
  const s = session();
  assert.equal(validSession(s), true);
  assert.equal(validSession({ ...s, id: `PG-${s.started}` }), true);
  for (const patch of [
    { station: "unknown" },
    { vehicle: "__proto__" },
    { vehicle: "toString" },
    { budget: -1 },
    { power: 100 },
    { target: Infinity },
    { energy: -1 },
    { reason: "<script>" },
    { connector: "SK-01" },
    { settled: true },
    { id: "<img src=x>" },
  ])
    assert.equal(validSession({ ...s, ...patch }), false);
  assert.equal(validSession(null), false);
});
