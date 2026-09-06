export function authoredObjectFixture(id, { path = "source/surface.json", sha256 = "a".repeat(64) } = {}) {
  return {
    schema: "cssearth-object@1", id, type: "layered-body",
    prepared: { format: "fixture@1", url: `/scenes/${id}/object.json`, sha256: "b".repeat(64) },
    properties: { recipe: {
      schema: "cssearth-authored-object@1",
      sources: [{ id: "surface", path, sha256 }],
      shape: { kind: "sphere", radiusKm: 2 },
      surfaces: [{ id: "body", source: "surface", projection: "equirectangular",
        lenses: [{ id: "normal", source: "surface" }] }],
    } },
  };
}
