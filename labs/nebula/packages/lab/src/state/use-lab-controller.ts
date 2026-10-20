import { mountSiteLab, type SiteLab } from '../shell/site-lab';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { mountNebulaLab } from '../shell/controller';
import { labView } from '../features/legacy-viewer/lab-routing';
import { createControlPortals } from '../ui/control-portals';
import type { AlignmentState, LabShellState } from './lab-shell';

export type LabController = Awaited<ReturnType<typeof mountNebulaLab>>;
export interface LabControlsProps { shell: LabShellState; controller: RefObject<LabController | null> }

/** The application owns controller lifetime and renders every control in its own tree. */
export function useLabController() {
  const [shell, setShell] = useState<LabShellState>({ objectId: '', view: labView(new URL(location.href)), busy: true, alignmentAvailable: true, pose: 'front' });
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

export interface SiteLabControlsProps { shell: LabShellState; controller: RefObject<SiteLab | null> }

/** Site-scene layers have their own lifetime; source alignment keeps its existing controller. */
export function useSiteLabController() {
  const [shell, setShell] = useState<LabShellState>({ objectId: '', view: 'reconstruction', busy: true, alignmentAvailable: false, pose: 'front' });
  const controller = useRef<SiteLab | null>(null);
  useEffect(() => {
    const host = document.getElementById('viewer');
    if (!host) throw new Error('The lab layer host is missing.');
    const value = mountSiteLab({ host, onShellState: setShell });
    controller.current = value;
    return () => { value.destroy(); controller.current = null; };
  }, []);
  return { shell, controller };
}
