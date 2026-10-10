import { WorkspaceTools } from '../workspace/workspace-tools';
import { DatasetLevelsPanel, LevelsIcon, LEVELS_TOOLTIP } from '../reconstruction/dataset-levels-panel';
import { DatasetRadialPanel, RadialIcon, RADIAL_TOOLTIP } from '../reconstruction/dataset-radial-panel';
import { differenceTool } from '../reconstruction/difference-map';
import type { LabControlsProps } from '../../state/use-lab-controller';

/** The circle tools (Levels, Radial, Difference) for an entry the site ships: its photograph (the one Show draws)
 * against the bank's own far picture, through the shared statistics (`/__nebula/site-*`,
 * server/services/site-diagnostics.ts). They sit in the left panel under the camera buttons. */
export function SiteWorkspaceTools({ kind, object, dataset, picture, shell, controller }: {
  kind: 'plates' | 'volume'; object: string; dataset: string; picture: 'original' | 'starless' } & LabControlsProps) {
  const query = new URLSearchParams({ kind, object, dataset, picture }).toString();
  // The identity the routes answer with (siteDiagnosticsId).
  const id = `${object.split('/').at(-1)}:${dataset || 'default'}:${picture}`;
  return <WorkspaceTools dock="left" tools={[
    { id: 'levels', label: 'Levels', tooltip: LEVELS_TOOLTIP, icon: <LevelsIcon />, panel: <DatasetLevelsPanel key={id} resultId={id} url={`/__nebula/site-levels?${query}`} /> },
    { id: 'radial', label: 'Radial', tooltip: RADIAL_TOOLTIP, icon: <RadialIcon />, panel: <DatasetRadialPanel key={id} resultId={id} url={`/__nebula/site-radial?${query}`} /> },
    ...differenceTool(id, shell.differenceOverlay, (enabled, opacity) => void controller.current?.setDifference(enabled, opacity), `/__nebula/site-difference?${query}`)
      .map(tool => ({ ...tool, label: 'Difference' })),
  ]} />;
}
