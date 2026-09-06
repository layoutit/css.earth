export const SITE_ORIGIN = "https://css.earth";

// Object routes remain canonical. The root Earth alias uses /earth/ too;
// camera state, query parameters, and preview hosts never enter metadata.
export function objectSeo(object) {
  return {
    title: `${object.name} in 3D | cssEarth`,
    description: object.description,
    canonical: new URL(object.route, SITE_ORIGIN).href,
    image: new URL(`/social/${object.id}.jpg`, SITE_ORIGIN).href,
    imageAlt: `${object.name} in the cssEarth 3D explorer`,
  };
}
