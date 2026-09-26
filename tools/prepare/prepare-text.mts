import { refuseDirectRun } from '../cli/library-entry.mts';
import { sha256 } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { datasetContributors } from '../../site/dataset-context.mts';
import {
  PREPARED_TEXT_SCHEMA, catalogueTextWarnings, compositionWarnings, parseObjectText, readerTextErrors, readerTextWarnings,
} from '../../site/object-text.mts';
import type { ObjectText, TextContext, TextFinding } from '../../site/object-text.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { parsePreparedExploration } from '../../src/platform/prepared-exploration.mts';
import { sourceResolver } from '../../src/platform/source-catalog.mts';
import { readSourceCatalog } from '../sources/read-source-catalogue.mts';
import { hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';
import { writePreparedText } from '../prepared/write-prepared-text.mts';
import { refreshPreparedInventory } from './prepare-object-json.mts';

const root = resolve(import.meta.dirname, '../..');
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
export const describe = (findings: readonly TextFinding[]) => findings.map(({ objectId, slot, rule, detail }) => `  ${objectId} ${slot}: ${rule} — ${detail}`).join('\n');

interface BodyText { readonly id: string; readonly directory: string; readonly sha256: string; readonly text: ObjectText; readonly context: TextContext }

async function readBody(projectRoot: string, object: { id: string; name: string }, catalogue: ReadonlySet<string>): Promise<BodyText> {
  const directory = resolve(projectRoot, 'src/objects', object.id);
  const bytes = await readFile(resolve(directory, 'text.json'));
  const page = requireRecord(await readJson(resolve(directory, 'prepared/page.json')));
  const lenses = requireRecord(page.controls).lenses;
  const provenance = validateObjectProvenance(await readJson(resolve(directory, 'prepared/provenance.json')), object.id);
  return {
    id: object.id, directory, sha256: sha256(bytes),
    text: parseObjectText(JSON.parse(bytes.toString('utf8')), object.id),
    context: {
      name: object.name, catalogue,
      lenses: lenses === null || lenses === undefined ? [] : requireArray(requireRecord(lenses).controls).map(value => {
        const control = requireRecord(value);
        return { id: requireString(control.id), label: requireString(control.label) };
      }),
      evidencedDatasets: new Set(provenance.products.flatMap(product => product.inputs.length ? [product.id, ...(product.lensIds ?? [])] : [])),
    },
  };
}

/** The introduction, one dataset summary and the credits shown beside it; the shell shows one dataset at a time. */
function compositionGroups(body: BodyText, exploration: ReturnType<typeof parsePreparedExploration>) {
  return body.context.lenses.map(lens => {
    const { missions, facilities, notes } = datasetContributors(body.id, lens.id, exploration.graph, exploration.catalog);
    return [
      { source: 'introduction', text: body.text.introduction.text },
      { source: `datasets.${lens.id}.summary`, text: body.text.datasets[lens.id]?.summary ?? '' },
      ...missions.map(mission => ({ source: `mission:${mission.id}`, text: mission.description.value })),
      ...notes.map(note => ({ source: `note:${note.label}`, text: note.reason })),
      ...facilities.map(facility => ({ source: `facility:${facility.id}`, text: facility.description.value })),
    ];
  });
}

function outputs(body: BodyText, descriptor: Record<string, unknown>): [string, string][] {
  const datasets = Object.fromEntries(body.context.lenses.map(lens => [lens.id, body.text.datasets[lens.id]]));
  const prepared = { schema: PREPARED_TEXT_SCHEMA, objectId: body.id,
    card: body.text.card, introduction: body.text.introduction, datasets };
  const properties = requireRecord(descriptor.properties), catalog = requireRecord(properties.catalog);
  // The card is also the catalogue's description, which search, previews and sharing read.
  const described = { ...descriptor, properties: { ...properties, catalog: { ...catalog, description: body.text.card.text } } };
  return [[resolve(body.directory, 'prepared/text.json'), `${JSON.stringify(prepared)}\n`],
    [resolve(body.directory, 'object.json'), `${JSON.stringify(described, null, 2)}\n`]];
}

/** Check every object's reader text, then publish all of it or nothing. Warnings are for a reviewer and never block. */
export async function prepareText({ ids = [] as readonly string[], check = false, projectRoot = root } = {}) {
  assert.ok(ids.every(id => SCENE_OBJECTS.some(object => object.id === id)), 'Unregistered text target');
  const sourceCatalog = await readSourceCatalog(projectRoot);
  const catalogue = new Set(sourceCatalog.records.map(record => record.id));
  const bodies = await Promise.all(SCENE_OBJECTS.map(object => readBody(projectRoot, object, catalogue)));
  const errors = bodies.flatMap(body => readerTextErrors(body.text, body.context));
  if (errors.length) throw new Error(`Reader text breaks the text contract:\n${describe(errors)}`);
  const warnings = [...bodies.flatMap(body => readerTextWarnings(body.text, body.context)),
    ...catalogueTextWarnings(bodies.map(body => ({ text: body.text, name: body.context.name })))];
  let composition = 'checked';
  try {
    const exploration = parsePreparedExploration(await readJson(resolve(projectRoot, 'site/prepared-facilities.json')), sourceResolver(sourceCatalog));
    const found = bodies.flatMap(body => compositionGroups(body, exploration).flatMap(blocks => compositionWarnings(body.id, blocks)));
    warnings.push(...new Map(found.map(finding => [JSON.stringify(finding), finding])).values());
  } catch (error) {
    composition = hasErrorCode(error, 'ENOENT') ? 'skipped: run pnpm prepare:facilities first' : `skipped: ${error instanceof Error ? error.message : String(error)}`;
  }
  const selected = bodies.filter(body => !ids.length || ids.includes(body.id));
  const planned = await Promise.all(selected.map(async body => outputs(body, requireRecord(await readJson(resolve(body.directory, 'object.json'))))));
  const stale: string[] = [], rewritten = new Set<string>();
  for (const [body, outputs] of selected.map((body, index) => [body, planned[index]!] as const)) for (const [path, text] of outputs) {
    const current = await readFile(path, 'utf8').catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (current === text) continue;
    if (check) stale.push(path.slice(projectRoot.length + 1));
    else { await writePreparedText(path, text); if (path.includes('/prepared/')) rewritten.add(body.id); }
  }
  // Nothing under prepared/ is tracked: a rewritten text.json is recorded by the body's inventory and still has to be published.
  for (const id of rewritten) await refreshPreparedInventory(id, projectRoot);
  if (stale.length) throw new Error(`Stale reader text; run pnpm prepare:text:\n  ${stale.join('\n  ')}`);
  return { objects: selected.length, warnings, composition };
}

/** The warnings a run shows its reviewer: each once, and in a run for named objects only theirs. A ten-asteroid run printed
 * 203, 25 of them twice, and the two about its own objects (Aquitania and Siegena sharing one card line) were lost among them. */
export function reviewWarnings(warnings: readonly TextFinding[], ids: readonly string[]) {
  const own = ids.length ? warnings.filter(warning => ids.includes(warning.objectId)) : warnings;
  return [...new Map(own.map(warning => [JSON.stringify(warning), warning])).values()];
}

refuseDirectRun(import.meta);
