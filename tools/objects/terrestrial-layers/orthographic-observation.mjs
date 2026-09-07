// Forward map into the photographed hemisphere. The opposite hemisphere has
// the same projected x/y; reject it before sampling rather than mirroring data.
export function orthographicPoint(longitude, latitude, {centerLongitude, centerLatitude, radius}) {
  const d = Math.PI / 180, lat = latitude * d, lat0 = centerLatitude * d;
  const lon = (longitude - centerLongitude) * d;
  if (Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(lon) <= 0) return null;
  return [radius * Math.cos(lat) * Math.sin(lon),
    radius * (Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(lon))];
}

