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
/** Every method exposes the same navigation; unavailable capabilities remain explicit. */
export function WorkspaceSections({ active, capabilities, onChange }: {
  active: WorkspaceSection; capabilities: WorkspaceCapabilities; onChange(section: WorkspaceSection): void;
}) {
  return <div className="emission-view-buttons workspace-sections" role="group" aria-label="Inspection mode">
    {sections.map(([id, label, reason]) => {
      const capability = capabilities[id], enabled = capability === true;
      return <button key={id} type="button" data-workspace-section={id} aria-pressed={active === id}
        disabled={!enabled} title={enabled ? `Inspect ${label.toLowerCase()}` : typeof capability === 'string' ? capability : reason}
        onClick={() => onChange(id)}>{label}</button>;
    })}
  </div>;
}
