import type { WorkspaceCommand } from '../workspace-commands.mts';

/** The density-volume preparation, the bake command the telescope runs from its source. */
export const PREPARE_VOLUME_COMMAND: WorkspaceCommand = { script: 'packages/bake/cli/prepare-volume.mts', source: 'packages/bake/cli/prepare-volume.mts' };
