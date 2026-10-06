import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A small authored world; no restored object assets are needed. */
export function worldContextFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'cssearth-world-context-'));
  const body = (id: string, x: number, memberIds: string[] = []) => ({
    id, name: id, color: '#abcdef', positionM: [x, 0, 0], radiusM: 1,
    ...(id === 'sun' || id === 'plain-star' ? {} : { orbit: { centerBodyId: id === 'moon' ? 'earth' : id === 'phobos' ? 'mars' : 'sun', vertexCount: 8, fullTrail: true } }),
    ...(memberIds.length ? { systemView: { memberIds, memberRadiiM: memberIds.map(() => 1) } } : {}),
  });
  const summary = {
    schema: 'cssearth-world-context-summary@2',
    frame: { referenceFrame: 'world', epochJdTt: 1, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 },
    focus: body('sun', 0, ['earth', 'venus', 'mars']), bodies: [],
    sky: { sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' },
    camera: { minimumDistanceM: 1, maximumDistanceM: 1e25, framingReferenceZoom: 1,
      presentation: {
        projection: { model: 'css-perspective-shared-with-sky', cssPerspective: '100px' },
        dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .01, minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 1 },
        levelOfDetail: { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20, billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4 },
        orbitLineFade: { visibleBelowDiscHeightShare: .1, hiddenAboveDiscHeightShare: .3 },
        drag: { model: 'screen-axis-tumble' },
      } },
    system: { fadeOutStartDistanceM: 1e14, hiddenDistanceM: 1e16 },
    volume: { objectId: 'galaxy-volume', fadeStartDistanceM: 1e20, fullDistanceM: 1e21 },
    stars: { objectId: 'stars', fadeStartDistanceM: 1e12, fullDistanceM: 1e13 },
  };
  const system = (id: string, bodies: ReturnType<typeof body>[], places = false) => ({
    schema: 'cssearth-world-system@1', id, orbitBanks: Object.fromEntries(bodies.filter(body => body.orbit).map(body => [body.id, 8])), systemNames: [], discoveries: [], billboard: {},
    bodies: { id: bodies.map(body => body.id), name: bodies.map(body => body.name), color: bodies.map(body => body.color),
      positionM: bodies.map(body => body.positionM), radiusM: bodies.map(body => body.radiusM), systemView: bodies.map(body => body.systemView ?? null), orbit: bodies.map(body => body.orbit ?? null) },
    ...(places ? { places: true } : {}),
  });
  const inputs: Record<string, unknown> = {
    summary,
    solar: system('solar-system', [body('earth', 10, ['moon']), body('venus', 20), body('mars', 30, ['phobos'])], true),
    earth: system('earth-system', [body('moon', 11)]),
    mars: system('mars-system', [body('phobos', 31)]),
    row: system('plain-star', [body('plain-star', 40)]),
  };
  for (const [name, value] of Object.entries(inputs)) writeFileSync(join(directory, `${name}.json`), JSON.stringify(value));
  return {
    read(name: string): unknown { return JSON.parse(readFileSync(join(directory, `${name}.json`), 'utf8')); },
    remove() { rmSync(directory, { recursive: true, force: true }); },
  };
}
