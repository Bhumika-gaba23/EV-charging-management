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
    image: "assets/models/car-poster-clean.png?v=clean1",
  },
  scooter: {
    label: "Electric scooter",
    short: "Scooter",
    name: "Urban Scooter",
    depthName: ["URBAN", "SCOOTER"],
    index: "02",
    capacity: 3,
    power: 1.5,
    connectors: ["Bharat AC-001"],
    image: "assets/models/scooter-poster-clean.png?v=clean1",
  },
  bike: {
    label: "Electric bike",
    short: "Bike",
    name: "Concept Bike",
    depthName: ["CONCEPT", "BIKE"],
    index: "03",
    capacity: 5,
    power: 3,
    connectors: ["Bharat AC-001"],
    image: "assets/models/bike-poster-clean.png?v=clean1",
  },
  cargo: {
    label: "Electric cargo three-wheeler",
    short: "Cargo",
    name: "Pluggo Cargo",
    depthName: ["PLUGGO", "CARGO"],
    index: "04",
    capacity: 20,
    power: 6.6,
    connectors: ["Bharat AC-001"],
    image: "assets/models/cargo-poster-clean.png?v=clean1",
  },
  // Pluggo SUV, Hatch and E-Scooter: original 3D models built in code (pluggo-models.js).
  suv: {"label": "Electric SUV", "short": "SUV", "name": "Pluggo SUV", "depthName": ["PLUGGO", "SUV"], "index": "05", "capacity": 45, "power": 60, "kmPerKWh": 6.5, "connectors": ["CCS2", "Type 2"], "image": "assets/models/suv-poster-clean.png?v=new1"},
  hatch: {"label": "Electric hatchback", "short": "Hatchback", "name": "Pluggo Hatch", "depthName": ["PLUGGO", "HATCH"], "index": "06", "capacity": 30, "power": 30, "kmPerKWh": 7.5, "connectors": ["CCS2", "Type 2"], "image": "assets/models/hatch-poster-clean.png?v=new1"},
  escooter: {"label": "Electric scooter", "short": "E-scooter", "name": "Pluggo E-Scooter", "depthName": ["PLUGGO", "E-SCOOTER"], "index": "07", "capacity": 3.2, "power": 1.5, "kmPerKWh": 33, "connectors": ["Bharat AC-001"], "image": "assets/models/escooter-poster-clean.png?v=new1"},
};
// Real models per vehicle type: typical battery (kWh), max charging power (kW) and km per kWh.
export const vehicleModels = {
  "car": [
    {
      "id": "nexon-ev-45",
      "name": "Tata Nexon EV 45",
      "capacity": 45,
      "power": 60,
      "kmPerKWh": 6.5
    },
    {
      "id": "punch-ev-lr",
      "name": "Tata Punch EV Long Range",
      "capacity": 35,
      "power": 50,
      "kmPerKWh": 7
    },
    {
      "id": "tiago-ev-lr",
      "name": "Tata Tiago EV Long Range",
      "capacity": 24,
      "power": 25,
      "kmPerKWh": 8
    },
    {
      "id": "xuv400",
      "name": "Mahindra XUV400",
      "capacity": 39.4,
      "power": 50,
      "kmPerKWh": 6.8
    },
    {
      "id": "be-6",
      "name": "Mahindra BE 6",
      "capacity": 79,
      "power": 175,
      "kmPerKWh": 6.5
    },
    {
      "id": "zs-ev",
      "name": "MG ZS EV",
      "capacity": 50.3,
      "power": 50,
      "kmPerKWh": 6.5
    },
    {
      "id": "windsor-ev",
      "name": "MG Windsor EV",
      "capacity": 38,
      "power": 45,
      "kmPerKWh": 7
    },
    {
      "id": "creta-electric",
      "name": "Hyundai Creta Electric",
      "capacity": 51.4,
      "power": 50,
      "kmPerKWh": 6.8
    },
    {
      "id": "atto-3",
      "name": "BYD Atto 3",
      "capacity": 60.5,
      "power": 80,
      "kmPerKWh": 6.2
    }
  ],
  "scooter": [
    {
      "id": "ather-450x",
      "name": "Ather 450X",
      "capacity": 2.9,
      "power": 1.5,
      "kmPerKWh": 35
    },
    {
      "id": "ola-s1-pro",
      "name": "Ola S1 Pro",
      "capacity": 4,
      "power": 1.5,
      "kmPerKWh": 35
    },
    {
      "id": "tvs-iqube",
      "name": "TVS iQube",
      "capacity": 3.4,
      "power": 1.5,
      "kmPerKWh": 32
    },
    {
      "id": "bajaj-chetak",
      "name": "Bajaj Chetak",
      "capacity": 3.5,
      "power": 1.5,
      "kmPerKWh": 33
    }
  ],
  "bike": [
    {
      "id": "revolt-rv400",
      "name": "Revolt RV400",
      "capacity": 3.24,
      "power": 3,
      "kmPerKWh": 40
    },
    {
      "id": "oben-rorr",
      "name": "Oben Rorr",
      "capacity": 4.4,
      "power": 3,
      "kmPerKWh": 40
    },
    {
      "id": "ultraviolette-f77",
      "name": "Ultraviolette F77",
      "capacity": 7.1,
      "power": 3,
      "kmPerKWh": 30
    }
  ],
  "cargo": [
    {
      "id": "treo-zor",
      "name": "Mahindra Treo Zor",
      "capacity": 7.4,
      "power": 3.3,
      "kmPerKWh": 12
    },
    {
      "id": "euler-hiload",
      "name": "Euler HiLoad EV",
      "capacity": 12.4,
      "power": 3.3,
      "kmPerKWh": 12
    }
  ],
  "suv": [
    {
      "id": "nexon-ev-45",
      "name": "Tata Nexon EV 45",
      "capacity": 45,
      "power": 60,
      "kmPerKWh": 6.5
    },
    {
      "id": "xuv400",
      "name": "Mahindra XUV400",
      "capacity": 39.4,
      "power": 50,
      "kmPerKWh": 6.8
    },
    {
      "id": "be-6",
      "name": "Mahindra BE 6",
      "capacity": 79,
      "power": 175,
      "kmPerKWh": 6.5
    },
    {
      "id": "zs-ev",
      "name": "MG ZS EV",
      "capacity": 50.3,
      "power": 50,
      "kmPerKWh": 6.5
    },
    {
      "id": "creta-electric",
      "name": "Hyundai Creta Electric",
      "capacity": 51.4,
      "power": 50,
      "kmPerKWh": 6.8
    },
    {
      "id": "atto-3",
      "name": "BYD Atto 3",
      "capacity": 60.5,
      "power": 80,
      "kmPerKWh": 6.2
    }
  ],
  "hatch": [
    {
      "id": "tiago-ev-lr",
      "name": "Tata Tiago EV Long Range",
      "capacity": 24,
      "power": 25,
      "kmPerKWh": 8
    },
    {
      "id": "punch-ev-lr",
      "name": "Tata Punch EV Long Range",
      "capacity": 35,
      "power": 50,
      "kmPerKWh": 7
    },
    {
      "id": "windsor-ev",
      "name": "MG Windsor EV",
      "capacity": 38,
      "power": 45,
      "kmPerKWh": 7
    }
  ],
  "escooter": [
    {
      "id": "ather-450x",
      "name": "Ather 450X",
      "capacity": 2.9,
      "power": 1.5,
      "kmPerKWh": 35
    },
    {
      "id": "ola-s1-pro",
      "name": "Ola S1 Pro",
      "capacity": 4,
      "power": 1.5,
      "kmPerKWh": 35
    },
    {
      "id": "tvs-iqube",
      "name": "TVS iQube",
      "capacity": 3.4,
      "power": 1.5,
      "kmPerKWh": 32
    },
    {
      "id": "bajaj-chetak",
      "name": "Bajaj Chetak",
      "capacity": 3.5,
      "power": 1.5,
      "kmPerKWh": 33
    }
  ]
};
for (const [type, list] of Object.entries(vehicleModels)) vehicles[type].models = list;

