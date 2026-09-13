import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceArray, sourceDigest, sourceObject, sourceText } from '../src/platform/source-catalog.mts';
import type { SourceResolver } from '../src/platform/source-catalog.mts';
import { objectTextViolations, parseObjectText } from '../site/object-text.mts';
import type { ObjectText, TextContext, TextViolation } from '../site/object-text.mts';

export interface ObjectTextReview {
  readonly text: ObjectText;
  readonly violations: readonly TextViolation[];
  /** Pinned evidence files cited by the text, relative to the object directory. */
  readonly evidencePaths: readonly string[];
}

/** Dataset identities, chooser labels and fact values from the content recipe the reader text must agree with. */
export function textContext(content: unknown, name: string): TextContext {
  const recipe = sourceObject(content), panel = sourceObject(recipe.panel), lenses = sourceObject(recipe.lenses);
  const labels = lenses.labels === undefined ? {} : sourceObject(lenses.labels);
  const facts = (raw: unknown) => sourceArray(raw ?? [], row => {
    const fact = sourceObject(row);
    return `${sourceText(fact.label)} ${sourceText(fact.value)}`;
  });
  const controls = sourceArray(lenses.controls, raw => sourceObject(raw));
  return {
    name,
    lenses: controls.map(control => {
      const id = sourceText(control.id), label = labels[id];
      return { id, label: typeof label === 'string' ? label : sourceText(control.label) };
    }),
    evidence: [...facts(panel.facts), ...facts(panel.moreFacts), ...controls.flatMap(control => facts(control.facts))],
  };
}

/**
 * Parse one object's reader text and apply the text contract with its recipe,
 * the source catalogue and pinned evidence. Preparation, publishing and the
 * source catalogue use this one review, so they cannot disagree.
 */
export async function reviewObjectText(raw: unknown, { objectId, name, content, manifest, sources, read }: {
  readonly objectId: string; readonly name: string; readonly content: unknown; readonly manifest: unknown;
  readonly sources?: SourceResolver; readonly read: (path: string) => Promise<Uint8Array>;
}): Promise<ObjectTextReview> {
  const text = parseObjectText(raw, objectId);
  const context = textContext(content, name);
  const citations = [...text.card.sources, ...text.introduction.sources,
    ...Object.values(text.datasets).flatMap(dataset => dataset.sources ?? [])];
  const records = sourceObject(manifest);
  const entries = ['inputs', 'documents', 'generatedIntermediates']
    .flatMap(section => sourceArray(records[section] ?? [], raw => sourceObject(raw)));
  const evidence: string[] = [], evidencePaths: string[] = [];
  for (const citation of citations) {
    if (sources && !Object.hasOwn(sources, citation.catalogueId)) throw new TypeError(`${objectId}: unknown text source ${citation.catalogueId}.`);
    if (citation.path === undefined || evidencePaths.includes(citation.path)) continue;
    const matches = entries.filter(entry => `source/${sourceText(entry.path)}` === citation.path);
    assert.equal(matches.length, 1, `${objectId}: text evidence needs one manifest entry: ${citation.path}`);
    const bytes = await read(citation.path);
    assert.equal(bytes.length, matches[0]!.expectedBytes, `${objectId}: text evidence byte count differs: ${citation.path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sourceDigest(matches[0]!.expectedSha256),
      `${objectId}: text evidence pin differs: ${citation.path}`);
    evidence.push(Buffer.from(bytes).toString('utf8'));
    evidencePaths.push(citation.path);
  }
  return {
    text, evidencePaths,
    violations: objectTextViolations(text, { ...context, evidence: [...context.evidence, ...evidence] }),
  };
}

export function describeTextViolations(violations: readonly TextViolation[]): string {
  return violations.map(violation => `${violation.objectId} ${violation.slot}: ${violation.rule}: ${violation.detail}`).join('\n');
}
