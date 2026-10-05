import { parseFeaturePin } from '../search/feature-search.mts';
import pin from '../prepared/prepared-feature-index.json' with { type: 'json' };

/** This build's cross-body feature index, or null when no body publishes named features. */
export const FEATURE_PIN = parseFeaturePin(JSON.stringify(pin));
