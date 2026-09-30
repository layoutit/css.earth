/** An equidistant-cylindrical layer on a sphere, as LROC's Apollo shapefiles are projected: its `.prj` names the radius,
 * the central meridian and the standard parallel. Returns the map from projected metres to east longitude and latitude. */
export function equidistantCylindricalInverse(projection: string, where: string): (x: number, y: number) => readonly [longitudeDegEast: number, latitudeDeg: number] {
  const radius = Number(/SPHEROID\["[^"]+",\s*([\d.]+)/u.exec(projection)?.[1]), central = Number(/"Central_Meridian",\s*(-?[\d.]+)/u.exec(projection)?.[1] ?? '0');
  const parallel = Number(/"Standard_Parallel_1",\s*(-?[\d.]+)/u.exec(projection)?.[1] ?? '0');
  if (!(radius > 0) || !Number.isFinite(central) || !Number.isFinite(parallel) || !/Equi(?:distant_Cylindrical|rectangular)/u.test(projection)) {
    throw new TypeError(`${where}: the projection is not an equidistant cylindrical sphere.`);
  }
  const scale = 180 / Math.PI / radius, cosine = Math.cos(parallel * Math.PI / 180);
  return (x, y) => { const longitude = central + x * scale / cosine; return [((longitude % 360) + 360) % 360, y * scale] as const; };
}
