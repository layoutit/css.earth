/** Methods describe available depth evidence; object names never select an algorithm. */
export const labWorkflows = {
  density: { label: 'Density model', description: 'Paint an independently supplied density model.' },
  symmetry: { label: 'Symmetry', description: 'Infer emission under an explicit axial-symmetry assumption.' },
  inference: { label: 'Constrained inference', description: 'Align observations, then compare explicitly assumed shapes.' },
} as const;
export type LabWorkflow = keyof typeof labWorkflows;
export function readLabWorkflow(value: unknown): LabWorkflow {
  if (value !== 'density' && value !== 'symmetry' && value !== 'inference') throw new TypeError('Unknown nebula workflow.');
  return value;
}
export function supportsLabAlignment(subject: { density?: unknown; observationAlignment?: unknown } | undefined) {
  return Boolean(subject?.density || subject?.observationAlignment);
}
/** Saved material variants retain the processing context of their actual density owner. */
export function densityReconstructionOwner(subjects: readonly {
  id: string; sourceSubjectId?: string; density?: { processingPlan?: string };
}[], id: string | null): string | null {
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const subject = subjects.find(item => item.id === id);
    if (!subject) return null;
    if (id.startsWith('reconstruction-')) { id = subject.sourceSubjectId ?? null; continue; }
    return subject.density?.processingPlan ? subject.id : null;
  }
  return null;
}
