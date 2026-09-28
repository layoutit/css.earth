/** Build-only: each tab group's selection rules, written by the component that renders the group (InformationTabs.astro)
 * and collected per page render, so the page does not parse its own controls to find them. */
export interface InformationTabStyle { key: string; css: string; name: string; panelIds: readonly string[] }

const identifier = (value: string) => {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) throw new TypeError(`Invalid information-tab identity: ${JSON.stringify(value)}.`);
  return value;
};

/** One radio group's rules. Keep specificity below the shared mobile rule that stacks detail panels.
 * Native radios still own selection, including without JavaScript. */
export function informationTabStyle(name: string, tabs: readonly { id: string; panelId: string }[]): InformationTabStyle {
  identifier(name);
  const css = tabs.map(tab => {
    const id = identifier(tab.id), panelId = identifier(tab.panelId);
    return `.object-native-tabs ~ :where(#${panelId}) { display: none; }
.object-native-tabs:has(> :where(#${id}):checked) ~ :where(#${panelId}) { display: block; }`;
  }).join('\n');
  return { key: `site/information-tabs/${name}`, css, name, panelIds: tabs.map(tab => tab.panelId) };
}

/** Rules collected during one page render, keyed by that render's `Astro.locals`. */
const rendered = new WeakMap<object, InformationTabStyle[]>();

export function collectInformationTabStyle(render: object, style: InformationTabStyle) {
  const styles = rendered.get(render) ?? [];
  styles.push(style);
  rendered.set(render, styles);
}

/** The rules of the groups inside `html`, in document order. Every panel a group names must be in `html` too. */
export function informationTabStyles(render: object, html: string): { key: string; css: string }[] {
  return (rendered.get(render) ?? [])
    .map(style => ({ style, at: html.indexOf(` name="${style.name}"`) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(({ style }) => {
      const missing = style.panelIds.find(panelId => !html.includes(` id="${panelId}"`));
      if (missing) throw new TypeError(`Information tabs ${style.name} name panel ${missing}, which the page does not render.`);
      return { key: style.key, css: style.css };
    });
}
