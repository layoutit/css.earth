const STORAGE_KEY = 'cssearth-admin-filters';

/** Filters the sidebar list and any overview rows by the same data attributes. Filters are a per-tab convenience. */
export function mountAdminFilters(root: Document) {
  const controls = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-admin-filter]')];
  const count = root.querySelector<HTMLElement>('[data-admin-count]');
  const saved = readSaved();
  for (const control of controls) {
    const value = saved[control.dataset.adminFilter ?? ''];
    if (typeof value === 'string') control.value = value;
    control.addEventListener('input', apply);
  }
  apply();
  root.querySelector('.admin-list-link.is-active')?.scrollIntoView({ block: 'center' });
  mountSorting(root);

  function apply() {
    const filters = Object.fromEntries(controls.map(control => [control.dataset.adminFilter ?? '', control.value]));
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch { /* storage is optional */ }
    const query = (filters.query ?? '').trim().toLocaleLowerCase('en');
    const matches = (element: HTMLElement) => (!query || (element.dataset.search ?? '').includes(query)) &&
      (!filters.classification || element.dataset.classification === filters.classification) &&
      (!filters.status || (element.dataset.status ?? '').split(' ').includes(filters.status));
    let visible = 0;
    for (const item of root.querySelectorAll<HTMLElement>('[data-admin-object]')) {
      const shown = matches(item);
      item.hidden = !shown;
      if (shown && item.closest('[data-admin-list]')) visible += 1;
    }
    if (count) count.textContent = String(visible);
  }
}

function readSaved(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
  } catch { return {}; }
}

function mountSorting(root: Document) {
  for (const table of root.querySelectorAll<HTMLTableElement>('[data-admin-sortable]')) {
    const body = table.tBodies[0];
    if (!body) continue;
    table.querySelectorAll<HTMLButtonElement>('thead button').forEach((button, column) => {
      button.addEventListener('click', () => {
        const descending = button.dataset.sort !== 'descending';
        table.querySelectorAll<HTMLButtonElement>('thead button').forEach(other => { delete other.dataset.sort; });
        button.dataset.sort = descending ? 'descending' : 'ascending';
        const key = (row: HTMLTableRowElement) => row.cells[column]?.dataset.value ?? row.cells[column]?.textContent ?? '';
        const rows = [...body.rows].sort((a, b) => {
          const left = key(a), right = key(b), numeric = Number(left) - Number(right);
          const order = Number.isNaN(numeric) ? left.localeCompare(right, 'en') : numeric;
          return descending ? -order : order;
        });
        body.append(...rows);
      });
    });
  }
}
