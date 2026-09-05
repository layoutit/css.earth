import test from "node:test";
import assert from "node:assert/strict";
import { rotationAxisAngle, sampleDestinationFlight } from "./destination-flight.mjs";


const plan = { startZoom: 512, targetZoom: 256, overviewZoom: 1.1, angularDistance: 160 };
test("distant city flights use a bounded pullback rather than a globe detour", () => {
  assert.deepEqual(sampleDestinationFlight(plan, 0), { rotation: 0, zoom: 512 });
  assert.deepEqual(sampleDestinationFlight(plan, 1), { rotation: 1, zoom: 256 });
  assert.ok(sampleDestinationFlight(plan, .1).zoom < 512);
  for (let i = 0; i <= 100; i++) {
    assert.ok(sampleDestinationFlight(plan, i / 100).zoom >= 128);
  }
  const betweenCities = { ...plan, targetZoom: 512 };
  assert.ok(Math.abs(sampleDestinationFlight(betweenCities, .5).zoom - 256) < 1e-8);
});
test("globe approach and return are monotonic, with zoom and rotation moving together", () => {
  for (const [startZoom, targetZoom] of [[1.75, 512], [.42, 512], [512, 1.75], [512, .42]]) {
    const flight = { ...plan, startZoom, targetZoom };
    let previous = startZoom;
    for (let i = 1; i <= 100; i++) {
      const frame = sampleDestinationFlight(flight, i / 100);
      assert.ok(startZoom < targetZoom ? frame.zoom >= previous : frame.zoom <= previous);
      assert.ok(frame.zoom >= Math.min(startZoom, targetZoom) && frame.zoom <= Math.max(startZoom, targetZoom));
      previous = frame.zoom;
    }
    const moving = sampleDestinationFlight(flight, .1);
    assert.notEqual(moving.zoom, startZoom);
    assert.ok(moving.rotation > 0 && moving.rotation < 1);
  }
});
test("nearby destinations retain city scale and finish at exact endpoints", () => {
  const nearby = { ...plan, angularDistance: 1 };
  for (let i = 0; i <= 100; i++) {
    const frame = sampleDestinationFlight(nearby, i / 100);
    assert.ok(frame.zoom >= 256 && frame.zoom <= 512);
    assert.ok(frame.rotation >= 0 && frame.rotation <= 1);
  }
});
test("rotation extraction is stable at identity, quarter turns, and antipodes", () => {
  const matrix = (rows) => Object.fromEntries(rows.flatMap((row, r) => row.map((value, c) => [`m${c + 1}${r + 1}`, value])));
  assert.equal(rotationAxisAngle(matrix([[1,0,0],[0,1,0],[0,0,1]])).degrees, 0);
  for (const [rows, axis, degrees] of [
    [[[1,0,0],[0,0,-1],[0,1,0]], [1,0,0], 90],
    [[[0,0,1],[0,1,0],[-1,0,0]], [0,1,0], 90],
    [[[-1,0,0],[0,-1,0],[0,0,1]], [0,0,1], 180],
    [[[1,0,0],[0,-1,0],[0,0,-1]], [1,0,0], 180],
    [[[-1,0,0],[0,1,0],[0,0,-1]], [0,1,0], 180],
  ]) {
    const result = rotationAxisAngle(matrix(rows));
    assert.ok(Math.abs(result.degrees - degrees) < 1e-10);
    assert.deepEqual(result.axis, axis);
  }
});
