/** Keep native submits usable after camera movement or an enhancement failure. */
export function bindNativeViewForms(documentTarget: Document, windowTarget: Pick<Window, 'location'>) {
  const context = ['v', 'view', 'overview', 'focus', 'focusLens', 'dataset', 'feature'];
  const submit = (event: Event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches('[data-settings-form], [data-dataset-form], .object-sidebar-search-card')) return;
    const url = new URL(windowTarget.location.href);
    for (const input of form.querySelectorAll<HTMLInputElement>('input[data-view-context], input[data-search-context]')) {
      const value = context.includes(input.name) ? url.searchParams.get(input.name) : null;
      input.disabled = value === null;
      input.value = value ?? '';
    }
    if (form.matches('[data-settings-form]')) return;
    for (const input of form.querySelectorAll('[data-current-setting]')) input.remove();
    const add = (name: string, value: string) => {
      const input = documentTarget.createElement('input');
      input.type = 'hidden'; input.name = name; input.value = value; input.dataset.currentSetting = '';
      form.append(input);
    };
    add('settings', '1');
    for (const input of documentTarget.querySelectorAll<HTMLInputElement>('.object-settings input[form][name]')) {
      if (input.type === 'checkbox') { if (input.checked) add(input.name, 'on'); }
      else if (!input.disabled) add(input.name, input.value);
    }
  };
  documentTarget.addEventListener('submit', submit, { capture: true });
  return () => documentTarget.removeEventListener('submit', submit, { capture: true });
}
