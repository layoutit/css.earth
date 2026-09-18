import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/trappist-1b/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'trappist-1b',controls,audit:{canonicalPreparedAssets:['/scenes/trappist-1b/trappist-1b-surface-temperature@2x.webp'],retained:{lensIds:['temperature'],speedClicks:5,allowedMountSelectors:[]}}});
