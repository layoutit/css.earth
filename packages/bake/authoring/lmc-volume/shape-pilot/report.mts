/** Local evidence of explicit emitting geometry and the existing site's tiny approximation. */
import { appendFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp, { type OverlayOptions } from 'sharp';
import { readShapeSource, SHAPE_DIR } from './source.mts';
import { array, json, need, rec, num } from '../inputs.mts';

const linear = (v: number) => { const x = v / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
async function pixels(path: string) { const p = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true }); need(p.info.width === 128 && p.info.height === 128 && p.info.channels === 3, 'Compare equal 128 px physical grids'); return p.data; }
function measure(image: Uint8Array, reference: Uint8Array) {
  let a = 0, b = 0, l1 = 0, den = 0, ax = 0, ay = 0, bx = 0, by = 0, border = 0;
  const actualChannels = [0, 0, 0], referenceChannels = [0, 0, 0];
  for (let p = 0; p < 128 * 128; p++) { let u = 0, v = 0; for (let c = 0; c < 3; c++) { const ca = linear(image[p * 3 + c]!), cb = linear(reference[p * 3 + c]!); actualChannels[c] += ca; referenceChannels[c] += cb; u += [.2126, .7152, .0722][c]! * ca; v += [.2126, .7152, .0722][c]! * cb; l1 += Math.abs(image[p * 3 + c]! - reference[p * 3 + c]!); den += reference[p * 3 + c]!; } const x = p % 128, y = Math.floor(p / 128); a += u; b += v; ax += x * u; ay += y * u; bx += x * v; by += y * v; if (x < 4 || y < 4 || x > 123 || y > 123) border += u; }
  need(a > 0 && b > 0, 'The object must actually render');
  const shares = (v: number[]) => v.map(n => n / v.reduce((s, x) => s + x, 0)), actualShare = shares(actualChannels), referenceShare = shares(referenceChannels);
  return { lightDifferencePercent: (a / b - 1) * 100, encodedRelativeL1: l1 / den, centroidErrorPixels: Math.hypot(ax / a - bx / b, ay / a - by / b), borderLightFraction: border / a, actualChannelShares: actualShare, referenceChannelShares: referenceShare, maximumChannelShareErrorPercentagePoints: Math.max(...actualShare.map((v, c) => Math.abs(v - referenceShare[c]!) * 100)) };
}

