import type { Matrix } from '../observations/models/model';
import { shapeCloudImageAxes } from './shape-cloud-photo-pose';

/** Small projected source axes; dot/cross disambiguates an axis aimed along the viewing direction. */
export function ShapeCloudOrientation({ yaw, pitch, matrix }: { yaw: number; pitch: number; matrix: Matrix }) {
  const axes = shapeCloudImageAxes(yaw, pitch, matrix), origin = [38, 39] as const;
  return <svg className="shape-cloud-orientation" width={142} height={100} viewBox="0 0 142 100" role="img" aria-label="Source image orientation"
    data-orientation-pose={`${yaw},${pitch}`} style={{ position: 'absolute', left: 10, bottom: 16, zIndex: 2 }}>
    <title>Image X points right in the original image; Image Y points down. Toward Earth is the original observer direction. Dot: toward you; cross: away.</title>
    <circle cx={origin[0]} cy={origin[1]} r={2} fill="#9fa8b0" />
    {axes.map((axis, index) => {
      const [dx, dy] = axis.screen, length = Math.hypot(dx, dy), x = origin[0] + dx * 26, y = origin[1] + dy * 26;
      const endOn = length < .12, ux = length > 0 ? dx / length : 0, uy = length > 0 ? dy / length : 0;
      return <g key={axis.id} data-image-axis={axis.id} data-end-on={endOn ? axis.towardEye >= 0 ? 'toward' : 'away' : 'false'}>
        <title>{axis.label}{endOn ? axis.towardEye >= 0 ? ' · toward the viewer' : ' · away from the viewer' : ''}</title>
        {endOn ? <g stroke={axis.color} fill="none"><circle cx={origin[0]} cy={origin[1]} r={6} />
          {axis.towardEye >= 0 ? <circle cx={origin[0]} cy={origin[1]} r={2} fill={axis.color} stroke="none" /> :
            <path d={`M ${origin[0] - 3} ${origin[1] - 3} l 6 6 M ${origin[0] - 3} ${origin[1] + 3} l 6 -6`} />}</g> :
          <g stroke={axis.color} fill="none" strokeWidth={1.5}><line x1={origin[0]} y1={origin[1]} x2={x} y2={y} />
            <path d={`M ${x - ux * 5 - uy * 2.5} ${y - uy * 5 + ux * 2.5} L ${x} ${y} L ${x - ux * 5 + uy * 2.5} ${y - uy * 5 - ux * 2.5}`} /></g>}
        <text x={77} y={22 + index * 17} fill={axis.color} fontSize={9}>{axis.label}</text>
      </g>;
    })}
  </svg>;
}
