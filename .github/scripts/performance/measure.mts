/** Composable build measurement CLI; writes one stable JSON document and an optional Markdown job summary. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { args, array, record, string, isMain } from '../build-compare/records.mts';
import { measure, sortedJson } from './build-measures.mts';
export async function representativeRoutes(): Promise<string[]> {
  const entries = array(JSON.parse(await readFile(new URL('./routes.json', import.meta.url), 'utf8')));
  return ['/', ...entries.map(raw => { const entry = record(raw); string(entry.capability); string(entry.objectId); return string(entry.route); })];
}
if (isMain(import.meta.url)) {
  const options = args(['--dist', '--metadata', '--out', '--routes', '--summary']);
  for (const key of ['--dist', '--metadata', '--out']) if (!options.get(key)) throw new Error(`Missing ${key}`);
  const routes = !options.get('--routes') || options.get('--routes') === 'representatives' ? await representativeRoutes() : options.get('--routes')!.split(',');
  const result = await measure(options.get('--dist')!, options.get('--metadata')!, routes);
  await mkdir(options.get('--out')!, { recursive: true });
  await writeFile(resolve(options.get('--out')!, 'measures.json'), sortedJson(result));
  const summary = `# Counted build measures\n\nRoutes: ${Object.keys(result.routes).length}\n\n` + Object.entries(result.global).filter(([key]) => /^(astro|css|transports)\.(count|raw|gzip|brotli)$/u.test(key)).map(([key, value]) => `- ${key}: ${value}`).join('\n') + '\n';
  if (options.get('--summary')) await writeFile(options.get('--summary')!, summary);
  console.log(summary);
}
