// Run once from the repository root after acquiring the pinned Dinkinesh CMOD.
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { bodies, celestiaCommit } from './catalog.mjs';
const base = 'src/planets/sn263-beta';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const write = async (p, value) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, JSON.stringify(value, null, 2) + '\n'); };
const pin = async p => { const bytes = await readFile(p); return { expectedBytes: bytes.length, expectedSha256: createHash('sha256').update(bytes).digest('hex') }; };
for (const body of bodies) {
  const p = `src/planets/${body.id}`, s = `${p}/source`;
  try { await access(`${p}/object.json`); throw Error(`Refusing to overwrite ${body.id}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const clone = async rel => JSON.parse((await readFile(`${base}/${rel}`, 'utf8')).replaceAll('sn263-beta', body.id).replaceAll('2001 SN263 Beta', body.name));
  for (const rel of ['stars/eso0932a.tif', 'stars/ESO-IMAGE-LICENSE.md', 'stars/LICENSE.md', 'stars/hyg-v41-field.json', 'presentation/InterVariable.ttf', 'presentation/LICENSE.INTER-OFL']) {
    await mkdir(dirname(`${s}/${rel}`), { recursive: true }); await copyFile(`${base}/source/${rel}`, `${s}/${rel}`);
  }
  await write(`${s}/stars/hyg-v41-field.json`, await clone('source/stars/hyg-v41-field.json'));
  await mkdir(`${s}/shape`, { recursive: true });
  let shapePath = 'shape/model.json';
  if (body.shape) await write(`${s}/${shapePath}`, body.shape);
  else {
    shapePath = 'shape/model.obj';
    for (const name of ['dinkinesh.cmod', 'dinkinesh.cmod.license']) await copyFile(`output/galileo-lucy/celestia/${name}`, `${s}/shape/${name}`);
    const original = await pin(`${s}/shape/dinkinesh.cmod`);
    if (original.expectedBytes !== 2855080 || original.expectedSha256 !== '8dc8a6d9fc9f4138cfc44f896ca7732fdfdd9d44b10d6fb49fd43f80fa2e1b2f') throw Error('Dinkinesh CMOD differs from the reviewed release');
    execFileSync('python3', [resolve('tools/objects/source-authoring/galileo-lucy/cmod.py'), `${s}/shape/dinkinesh.cmod`, `${s}/${shapePath}`, '--volume-equivalent-radius-km', String(body.radiusKm)]);
  }
  const config = await clone('source/preparation/terrestrial.json');
  config.displayName = body.name; config.geometry.radiusKm = body.radiusKm;
  config.geometry.camera = { initialScenePitchDegrees: 20, defaultControlYawDegrees: -45, framingScale: body.id === 'selam' ? .68 : .75 };
  const terrain = config.geometry.radialTerrain;
  terrain.path = shapePath; terrain.format = body.format; terrain.grid = { metersPerUnit: 1, expectedVertices: body.id === 'dactyl' ? 258 : body.id === 'selam' ? 516 : 51101, expectedFaces: body.id === 'dactyl' ? 512 : body.id === 'selam' ? 1024 : 101512 };
  terrain.faceBudget = body.faces; terrain.simplification.targetFaces = body.faces; terrain.simplification.maximumErrorMeters = body.errorMeters;
  config.celestial.sunSource = `${body.description} ${body.qualification}`;
  await write(`${s}/preparation/terrestrial.json`, config);
  const content = await clone('source/content/object.json');
  const facts = [{ id: 'parent', label: 'Orbits', value: body.parentName }, { id: 'size', label: 'Size', value: body.axes }, { id: 'shape', label: 'Shape evidence', value: body.id === 'dinkinesh' ? 'Authored reconstruction' : 'Spacecraft images' }];
  content.panel = { introduction: `${body.introduction} ${body.qualification}`, facts, moreFacts: [] };
  content.lenses.labels = { shape: 'Shape' };
  Object.assign(content.lenses.controls[0], { label: 'Shape', detail: body.detail, title: body.title, description: body.description });
  content.lenses.controls[0].source = { id: 'shape-model', path: '../manifest.json', url: body.sourceUrl };
  content.resources = [...body.papers.map(([label, description, href]) => ({ label, description, href, role: 'facts' })), { label: 'Mission images', description: 'Resolved encounter observations and context', role: 'observations', href: body.id === 'dactyl' ? 'https://science.nasa.gov/photojournal/high-resolution-view-of-dactyl/' : 'https://science.nasa.gov/mission/lucy/' }, content.resources.at(-1)];
  content.provenance.editorial = { url: body.sourceUrl, credit: body.credit };
  content.provenance.physical = { path: '../measurements.json', credit: body.credit };
  await write(`${s}/content/object.json`, content);
  await write(`${s}/measurements.json`, { body: body.id, representation: body.description, size: body.axes, radiusKm: body.radiusKm, radiusMeaning: body.id === 'dinkinesh' ? 'Published volume-equivalent radius used for uniform model scaling' : 'Volume-equivalent radius of the declared smooth envelope', shapeParameters: body.shape ?? null, citations: body.papers, limitations: body.qualification, sourceSelection: { missionImages: 'Encounter images establish resolved shape, but a camera-controlled texture is not yet qualified.', celestia: body.id === 'dinkinesh' ? { commit: celestiaCommit, status: 'Selected attributed authored reconstruction; not a mission mesh. Original UVs preserved but texture omitted because observed-versus-filled coverage is undocumented.' } : 'Generic Dactyl texture and unregistered Selam reconstruction excluded.', imagery: 'Shared missing-imagery grid. No stock rock texture, inferred albedo, or invented terrain.' } });
  const manifest = await clone('source/manifest.json');
  manifest.inputs = manifest.inputs.slice(0, 2);
  const license = body.id === 'dinkinesh' ? 'CC-BY-4.0; retain ItzImcool and domi9 attribution and mark conversion/scaling.' : 'Numerical scientific facts; independent cssEarth tessellation MIT. Cite the original paper.';
  const entry = { id: 'shape-model', path: shapePath, origin: body.sourceUrl, credit: body.credit, license, acquisition: body.shape ? 'Reproduce from the published numerical dimensions through scaffold.mjs and the shared ellipsoid preparer.' : 'Reproduce with cmod.py from the pinned original; uniform scale to published volume-equivalent diameter.', redistribution: license, consumers: ['terrain', 'shape'], coverage: body.description, ...await pin(`${s}/${shapePath}`) };
  manifest.inputs.push(entry); manifest.generatedIntermediates = []; manifest.documents = [];
  await write(`${s}/manifest.json`, manifest);
  const nav = await clone('source/preparation/navigation.json');
  Object.assign(nav.source, { origin: body.sourceUrl, credit: body.credit, license }); nav.source.recipe.inputs = ['shape-model'];
  await write(`${s}/preparation/navigation.json`, nav);
  const acquisition = await clone('source/preparation/acquisition.json'); acquisition.operations = acquisition.operations.slice(0, 2);
  await write(`${s}/preparation/acquisition.json`, acquisition);
  const descriptor = await clone('object.json');
  delete descriptor.prepared; delete descriptor.properties.worldFrame; delete descriptor.properties.page.metadata;
  descriptor.properties.recipe.shape.radiusKm = body.radiusKm;
  await write(`${p}/object.json`, descriptor);
  await writeFile(`src/renderers/css/styles/${body.id}-surfaces.css`, (await readFile('src/renderers/css/styles/sn263-beta-surfaces.css', 'utf8')).replaceAll('sn263-beta', body.id));
  await mkdir(`tests/objects/browser/${body.id}`, { recursive: true });
  await writeFile(`tests/objects/browser/${body.id}/browser-profile.mjs`, (await readFile('tests/objects/browser/sn263-beta/browser-profile.mjs', 'utf8')).replaceAll('sn263-beta', body.id));
  await writeFile(`${p}/NOTICE.md`, `# Sources and reuse\n\n${body.credit}. ${license}\n\n${body.id === 'dinkinesh' ? 'Original model: source/shape/dinkinesh.cmod and its adjacent SPDX license. Converted from Y-up to Z-up, centered and uniformly scaled; the original topology is retained before shared preparation simplifies it. https://creativecommons.org/licenses/by/4.0/\n\n' : ''}Scientific sources are linked in source/measurements.json. This package does not redistribute paper prose or figures.\n\nESO/S. Brunier panorama: CC BY 4.0. HYG and Inter retain their notices beside the pinned sources.\n`);
  console.log(body.id, shapePath, body.radiusKm);
}
