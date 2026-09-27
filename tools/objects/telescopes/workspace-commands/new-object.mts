import type { WorkspaceCommand } from '../workspace-commands.mts';

/** `telescope new-object`: the object generator and the bake it hands its objects to. */
export const NEW_OBJECT_COMMAND: WorkspaceCommand = { script: 'tools/objects/new-object/cli.mts', source: 'tools/objects/new-object/cli.mts' };
