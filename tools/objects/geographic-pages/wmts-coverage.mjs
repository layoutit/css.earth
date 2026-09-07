import { wmtsRow } from "./wmts-page-geometry.mjs";
import { worldCoverTileBounds } from "./worldcover-catalog.mjs";

const union = ranges => {
  const result = [];
  for (const [start, end] of ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1])) {
    const previous = result.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else result.push([start, end]);
  }
  return result;
};

// A compact, preparation-only inventory of provider tile addresses. These are
// published source footprints, not a land mask or a promise of valid pixels.
// Half-open integer runs avoid enumerating millions of individual addresses.
export function prepareWmtsCoverage(entries, zoom, { blockSide = 8, includePolar = false } = {}) {
  if (!Number.isSafeInteger(zoom) || zoom < 5 || zoom > 19 || !Number.isSafeInteger(blockSide) || blockSide < 1) throw new Error("Invalid WMTS coverage level.");
  const limit = includePolar ? 85.0511287798066 : 78.75;
  const n = 2 ** zoom, firstRow = includePolar ? 0 : Math.ceil(wmtsRow(limit, zoom)), lastRow = includePolar ? n : Math.floor(wmtsRow(-limit, zoom));
  const events = new Map();
  const add = (row, value) => { if (!events.has(row)) events.set(row, []); events.get(row).push(value); };
  for (const entry of entries) {
    const b = worldCoverTileBounds(entry.tile);
    if (b.south >= limit || b.north <= -limit) continue;
    const y0 = Math.max(firstRow, Math.floor(wmtsRow(Math.min(limit,b.north), zoom)));
    const y1 = Math.min(lastRow, Math.ceil(wmtsRow(Math.max(-limit,b.south), zoom)));
    if (y1 <= y0) continue;
    const x0 = Math.max(0, Math.floor((b.west + 180) / 360 * n));
    const x1 = Math.min(n, Math.ceil((b.east + 180) / 360 * n));
    add(y0, { id: entry.tile, range: [x0, x1] }); add(y1, { id: entry.tile });
  }
  const rows = [...events.keys()].sort((a,b)=>a-b), active = new Map(), bands = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const y0 = rows[i], y1 = rows[i + 1];
    for (const event of events.get(y0)) { if (event.range) active.set(event.id, event.range); else active.delete(event.id); }
    const ranges = union([...active.values()].map(range => [...range]));
    if (!ranges.length) continue;
    const previous = bands.at(-1);
    if (previous && previous.y1 === y0 && JSON.stringify(previous.ranges) === JSON.stringify(ranges)) previous.y1 = y1;
    else bands.push({ y0, y1, ranges });
  }
  const blockRows = new Map();
  for (const band of bands) for (let y = Math.floor(band.y0 / blockSide); y < Math.ceil(band.y1 / blockSide); y++) {
    if (!blockRows.has(y)) blockRows.set(y, []);
    blockRows.get(y).push(...band.ranges.map(([a,b])=>[Math.floor(a/blockSide),Math.ceil(b/blockSide)]));
  }
  const tileCount = bands.reduce((total, band) => total + (band.y1 - band.y0) * band.ranges.reduce((sum,[a,b])=>sum+b-a,0),0);
  const blockCount = [...blockRows.values()].reduce((total,ranges)=>total+union(ranges).reduce((sum,[a,b])=>sum+b-a,0),0);
  return { zoom, firstRow, lastRow, tileCount, blockSide, blockCount, bands };
}
