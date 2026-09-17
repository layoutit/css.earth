const STORAGE_KEY = 'cssearth-admin-status';

export function mountAdmin(root: Document) {
  mountSearch(root);
  mountCategoryFilters(root);
  mountContents(root);
  mountReadmeLinks(root);
}

/** Choosing a name from the header search opens its article; on the main page typing also narrows the lists. */
function mountSearch(root: Document) {
  const form = root.querySelector<HTMLFormElement>('[data-wiki-search]');
  const input = form?.querySelector('input');
  if (!form || !input) return;
  const options = [...root.querySelectorAll<HTMLOptionElement>('#wiki-objects option')];
  const find = (value: string) => {
    const query = value.trim().toLocaleLowerCase('en');
    return options.find(option => option.value.toLocaleLowerCase('en') === query) ??
      options.find(option => option.value.toLocaleLowerCase('en').startsWith(query));
  };
  const open = () => { const id = find(input.value)?.dataset.id; if (id) root.defaultView?.location.assign(`/admin/${id}/`); };
  form.addEventListener('submit', event => { event.preventDefault(); open(); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); open(); } });
  input.addEventListener('input', event => {
    if (!(event instanceof InputEvent) || event.inputType === 'insertReplacementText') open();
    root.dispatchEvent(new CustomEvent('admin-query', { detail: input.value }));
  });
}

function mountCategoryFilters(root: Document) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-admin-status]')];
  if (!buttons.length) return;
  let status = '', query = '';
  try { status = sessionStorage.getItem(STORAGE_KEY) ?? ''; } catch { /* storage is optional */ }
  if (!buttons.some(button => button.dataset.adminStatus === status)) status = '';
  for (const button of buttons) button.addEventListener('click', () => { status = button.dataset.adminStatus ?? ''; apply(); });
  root.addEventListener('admin-query', event => { query = event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : ''; apply(); });
  apply();

  function apply() {
    try { sessionStorage.setItem(STORAGE_KEY, status); } catch { /* storage is optional */ }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.adminStatus === status));
    const words = query.trim().toLocaleLowerCase('en');
    let shown = 0;
    for (const group of root.querySelectorAll<HTMLElement>('[data-admin-group]')) {
      let visible = 0;
      for (const block of group.querySelectorAll<HTMLElement>('[data-admin-block]')) {
        let inBlock = 0;
        for (const item of block.querySelectorAll<HTMLElement>('[data-admin-card]')) {
          const match = (!words || (item.dataset.name ?? '').includes(words)) && (!status || (item.dataset.tags ?? '').split(' ').includes(status));
          item.hidden = !match;
          if (match) inBlock += 1;
        }
        block.hidden = inBlock === 0;
        visible += inBlock;
      }
      group.hidden = visible === 0;
      const count = group.querySelector('[data-admin-group-count]');
      if (count) count.textContent = String(visible);
      shown += visible;
    }
    const empty = root.querySelector<HTMLElement>('[data-admin-empty]');
    if (empty) empty.hidden = shown > 0;
  }
}

/** Marks the section being read in the contents sidebar. */
function mountContents(root: Document) {
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-wiki-toc] a')];
  const targets = links.map(link => root.getElementById(decodeURIComponent(link.hash.slice(1)))).filter(target => target !== null);
  if (!targets.length) return;
  const update = () => {
    const current = targets.filter(target => target.getBoundingClientRect().top < 120).at(-1) ?? targets[0];
    for (const link of links) link.classList.toggle('is-current', link.hash === `#${current?.id}`);
  };
  root.addEventListener('scroll', update, { passive: true });
  update();
}

/** README links are written relative to the package; send them to the repository. */
function mountReadmeLinks(root: Document) {
  const readme = root.querySelector<HTMLElement>('[data-wiki-readme]');
  const base = readme?.dataset.base;
  if (!readme || !base) return;
  for (const link of readme.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = link.getAttribute('href') ?? '';
    if (!/^(?:[a-z]+:|#|\/)/iu.test(href)) link.href = new URL(href, base).href;
  }
}
