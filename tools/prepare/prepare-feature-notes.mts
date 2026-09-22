// Pin source-backed feature notes for one or more objects. Usage:
//   node tools/prepare/prepare-feature-notes.mts <objectId> [...] [--wikidata <saved SPARQL result>]
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadArticleMap, prepareFeatureNotes } from '#preparation/surface-features/notes';

const args = process.argv.slice(2), dumpIndex = args.indexOf('--wikidata');
const dump = dumpIndex >= 0 ? args[dumpIndex + 1]! : null;
const ids = args.filter((arg, index) => arg !== '--wikidata' && (dumpIndex < 0 || index !== dumpIndex + 1));
const articles = await loadArticleMap(dump);
const today = new Date().toISOString().slice(0, 10);
for (const id of ids) {
  const result = await prepareFeatureNotes(id, articles, today);
  console.log(JSON.stringify({ id, ...result, path: result.path.replace(`${resolve('.')}/`, '') }));
}
