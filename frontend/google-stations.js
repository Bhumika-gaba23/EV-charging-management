// Google Places results remain in memory and are displayed only on Google Maps.
export async function findGoogleStations(api, {query = "", origin}) {
  const {Place, SearchNearbyRankPreference} = await api.maps.importLibrary("places");
  const fields = ["id", "displayName", "formattedAddress", "location", "googleMapsURI", "businessStatus"];
  const circle = {center: {lat: origin.lat, lng: origin.lng}, radius: 5000};
  const result = query.trim()
    ? await Place.searchByText({textQuery: query.trim(), includedType: "electric_vehicle_charging_station", strictTypeFiltering: true, locationBias: circle, fields, maxResultCount: 20})
    : await Place.searchNearby({includedTypes: ["electric_vehicle_charging_station"], locationRestriction: circle, rankPreference: SearchNearbyRankPreference.DISTANCE, fields, maxResultCount: 20});
  return (result.places || []).filter(p => p.location && p.businessStatus !== "CLOSED_PERMANENTLY");
}
