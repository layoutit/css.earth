import assert from "node:assert/strict";
import test from "node:test";
import { prepareAdministrativePlaces, principalNavigationBounds } from "../tools/prepare-administrative-places.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";

function fixture() {
  const country = Array(19).fill("");
  Object.assign(country, { 0: "AR", 1: "ARG", 4: "Argentina", 5: "Buenos Aires", 6: "2780400", 7: "45900000", 16: "3865483" });
  const record = (id, name, type, code) => {
    const row = Array(19).fill("");
    Object.assign(row, { 0: id, 1: name, 2: name, 4: "-31.5", 5: "-64", 6: "A", 7: type, 8: "AR", 10: code, 14: "100000", 18: "2026-09-04" }); return row;
  };
  return { countryRows: [country], adminRows: [["AR.05", "Córdoba", "Cordoba", "3860255"]],
    records: new Map([["3865483", record("3865483", "Argentina", "PCLI", "00")], ["3860255", record("3860255", "Córdoba", "ADM1", "05")]]),
    legacyCountryFeatures: [], countryFeatures: [], adminFeatures: [], scene: PREPARED_EARTH_SCENE };
}

test("absent and ambiguous geometry retain source records and never invent boundaries or parents", () => {
  const input = fixture(), first = prepareAdministrativePlaces(input);
  assert.equal(first.places.length, 2);
  assert.deepEqual(first.places.map(p => p.parentId), ["earth", "country:AR"]);
  for (const entity of first.places) {
    assert.deepEqual(entity.navigation, { kind: "source-point", source: "GeoNames" });
    assert.deepEqual([entity.longitude, entity.latitude], [-64, -31.5]);
    assert.ok(Object.values(entity.camera).every(Number.isFinite));
  }
  const feature = { properties: { gn_id: 3860255, iso_a2: "AR", gn_a1_code: "AR.05", adm1_code: "source-id" },
    geometry: { type: "Polygon", coordinates: [[[-65, -32], [-63, -32], [-63, -30], [-65, -30], [-65, -32]]] } };
  const mapped = prepareAdministrativePlaces({ ...input, adminFeatures: [feature] });
  assert.equal(mapped.admins.get("AR.05").navigation.kind, "principal-area");
  for (const features of [[feature, feature], [{ ...feature, properties: { ...feature.properties, iso_a2: "CL" } }]]) {
    const ambiguous = prepareAdministrativePlaces({ ...input, adminFeatures: features });
    assert.deepEqual(ambiguous.places, first.places);
    assert.equal(ambiguous.receipt.geometryConflicts.length, 1);
  }
});

test("administrative identity and parent-code disagreements fail before publishing fabricated records", () => {
  const input = fixture(); input.records.get("3860255")[10] = "02";
  assert.throws(() => prepareAdministrativePlaces(input), /parent codes disagree/);
  input.records.delete("3860255");
  assert.throws(() => prepareAdministrativePlaces(input), /Missing or invalid/);
});

test("navigation bounds unwrap the dateline and select the source principal polygon", () => {
  const polygon = [[178, -18], [-179, -18], [-179, -16], [178, -16], [178, -18]];
  assert.deepEqual(principalNavigationBounds({ type: "Polygon", coordinates: [polygon] }, 179), [178, -18, 181, -16]);
  assert.deepEqual(principalNavigationBounds({ type: "MultiPolygon", coordinates: [[[[170, -15], [170.1, -15], [170.1, -14.9], [170, -15]]], [polygon]] }, 179), [178, -18, 181, -16]);
  assert.throws(() => principalNavigationBounds({ type: "Polygon", coordinates: [[[0, 0], [1, NaN], [2, 1], [0, 0]]] }, 0), /invalid coordinates/);
});
