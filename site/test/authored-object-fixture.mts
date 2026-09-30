export interface AuthoredObjectFixtureOptions {
  readonly path?: string;
}

export function authoredObjectFixture(id: string, { path = "source/surface.json" }: AuthoredObjectFixtureOptions = {}) {
  return {
    schema: "cssearth-object@2", id, type: "layered-body",
    prepared: { format: "fixture@1", url: `/scenes/${id}/object.json` },
    properties: { recipe: {
      schema: "cssearth-authored-object@2",
      sources: [{ id: "surface", path }],
      shape: { kind: "sphere", radiusKm: 2 },
      surfaces: [{ id: "body", source: "surface", projection: "equirectangular",
        datasets: [{ id: "normal", source: "surface" }] }],
    } },
  };
}
