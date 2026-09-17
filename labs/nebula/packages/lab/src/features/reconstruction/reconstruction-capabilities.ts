/** Method identity comes from the descriptor-pinned provenance, never the object name. */
export interface ReconstructionProcessingCapability { densityPreview: boolean; modelLabel: string; reason?: string }
export function reconstructionProcessingCapability(method: unknown): ReconstructionProcessingCapability {
  if (method === 'alignment-density-material-v1') return { densityPreview: true, modelLabel: 'Fixed density material' };
  return { densityPreview: false, modelLabel: method === 'simulation-guided-finite-emission@1' ? 'Simulation-guided finite emission' : method === 'simulation-guided-finite-material@1' ? 'Simulation-guided finite material' : 'Saved reconstruction',
    reason: 'This saved model cannot be refitted by the density material Preview. Its finite geometry and image colors were prepared together. Refitting requires its recorded offline recipe; shared compiler controls are not connected yet.' };
}
export function densityPreviewAllowed(capability: ReconstructionProcessingCapability | undefined): boolean {
  return capability?.densityPreview === true;
}
