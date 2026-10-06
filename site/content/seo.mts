export const SITE_ORIGIN = "https://css.earth";

// Object routes remain canonical. The root Earth alias uses /earth/ too;
// camera state, query parameters, and preview hosts never enter metadata.
export function objectSeo(object: Pick<import("../directory/objects.mts").ObjectEntry, "id" | "name" | "description" | "route">,
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

/** The site's own page, `/`: it opens on Earth but is named and addressed as the site. */
export function homeSeo(earth: ReturnType<typeof objectSeo>) {
  return { ...earth, title: "cssEarth: the universe in HTML and CSS",
    description: "Explore planets, moons, stars and galaxies built from open space data as 3D HTML and CSS, without WebGL or canvas.",
    canonical: new URL("/", SITE_ORIGIN).href };
}

/** schema.org for the home page: the site's name, which search results show beside its address. */
export function websiteJsonLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: "cssEarth", alternateName: "css.earth", url: new URL("/", SITE_ORIGIN).href };
}

/** schema.org for a body's page: the pages from the site down its orbit chain (cssEarth › Sun › Mars › Phobos). */
export function breadcrumbJsonLd(trail: readonly { readonly name: string; readonly route: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ name: "cssEarth", route: "/" }, ...trail].map((step, index) => ({
      "@type": "ListItem", position: index + 1, name: step.name, item: new URL(step.route, SITE_ORIGIN).href })) };
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
