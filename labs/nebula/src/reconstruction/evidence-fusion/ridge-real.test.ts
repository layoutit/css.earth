/** Explicit local-data verification; ordinary tests do not need ignored native/source caches. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { prepareEvidenceInputs } from './provider.js';
import { combineEvidence } from './combine.js';
import { buildRidgeGraph } from './ridge-graph.js';

test('real three-source ridge graph preserves every sampled footprint and projects onto the registered source', { skip: process.env.NEBULA_RIDGE_REAL !== '1' }, async () => {
  const inputs = await prepareEvidenceInputs(process.cwd(), '.local/nebula-lab/observations/helix/structures/catalogue.json');
  const combined = combineEvidence(inputs, { channel: 'ridges', weights: [1, 1, 1], sensitivity: 1 });
  const start = performance.now(), graph = buildRidgeGraph(inputs, combined), graphMs = performance.now() - start;
  assert.ok(graph.polylines.length > 0); assert.ok(graph.nodes.length > 0);
  for (const line of graph.polylines) for (let i = 0; i < line.points.length; i++) {
    const point = line.points[i], p = Math.floor(point.y) * graph.grid.width + Math.floor(point.x);
    assert.ok(point.score >= graph.settings.threshold); assert.ok(point.supportMask > 0);
    if (i) assert.ok(Math.hypot(point.x - line.points[i - 1].x, point.y - line.points[i - 1].y) <= Math.SQRT2 + 1e-9);
    for (let s = 0; s < inputs.sources.length; s++) {
      const eligible = inputs.sources[s].footprint[p] && inputs.sources[s].channels.ridges.coverage[p] && combined.coverage[s][p];
      assert.equal(point.sourceValues[s], eligible ? combined.planes[s][p] : null);
    }
  }
  assert.deepEqual(buildRidgeGraph(inputs, combined), graph);
  const directory = resolve('.local/nebula-lab/evidence-fusion/ridge-verification', graph.id); await mkdir(directory, { recursive: true });
  const { width, height } = inputs.grid;
  const reference = await sharp(inputs.sources[2].registeredRgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const palette = ['#69d4a5', '#ba97f2', '#f3b669'];
  const paths = graph.polylines.map(line => {
    const main = line.sourceSupport.reduce((best, support, s) => support.supportedFraction > line.sourceSupport[best].supportedFraction ? s : best, 0);
    return `<polyline points="${line.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${palette[main]}" stroke-width="1.2"/>`;
  }).join('');
  const junctions = graph.nodes.filter(node => node.kind === 'junction').map(node => `<circle cx="${node.x}" cy="${node.y}" r="2" fill="#fff"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height}" viewBox="0 0 ${width * 2} ${height}"><rect width="100%" height="100%" fill="#080a10"/><image width="${width}" height="${height}" href="data:image/png;base64,${reference.toString('base64')}"/><g transform="translate(${width},0)"><image opacity=".5" width="${width}" height="${height}" href="data:image/png;base64,${reference.toString('base64')}"/>${paths}${junctions}</g></svg>`;
  await writeFile(resolve(directory, 'ridge-graph.json'), JSON.stringify(graph));
  await writeFile(resolve(directory, 'ridge-overlay.svg'), svg);
  await sharp(Buffer.from(svg)).png().toFile(resolve(directory, 'ridge-overlay.png'));
  const report = { graphId: graph.id, inputIdentity: inputs.identity, graphMs, nodes: graph.nodes.length, junctions: graph.nodes.filter(n => n.kind === 'junction').length,
    polylines: graph.polylines.length, points: graph.polylines.reduce((n, p) => n + p.points.length, 0), jsonBytes: Buffer.byteLength(JSON.stringify(graph)), diagnostics: graph.diagnostics };
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ directory, ...report }));
});
