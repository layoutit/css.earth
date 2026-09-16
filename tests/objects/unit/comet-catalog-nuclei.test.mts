import { testCatalogNucleus } from './comets/catalog-models.mts';
import { selectedObjectIds } from './anchor-table.mts';

// Comet nuclei delivered as native Celestia catalogue meshes with the shared no-imagery material.
const NUCLEI = ['comet-109p', 'comet-153p', 'comet-167p', 'comet-17p', 'comet-21p', 'comet-26p', 'comet-29p', 'comet-46p',
  'comet-55p', 'comet-96p', 'comet-c1956-r1', 'comet-c1973-e1', 'comet-c1983-h1', 'comet-c1995-o1', 'comet-c1996-b2',
  'comet-c2006-p1', 'comet-c2013-a1', 'comet-c2014-un271', 'comet-c2020-f3', 'comet-c2023-a3'];
for (const id of selectedObjectIds(NUCLEI)) testCatalogNucleus(id);
