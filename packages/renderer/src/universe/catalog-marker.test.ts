import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parsePreparedNebulaCatalog, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog } from '@cssearth/catalog';
import { catalogMarkerKind, catalogMarkerSvg, mountCatalogMarkerKind } from './catalog-marker.js';

test('shipped classifications select the correct marker without object ID exceptions', () => {
  for (const [id, expected] of [['m45', 'open-cluster'], ['helix', 'planetary-nebula'],
    ['m42', 'nebula'], ['m8', 'nebula'], ['m1', 'nebula'], ['m2-9', 'nebula']]) {
    const catalog = parsePreparedNebulaCatalog(JSON.parse(readFileSync(
      new URL('../../../../src/objects/' + id + '/source/nebula.json', import.meta.url), 'utf8')));
    assert.equal(catalogMarkerKind(catalog.objects[0]!), expected);
  }
  const galaxies = parsePreparedGalaxyCatalog(JSON.parse(readFileSync(
    new URL('../../../../src/objects/local-group/prepared/catalogue.json', import.meta.url), 'utf8')));
  assert.equal(catalogMarkerKind(galaxies.objects[0]!), 'galaxy');
});

test('outer scene markers share the ordinary circle while retaining classification metadata', () => {
  const clusters = parsePreparedClusterCatalog(JSON.parse(readFileSync(
    new URL('../../../../src/objects/galaxy-clusters/prepared/catalogue.json', import.meta.url), 'utf8')));
  assert.equal(clusters.objects.every(object => catalogMarkerKind(object) === 'galaxy-cluster'), true);
  for (const kind of ['galaxy', 'nebula', 'planetary-nebula', 'open-cluster', 'globular-cluster', 'galaxy-group', 'galaxy-cluster'] as const) {
    const marker = { className: '', dataset: { catalogMarkerKind: '' }, style: {}, innerHTML: '<svg></svg>', setAttribute() {} };
    mountCatalogMarkerKind(marker as unknown as HTMLElement, kind);
    assert.equal(marker.dataset.catalogMarkerKind, kind);
    assert.equal(marker.className, 'prepared-context-marker');
    assert.equal(marker.innerHTML, '');
  }
});

test('globular-cluster kind selects a stellar-cluster marker independently of its display name', () => {
  const catalog = parsePreparedNebulaCatalog(JSON.parse(readFileSync(
    new URL('../../../../src/objects/m45/source/nebula.json', import.meta.url), 'utf8')));
  const cluster = { ...catalog.objects[0]!, kind: 'globular-cluster' as const };
  assert.equal(catalogMarkerKind(cluster), 'globular-cluster');
  assert.ok(catalogMarkerSvg('globular-cluster').includes('<circle'));
  assert.notEqual(catalogMarkerSvg('globular-cluster'), catalogMarkerSvg('nebula'));
});
