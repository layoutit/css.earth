/** Visible lab controls for the independently prepared bright-star layer. */
export interface CloudStarOptions { enabled: boolean; brightness: number; size: number; }
export interface CloudStarContext { id: string; count: number; sourceUrl: string; }
const KEY = 'cssearth-nebula-bright-stars@1';
const defaults = (): CloudStarOptions => ({ enabled: true, brightness: .7, size: 1 });
type SavedOptions = Omit<CloudStarOptions, 'size'> & { size?: number };
const valid = (value: unknown): value is SavedOptions => {
  if (!value || typeof value !== 'object') return false;
  const item = value as SavedOptions;
  return typeof item.enabled === 'boolean' && Number.isFinite(item.brightness) && item.brightness >= 0 && item.brightness <= 1 &&
    (item.size === undefined || (Number.isFinite(item.size) && item.size >= .5 && item.size <= 3));
};

export function createCloudStarControls({ host, onChange }: {
  host: HTMLElement; onChange(options: CloudStarOptions): void;
}) {
  let context: CloudStarContext | null = null, options = defaults();
  const saved = new Map<string, CloudStarOptions>();
  try {
    for (const row of JSON.parse(localStorage.getItem(KEY) ?? '[]')) {
      if (Array.isArray(row) && typeof row[0] === 'string' && valid(row[1])) saved.set(row[0], { ...defaults(), ...row[1] });
    }
  } catch { /* Local storage is optional. */ }
  const box = document.createElement('fieldset'); box.className = 'cloud-star-fieldset';
  const legend = document.createElement('legend'); legend.textContent = 'Bright stars';
  const enabledLabel = document.createElement('label'); enabledLabel.className = 'cloud-density-removed';
  const enabled = document.createElement('input'); enabled.id = 'cloud-stars-enabled'; enabled.type = 'checkbox';
  enabledLabel.htmlFor = enabled.id; enabledLabel.append(enabled, document.createTextNode(' Show catalog stars'));
  const row = document.createElement('div'); row.className = 'cloud-brightness-control';
  const label = document.createElement('label'); label.htmlFor = 'cloud-stars-brightness'; label.textContent = 'Brightness';
  const brightness = document.createElement('input'); brightness.id = label.htmlFor; brightness.type = 'range';
  brightness.min = '0'; brightness.max = '100'; brightness.step = '1';
  const output = document.createElement('output'); output.htmlFor = brightness.id;
  const sizeRow = document.createElement('div'); sizeRow.className = 'cloud-brightness-control';
  const sizeLabel = document.createElement('label'); sizeLabel.htmlFor = 'cloud-stars-size'; sizeLabel.textContent = 'Size';
  const size = document.createElement('input'); size.id = sizeLabel.htmlFor; size.type = 'range';
  size.min = '50'; size.max = '300'; size.step = '5';
  const sizeOutput = document.createElement('output'); sizeOutput.htmlFor = size.id;
  const note = document.createElement('p'); note.className = 'cloud-control-hint';
  const source = document.createElement('a'); source.className = 'cloud-star-source'; source.textContent = 'Catalog source ↗';
  source.target = '_blank'; source.rel = 'noreferrer';
  row.append(label, brightness, output); sizeRow.append(sizeLabel, size, sizeOutput);
  box.append(legend, enabledLabel, row, sizeRow, note, source); host.append(box); host.hidden = true;
  function render() {
    enabled.checked = options.enabled; brightness.value = String(Math.round(options.brightness * 100));
    output.textContent = `${brightness.value}%`;
    size.value = String(Math.round(options.size * 100)); sizeOutput.textContent = `${size.value}%`;
  }
  function publish() {
    if (!context) return;
    saved.set(context.id, { ...options });
    try { localStorage.setItem(KEY, JSON.stringify([...saved])); } catch { /* Session controls still work. */ }
    onChange({ ...options });
  }
  enabled.addEventListener('change', () => { options.enabled = enabled.checked; publish(); });
  brightness.addEventListener('input', () => { options.brightness = Number(brightness.value) / 100; render(); publish(); });
  size.addEventListener('input', () => { options.size = Number(size.value) / 100; render(); publish(); });
  return {
    setContext(next: CloudStarContext | null) {
      if (context?.id === next?.id) return;
      context = next; host.hidden = !next;
      if (!next) return;
      options = { ...(saved.get(next.id) ?? defaults()) }; render();
      note.textContent = `${next.count.toLocaleString()} catalog stars. Sky positions are measured; depths are modeled.`;
      source.href = next.sourceUrl; onChange({ ...options });
    },
    destroy() { context = null; host.replaceChildren(); },
  };
}
