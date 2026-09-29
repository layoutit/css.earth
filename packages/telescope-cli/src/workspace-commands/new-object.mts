import type { WorkspaceCommand } from '../workspace-commands.mts';

/** `telescope new-object`: the object generator and the bake it hands its objects to. */
export const NEW_OBJECT_COMMAND: WorkspaceCommand = { script: 'packages/telescope-cli/src/new-object/cli.mts', source: 'packages/telescope-cli/src/new-object/cli.mts' };
