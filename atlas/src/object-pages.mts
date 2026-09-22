import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { SITE_ORIGIN } from '../../site/seo.mts';
import { discoveryDescription, isDiscoveryAnchor, parseObjectDiscovery } from '../../site/object-discovery.mts';
import {
  APP_ORIGIN, OBJECTS_DIRECTORY, REPOSITORY, REPOSITORY_URL, formatBytes, isRecord, list, readJson, readObjects, systemGroups, text,
  type ObjectRecord, type SystemEntry,
} from './objects.mts';

const NOTE_GROUPS = [
  { status: 'unresolved', label: 'Unresolved' },
  { status: 'deferred', label: 'Deferred' },
  { status: 'included', label: 'Included' },
  { status: 'excluded', label: 'Excluded' },
] as const;

/** One Starlight page per object README, plus the main page. Pages rebuild when a package file changes in dev. */
export function objectPagesLoader(): Loader {
  return {
    name: 'cssearth-object-pages',
    async load(context) {
      await loadPages(context);
      context.watcher?.add(OBJECTS_DIRECTORY);
      context.watcher?.on('change', path => {
        if (path.startsWith(OBJECTS_DIRECTORY) && /(README\.md|\.json)$/u.test(path)) void loadPages(context);
      });
    },
  };
}

async function loadPages(context: LoaderContext) {
  const discoveries = readJson(resolve(REPOSITORY, 'site/prepared-object-discovery.json'));
  if (!isRecord(discoveries)) context.logger.warn('site/prepared-object-discovery.json is missing; run pnpm prepare:catalog to show shape-only and illustration status.');
  const objects = readObjects(), ids = new Set<string>(['index']);
  for (const object of objects) {
    ids.add(object.id);
    await setPage(context, object.id, object.readmePath, articleData(object, isRecord(discoveries) ? discoveries[object.id] : undefined), articleBody(object));
  }
  await setPage(context, 'index', resolve(OBJECTS_DIRECTORY, 'README.md'), {
    title: 'Objects', description: `${objects.length} object packages in src/objects.`, tableOfContents: false,
  }, mainPageBody(objects));
  for (const id of context.store.keys()) if (!ids.has(id)) context.store.delete(id);
}

async function setPage(context: LoaderContext, id: string, filePath: string, data: Record<string, unknown>, body: string) {
  const digest = context.generateDigest({ data, body });
  if (context.store.get(id)?.digest === digest) return;
  const relativePath = filePath.slice(REPOSITORY.length + 1);
  const parsed = await context.parseData({ id, data, filePath: `../${relativePath}` });
  const rendered = await context.renderMarkdown(body, { fileURL: pathToFileURL(filePath) });
  // Relative images in the Markdown are imported like any content file's images.
  context.store.set({ id, data: parsed, body, filePath: `../${relativePath}`, digest, rendered, assetImports: rendered.metadata?.imagePaths });
}

function articleData(object: ObjectRecord, discovery: unknown) {
  const directory = resolve(OBJECTS_DIRECTORY, object.id);
  const content = readJson(resolve(directory, 'prepared/content.json'));
  const card = readJson(resolve(directory, 'text.json'));
  const minimaps = readJson(resolve(directory, 'prepared/minimaps.json'));
  const ledger = readJson(resolve(directory, 'investigations.json'));
  const manifest = readJson(resolve(directory, 'source/manifest.json'));
  const runtime = readJson(resolve(directory, 'inventory.json'));
  const facts = (isRecord(content) ? [...list(content.facts), ...list(content.moreFacts)] : []).filter(isRecord)
    .flatMap(fact => { const label = text(fact.label), value = text(fact.value); return label && value ? [{ label, value }] : []; });
  const parsedDiscovery = discovery === undefined ? null : parseObjectDiscovery(discovery);
  const status = parsedDiscovery && !isDiscoveryAnchor({ classification: object.group }) ? discoveryDescription(parsedDiscovery) : null;
  const sources = list(isRecord(manifest) ? manifest.inputs : null).filter(isRecord);
  return {
    title: object.title,
    description: text(isRecord(card) && isRecord(card.card) ? card.card.text : null) ?? undefined,
    editUrl: `${REPOSITORY_URL}/edit/main/src/objects/${object.id}/README.md`,
    // The object viewer fills the viewport; the README scrolls in its own pane.
    tableOfContents: false,
    object: {
      id: object.id, group: object.group, groupLabel: object.groupLabel, system: object.system, status, facts,
      maps: list(isRecord(minimaps) ? minimaps.images : null).length,
      openQuestions: list(isRecord(ledger) ? ledger.entries : null).filter(entry => isRecord(entry) && entry.status === 'unresolved').length,
      sourceFiles: sources.length,
      sourceSize: formatBytes(sources.reduce((sum, input) => sum + (typeof input.expectedBytes === 'number' ? input.expectedBytes : 0), 0)),
      runtimeSize: formatBytes(list(isRecord(runtime) ? runtime.assets : null).filter(isRecord).filter(asset => asset.location === 'public')
        .reduce((sum, asset) => sum + (typeof asset.bytes === 'number' ? asset.bytes : 0), 0)),
      appUrl: object.catalogued ? `${SITE_ORIGIN}/${object.id}/` : undefined,
      // The viewer is the app's own scene for this object, shown without its shell.
      sceneUrl: object.catalogued ? `${APP_ORIGIN}/${object.id}/?embed` : undefined,
    },
  };
}

