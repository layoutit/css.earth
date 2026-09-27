/** Shared prepared-chart presentation. Body quantities and source interpretation stay in recipes/readers. */
export interface ChartIdentity { id: string; title: string; description: string; metadata: Record<string, unknown> }
export const CHART = Object.freeze({ width: 306, left: 42, right: 294, top: 29, bottom: 203,
  label: '#b8bbc4', neutral: '#dadde5', purple: '#9478ff', green: '#83c997', amber: '#e6ab64', bandOpacity: '.18' });
export const escapeXml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const coordinate = (value: number) => value.toFixed(3);
export const tickLabel = (value: number) => Number(value.toPrecision(3)).toString();
export function linearScale(minimum: number, maximum: number, start: number, end: number) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) throw new RangeError('Chart scale must be finite and increasing.');
  return (value: number) => start + (value - minimum) / (maximum - minimum) * (end - start);
}
export interface ChartTick { value: number; label: string }
export const ticks = (values: readonly number[]): ChartTick[] => values.map(value => ({ value, label: tickLabel(value) }));
export function chartAxes({ x, y, xTicks, yTicks, xLabel, yLabel, direction = '' }: {
  x: (value: number) => number; y: (value: number) => number; xTicks: readonly ChartTick[]; yTicks: readonly ChartTick[];
  xLabel: string; yLabel: string; direction?: string;
}) {
  return `<text x="0" y="13">${escapeXml(yLabel)}</text><text x="294" y="13" text-anchor="end">${escapeXml(direction)}</text>
${yTicks.map(t => `<path class="chart-grid" d="M42 ${coordinate(y(t.value))}H294" stroke="${CHART.label}" stroke-opacity="${t.value === 0 ? '.3' : '.1'}"/><text x="35" y="${coordinate(y(t.value) + 4)}" text-anchor="end"${t.label.length > 5 ? ' font-size="10"' : ''}>${escapeXml(t.label)}</text>`).join('')}
${xTicks.map((t, i) => `<text x="${coordinate(x(t.value))}" y="218" text-anchor="${i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}">${escapeXml(t.label)}</text>`).join('')}
<text x="168" y="233" text-anchor="middle">${escapeXml(xLabel)}</text>`;
}
export function chartNotes(notes: readonly string[], start = 264) {
  return notes.map((note, i) => `<text x="0" y="${start + i * 15}" fill-opacity=".85">${escapeXml(note)}</text>`).join('');
}
export function chartLine(points: readonly { x: number; y: number }[], color: string = CHART.neutral, className = 'object-chart-line') {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${coordinate(p.x)} ${coordinate(p.y)}`).join(' ');
  return `<path class="${className}" d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
}
export function chartDocument(identity: ChartIdentity, body: string, { height = 275, className = '' }: { height?: number; className?: string } = {}) {
  const { id, title, description, metadata } = identity;
  if (!/^[a-z][a-z0-9-]*$/.test(id) || typeof title !== 'string' || !title || typeof description !== 'string' || !description ||
      !metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('Scientific chart identity is incompatible.');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" width="306" height="${height}" viewBox="0 0 306 ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${CHART.label}">
<title id="${id}-title">${escapeXml(title)}</title><desc id="${id}-desc">${escapeXml(description)}</desc>
<metadata>${escapeXml(JSON.stringify(metadata))}</metadata>
${body}
</svg>\n`;
}
