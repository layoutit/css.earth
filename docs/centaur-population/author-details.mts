import {readJsonSource,requireRecord} from '../../tools/source-values.mts';
import {shape,array,text,number,dictionary} from '../../tools/objects/terrestrial-layers/source-records.mts';
import {parseAuthoringSolid,parseAuthoringContent,parseAuthoringDescriptor} from '../../tools/source-authoring-templates.mts';
// Body-specific facts layered onto the existing Lucy approximation author.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = 'src/planets';
const read = readJsonSource;
const write = (path:string, value:unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const {bodies}=shape({bodies:array(shape({id:text}))})(await read('docs/centaur-population/inputs.json'));
const ringSource=shape({rings:array(shape({id:text,innerRadiusKm:number,outerRadiusKm:number,displayValue:number,displayOpacity:number}))})(await read('docs/centaur-population/chariklo-rings.json'));
const elementText = await readFile('packages/astronomy/src/data/asteroidElements-4.data.ts', 'utf8');
const elements = dictionary(shape({elements:shape({semiMajorAxisKm:number})}))(JSON.parse(elementText.split('export const ASTEROID_ELEMENTS_4 = ')[1].split(' satisfies')[0]));
for (const { id } of bodies) {
  const pkg = `${root}/${id}`, source = `${pkg}/source`;
  const config = parseAuthoringSolid(await read(`${source}/preparation/terrestrial.json`));
  config.distanceAu = elements[id].elements.semiMajorAxisKm / 149597870.7;
  const descriptor = requireRecord(await read(`${pkg}/object.json`));
  if (id === 'chariklo') {
    await mkdir(`${source}/rings`, { recursive: true });
    await write(`${source}/rings/occultation-2022.json`, ringSource);
    config.rings = { textureSize: 2048, bands: ringSource.rings.map(ring => ({
      id: ring.id, innerRadiusKm: ring.innerRadiusKm, outerRadiusKm: ring.outerRadiusKm,
      segments: 128, displayValue: ring.displayValue, displayOpacity: ring.displayOpacity,
      qualification: '2022 JWST F150W2 first-contact radius and width, extended as a circular annulus. Neutral gray and fixed alpha are schematic; occultation opacity is not a reflected-light scattering model.',
    })) };
    config.geometry.camera.framingScale = config.geometry.radiusKm / Math.max(...ringSource.rings.map(ring => ring.outerRadiusKm));
    requireRecord(requireRecord(descriptor.properties).recipe).rings = { source: 'terrestrial' };
    const content = parseAuthoringContent(await read(`${source}/content/object.json`));
    content.panel.moreFacts = [
      { id: 'inner-ring', label: 'C1R radius / width', value: '385.9 km / 7.04 km' },
      { id: 'outer-ring', label: 'C2R radius / width', value: '400.3 km / 1.009 km' },
      { id: 'ring-epoch', label: 'Ring measurement', value: 'JWST, 18 October 2022, first contact' },
    ];
    content.lenses.controls[0].description += ' Rings use 2022 JWST dimensions with schematic constant opacity; their widths and optical properties vary with longitude, wavelength and time.';
    content.resources.push({ label: 'Ring measurements', role: 'facts', description: 'JWST occultation constraints and their uncertainties', href: 'https://arxiv.org/abs/2510.06366' });
    await write(`${source}/content/object.json`, content);
  }
  await write(`${source}/preparation/terrestrial.json`, config);
  await write(`${pkg}/object.json`, descriptor);
}
