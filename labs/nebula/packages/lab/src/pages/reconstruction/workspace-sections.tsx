import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InfoTip } from '../../ui/info-tip';
export type WorkspaceSection = 'compiler' | 'sources' | 'structure' | 'combined' | 'kinematics' | 'joint' | 'volume';
export type WorkspaceCapabilities = Partial<Record<WorkspaceSection, boolean | string>>;
const sections: readonly [WorkspaceSection, string, string][] = [
  ['compiler', 'Model', 'A nebula model is not configured for this object.'],
  ['sources', 'Source candidates', 'A source candidate catalogue is not configured for this object.'],
  ['structure', 'Structures', 'Prepared structure inspection is not configured for this object.'],
  ['combined', 'Combined', 'Combined image evidence is not configured for this object.'],
  ['kinematics', 'Velocity', 'Velocity evidence is not configured for this object.'],
  ['joint', 'Joint fit', 'A joint image and velocity fit is not configured for this object.'],
  ['volume', 'Volume baseline', 'An earlier volume baseline is not configured for this object.'],
];
const explanations: Record<WorkspaceSection, [string, string]> = {
  compiler: ['◉', 'Inspect the prepared 3D cloud, its image colors and stars. Use this view to judge the current reconstruction.'],
  sources: ['▧', 'Compare candidate photographs and their sky coverage before reconstruction.'],
  structure: ['⌁', 'Inspect prepared image structures and edit shape hypotheses. Image features do not establish measured depth.'],
  combined: ['⊞', 'Compare which structures are supported by registered images, including shared and single-image evidence.'],
  kinematics: ['↔', 'Compare observed line velocities with an adjustable shell hypothesis.'],
  joint: ['⋈', 'Compare 3D candidates constrained by image ridges and measured velocities.'],
  volume: ['◫', 'Inspect an earlier prepared volume for comparison with the current model.'],
};
interface Props { active: WorkspaceSection; capabilities: WorkspaceCapabilities; onChange(section: WorkspaceSection): void }
/** Every method exposes the same navigation; unavailable capabilities remain explicit. */
export function WorkspaceSectionItems({ active, capabilities, onChange }: Props) {
  return <div className="emission-view-buttons workspace-sections" role="group" aria-label="Inspection mode">
    {sections.map(([id, label, reason]) => {
      const capability = capabilities[id], enabled = capability === true;
      const [icon, explanation] = explanations[id];
      const help = `${explanation}${enabled ? '' : ` ${typeof capability === 'string' ? capability : reason}`}`;
      return <InfoTip key={id} content={help}>
        <button type="button" data-workspace-section={id} aria-label={label} aria-pressed={active === id}
          aria-disabled={!enabled} onClick={() => { if (enabled) onChange(id); }}><span aria-hidden="true">{icon}</span><span>{label}</span></button>
      </InfoTip>;
    })}
  </div>;
}

/** Explicit visibility is required because portals escape a hidden sidebar ancestor. */
export function WorkspaceSections({ visible = true, ...props }: Props & { visible?: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null), navigation = useRef<HTMLElement>(null);
  useEffect(() => { setHost(document.querySelector<HTMLElement>('.workspace-content')); }, []);
  useEffect(() => {
    const node = navigation.current;
    if (!host || !visible || !node) return;
    const measure = () => host.style.setProperty('--workspace-navigation-height', `${node.getBoundingClientRect().height + 20}px`);
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => { observer.disconnect(); host.style.removeProperty('--workspace-navigation-height'); };
  }, [host, visible]);
  return host && visible ? createPortal(<nav ref={navigation} className="workspace-section-navigation" aria-label="Reconstruction views">
    <WorkspaceSectionItems {...props} />
  </nav>, host) : null;
}
