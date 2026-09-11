import { localFile } from '../viewer/viewer';

/** Read-only numerical comparisons; selecting a view never starts a reconstruction. */
export function EmissionComparison({ directory }: { directory: string }) {
  return <aside className="floating-panel cloud-adjustment-panel" aria-label="Emission inference comparison">
    <fieldset>
      <legend>Image → inferred volume</legend>
      {[
        ['input.png', 'Input · points attenuated'],
        ['projection.png', 'Volume projected toward Earth'],
        ['residual.png', 'Difference ×4'],
      ].map(([file, label]) => <figure key={file} style={{ margin: '12px 0' }}>
        <img src={localFile(`${directory}/${file}`)} alt={label} style={{ width: '100%', display: 'block' }} />
        <figcaption className="interaction-hint">{label}</figcaption>
      </figure>)}
      <p className="interaction-hint" title="The depth is inferred under an authored axial-symmetry assumption. Physical size and gas mass density are not measured. The projection comparison is numerical; the PolyCSS display uses an approximate opacity transfer.">Symmetry-based experiment · unmeasured depth</p>
      <a className="model-source" href="https://doi.org/10.1111/cgf.12216" target="_blank" rel="noreferrer">Reconstruction paper ↗</a>
    </fieldset>
  </aside>;
}
