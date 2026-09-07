import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry } from '@layoutit/polycss';
import type { Polygon, ComputeTextureAtlasPlanOptions } from '@layoutit/polycss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { prepareVolumeSlices } from './volume-slices.js';
import type { VolumeSliceQuad } from './volume-slices.js';

const repo = process.cwd();
const output = resolve(repo, '.local/milky-way-proof/volume');
await mkdir(output, { recursive: true });
const prepared = await prepareVolumeSlices({ galaxioRoot: resolve(repo, '../galaxio'), outputDirectory: output,
  sliceCounts: { x: 128, y: 128, z: 32 }, radiusUnits: 10, imageWidth: 512 });
const leaves: Array<Pick<VolumeSliceQuad, 'axis' | 'id' | 'center' | 'vertices'> & { url: string; style: string }> = [];
const compileOptions: ComputeTextureAtlasPlanOptions & { textureLighting: 'baked' } = {
  tileSize: 50, layerElevation: 50, textureLighting: 'baked', seamBleed: 0,
};
let pngBytes = 0;
let rgbaBytes = 0;
for (const [index, quad] of prepared.quads.entries()) {
  const bytes = await readFile(resolve(output, quad.texturePath));
  pngBytes += bytes.length;
  rgbaBytes += quad.widthPx * quad.heightPx * 4;
  const url = `data:image/png;base64,${bytes.toString('base64')}`;
  const polygon: Polygon = { vertices: quad.vertices, uvs: quad.uvs, texture: url,
    textureImageSource: { url, width: quad.widthPx, height: quad.heightPx },
    texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
  const plan = computeTextureAtlasPlanPublic(polygon, index, compileOptions);
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
  if (!geometry) throw new Error(`PolyCSS failed to prepare quad ${quad.id}`);
  const style = `width:${geometry.leafWidth}px;height:${geometry.leafHeight}px;transform:matrix3d(${geometry.matrix});background-image:url(${url});background-size:${geometry.backgroundSize.map(value => `${value}px`).join(' ')};background-position:${geometry.backgroundPosition.map(value => `${value}px`).join(' ')}`;
  leaves.push({ axis: quad.axis, id: quad.id, url, center: quad.center, vertices: quad.vertices, style });
}
execFileSync(resolve(repo, 'node_modules/.bin/esbuild'), [resolve(repo, 'experiments/milky-way/volume-runtime.ts'), '--bundle', '--platform=browser', '--format=iife', `--outfile=${resolve(output, 'runtime.js')}`], { stdio: 'inherit' });
const runtime = await readFile(resolve(output, 'runtime.js'), 'utf8');
const scene = ['x', 'y', 'z'].map(axis => `<div class="polycss-projection" data-axis="${axis}"><div class="polycss-camera"><div class="polycss-scene"><div class="polycss-mesh" data-axis="${axis}">${leaves.filter(leaf => leaf.axis === axis).map(leaf => `<s data-slice="${leaf.id}" data-center="${leaf.center.join(',')}" style="${leaf.style}"></s>`).join('')}</div></div></div></div>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Milky Way — PolyCSS 3D volume</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050609;color:#dbe0e8;font:14px/1.45 system-ui,sans-serif}#viewport{position:absolute;inset:0;overflow:hidden;outline:none;background:#000;touch-action:none}.polycss-projection{position:absolute;inset:0;background:#000;pointer-events:none}.polycss-camera{position:absolute;inset:0;perspective-origin:50% 50%;transform-style:preserve-3d;pointer-events:none}.polycss-scene{position:absolute;left:50%;top:50%;width:0;height:0;transform-origin:0 0;transform-style:preserve-3d}.polycss-mesh{position:absolute;width:0;height:0;transform-origin:0 0;transform-style:preserve-3d}.polycss-mesh s{display:block;position:absolute;left:0;top:0;transform-origin:0 0;backface-visibility:visible;text-decoration:none;background-repeat:no-repeat;pointer-events:none}.wireframe s{outline:1px solid #54789788}header{position:fixed;left:24px;top:20px;z-index:10;pointer-events:none}h1{font-size:24px;margin:0 0 4px;font-weight:600}header p{margin:0;color:#a5b0c0;max-width:640px}nav{position:fixed;top:22px;right:24px;display:flex;gap:8px;z-index:11;flex-wrap:wrap;justify-content:flex-end;max-width:48%}button{background:#151b24;color:#dbe0e8;border:1px solid #475365;border-radius:4px;font:inherit;padding:8px 12px;cursor:pointer}button:hover,button:focus-visible{background:#27374b;border-color:#9abbdf}footer{position:fixed;left:24px;bottom:18px;right:24px;z-index:10;display:flex;gap:16px;flex-wrap:wrap;align-items:center;pointer-events:none;color:#a5b0c0;font-size:12px}footer label,footer a{pointer-events:auto}footer a{color:#a9c9f1}.help{position:fixed;left:24px;bottom:64px;color:#c6ceda;pointer-events:none;z-index:10;font-size:13px}.badge{color:#f5be89}#status{font:12px ui-monospace,monospace}input{accent-color:#a9c9f1}@media(max-width:760px){header{top:14px;left:16px}h1{font-size:20px}header p{max-width:85vw;font-size:12px}nav{top:96px;left:16px;right:16px;max-width:none;justify-content:flex-start}button{padding:6px 8px;font-size:12px}.help,footer{left:16px;right:16px;font-size:11px}.help{bottom:108px}footer{gap:6px 12px}#status{flex-basis:100%;font-size:11px}}
</style></head><body>
<div id="viewport" tabindex="0" role="application" aria-label="Navigate the Milky Way in three dimensions">${scene}</div>
<header><h1>Milky Way · PolyCSS 3D</h1><p>Prepared density slices in world space. Rotate, pan and move through the cloud.</p></header>
<nav aria-label="Camera destinations"><button data-preset="above">Above</button><button data-preset="oblique">Orbit</button><button data-preset="edge">Edge-on</button><button data-preset="below">Below</button><button data-preset="inside">Inside</button><button id="reset">Reset</button></nav>
<div class="help">Drag to orbit · Shift/right-drag to pan · Wheel to move closer<br>Click the sky, then W/A/S/D to move · Q/E down/up</div>
<footer><span id="status">Decoding ${leaves.length} prepared textures…</span><label><input type="checkbox" id="wireframe"> Show polygon edges</label><span class="badge">Volume approximation · visual proof</span><a href="manifest.json">Source + limits</a></footer>
<script id="scene-config" type="application/json">${JSON.stringify({ solarPositionUnits: prepared.solarPositionUnits })}</script><script id="resources" type="application/json">${JSON.stringify(leaves.map(leaf => leaf.url))}</script><script>${runtime.replaceAll('</script', '<\\/script')}</script></body></html>`;
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ compiler: '@layoutit/polycss@0.2.11',
  scene: 'Actual prepared 3D textured polygons; no full-frame camera-view images.',
  camera: 'cssEarth trackball math, physical perspective/orbit/pan/dolly/translation',
  handoff: 'One observer; smooth normalized ordinary-alpha blend of independently projected live 3D slice stacks.',
  faces: leaves.length, pngBytes, rgbaBytes, source: prepared.source, solarPositionUnits: prepared.solarPositionUnits, approximation: prepared.approximation,
  geometry: leaves.map(({ url: _url, style: _style, ...leaf }) => leaf),
}, null, 2));
console.log(`PREPARED POLYCSS VOLUME: ${leaves.length} real 3D faces · ${pngBytes} PNG bytes · ${rgbaBytes} decoded bytes · ${output}/index.html`);
