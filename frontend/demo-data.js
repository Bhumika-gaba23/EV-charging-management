export const vehicles = {
  car: {
    label: "Electric car",
    short: "Car",
    name: "Tesla Model 3",
    depthName: ["TESLA", "MODEL 3"],
    index: "01",
    capacity: 40,
    power: 50,
    connectors: ["CCS2", "Type 2"],
    image: "assets/models/car-poster.png?v=silver-5",
  },
  scooter: {
    label: "Electric scooter",
    short: "Scooter",
    name: "Urban Scooter",
    depthName: ["URBAN", "SCOOTER"],
    index: "02",
    capacity: 3,
    power: 1.5,
    connectors: ["Demo AC"],
    image: "assets/models/scooter-poster.png?v=silver-5",
  },
  bike: {
    label: "Electric bike",
    short: "Bike",
    name: "Concept Bike",
    depthName: ["CONCEPT", "BIKE"],
    index: "03",
    capacity: 5,
    power: 3,
    connectors: ["Demo AC"],
    image: "assets/models/bike-poster.png?v=silver-5",
  },
  cargo: {
    label: "Electric cargo three-wheeler",
    short: "Cargo",
    name: "Pluggo Cargo",
    depthName: ["PLUGGO", "CARGO"],
    index: "04",
    capacity: 20,
    power: 6.6,
    connectors: ["Demo AC"],
    image: "assets/models/cargo-poster.png?v=cargo1",
  },
};
export const stations = [
  {
    id: "CP",
    name: "Central Circle",
    area: "Connaught Place",
    lat: 28.6328,
    lng: 77.2197,
    rate: 18,
    amenities: ["Open 24/7", "Café", "Parking"],
    connectors: [
      { id: "CP-01", type: "CCS2", power: 50, available: true },
      { id: "CP-02", type: "Type 2", power: 22, available: true },
      { id: "CP-03", type: "Demo AC", power: 3.3, available: true },
    ],
  },
  {
    id: "MH",
    name: "Mandi House Hub",
    area: "Mandi House",
    lat: 28.6259,
    lng: 77.2344,
    rate: 16,
    amenities: ["Open 24/7", "Metro nearby"],
    connectors: [
      { id: "MH-01", type: "CCS2", power: 30, available: true },
      { id: "MH-02", type: "Demo AC", power: 3.3, available: true },
    ],
  },
  {
    id: "IG",
    name: "Garden Charge",
    area: "India Gate",
    lat: 28.6129,
    lng: 77.2295,
    rate: 20,
    amenities: ["Open 24/7", "Parking"],
    connectors: [
      { id: "IG-01", type: "CCS2", power: 60, available: false },
      { id: "IG-02", type: "Type 2", power: 7.4, available: false },
    ],
  },
  {
    id: "LR",
    name: "Lodhi Green",
    area: "Lodhi Road",
    lat: 28.5918,
    lng: 77.225,
    rate: 14,
    amenities: ["Open 24/7", "Restroom", "Café"],
    connectors: [
      { id: "LR-01", type: "Type 2", power: 22, available: true },
      { id: "LR-02", type: "Demo AC", power: 3.3, available: true },
    ],
  },
  {
    id: "SK",
    name: "South Link",
    area: "Saket",
    lat: 28.5286,
    lng: 77.219,
    rate: 15,
    amenities: ["Open 24/7", "Shopping", "Parking"],
    connectors: [
      { id: "SK-01", type: "CCS2", power: 50, available: true },
      { id: "SK-02", type: "Demo AC", power: 3.3, available: false },
    ],
  },
];
export const stationById = (id) => stations.find((s) => s.id === id);
export const compatible = (station, vehicle) =>
  station.connectors.some((c) => vehicles[vehicle].connectors.includes(c.type));
export const available = (station, vehicle) =>
  station.connectors.some(
    (c) => c.available && vehicles[vehicle].connectors.includes(c.type),
  );
export function distance(station, origin) {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(station.lat - origin.lat) / 2) ** 2 +
    Math.cos(rad(origin.lat)) *
      Math.cos(rad(station.lat)) *
      Math.sin(rad(station.lng - origin.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
export function energyLimit(session) {
  return Math.min(
    ((session.target - 25) / 100) * vehicles[session.vehicle].capacity,
    session.budget / stationById(session.station).rate,
  );
}
export function updateSession(session, now = Date.now()) {
  if (session.backendOwned) return false;
  if (session.ended) return false;
  const limit = energyLimit(session);
  session.energy = Math.min(
    ((Math.max(0, now - session.started) / 1000) * session.power) / 60,
    limit,
  );
  if (session.energy >= limit) {
    session.ended = session.started + (limit / session.power) * 60 * 1000;
    session.reason =
      session.energy * stationById(session.station).rate >=
      session.budget - 0.001
        ? "Budget limit reached"
        : "Charge target reached";
    return true;
  }
  return false;
}
export function validSession(s) {
  const station = stationById(s?.station);
  const vehicle = Object.hasOwn(vehicles, s?.vehicle)
    ? vehicles[s.vehicle]
    : null;
  const connector = station?.connectors.find((c) => c.id === s.connector);
  return !!(
    station &&
    vehicle &&
    connector &&
    connector.available &&
    vehicle.connectors.includes(connector.type) &&
    Number.isSafeInteger(s.started) &&
    s.started > 0 &&
    s.started <= Date.now() + 1000 &&
    (s.id === `CF-${s.started}` || s.id === `PG-${s.started}`) &&
    Number.isFinite(s.target) &&
    s.target >= 30 &&
    s.target <= 100 &&
    Number.isFinite(s.budget) &&
    s.budget >= 50 &&
    s.budget <= 1000 &&
    s.power === Math.min(connector.power, vehicle.power) &&
    Number.isFinite(s.energy) &&
    s.energy >= 0 &&
    s.energy <= energyLimit(s) + 0.00001 &&
    (s.ended === null || (Number.isFinite(s.ended) && s.ended >= s.started)) &&
    typeof s.settled === "boolean" &&
    (!s.settled || s.ended !== null) &&
    [
      "",
      "Budget limit reached",
      "Charge target reached",
      "Stopped by you",
    ].includes(s.reason)
  );
}
