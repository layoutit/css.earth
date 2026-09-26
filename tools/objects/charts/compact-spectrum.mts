import { isArray } from '@cssearth/core';
import type { SpectrumPoint } from './spectrum-data.mts';
const escape = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** A static image produced during page preparation, never by the browser runtime. */
export function renderCompactSpectrum({ title, description, metadata, points, maximum }: {title: string; description: string; metadata: Readonly<Record<string, unknown>>; points: readonly SpectrumPoint[]; maximum: number}) {
  if (!isArray(points) || points.length < 2 || !Number.isFinite(maximum) || maximum <= 0 ||
      points.some((point, index) => !Number.isFinite(point.wavelength) || !Number.isFinite(point.total) ||
        point.wavelength < .35 || point.wavelength > 1.01 ||
        index > 0 && point.wavelength <= points[index - 1].wavelength)) throw new TypeError('Invalid compact spectrum.');
  const x = (wavelength: number) => (wavelength - .35) / .65 * 300;
  const y = (value: number) => 64 - value / maximum * 46;
  const unit = 10 ** Math.floor(Math.log10(maximum / 2));
  const step = [10, 5, 2.5, 2, 1].find(value => value * unit <= maximum / 2)! * unit;
  const ticks = Array.from({ length: Math.floor(maximum / step + 1e-9) + 1 }, (_, index) => index * step);
  const stops = [['0','#5d2e91'],['.12','#4243a5'],['.26','#2761b7'],['.4','#2098b5'],['.53','#35a660'],['.65','#d5ca48'],['.76','#e38b37'],['.88','#d1493b'],['1','#7d242d']];
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.wavelength).toFixed(2)},${y(point.total).toFixed(2)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90" role="img" aria-labelledby="title desc" font-family="system-ui, sans-serif" font-size="13">
<title id="title">${escape(title)}</title><desc id="desc">${escape(description)}</desc>
<metadata>${escape(JSON.stringify({ ...metadata, maximum, points: points.length }))}</metadata>
<defs><linearGradient id="visible-spectrum" gradientUnits="userSpaceOnUse" x1="${x(.38)}" x2="${x(.75)}">${stops.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient></defs>
${ticks.map(value => `<path d="M0,${y(value).toFixed(2)} H300" stroke="#222"/>`).join('\n')}
<path d="${path}" fill="none" stroke="#b7d4d0" stroke-width="1.25" stroke-linejoin="round"/>
${ticks.filter(value => value > 0).map(value => `<text x="296" y="${(y(value)-4).toFixed(2)}" fill="#666" text-anchor="end">${Number(value.toPrecision(3))}</text>`).join('\n')}
<rect y="68" width="${x(.38)}" height="6" fill="#261735"/>
<rect x="${x(.38)}" y="68" width="${x(.75)-x(.38)}" height="6" fill="url(#visible-spectrum)"/>
<rect x="${x(.75)}" y="68" width="${300-x(.75)}" height="6" fill="#32191d"/>
${([[.35,'350','start'],[.55,'550','middle'],[.75,'750','middle'],[1,'1000 nm','end']] as const).map(([wavelength,label,anchor]) => `<text x="${x(wavelength)}" y="86" fill="#666" text-anchor="${anchor}">${label}</text>`).join('\n')}
</svg>`;
}
