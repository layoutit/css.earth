export const SITE_ORIGIN = "https://css.earth";

// Object routes remain canonical. The root Earth alias uses /earth/ too;
// camera state, query parameters, and preview hosts never enter metadata.
export function objectSeo(object: Pick<import("./objects.mts").ObjectEntry, "id" | "name" | "description" | "route">,
  { socialImages, defaultSocialImageId = "earth" }: { socialImages?: ReadonlySet<string>; defaultSocialImageId?: string } = {}) {
  // Only some bodies have a scene capture. Advertising a missing file would
  // break every share preview, so the rest fall back to the default capture.
  const socialId = !socialImages || socialImages.has(object.id) ? object.id : defaultSocialImageId;
  return {
    title: `${object.name} | cssEarth`,
    description: object.description,
    canonical: new URL(object.route, SITE_ORIGIN).href,
    image: new URL(`/social/${socialId}.jpg`, SITE_ORIGIN).href,
    imageAlt: `${object.name} in the cssEarth 3D explorer`,
  };
}

/** A catalogue focus's page: its host scene's page, titled and addressed as the focus. */
export function focusSeo(focus: { id: string; name: string }, options?: Parameters<typeof objectSeo>[1]) {
  return objectSeo({ id: focus.id, name: focus.name, route: `/${focus.id}/`, description: `${focus.name} in the cssEarth 3D explorer` }, options);
}

/** Write a page's title, address and description into the live head when an in-place selection changes which page it is.
 * The share image stays the loaded page's: only the build knows which captures exist. */
export function applySeoHead(document: Document, seo: Pick<ReturnType<typeof objectSeo>, "title" | "description" | "canonical">) {
  if (document.title !== seo.title) document.title = seo.title;
  for (const [selector, attribute, value] of [
    ['link[rel="canonical"]', "href", seo.canonical], ['meta[name="description"]', "content", seo.description],
    ['meta[property="og:title"]', "content", seo.title], ['meta[property="og:description"]', "content", seo.description],
    ['meta[property="og:url"]', "content", seo.canonical], ['meta[name="twitter:title"]', "content", seo.title],
    ['meta[name="twitter:description"]', "content", seo.description],
  ] as const) {
    const element = document.head.querySelector(selector);
    if (element && element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
  }
}
