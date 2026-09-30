/** Explicit local handoff of this browser's lab settings; never infer user choices from test bakes. */
export async function saveDatasetSettings(subjectId: string, selection: { imageId: string; displayedResultId?: string }, active?: unknown) {
  const storage: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('cssearth-nebula-')) storage[key] = localStorage.getItem(key)!;
  }
  const response = await fetch('/__nebula/dataset-settings', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ schema: 'cssearth-nebula-dataset-settings@1', capturedAt: new Date().toISOString(), subjectId, selection, active, storage }) });
  const result = await response.json();
  if (!response.ok || result.saved !== true) throw new Error(result.error ?? 'Dataset settings could not be saved.');
}
