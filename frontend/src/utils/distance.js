const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => degrees * (Math.PI / 180);

export function calculateDistance(userLat, userLng, mechanicLat, mechanicLng) {
  const lat1 = Number(userLat);
  const lng1 = Number(userLng);
  const lat2 = Number(mechanicLat);
  const lng2 = Number(mechanicLng);

  if ([lat1, lng1, lat2, lng2].some((value) => Number.isNaN(value))) {
    return null;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}
