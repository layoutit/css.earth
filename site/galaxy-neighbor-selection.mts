/** Update retained, prepared neighbor rows; positions and distances were compiled by the shell. */
export function selectGalaxyNeighbor(card: HTMLElement, selectedId: string): void {
  const rows = [...card.querySelectorAll<HTMLElement>('[data-neighbor-id]')];
  const distances = rows.map(row => {
    const values: unknown = JSON.parse(row.dataset.neighborDistances ?? '{}');
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new TypeError('Invalid prepared neighbor distances');
    const value: unknown = Reflect.get(values, selectedId);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError('Missing prepared neighbor distance');
    return { row, value };
  });
  distances.sort((a, b) => a.value - b.value);
  const parent = rows[0]?.parentElement;
  if (!parent) return;
  const selectedName = rows.find(row => row.dataset.neighborId === selectedId)?.querySelector('.object-name')?.textContent ?? '';
  for (const { row, value } of distances) {
    const active = row.dataset.neighborId === selectedId;
    const link = row.querySelector('a');
    if (active) link?.setAttribute('aria-current', 'true'); else link?.removeAttribute('aria-current');
    const label = row.querySelector<HTMLElement>('.object-distance');
    if (label) {
      label.hidden = active;
      label.title = 'Catalogue center distance from ' + selectedName;
      const ly = value * 3.261563777, divisor = ly >= 1e6 ? 1e6 : ly >= 1e3 ? 1e3 : 1;
      const number = label.querySelector('.object-distance-value'), unit = label.querySelector('.object-distance-unit');
      if (number) number.textContent = '≈' + new Intl.NumberFormat('en', { maximumSignificantDigits: 3 }).format(ly / divisor);
      if (unit) unit.textContent = divisor === 1e6 ? 'Mly' : divisor === 1e3 ? 'kly' : 'ly';
    }
    parent.append(row);
  }
}
