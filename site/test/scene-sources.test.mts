import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { OBJECTS } from '../objects.mts';
import { SourceEvidence } from './source-evidence-values.mts';
import { required } from './navigation-test-values.mts';
import { parseObjectDescriptor } from '@cssearth/objects';
import { validatePreparedVolumeLenses } from '../../src/renderers/css/dist/universe.js';
import { sceneSources, sceneSourceGroups } from '../scene-sources.mts';
const sharedLabels = ['NASA SVS', 'OpenSpace', 'HYG', 'IBEX', 'LVDB', 'McConnachie', 'ESA/Hubble', 'ESO', 'NOIRLab', 'ESO VISTA', 'NOIRLab Horálek', 'NASA/IPAC WISE', 'Dryad', 'Bonanos', 'NOIRLab', 'MCXC-II'];

test('small shell attribution records match the checked scientific provenance', async () => {
  const read = async (path: string) => SourceEvidence.parse(JSON.parse(await readFile(new URL(`../../src/objects/${path}`, import.meta.url), 'utf8')));
  const sky = await read('milky-way/source/sky/provenance.json');
  const volume = await read('milky-way/source/provenance.json');
  const stars = await read('stellar-neighbourhood/source/provenance.json');
  const heliosphere = await read('heliosphere/source/provenance.json');
  const galaxies = await read('local-group/source/provenance.json');
  const clusters = await read('galaxy-clusters/source/provenance.json');
  const m31 = await read('m31/source/provenance.json');
  const m31Recipe = await read('m31/source/recipe.json');
  const catalogue = required(stars.rows('sources').find(source => source.text('id') === 'catalogue'));
  const sources = sceneSources();
  assert.equal(required(sources.at(-1)).href, clusters.text('publication', 'url'));
  assert.ok(required(sources.at(-1)).description.startsWith(clusters.rows('sources')[0].text('citation')));
  assert.match(required(sources.at(-1)).description, /redshift-derived comoving.*peculiar velocities are not corrected.*R500.*not a cluster boundary/u);
  assert.deepEqual(sources.map(source => source.label), sharedLabels);
  assert.equal(sources[0].href, sky.text('sourcePage'));
  assert.equal(sources[0].description, `${sky.text('title')}. ${sky.strings('credits').join('; ')}.`);
  assert.equal(sources[1].href, volume.text('license', 'dataLicenseDeclaration'));
  assert.equal(sources[1].description, `${volume.text('title')}. ${volume.strings('authors').join(', ')}. ${volume.strings('organizations').join('; ')}.`);
  assert.equal(sources[2].description, catalogue.text('credit'));
  assert.equal(sceneSources([{ label: 'HYG licence', href: catalogue.text('url'), role: 'catalogue', description: 'Catalogue licence' }]).length, sharedLabels.length);
  assert.equal(sources[3].href, heliosphere.text('publication', 'url'));
  assert.equal(heliosphere.text('publication', 'url'), `https://doi.org/${heliosphere.text('publication', 'doi')}`);
  const leadAuthor = required(heliosphere.strings('publication', 'authors')[0].split(' ').at(-1));
  const year = required(heliosphere.text('publication', 'journal').match(/\((\d{4})\)/u))[1];
  assert.equal(sources[3].description, `${leadAuthor} et al. (${year}): IBEX-derived envelope, published Z–H model; tail distances are ENA sounding limits, not a measured heliopause closure.`);
  assert.match(heliosphere.text('sourceReference', 'variant'), /Zirnstein–Heerikhuisen/u);
  assert.match(heliosphere.text('approximation', 'geometry'), /All 91 coordinates.*remain exact/u);
  const lvdb = required(galaxies.rows('sources').find(source => source.text('id') === 'lvdb-v1.1.1'));
  assert.equal(sources[4].href, `https://doi.org/${required(lvdb.text('citation').match(/DOI ([^;]+)/u))[1]}`);
  assert.equal(sources[4].description, `${lvdb.text('citation')} Catalogue compilation: CC0 1.0; original measurement papers retain their separate rights.`);
  assert.match(required(galaxies.rows('sources').find(source => source.text('id') === 'lvdb-license')).text('citation'), /CC0 1.0.*separate rights/u);
  assert.equal(sources[5].href, required(galaxies.rows('sources').find(source => source.text('id') === 'mcconnachie-table1-text')).text('url'));
  const membership = required(galaxies.rows('sources').find(source => source.text('id') === 'mcconnachie-table1-2019'));
  assert.ok(sources[5].description.includes(required(membership.text('citation').match(/DOI([^;]+)/u))[1]));
  assert.match(sources[5].description, /October 2019 Table 1.*LVDB host associations/u);
  assert.match(galaxies.text('selection', 'membership'), /host chains supplement the historical membership table/u);
  assert.equal(sources[6].href, m31.text('sourcePage'));
  assert.equal(m31Recipe.text('source', 'publisherUrl'), m31.text('sourcePage'));
  assert.equal(m31Recipe.text('source', 'credit'), m31.text('credit'));
  assert.equal(m31Recipe.text('source', 'license'), m31.text('license'));
  assert.equal(sources[6].description, `${m31.text('title')}. ${m31.text('credit')}. ${m31.text('license')}. ${m31.text('displayModel')}`);
  assert.doesNotMatch(sources[6].description, /NASA|public domain/u);
  assert.deepEqual(sources.filter(source => source.role.endsWith(' image')).map(source => source.role), ['M31 image', 'M33 image', 'LMC VISTA image', 'LMC Horálek image', 'LMC WISE image', 'SMC image']);
  for (const id of ['m31', 'm33', 'smc']) {
    const provenance = await read(`${id}/source/provenance.json`), recipe = await read(`${id}/source/recipe.json`);
    const source = required(sources.find(source => source.role === `${id.toUpperCase()} image`));
    assert.equal(source.href, provenance.text('sourcePage'));
    assert.equal(source.description, `${provenance.text('title')}. ${provenance.text('credit')}. ${provenance.text('license')}. ${provenance.text('displayModel')}`);
    assert.equal(recipe.text('source', 'credit'), provenance.text('credit'));
    assert.equal(recipe.text('source', 'publisherUrl'), provenance.text('sourcePage'));
    const descriptor = parseObjectDescriptor((await read(`${id}/object.json`)).value);
    assert.equal(descriptor.type, 'image-layer-bank');
    const prepared = await readFile(new URL(`../../src/objects/${id}/${required(descriptor.prepared).url}`, import.meta.url));
    assert.equal(createHash('sha256').update(prepared).digest('hex'), required(descriptor.prepared).sha256, `${id}: credits require the active prepared bank`);
  }
  const lmcDescriptor = parseObjectDescriptor((await read('lmc/object.json')).value);
  assert.equal(lmcDescriptor.type, 'volume-lens-bank');
  const lmcBytes = await readFile(new URL(`../../src/objects/lmc/${required(lmcDescriptor.prepared).url}`, import.meta.url));
  assert.equal(createHash('sha256').update(lmcBytes).digest('hex'), required(lmcDescriptor.prepared).sha256);
  const bank = validatePreparedVolumeLenses(SourceEvidence.parse(JSON.parse(lmcBytes.toString('utf8'))).field('data'));
  const activeLmcImages = sources.filter(source => source.role.startsWith('LMC ') && source.role.endsWith(' image'));
  assert.deepEqual(activeLmcImages.map(source => source.href), bank.lenses.map(lens => lens.sourceUrl));
  for (const lens of bank.lenses) {
    const provenance = await read(`lmc/source/lenses/${lens.id}/provenance.json`);
    const result = await read(`lmc/source/lenses/${lens.id}/result.json`);
    const catalogue = await read(`lmc/source/lenses/${lens.id}/catalogue-stars.json`);
    const image = required(activeLmcImages.find(source => source.href === lens.sourceUrl));
    assert.equal(image.href, result.text('subject', 'sourcePageUrl'));
    assert.equal(image.href, provenance.text('request', 'sourcePageUrl'));
    assert.equal(image.description, `${lens.description} ${provenance.text('request', 'credit')}.`);
    assert.deepEqual(lens.volume.provenance, provenance.value);
    const model = required(sources.find(source => source.role === 'LMC density model'));
    assert.equal(model.href, result.text('subject', 'density', 'sourcePageUrl'));
    assert.equal(model.description, `${result.text('subject', 'density', 'credit')} ${result.text('subject', 'density', 'modelNote')}`);
    const starSource = required(sources.find(source => source.role === 'LMC stars'));
    assert.equal(starSource.href, catalogue.text('sourceUrl'));
    assert.equal(starSource.description, `${catalogue.text('credit')}. ${catalogue.text('depthAssumption')}`);
    const modelPin = provenance.child('canonicalCloud', 'provenance');
    const modelBytes = await readFile(new URL(`../../${modelPin.text('path')}`, import.meta.url));
    assert.equal(createHash('sha256').update(modelBytes).digest('hex'), modelPin.text('sha256'));
    const starsPin = provenance.child('request', 'stars');
    const starBytes = await readFile(new URL(`../../${starsPin.text('path')}`, import.meta.url));
    assert.equal(createHash('sha256').update(starBytes).digest('hex'), starsPin.text('sha256'));
  }
  const registration = required(sources.find(source => source.role === 'LMC registration'));
  const smash = await read('lmc/source/provenance.json');
  assert.equal(registration.href, smash.text('sourcePage'));
  assert.ok(registration.description.includes(smash.text('credit')));
  assert.match(registration.description, /reference image and sky registration/u);
  assert.equal(sources.some(source => source.role === 'LMC image'), false);
  for (const source of sources.filter(source => source.role.startsWith('LMC '))) {
    assert.doesNotMatch(source.description, /32 normalized parametric slabs|high-frequency midplane residual/u);
  }

});

