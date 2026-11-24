// Place names for the location picker and station search, from OpenStreetMap's Nominatim service.
// Coordinates are rounded to about 100 m before they leave the phone. Nominatim's usage policy
// allows occasional lookups by an identified app (the browser sends this site as the referrer) and
// forbids search-as-you-type, so lookups happen only when the driver submits a search.
const NOMINATIM = "https://nominatim.openstreetmap.org";
const SAVED_KEY = "pluggo.place";
const round = (n) => Math.round(n * 1000) / 1000;

async function nominatim(path, params) {
  const url = new URL(path, NOMINATIM);
  url.search = new URLSearchParams({ format: "jsonv2", "accept-language": "en", ...params });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { signal: controller.signal, referrerPolicy: "origin" });
    if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

// The most useful short name for a place: village or town before the district.
export function shortName(address = {}, fallback = "") {
  return address.village || address.town || address.city || address.hamlet || address.suburb
    || address.municipality || address.county || address.state_district || address.state || fallback;
}

export async function placeName(lat, lng) {
  const cacheKey = `pluggo.place.${round(lat)},${round(lng)}`;
  try { const hit = sessionStorage.getItem(cacheKey); if (hit) return hit; } catch {}
  const reply = await nominatim("/reverse", { lat: round(lat), lon: round(lng), zoom: 14, addressdetails: 1 });
  const name = shortName(reply.address, reply.name || "Your location");
  try { sessionStorage.setItem(cacheKey, name); } catch {}
  return name;
}

// Towns, villages and areas in India that match the text, best first. With placesOnly, offices,
// shops and other named buildings ("Tata Power") are left out, so a charger name is not mistaken for a town.
export async function findPlaces(text, limit = 6, { placesOnly = false } = {}) {
  const query = String(text).trim();
  if (query.length < 2) return [];
  const reply = await nominatim("/search", { q: query, countrycodes: "in", addressdetails: 1, limit: placesOnly ? Math.max(limit, 5) : limit });
  return reply.filter((r) => !placesOnly || ["place", "boundary"].includes(r.category || r.class)).slice(0, limit).map((r) => ({
    name: shortName(r.address, r.name || query),
    detail: [r.address?.state_district || r.address?.county, r.address?.state].filter(Boolean).join(", "),
    lat: Number(r.lat), lng: Number(r.lon),
  })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

// The chosen place (from GPS or picked by hand), kept on this phone.
export function savedPlace() {
  try {
    const place = JSON.parse(localStorage.getItem(SAVED_KEY) || "null");
    return place && Number.isFinite(place.lat) && Number.isFinite(place.lng) && place.name ? place : null;
  } catch { return null; }
}
export function savePlace(place) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify({ name: place.name, lat: place.lat, lng: place.lng, gps: !!place.gps })); } catch {}
}

// Current GPS position, or null when location is off or refused.
export function currentPosition({ timeout = 12000 } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge: 120000, enableHighAccuracy: false },
    );
  });
}
// True when the driver has already allowed location, so it can be used without a prompt.
export async function locationAllowed() {
  try { return (await navigator.permissions.query({ name: "geolocation" })).state === "granted"; } catch { return false; }
}
