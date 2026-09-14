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

test('galaxy groups have outlined hexagons and clusters have filled hexagons', () => {
  const clusters = parsePreparedClusterCatalog(JSON.parse(readFileSync(
    new URL('../../../objects/galaxy-clusters/prepared/catalogue.json', import.meta.url), 'utf8')));
  expect(clusters.objects.every(object => catalogMarkerKind(object) === 'galaxy-cluster')).toBe(true);
  const marker = { dataset: {}, style: {}, innerHTML: '', setAttribute() {} };
  mountCatalogMarkerKind(marker as unknown as HTMLElement, 'galaxy-group');
  expect(marker.innerHTML).toContain('M12 3 20 7.5v9L12 21l-8-4.5v-9Z');
  expect(marker.innerHTML).not.toContain('fill="currentColor"');
  mountCatalogMarkerKind(marker as unknown as HTMLElement, 'galaxy-cluster');
  expect(marker.innerHTML).toContain('fill="currentColor"');
});