export const stations = [
  {
    // Demo station: pinned to the top of the app's lists, and first on the operator dashboard.
    id: "DB",
    name: "Dashboard",
    area: "Delhi Technical Campus, Greater Noida",
    lat: 28.4696,
    lng: 77.4955,
    rate: 16,
    pinned: true,
    amenities: ["Open 24/7", "Live on the operator dashboard", "Parking"],
    connectors: [
      { id: "DB-01", type: "CCS2", power: 50, available: true },
      { id: "DB-02", type: "Type 2", power: 22, available: true },
      { id: "DB-03", type: "Bharat AC-001", power: 3.3, available: true },
    ],
  },
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
      { id: "CP-03", type: "Bharat AC-001", power: 3.3, available: true },
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
      { id: "MH-02", type: "Bharat AC-001", power: 3.3, available: true },
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
      { id: "LR-02", type: "Bharat AC-001", power: 3.3, available: true },
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
      { id: "SK-02", type: "Bharat AC-001", power: 3.3, available: false },
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
    ((session.target - (session.startSoc ?? 25)) / 100) * (session.capacity || vehicles[session.vehicle].capacity),
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
    (s.startSoc === undefined || (Number.isFinite(s.startSoc) && s.startSoc >= 0 && s.startSoc <= 95)) &&
    (s.capacity === undefined || (Number.isFinite(s.capacity) && s.capacity > 0 && s.capacity <= 200)) &&
    Number.isFinite(s.power) && s.power > 0 && s.power <= connector.power &&
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
