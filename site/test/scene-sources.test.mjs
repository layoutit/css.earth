import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { OBJECTS } from '../objects.mjs';
import { sceneSources } from '../scene-sources.mjs';
const sharedLabels = ['NASA SVS', 'OpenSpace', 'HYG', 'IBEX', 'LVDB', 'McConnachie', 'ESA/Hubble', 'ESO', 'NOIRLab', 'NOIRLab', 'MCXC-II'];

test('small shell attribution records match the checked scientific provenance', async () => {
  const read = async path => JSON.parse(await readFile(new URL(`../../src/objects/${path}`, import.meta.url), 'utf8'));
  const sky = await read('milky-way/source/sky/provenance.json');
  const volume = await read('milky-way/source/provenance.json');
  const stars = await read('stellar-neighbourhood/source/provenance.json');
  const heliosphere = await read('heliosphere/source/provenance.json');
  const galaxies = await read('local-group/source/provenance.json');
  const clusters = await read('galaxy-clusters/source/provenance.json');
  const m31 = await read('m31/source/provenance.json');
  const m31Recipe = await read('m31/source/recipe.json');
  const catalogue = stars.sources.find(source => source.id === 'catalogue');
  const sources = sceneSources();
  assert.equal(sources.at(-1).href, clusters.publication.url);
  assert.ok(sources.at(-1).description.startsWith(clusters.sources[0].citation));
  assert.match(sources.at(-1).description, /redshift-derived comoving.*peculiar velocities are not corrected.*R500.*not a cluster boundary/u);
  assert.deepEqual(sources.map(source => source.label), sharedLabels);
  assert.equal(sources[0].href, sky.sourcePage);
  assert.equal(sources[0].description, `${sky.title}. ${sky.credits.join('; ')}.`);
  assert.equal(sources[1].href, volume.license.dataLicenseDeclaration);
  assert.equal(sources[1].description, `${volume.title}. ${volume.authors.join(', ')}. ${volume.organizations.join('; ')}.`);
  assert.equal(sources[2].description, catalogue.credit);
  assert.equal(sceneSources([{ label: 'HYG licence', href: catalogue.url }]).length, sharedLabels.length);
  assert.equal(sources[3].href, heliosphere.publication.url);
  assert.equal(heliosphere.publication.url, `https://doi.org/${heliosphere.publication.doi}`);
  const leadAuthor = heliosphere.publication.authors[0].split(' ').at(-1);
  const year = heliosphere.publication.journal.match(/\((\d{4})\)/u)[1];
  assert.equal(sources[3].description, `${leadAuthor} et al. (${year}): IBEX-derived envelope, published Z–H model; tail distances are ENA sounding limits, not a measured heliopause closure.`);
  assert.match(heliosphere.sourceReference.variant, /Zirnstein–Heerikhuisen/u);
  assert.match(heliosphere.approximation.geometry, /All 91 coordinates.*remain exact/u);
  const lvdb = galaxies.sources.find(source => source.id === 'lvdb-v1.1.1');
  assert.equal(sources[4].href, `https://doi.org/${lvdb.citation.match(/DOI ([^;]+)/u)[1]}`);
  assert.equal(sources[4].description, `${lvdb.citation} Catalogue compilation: CC0 1.0; original measurement papers retain their separate rights.`);
  assert.match(galaxies.sources.find(source => source.id === 'lvdb-license').citation, /CC0 1.0.*separate rights/u);
  assert.equal(sources[5].href, galaxies.sources.find(source => source.id === 'mcconnachie-table1-text').url);
  const membership = galaxies.sources.find(source => source.id === 'mcconnachie-table1-2019');
  assert.ok(sources[5].description.includes(membership.citation.match(/DOI([^;]+)/u)[1]));
  assert.match(sources[5].description, /October 2019 Table 1.*LVDB host associations/u);
  assert.match(galaxies.selection.membership, /host chains supplement the historical membership table/u);
  assert.equal(sources[6].href, m31.sourcePage);
  assert.equal(m31Recipe.source.publisherUrl, m31.sourcePage);
  assert.equal(m31Recipe.source.credit, m31.credit);
  assert.equal(m31Recipe.source.license, m31.license);
  assert.equal(sources[6].description, `${m31.title}. ${m31.credit}. ${m31.license}. ${m31.displayModel}`);
  assert.doesNotMatch(sources[6].description, /NASA|public domain/u);
  assert.deepEqual(sources.filter(source => source.role.endsWith(' image')).map(source => source.role), ['M31 image', 'M33 image', 'LMC image', 'SMC image']);
  for (const id of ['m31', 'm33', 'lmc', 'smc']) {
    const provenance = await read(`${id}/source/provenance.json`), recipe = await read(`${id}/source/recipe.json`);
    const source = sources.find(source => source.role === `${id.toUpperCase()} image`);
    assert.equal(source.href, provenance.sourcePage);
    assert.equal(source.description, `${provenance.title}. ${provenance.credit}. ${provenance.license}. ${provenance.displayModel}`);
    assert.equal(recipe.source.credit, provenance.credit);
    assert.equal(recipe.source.publisherUrl, provenance.sourcePage);
    const descriptor = await read(`${id}/object.json`);
    assert.equal(descriptor.type, 'image-layer-bank');
    const prepared = await readFile(new URL(`../../src/objects/${id}/${descriptor.prepared.url}`, import.meta.url));
    assert.equal(createHash('sha256').update(prepared).digest('hex'), descriptor.prepared.sha256, `${id}: credits require the active prepared bank`);
  }
});

