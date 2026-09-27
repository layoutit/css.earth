import type { WorkspaceCommand } from '../workspace-commands.mts';

/** The density-volume preparation, run as the build `#preparation/prepare-volume` resolves to. */
export const PREPARE_VOLUME_COMMAND: WorkspaceCommand = { script: 'tools/objects/dist/prepare-volume.js', source: 'tools/objects/prepare-volume.ts' };
