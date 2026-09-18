import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/trappist-1d/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'trappist-1d',controls,audit:{canonicalPreparedAssets:['/scenes/trappist-1d/trappist-1d-surface-shape@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
