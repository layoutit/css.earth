#!/usr/bin/env node
/** Every body's world billboard from the arrival photograph it already has (`@cssearth/bake/site-assets`
 * `writeWorldBillboard`). The arrival bake writes each body's as it photographs it; this brings the rest up to date. */
import { resolve } from 'node:path';
import { writeWorldBillboard } from '@cssearth/bake/site-assets';
import { readPreparedObjects } from '@cssearth/objects/node';

const root = resolve(import.meta.dirname, '../../..');
const counts = { written: 0, current: 0, none: 0 };
for (const object of readPreparedObjects(root).sceneObjects) counts[await writeWorldBillboard(root, object.id)]++;
console.log(`World billboards: ${counts.written} written, ${counts.current} current, ${counts.none} bodies without an arrival photograph of their own.`);
