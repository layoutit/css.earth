import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parsePreparedNebulaCatalog, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog } from '@cssearth/catalog';
import { catalogMarkerKind, mountCatalogMarkerKind } from './catalog-marker.js';

test('shipped classifications select the correct marker without object ID exceptions', () => {
  for (const [id, expected] of [['m45', 'open-cluster'], ['helix', 'planetary-nebula'],
    ['m42', 'nebula'], ['m8', 'nebula'], ['m1', 'nebula'], ['m2-9', 'nebula']]) {
    const catalog = parsePreparedNebulaCatalog(JSON.parse(readFileSync(
      new URL('../../../objects/' + id + '/source/nebula.json', import.meta.url), 'utf8')));
    expect(catalogMarkerKind(catalog.objects[0]!)).toBe(expected);
  }
  const galaxies = parsePreparedGalaxyCatalog(JSON.parse(readFileSync(
    new URL('../../../objects/local-group/prepared/catalogue.json', import.meta.url), 'utf8')));
  expect(catalogMarkerKind(galaxies.objects[0]!)).toBe('galaxy');
});

test('outer scene markers share the ordinary circle while retaining classification metadata', () => {
  const clusters = parsePreparedClusterCatalog(JSON.parse(readFileSync(
    new URL('../../../objects/galaxy-clusters/prepared/catalogue.json', import.meta.url), 'utf8')));
  expect(clusters.objects.every(object => catalogMarkerKind(object) === 'galaxy-cluster')).toBe(true);
  for (const kind of ['galaxy', 'nebula', 'planetary-nebula', 'open-cluster', 'galaxy-group', 'galaxy-cluster'] as const) {
    const marker = { className: '', dataset: { catalogMarkerKind: '' }, style: {}, innerHTML: '<svg></svg>', setAttribute() {} };
    mountCatalogMarkerKind(marker as unknown as HTMLElement, kind);
    expect(marker.dataset.catalogMarkerKind).toBe(kind);
    expect(marker.className).toBe('prepared-context-marker');
    expect(marker.innerHTML).toBe('');
  }
});
