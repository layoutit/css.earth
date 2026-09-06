import { normalizeDestinationQuery } from "../../../../site/destination-search.mjs";
import { prepareLocationPoint, prepareLocationCamera } from "./city/prepare-location.mjs";

const aliases = values => [...new Set(values.filter(value => typeof value === "string" && value.trim())
  .map(normalizeDestinationQuery).filter(Boolean))];
const number = value => Number(value).toLocaleString("en-US");
const coordinates = (latitude, longitude) => `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? "S" : "N"}, ${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? "W" : "E"}`;

// These extents frame source geometry. They are never published as borders.
export function principalNavigationBounds(geometry, longitude) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : null;
  if (!polygons?.length) throw new Error("Administrative source has no polygon geometry.");
  return polygons.map(polygon => {
    const points = polygon[0].map(([lon, lat]) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90) throw new Error("Administrative source has invalid coordinates.");
      return [longitude + ((lon - longitude + 540) % 360 - 180), lat];
    });
    if (points.length < 4) throw new Error("Administrative source has an incomplete ring.");
    return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  }).sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0];
}

export function prepareAdministrativePlaces({ countryRows, adminRows, records, legacyCountryFeatures, countryFeatures, adminFeatures, scene }) {
  const receipt = { countries: 0, admin1: 0, countryPointViews: [], adminPointViews: [], geometryConflicts: [], historical: [], alternateCountryCodes: [] };
  const countries = new Map(), admins = new Map(), places = [];
  const countryShapes = new Map(countryFeatures.map(feature => [String(feature.properties.geoNameId), feature]));
  const adminShapes = new Map();
  for (const feature of adminFeatures) {
    const id = String(feature.properties.gn_id);
    if (!adminShapes.has(id)) adminShapes.set(id, []);
    adminShapes.get(id).push(feature);
  }
  function sourceRecord(id) {
    const row = records.get(id);
    if (!row || row.length !== 19 || row[6] !== "A" || !Number.isFinite(Number(row[4])) || Math.abs(Number(row[4])) > 90 ||
        !Number.isFinite(Number(row[5])) || Math.abs(Number(row[5])) > 180) throw new Error(`Missing or invalid administrative source record: ${id}`);
    return row;
  }
  function navigation(row, geometry, geometrySource, legacyPoint) {
    const latitude = legacyPoint?.latitude ?? Number(row[4]), longitude = legacyPoint?.longitude ?? Number(row[5]);
    const bounds = geometry ? principalNavigationBounds(geometry, longitude) : null;
    const span = bounds ? Math.max(bounds[3] - bounds[1], (bounds[2] - bounds[0]) * Math.cos(latitude * Math.PI / 180)) : null;
    const zoom = bounds ? Math.max(1.5, Math.min(legacyPoint ? 64 : 1024, 95 / Math.max(span, 0.0001))) : 8;
    return { latitude, longitude,
      camera: prepareLocationCamera(scene, prepareLocationPoint(scene, longitude, latitude), zoom), coverage: "overview",
      navigation: { kind: bounds ? "principal-area" : "source-point", source: geometrySource ?? "GeoNames", ...(bounds ? { bounds } : {}) } };
  }
  function provenance(row) {
    if (row[9]) receipt.alternateCountryCodes.push({ id: row[0], country: row[8], alternatives: row[9].split(",") });
    return { featureCode: row[7], countryCode: row[8], admin1Code: row[10], alternateCountryCodes: row[9].split(",").filter(Boolean), modifiedAt: row[18] };
  }
  for (const row of countryRows) {
    const record = sourceRecord(row[16]);
    if (record[8] !== row[0]) throw new Error(`Country source code disagrees: ${row[0]}`);
    const legacy = legacyCountryFeatures.filter(feature => feature.properties.ISO_A2_EH === row[0]);
    if (legacy.length > 1) throw new Error(`Ambiguous accepted country view: ${row[0]}`);
    const previous = legacy[0], shape = previous ?? countryShapes.get(row[16]);
    const properties = previous?.properties ?? {};
    const historical = record[7] === "PCLH";
    const kindLabel = historical ? "Historical country / territory" : "Country / territory";
    const name = row[4].trim(), id = `country:${row[0]}`;
    const place = { id, kind: "country", kindLabel, name, parentId: "earth", context: historical ? kindLabel : properties.CONTINENT ?? kindLabel,
      identifiers: { geonames: row[16], ...(/^Q[1-9]\d*$/u.test(properties.WIKIDATAID) ? { wikidata: properties.WIKIDATAID } : {}) },
      names: aliases([name, row[0], row[1], record[1], record[2], ...record[3].split(","), ...Object.entries(properties).filter(([key]) => key.startsWith("NAME_")).map(([, value]) => value)]),
      searchContext: normalizeDestinationQuery(`${properties.CONTINENT ?? ""} ${kindLabel}`), population: Number(row[7]), historical,
      ...navigation(record, shape?.geometry, previous ? "Natural Earth 1:110m" : shape ? "GeoNames country shapes" : null,
        previous ? { latitude: properties.LABEL_Y, longitude: properties.LABEL_X } : null),
      facts: [{ label: "Capital", value: row[5] || "—" }, { label: "Population", value: number(row[7]) }, { label: "Area", value: `${number(row[6])} km²` },
        ...(historical ? [{ label: "Status", value: "Former political entity" }] : [])], sourceRecord: provenance(record) };
    place.status = historical ? "Historical entity · GeoNames" : `${shape ? "Area" : "Location"} overview · ${previous ? "Natural Earth" : "GeoNames"}`;
    if (!shape) receipt.countryPointViews.push(id);
    if (historical) receipt.historical.push(id);
    places.push(place); countries.set(row[0], place); receipt.countries++;
  }
  for (const row of adminRows) {
    const record = sourceRecord(row[3]), countryCode = row[0].split(".")[0], country = countries.get(countryCode);
    if (!country || record[7] !== "ADM1" || `${record[8]}.${record[10]}` !== row[0]) throw new Error(`Administrative parent codes disagree: ${row[0]}`);
    const candidates = adminShapes.get(row[3]) ?? [];
    const accepted = candidates.length === 1 && candidates[0].properties.iso_a2 === countryCode && candidates[0].properties.gn_a1_code === row[0];
    const feature = accepted ? candidates[0] : null, properties = feature?.properties ?? {};
    // Natural Earth's type labels can disagree with their GeoNames identity
    // (including Buenos Aires province). Use the primary ADM1 classification.
    const kindLabel = "Administrative region", id = `admin1:${row[3]}`;
    const place = { id, kind: "admin1", kindLabel, name: row[1], context: `${kindLabel} · ${country.name}`, parentId: country.id,
      identifiers: { geonames: row[3], ...(/^Q[1-9]\d*$/u.test(properties.wikidataid) ? { wikidata: properties.wikidataid } : {}) },
      names: aliases([row[1], row[2], record[1], record[2], ...record[3].split(","), properties.name, properties.name_alt,
        ...Object.entries(properties).filter(([key]) => key.startsWith("name_")).map(([, value]) => value)]),
      searchContext: normalizeDestinationQuery(`${kindLabel} ${country.name} ${countryCode}`), population: Number(record[14]),
      ...navigation(record, feature?.geometry, feature ? "Natural Earth 1:10m" : null),
      facts: [{ label: "Type", value: "First-order administrative division" }, ...(Number(record[14]) > 0 ? [{ label: "Population", value: number(record[14]) }] : []),
        { label: "Coordinates", value: coordinates(Number(record[4]), Number(record[5])) }], sourceRecord: provenance(record) };
    place.status = `${feature ? "Region" : "Location"} overview · ${feature ? "Natural Earth" : "GeoNames"}`;
    if (!feature) receipt.adminPointViews.push(id);
    if (candidates.length && !accepted) receipt.geometryConflicts.push({ id, code: row[0], candidates: candidates.map(({ properties: p }) => ({ id: p.adm1_code, country: p.iso_a2, code: p.gn_a1_code })) });
    places.push(place); admins.set(row[0], place); receipt.admin1++;
  }
  return { places, countries, admins, receipt };
}