test('every shared route retains its object sources and the actual environment credits', async () => {
  for (const object of OBJECTS) {
    const content = JSON.parse(await readFile(new URL(`../../src/planets/${object.id}/prepared/content.json`, import.meta.url), 'utf8'));
    const sources = sceneSources(content.resources), byLabel = new Map(sources.map(source => [source.label, source]));
    for (const source of sources) assert.ok(source.role?.trim(), `${object.id}: ${source.label} needs an attribution category`);
    for (const source of content.resources) {
      const retiredPhoto = /^https?:\/\/(?:www\.)?eso\.org\/public\/images\/eso0932a\/?(?:[?#].*)?$/u.test(source.href);
      assert.equal(sources.some(candidate => candidate.href === source.href), !retiredPhoto, `${object.id}: ${source.label}`);
    }
    assert.match(byLabel.get('NASA SVS').description, /Milky Way-only.*NASA\/Goddard.*Ernie Wright \(USRA\).*ESA\/Gaia\/DPAC/u);
    assert.equal(byLabel.get('NASA SVS').href, 'https://svs.gsfc.nasa.gov/4851/');
    assert.match(byLabel.get('OpenSpace').description, /Jon Parker.*Emil Axelsson.*Carter Emmart.*National Astronomical Observatory of Japan.*American Museum of Natural History/u);
    assert.match(byLabel.get('HYG').description, /David Nash.*CC-BY-SA-4\.0/u);
    assert.equal(sources.filter(source => source.label === 'HYG').length, 1);
    assert.equal(sources.filter(source => source.label === 'IBEX').length, 1);
    assert.match(byLabel.get('IBEX').description, /Reisenfeld et al\. \(2021\).*IBEX-derived.*published Z–H model; tail distances are ENA sounding limits, not a measured heliopause closure/u);
    for (const shared of sceneSources()) assert.equal(sources.filter(source => source.href === shared.href).length, 1, `${object.id}: ${shared.label}`);
    assert.match(byLabel.get('LVDB').description, /Pace \(2025\).*v1\.1\.1.*CC0 1\.0/u);
    assert.match(byLabel.get('ESA/Hubble').description, /Digitized Sky Survey 2.*Davide De Martin.*CC-BY-4\.0.*not measured per-pixel depth/u);
    assert.equal(new Set(sources.map(source => source.href)).size, sources.length);
  }
});

test('omits only the superseded ESO panorama, preserving other ESO and object OpenSpace sources', () => {
  const retired = ['https://www.eso.org/public/images/eso0932a/', 'https://eso.org/public/images/eso0932a',
    'http://www.eso.org/public/images/eso0932a/?view=large#credit'];
  const retained = [
    { label: 'ESO observation', href: 'https://www.eso.org/public/images/eso0932b/' },
    { label: 'ESO', href: 'https://www.eso.org/' },
    { label: 'OpenSpace', role: 'scene', description: 'Globe & lighting', href: 'https://github.com/OpenSpace/OpenSpace' },
    { label: 'OpenSpace', role: 'atmosphere', description: 'Clouds & atmosphere', href: 'https://docs.openspaceproject.com/latest/content/venus/' },
  ];
  const sources = sceneSources([...retired.map(href => ({ label: 'ESO', href })), ...retained]);
  assert.deepEqual(sources.slice(0, retained.length), retained);
  assert.equal(sources.length, retained.length + sharedLabels.length);
  for (const href of retired) assert.equal(sources.some(source => source.href === href), false);
});

test('merges duplicate source links without dropping full credits or changing the caller', () => {
  const resources = [{ label: 'NASA image', role: 'image', description: 'Old short credit', href: 'https://svs.gsfc.nasa.gov/4851/#media' },
    { label: 'HYG', description: 'Catalogue', href: 'https://github.com/astronexus/HYG-Database' }];
  const original = structuredClone(resources), sources = sceneSources(resources);
  assert.equal(sources.length, sharedLabels.length);
  assert.match(sources[0].description, /Ernie Wright/u);
  assert.deepEqual(resources, original);
  assert.deepEqual(sceneSources(sources), sources);
});

test('footer and directly cached information panels use the same source projection', async () => {
  const read = name => readFile(new URL(`../components/${name}.astro`, import.meta.url), 'utf8');
  const [shell, information, object, cards] = await Promise.all([
    read('PlanetShell'), read('PlanetInformationPanel'), read('PreparedObjectPanel'), read('PreparedSidebarCards'),
  ]);
  for (const component of [shell, information]) {
    assert.match(component, /import \{ sceneSources \} from "\.\.\/scene-sources\.mjs"/u);
    assert.match(component, /const sources = sceneSources\(resources\)/u);
    assert.equal((component.match(/sources\.map\(\(resource/gu) ?? []).length, 1);
    assert.doesNotMatch(component, /resources\.map\(\(resource/u);
  }
  assert.match(shell, /<PlanetInformationPanel \{\.\.\.Astro\.props\} \/>/u);
  // Cached navigation bypasses PlanetShell: its direct information-only path
  // must reach the same projection, not depend on shell-preprocessed props.
  assert.match(cards, /<PreparedObjectPanel informationOnly/u);
  assert.match(object, /const Panel = informationOnly \? PlanetInformationPanel : PlanetShell/u);
  assert.match(object, /resources=\{content\.resources\}/u);
});
