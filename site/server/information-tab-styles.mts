/** Build-only: each tab group's selection rules, written by the component that renders the group (InformationTabs.astro)
 * and collected per page render, so the page does not parse its own controls to find them. */
export interface InformationTabStyle { key: string; css: string; name: string; panelIds: readonly string[] }

const identifier = (value: string) => {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) throw new TypeError(`Invalid information-tab identity: ${JSON.stringify(value)}.`);
  return value;
};

/** One radio group's rules. Native radios still own selection, including without JavaScript.
 * Specificity sits between the shell's plain `.object-card-tabpanel` (0,1,0), which must lose whatever order the
 * stylesheets load in (a dev server injects the shell's CSS after these), and the phone and tablet rules that stack
 * every panel (0,3,0). The attribute selector names the panel at (0,1,0), where an id would be (1,0,0). */
export function informationTabStyle(name: string, tabs: readonly { id: string; panelId: string }[]): InformationTabStyle {
  identifier(name);
  const css = tabs.map(tab => {
    const id = identifier(tab.id), panelId = identifier(tab.panelId);
    return `.object-native-tabs ~ [id="${panelId}"] { display: none; }
.object-native-tabs:has(> :where(#${id}):checked) ~ [id="${panelId}"] { display: block; }`;
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
