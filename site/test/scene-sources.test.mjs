import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OBJECTS } from '../objects.mjs';
import { sceneSources } from '../scene-sources.mjs';

test('small shell attribution records match the checked scientific provenance', async () => {
  const read = async path => JSON.parse(await readFile(new URL(`../../src/objects/${path}`, import.meta.url), 'utf8'));
  const sky = await read('milky-way/source/sky/provenance.json');
  const volume = await read('milky-way/source/provenance.json');
  const stars = await read('stellar-neighbourhood/source/provenance.json');
  const heliosphere = await read('heliosphere/source/provenance.json');
  const catalogue = stars.sources.find(source => source.id === 'catalogue');
  const sources = sceneSources();
  assert.equal(sources[0].href, sky.sourcePage);
  assert.equal(sources[0].description, `${sky.title}. ${sky.credits.join('; ')}.`);
  assert.equal(sources[1].href, volume.license.dataLicenseDeclaration);
  assert.equal(sources[1].description, `${volume.title}. ${volume.authors.join(', ')}. ${volume.organizations.join('; ')}.`);
  assert.equal(sources[2].description, catalogue.credit);
  assert.equal(sceneSources([{ label: 'HYG licence', href: catalogue.url }]).length, 4);
  assert.equal(sources[3].href, heliosphere.publication.url);
  assert.equal(heliosphere.publication.url, `https://doi.org/${heliosphere.publication.doi}`);
  const leadAuthor = heliosphere.publication.authors[0].split(' ').at(-1);
  const year = heliosphere.publication.journal.match(/\((\d{4})\)/u)[1];
  assert.equal(sources[3].description, `${leadAuthor} et al. (${year}): IBEX-derived envelope, published Z–H model; tail distances are ENA sounding limits, not a measured heliopause closure.`);
  assert.match(heliosphere.sourceReference.variant, /Zirnstein–Heerikhuisen/u);
  assert.match(heliosphere.approximation.geometry, /All 91 coordinates.*remain exact/u);
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
  assert.equal(sources.length, retained.length + 4);
  for (const href of retired) assert.equal(sources.some(source => source.href === href), false);
});

test('merges duplicate source links without dropping full credits or changing the caller', () => {
  const resources = [{ label: 'NASA image', role: 'image', description: 'Old short credit', href: 'https://svs.gsfc.nasa.gov/4851/#media' },
    { label: 'HYG', description: 'Catalogue', href: 'https://github.com/astronexus/HYG-Database' }];
  const original = structuredClone(resources), sources = sceneSources(resources);
  assert.equal(sources.length, 4);
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
