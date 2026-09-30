/** An object's page stylesheet may be a shared lane template (`src/renderers/css/styles/templates/`) whose selectors name
 * `__object__`; the page and preparation fill in the object's id. A stylesheet of its own names no placeholder. */
export function objectPageCss(css: string, objectId: string): string {
  return css.replaceAll('__object__', objectId);
}
