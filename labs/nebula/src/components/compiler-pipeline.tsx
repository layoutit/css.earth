import type { CompilerResult } from '../reconstruction/compiler/result';
import { localFile } from '../viewer/viewer';

/** Completed receipts describe the visible cloud; running work keeps its own live status. */
export function CompilerPipeline({ result, busy }: { result: CompilerResult; busy: boolean }) {
  return <section className="compiler-pipeline" aria-label="Compiler pipeline" data-result-id={result.id}>
    <div className="compiler-pipeline-heading"><span>Stages</span><span title={busy
      ? 'These receipts belong to the cloud still on screen. Current processing is shown above.'
      : 'These stages produced the displayed cloud.'}>{busy ? 'Displayed bake' : 'Complete bake'}</span></div>
    <ol aria-label="Completed processing stages">
      {result.pipeline.map(step => <li key={step.id} data-stage-id={step.id} data-stage-state={step.state}
        title={`${step.label} · ${step.state === 'reused' ? 'Reused' : 'Complete'} · ${step.seconds.toFixed(2)} s`}>
        <span className="compiler-pipeline-symbol" aria-hidden="true">{step.state === 'reused' ? '↻' : '✓'}</span>
        <span className="compiler-pipeline-label">{step.label}</span><span className="compiler-pipeline-state">{step.state === 'reused' ? 'Reused' : 'Done'}</span>
      </li>)}
    </ol>
    <details className="compiler-provenance"><summary>Sources & method</summary>
      <ul>{result.sources.map(source => <li key={source.id}><a href={source.page} target="_blank" rel="noreferrer" title={source.credit}>{source.label} ↗</a></li>)}</ul>
      <p>{result.interpretation}</p>
      <p>{result.metrics.components} components · {result.metrics.unconstrainedComponents} without velocity constraints</p>
      <a href={localFile(result.method.path)} target="_blank" rel="noreferrer" title="Prepared method record: configured sources, assumptions, fit settings and provenance.">Method record ↗</a>
    </details>
  </section>;
}
