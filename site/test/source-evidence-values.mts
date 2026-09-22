import { requireArray, requireRecord, requireString } from '../../tools/sources/source-values.mts';

/** Read only fields consumed by an assertion; keep the original evidence intact. */
export class SourceEvidence {
  readonly value: Record<string, unknown>;
  constructor(value: Record<string, unknown>) { this.value = value; }
  static parse(value: unknown): SourceEvidence { return new SourceEvidence(requireRecord(value, 'source evidence')); }
  field(...path: string[]): unknown {
    let value: unknown = this.value;
    for (const key of path) value = requireRecord(value, `evidence ${path.join('.')}`)[key];
    return value;
  }
  text(...path: string[]): string { return requireString(this.field(...path), `evidence ${path.join('.')}`); }
  strings(...path: string[]): string[] { return requireArray(this.field(...path), `evidence ${path.join('.')}`).map(value => requireString(value, 'evidence text')); }
  rows(...path: string[]): SourceEvidence[] { return requireArray(this.field(...path), `evidence ${path.join('.')}`).map(SourceEvidence.parse); }
  child(...path: string[]): SourceEvidence { return SourceEvidence.parse(this.field(...path)); }
}