test('every shared route retains its object sources and the actual environment credits', async () => {
  for (const object of OBJECTS) {
    const content = SourceEvidence.parse(JSON.parse(await readFile(new URL(`../../src/planets/${object.id}/prepared/content.json`, import.meta.url), 'utf8')));
    const resources = content.rows('resources').map(source => ({ label: source.text('label'), href: source.text('href'), role: source.text('role'), description: source.text('description') }));
    const sources = sceneSources(resources), byLabel = new Map(sources.map(source => [source.label, source]));
    for (const source of sources) assert.ok(source.role?.trim(), `${object.id}: ${source.label} needs an attribution category`);
    for (const source of resources) {
      const retiredPhoto = /^https?:\/\/(?:www\.)?eso\.org\/public\/images\/eso0932a\/?(?:[?#].*)?$/u.test(source.href);
      assert.equal(sources.some(candidate => candidate.href === source.href), !retiredPhoto, `${object.id}: ${source.label}`);
    }
    assert.match(required(byLabel.get('NASA SVS')).description, /Milky Way-only.*NASA\/Goddard.*Ernie Wright \(USRA\).*ESA\/Gaia\/DPAC/u);
    assert.equal(required(byLabel.get('NASA SVS')).href, 'https://svs.gsfc.nasa.gov/4851/');
    assert.match(required(byLabel.get('OpenSpace')).description, /Jon Parker.*Emil Axelsson.*Carter Emmart.*National Astronomical Observatory of Japan.*American Museum of Natural History/u);
    assert.match(required(byLabel.get('HYG')).description, /David Nash.*CC-BY-SA-4\.0/u);
    assert.equal(sources.filter(source => source.label === 'HYG').length, 1);
    assert.equal(sources.filter(source => source.label === 'IBEX').length, 1);
    assert.match(required(byLabel.get('IBEX')).description, /Reisenfeld et al\. \(2021\).*IBEX-derived.*published Z–H model; tail distances are ENA sounding limits, not a measured heliopause closure/u);
    for (const shared of sceneSources()) assert.equal(sources.filter(source => source.href === shared.href).length, 1, `${object.id}: ${shared.label}`);
    assert.match(required(byLabel.get('LVDB')).description, /Pace \(2025\).*v1\.1\.1.*CC0 1\.0/u);
    assert.match(required(byLabel.get('ESA/Hubble')).description, /Digitized Sky Survey 2.*Davide De Martin.*CC-BY-4\.0.*not measured per-pixel depth/u);
    assert.equal(new Set(sources.map(source => source.href)).size, sources.length);
  }
});

test('omits only the superseded ESO panorama, preserving other ESO and object OpenSpace sources', () => {
  const retired = ['https://www.eso.org/public/images/eso0932a/', 'https://eso.org/public/images/eso0932a',
    'http://www.eso.org/public/images/eso0932a/?view=large#credit'];
  const retained = [
    { label: 'ESO observation', role: 'image', description: 'Observation', href: 'https://www.eso.org/public/images/eso0932b/' },
    { label: 'ESO', role: 'publisher', description: 'Publisher', href: 'https://www.eso.org/' },
    { label: 'OpenSpace', role: 'scene', description: 'Globe & lighting', href: 'https://github.com/OpenSpace/OpenSpace' },
    { label: 'OpenSpace', role: 'atmosphere', description: 'Clouds & atmosphere', href: 'https://docs.openspaceproject.com/latest/content/venus/' },
  ];
  const sources = sceneSources([...retired.map(href => ({ label: 'ESO', href, role: 'image', description: 'Retired image' })), ...retained]);
  assert.deepEqual(sources.slice(0, retained.length), retained);
  assert.equal(sources.length, retained.length + sharedLabels.length);
  for (const href of retired) assert.equal(sources.some(source => source.href === href), false);
});

test('merges duplicate source links without dropping full credits or changing the caller', () => {
  const resources = [{ label: 'NASA image', role: 'image', description: 'Old short credit', href: 'https://svs.gsfc.nasa.gov/4851/#media' },
    { label: 'HYG', role: 'catalogue', description: 'Catalogue', href: 'https://github.com/astronexus/HYG-Database' }];
  const original = structuredClone(resources), sources = sceneSources(resources);
  assert.equal(sources.length, sharedLabels.length);
  assert.match(sources[0].description, /Ernie Wright/u);
  assert.deepEqual(resources, original);
  assert.deepEqual(sceneSources(sources), sources);
});

test('footer groups print a shared provider name once and keep every source link', () => {
  const sources = [
    { label: 'NASA Science', role: 'facts', href: 'https://science.nasa.gov/', description: 'Facts' },
    { label: 'JPL', role: 'orbit', href: 'https://ssd.jpl.nasa.gov/', description: 'Orbit' },
    { label: 'NASA/IPAC WISE', role: 'LMC WISE image', href: 'https://irsa.ipac.caltech.edu/', description: 'Infrared' },
    { label: 'NOIRLab', role: 'LMC registration', href: 'https://noirlab.edu/public/images/noirlab2030a/', description: 'LMC' },
    { label: 'NOIRLab', role: 'SMC image', href: 'https://noirlab.edu/public/images/noirlab2030b/', description: 'SMC' },
  ];
  const groups = sceneSourceGroups(sources);
  assert.deepEqual(groups.map(group => group.provider), ['NASA', '', 'NOIRLab']);
  assert.deepEqual(groups.map(group => group.members.map(member => member.part)),
    [['Science', 'IPAC WISE'], ['JPL'], ['LMC registration', 'SMC image']]);
  assert.deepEqual(new Set(groups.flatMap(group => group.members.map(member => member.href))), new Set(sources.map(source => source.href)),
    'every source keeps its own link; grouping gathers a provider’s entries together');
  assert.deepEqual(sceneSourceGroups([sources[1]]), [{ provider: '', members: [{ ...sources[1], part: 'JPL' }] }],
    'a lone provider keeps its whole label');
});

test('app credits and prepared body provenance have separate consumers on direct and cached routes', async () => {
  const read = (name: string) => readFile(new URL(`../components/${name}.astro`, import.meta.url), 'utf8');
  const [shell, information, object, cards, context] = await Promise.all([
    read('PlanetShell'), read('PlanetInformationPanel'), read('PreparedObjectPanel'), read('PreparedSidebarCards'), read('DatasetContextPanels'),
  ]);
  assert.match(shell, /const sources = sceneSources\(resources\)/u);
  assert.doesNotMatch(information, /sceneSources/u);
  assert.match(information, /<DatasetContextPanels \{\.\.\.Astro\.props\}/u);
  assert.doesNotMatch(context, /sceneSources/u);
  assert.match(context, /datasetContext\(objectId, lens\.id, provenance,/u);
  assert.match(object, /prepared\/provenance\.json/u);
  assert.doesNotMatch(object, /sourceManifests|sourceCharts|sourceLenses/u);
  assert.match(object, /resources=\{content.resources\}/u);
  assert.match(object, /provenance=\{provenance\}/u);
  assert.match(cards, /<PreparedObjectPanel informationOnly/u);
  assert.match(object, /const Panel = informationOnly \? PlanetInformationPanel : PlanetShell/u);
  assert.match(shell, /<PlanetInformationPanel \{\.\.\.Astro\.props\} \/>/u);
});
