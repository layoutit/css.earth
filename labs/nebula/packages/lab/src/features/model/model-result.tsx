/** A `model` result in the viewport's place: its picture, and over it the surfaces' outlines and the measured points,
 * in the picture's own pixels. */
import { createPortal } from 'react-dom';
import { localFile } from '../legacy-viewer/controller';
import type { LabModel } from '../../server/workflows/model/model-output.ts';

const STROKE: Record<LabModel['outlines'][number]['kind'], string> = { envelope: '#f0c27a', wall: '#7fd1ff', plate: '#9fd3e6', ellipse: '#f0c27a', outline: '#c9a2ff' };
const APPROACH = '#5aaaff', RECEDE = '#ff6e5a';

export function ModelResult({ model }: { model: LabModel }) {
  const host = document.querySelector('.workspace-content');
  if (!host) return null;
  const { width, height } = model.image, size = Math.max(width, height), maxKmS = Math.max(1, ...model.points.map(point => Math.abs(point.kmS)));
  const kinds = [...new Set(model.outlines.map(outline => outline.kind))];
  return createPortal(<div className="model-result" data-model-result={model.method} data-model-outlines={model.outlines.length} data-model-points={model.points.length}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${model.method} result on ${model.image.label}`}>
      <image href={localFile(model.image.path)} width={width} height={height} />
      {model.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={size / 450}
        fill={point.kmS < 0 ? APPROACH : RECEDE} fillOpacity={.3 + .6 * Math.min(1, Math.abs(point.kmS) / maxKmS)} />)}
      {model.outlines.map(outline => {
        const d = outline.points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + (outline.closed ? ' Z' : '');
        return <path key={outline.id} d={d} fill="none" stroke={STROKE[outline.kind]} strokeWidth={size / 320} strokeLinejoin="round"
          strokeDasharray={outline.kind === 'wall' || outline.kind === 'plate' ? `${size / 90} ${size / 160}` : undefined} data-outline={outline.id} />;
      })}
    </svg>
    <div className="model-result-legend">
      {kinds.map(kind => <span key={kind}><i style={{ background: STROKE[kind] }} />{kind}</span>)}
      {model.points.length > 0 && <><span><i style={{ background: APPROACH }} />approaching</span><span><i style={{ background: RECEDE }} />receding</span></>}
      <span>{model.image.label}</span>
    </div>
  </div>, host);
}
