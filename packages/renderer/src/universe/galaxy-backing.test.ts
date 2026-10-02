import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseGalaxyBacking, GALAXY_BACKING_SCHEMA } from '@cssearth/objects';
import { mountGalaxyBacking } from './galaxy-backing.js';

test('a backing mounts the shared parsed leaf and removes it when destroyed', () => {
  const { document } = parseHTML('<div id="host"></div>'), host = document.getElementById('host')!;
  const payload = parseGalaxyBacking({ schema: GALAXY_BACKING_SCHEMA, id: 'backing',
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    leaf: { texturePath: 'backing/backing.webp', style: { width: '32px', height: '16px', transform: 'translateZ(0px)',
      backgroundSize: '32px 16px', backgroundPosition: '0px 0px' } } });
  const mounted = mountGalaxyBacking({ host, before: null, payload, resolveResource: path => `/${path}` });
  const leaf = mounted.root.querySelector<HTMLElement>('s')!;
  assert.equal(leaf.style.width, payload.leaf.style.width);
  assert.equal(leaf.style.transform, payload.leaf.style.transform);
  assert.equal(leaf.style.backgroundImage, 'url("/backing/backing.webp")');
  assert.equal(host.children.length, 1);
  mounted.destroy();
  assert.equal(host.children.length, 0);
});
