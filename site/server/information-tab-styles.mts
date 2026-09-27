import { parseHTML } from 'linkedom';

/** Build-only: derive the scene's tab rules from its rendered controls, outside replaceable cards. */
export function prepareInformationTabStyles(html: string): { key: string; css: string }[] {
  const { document } = parseHTML(html);
  const identifier = (value: string | null) => {
    if (!value || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) throw new TypeError('Invalid information-tab identity.');
    return value;
  };
  return [...document.querySelectorAll('.object-native-tabs')].map(group => {
    const tabs = [...group.querySelectorAll<HTMLInputElement>(':scope > input[data-information-tab]')];
    const name = identifier(tabs[0]?.getAttribute('name') ?? null);
    const css = tabs.map(tab => {
      const id = identifier(tab.id), panelId = identifier(tab.getAttribute('aria-controls'));
      if (tab.name !== name || document.getElementById(panelId)?.parentNode !== group.parentNode)
        throw new TypeError('Information tabs must name sibling panels in one radio group.');
      // Keep specificity below the shared mobile rule that stacks detail panels.
      // Native radios still own selection, including without JavaScript.
      return `.object-native-tabs ~ :where(#${panelId}) { display: none; }
.object-native-tabs:has(> :where(#${id}):checked) ~ :where(#${panelId}) { display: block; }`;
    }).join('\n');
    return { key: `site/information-tabs/${name}`, css };
  });
}