export async function shapeReport() {
  const source = await readShapeSource(), columns = source.shapes.flatMap(s => [{ title: s.label + ': model', id: s.id, type: 'reference' }, { title: s.label + ': real site', id: s.id, type: 'site' }]), angles = ['0-0', '45-0', '90-0', '90-90'], width = 1280, tile = 320, row = 344, heading = 45, overlays: OverlayOptions[] = [], rows = [];
  const labels = columns.map((c, i) => `<text x="${i * tile + 8}" y="25">${escape(c.title)}</text>`);
  for (const shape of source.shapes) {
    const complete = rec(await json(SHAPE_DIR + shape.id + '/site/result.json')); need(complete.complete === true && complete.oneView === false && array(complete.rows).length === 7, 'All finite-object views must be captured');
    for (const v of array(complete.rows)) { const r = rec(v); need(typeof r.name === 'string', 'Missing view name'); const actual = await pixels(SHAPE_DIR + shape.id + '/site/' + r.name + '-128.png'), reference = await pixels(SHAPE_DIR + shape.id + '/' + r.name + '-reference.png'); rows.push({ shape: shape.id, name: r.name, ...measure(actual, reference) }); }
  }
  for (let y = 0; y < angles.length; y++) for (let x = 0; x < columns.length; x++) {
    const c = columns[x]!, name = c.id + '-' + angles[y]!, file = c.type === 'reference' ? SHAPE_DIR + c.id + '/' + name + '-reference.png' : SHAPE_DIR + c.id + '/site/' + name + '-128.png';
    if (x === 0) labels.push(`<text x="8" y="${heading + y * row + 17}">${['Face-on', '45 degrees', 'Edge-on Y', 'Edge-on X'][y]}</text>`);
    overlays.push({ input: await sharp(file).resize(tile, tile, { kernel: 'nearest' }).png().toBuffer(), left: x * tile, top: heading + y * row + 24 });
  }
  const height = heading + angles.length * row, text = Buffer.from(`<svg width="${width}" height="${height}"><style>text{fill:white;font:13px sans-serif}</style>${labels.join('')}</svg>`);
  overlays.unshift({ input: text, left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: '#111' } }).composite(overlays).png().toFile(SHAPE_DIR + 'sheet.png');
  const encodings = await Promise.all(['cloud', 'shell', 'background'].map(async id => ({ id, ...rec(await json(SHAPE_DIR + 'banks/' + id + '/encoding.json')) })));
  const result = { schema: 'cssearth-lmc-finite-shape-pilot@1', complete: true, model: 'l36', approvedCommit: source.approvedCommit, modelParametersChanged: 0, sourceGasGain: source.gasGain,
    status: 'Finite emission geometry and standalone real-site previews complete. Slab appearance fails; no scale-up or production promotion. Combined galaxy integration remains unqualified.',
    eligibleForFullResolution: false,
    generator: 'packages/bake/authoring/lmc-volume/shape-pilot/report.mts', tinyPixels: 128, combinedOpticalLayerBudget: 33,
    shapes: source.shapes.map(s => ({ id: s.id, label: s.label, box: s.box, primitives: s.emitters.length, kinds: Object.fromEntries(['ball', 'shell', 'filament'].map(k => [k, s.emitters.filter(e => e.object.kind === k).length])), geometrySources: [...new Set(s.emitters.map(e => e.object.source))], assumedDepth: 'The adopted l36 finite-object depths, not new distance measurements.', physicalDustColumn: 0 })),
    physicalPartition: { ownership: 'Only the selected finite gas primitives leave the background. All smooth stellar populations, diffuse gas and dust stay continuous in the background.', emissionScale: 'Original owner amplitude multiplied by the original global ionized-gas gain.', tests: 'Source-projector equivalence, luminous shell rim, rotation, exact emitter partition, fixed dust ownership and calibrated small-quad geometry.' },
    geometryCompiler: 'The shared Milky Way slab writer and compiler are reused. Tiny quads compile in pc, then every matrix, bound and physical frame returns to the common kpc coordinates. No shared source was edited.',
    encodings, actualSite: { rows, isolatedEmission: true, externalDustAndStarlightOmittedForInspection: true, localBoundsVerifiedAt45Degrees: true },
    restoration: await json(SHAPE_DIR + 'restored.json'),
    limits: ['Standalone object views use their own local bounds. A single merged galaxy volume would still impose the galaxy thin-disc axis policy on every component; that is not qualified as independent object rendering.', 'The actual site changes the pink face-on emission toward orange, and some views exceed the no-added-light criterion. The tiny slab approximation is rejected for promotion.', 'The existing dataset renderer clears axis-root black mattes. Its transparent completed-group blending remains a known shared limitation; this pilot does not correct it.', 'Scalar-alpha textures and merged optical copies remain approximations. Per-view residuals are reported rather than hidden.', 'Only the tiny 128 px rung ran. No full-resolution run, publication or phone qualification.'], evidenceDirectory: SHAPE_DIR,
  };
  await writeFile(SHAPE_DIR + 'result.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile('src/objects/lmc-volume/source/preparation/l36/finite-shapes.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile(SHAPE_DIR + 'notes.md', `# Finite emitting objects\n\nN44G is a cloud composed of ${source.shapes[0]!.emitters.length} finite gas primitives. Thirty Doradus is its complete accepted shell and filament complex, including the published hemispherical bowl and central shell. No physical source position, depth or luminosity was fitted. Their color and luminosity come from the accepted l36 source.\n\nThese are emitting gas shapes. Physical dust remains exclusively in the continuous galaxy background. The standalone images deliberately omit external dust and starlight so their geometry can be inspected. Each object uses its own spatial bounds and X/Y/Z selection.\n\nThe first very small quads were expanded by the PolyCSS edge guard. Compiling in pc and rebasing the prepared transforms to kpc fixes their physical scale; a failing geometry test protects that conversion.\n\n| View | Light difference | Encoded L1 | Centroid difference |\n| --- | ---: | ---: | ---: |\n${rows.map(r => `| ${r.name} | ${r.lightDifferencePercent.toFixed(1)}% | ${(r.encodedRelativeL1 * 100).toFixed(1)}% | ${r.centroidErrorPixels.toFixed(2)} px |`).join('\n')}\n\n| Bank | Effective face-on alpha loss |\n| --- | ---: |\n${encodings.map(r => `| ${r.id} | ${(num(rec(r).faceOnEffectiveAlphaLoss) * 100).toFixed(3)}% |`).join('\n')}\n\nAlpha loss is not luminosity loss. Each shape has 11 optical layers. The allocated continuous background has 11, for 33 total. The combined galaxy bank remains experimental because it gives every component the galaxy's thin-disc direction selector. The standalone geometry is shown before any full-resolution run or shared-renderer change. The accepted bank, descriptor, inventory and generated resource list are restored after capture.\n`);
  await appendFile(SHAPE_DIR + 'notes.md', `\nThe geometry prototype is complete, but its slab appearance is rejected for promotion. Face-on pink emission turns orange in the actual site, and the worst view gains ${Math.max(...rows.map(r => r.lightDifferencePercent)).toFixed(1)}% light. The maximum integrated channel-share error is ${Math.max(...rows.map(r => r.maximumChannelShareErrorPercentagePoints)).toFixed(1)} percentage points. The existing dataset renderer clears completed-group mattes; transparent overlap is an additional shared limitation. Independent local direction selection and correct component compositing need shared support before these shapes can join the galaxy. There is no full-resolution run.\n`);
  console.log('FINITE_SHAPE_REPORT_COMPLETE'); return result;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await shapeReport();
