import { useEffect, useRef, useState, type RefObject } from 'react';
import { mountNebulaLab } from '../shell/controller';
import { labView } from '../features/legacy-viewer/lab-routing';
import { createControlPortals } from '../ui/control-portals';
import type { AlignmentState, LabShellState } from './lab-shell';

export type LabController = Awaited<ReturnType<typeof mountNebulaLab>>;
export interface LabControlsProps { shell: LabShellState; controller: RefObject<LabController | null> }

/** The application owns controller lifetime and renders every control in its own tree. */
export function useLabController() {
  const [shell, setShell] = useState<LabShellState>({ objectId: 'lmc-clouds', view: labView(new URL(location.href)), busy: true, alignmentAvailable: true, pose: 'front' });
  const [controls] = useState(createControlPortals);
  const controller = useRef<LabController | null>(null);
  useEffect(() => {
    let disposed = false;
    void mountNebulaLab({ controls, onShellState(next) {
      if (!disposed) setShell(next);
    } }).then(value => { if (disposed) value.destroy(); else controller.current = value; });
    return () => { disposed = true; controller.current?.destroy(); controller.current = null; };
  }, [controls]);
  const updateAlignment = (partial: Partial<AlignmentState>) => setShell(value => value.alignment ? { ...value, alignment: { ...value.alignment, ...partial } } : value);
  return { shell, controller, controls, updateAlignment };
}
