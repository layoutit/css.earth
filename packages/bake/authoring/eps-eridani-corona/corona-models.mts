/** Gas at rest at one temperature and Parker's isothermal wind, each from published numbers of the star. They moved to the
 * shared stellar library (`@cssearth/bake/objects/stellar`, corona/models.ts) when the body generator began to derive other
 * stars' coronae from them; this module keeps the address this package's records and tests name. */
export { G_CGS, HYDROGEN_MASS_G, KELVIN_PER_KEV, K_B, LOSS, MASS_PER_ELECTRON, MEAN_PARTICLE, PROTON_MASS_G, SECONDS_PER_YEAR, SOLAR_MASS_G, SOLAR_RADIUS_CM, hydrostaticCorona, lossFunction, parkerWind } from '@cssearth/bake/objects/stellar';
