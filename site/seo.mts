export const SITE_ORIGIN = "https://css.earth";

// Object routes remain canonical. The root Earth alias uses /earth/ too;
// camera state, query parameters, and preview hosts never enter metadata.
export function objectSeo(object: Pick<import("./object-schema.mts").ObjectEntry, "id" | "name" | "description" | "route">,
  { socialImages, defaultSocialImageId = "earth" }: { socialImages?: ReadonlySet<string>; defaultSocialImageId?: string } = {}) {
  // Only some bodies have a scene capture. Advertising a missing file would
  // break every share preview, so the rest fall back to the default capture.
  const socialId = !socialImages || socialImages.has(object.id) ? object.id : defaultSocialImageId;
  const imageAlt = socialId === object.id
    ? `${object.name} in the cssEarth 3D explorer`
    : `${defaultSocialImageId === 'earth' ? 'Earth' : defaultSocialImageId} in cssEarth (shared preview)`;
  return {
    title: `${object.name} | cssEarth`,
    description: object.description,
    canonical: new URL(object.route, SITE_ORIGIN).href,
    image: new URL(`/social/${socialId}.jpg`, SITE_ORIGIN).href,
    imageAlt,
  };
}