/** Plain text from a package, safe to place in Markdown. Markdown links written in ledgers stay links. */
const prose = (value: string) => value.replaceAll('<', '&lt;').replace(/\s+/gu, ' ').trim();

function articleBody(object: ObjectRecord) {
  const directory = resolve(OBJECTS_DIRECTORY, object.id);
  const parts: string[] = [];
  const card = readJson(resolve(directory, 'text.json'));
  const introduction = text(isRecord(card) && isRecord(card.introduction) ? card.introduction.text : null);
  if (introduction) parts.push(prose(introduction));

  const minimaps = readJson(resolve(directory, 'prepared/minimaps.json'));
  const lenses = readJson(resolve(directory, 'prepared/lenses.json'));
  const maps = list(isRecord(minimaps) ? minimaps.images : null).filter(isRecord).flatMap(image => {
    const id = text(image.id), path = text(image.path);
    if (!id || !path) return [];
    const lens = list(isRecord(lenses) ? lenses.controls : null).filter(isRecord).find(control => control.id === id);
    return [{ label: text(lens?.label) ?? id, path: `prepared/${path}`, falseColor: lens?.falseColor === true }];
  });
  if (maps.length) parts.push('## Minimaps', '<div class="object-maps">',
    ...maps.map(map => `![${prose(map.label)} map](${map.path})\n*${prose(map.label)}${map.falseColor ? ' (false colour)' : ''}*`), '</div>');

  // The README is the package's source-and-evidence document; its title is already the page title.
  parts.push(object.readme.replace(/^\s*#\s+.+\n/u, '').replace(/(?<!!)\[([^\]]*)\]\((?!https?:|#|mailto:)([^)\s]+)\)/gu,
    (_, label: string, href: string) => `[${label}](${new URL(href, `${REPOSITORY_URL}/blob/main/src/objects/${object.id}/`).href})`));

  const ledger = readJson(resolve(directory, 'investigations.json'));
  const entries = list(isRecord(ledger) ? ledger.entries : null).filter(isRecord);
  const references: string[] = [];
  const cite = (link: string) => { if (!references.includes(link)) references.push(link); return `[^${references.indexOf(link) + 1}]`; };
  const notes = NOTE_GROUPS.map(group => ({ ...group, entries: entries.filter(entry => entry.status === group.status) })).filter(group => group.entries.length);
  if (notes.length) {
    parts.push('## Investigations');
    for (const group of notes) {
      parts.push(`### ${group.label}`);
      for (const entry of group.entries) {
        const evidence = list(entry.evidence).filter((link): link is string => typeof link === 'string' && /^https?:\/\//u.test(link));
        parts.push(`**${prose(text(entry.subject) ?? text(entry.id) ?? '')}.** ${prose(text(entry.finding) ?? '')}${evidence.map(cite).join('')}`);
        const revisit = text(entry.revisitWhen);
        if (revisit) parts.push(`*Revisit when: ${prose(revisit)}*`);
      }
    }
  }

  const manifest = readJson(resolve(directory, 'source/manifest.json'));
  const credits = new Map<string, { files: number; bytes: number; machines: Set<string> }>();
  for (const input of list(isRecord(manifest) ? manifest.inputs : null).filter(isRecord)) {
    const credit = text(input.credit) ?? text(input.id) ?? "", entry = credits.get(credit) ?? { files: 0, bytes: 0, machines: new Set<string>() };
    entry.files += 1;
    entry.bytes += typeof input.expectedBytes === 'number' ? input.expectedBytes : 0;
    for (const item of isRecord(input.capture) ? list(input.capture.attributions).filter(isRecord) : []) {
      const machine = text(item.machineId) ?? text(item.missionId);
      if (machine) entry.machines.add(machine);
    }
    credits.set(credit, entry);
  }
  if (credits.size) parts.push('## Data sources', [...credits].sort((a, b) => b[1].bytes - a[1].bytes).map(([credit, entry]) =>
    `- **${prose(credit)}**: ${[...entry.machines, `${entry.files} ${entry.files === 1 ? 'file' : 'files'}`, formatBytes(entry.bytes)].join(', ')}`).join('\n'));

  if (references.length) parts.push(references.map((link, index) => `[^${index + 1}]: <${link}>`).join('\n'));
  return parts.join('\n\n');
}

function mainPageBody(objects: readonly ObjectRecord[]) {
  const link = (object: ObjectRecord) => `[${prose(object.title)}](/${object.id}/)`;
  const entry = (item: SystemEntry): string => item.satellites.length ? `${link(item.object)} (${item.satellites.map(entry).join(' · ')})` : link(item.object);
  return [
    `${objects.length} object packages in \`src/objects\`, nested by planetary system. Each page shows the package's README, minimaps, investigations, source manifest and prepared facts.`,
    ...systemGroups(objects).flatMap(system => [
      `## ${prose(system.label)}`,
      ...(system.star ? [entry(system.star)] : []),
      ...(system.groups.length === 1 && !system.star ? [system.groups[0]!.entries.map(entry).join(' · ')]
        : system.groups.flatMap(group => [`### ${prose(group.label)}`, group.entries.map(entry).join(' · ')])),
    ]),
  ].join('\n\n');
}
