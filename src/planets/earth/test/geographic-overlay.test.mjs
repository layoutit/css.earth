import assert from "node:assert/strict";
import test from "node:test";
import { prepareGeographicOverlayTile } from "../tools/city/geographic-overlay.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
const tile = {key:"sample",width:1024,height:1024,url:"/scenes/earth/sample.webp"};
test("geographic tile preparation splits at actual Earth faces and preserves one pixel source", () => {
  for (const west of [-.1,11.15,179.9,-180.1]) {
    const pieces = prepareGeographicOverlayTile(PREPARED_EARTH_SCENE,{west,east:west+.2,south:5,north:5.2},tile);
    assert.equal(pieces.length,2);
    assert.ok(pieces.every(piece=>piece.url===tile.url && piece.imageMatrix.split(",").every(n=>Number.isFinite(+n))));
    assert.ok(Math.abs(pieces.reduce((sum,p)=>sum+p.sourceBounds.east-p.sourceBounds.west,0)-.2)<1e-10);
    assert.equal(pieces[0].sourceBounds.east,pieces[1].sourceBounds.west);
    assert.notEqual(pieces[0].frameMatrix,pieces[1].frameMatrix);
  }
});
