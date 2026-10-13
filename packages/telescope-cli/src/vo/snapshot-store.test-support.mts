/** Separate-process publication exercises the same shared user-owned snapshot directory. */
import { readFile } from 'node:fs/promises';
import { parseSnapshot } from '@cssearth/objects';
import { snapshotPublisher } from './snapshot-store.mts';

const path = process.argv[2], query = process.argv[3];
if (!path || query === undefined) throw new TypeError('Expected snapshot input path and query.');
const snapshot = parseSnapshot(JSON.parse(await readFile(path, 'utf8')));
console.log(JSON.stringify(await snapshotPublisher({ ...snapshot, query })()));
