import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/trappist-1/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'trappist-1',controls,audit:{canonicalPreparedAssets:['/scenes/trappist-1/trappist-1-surface-color@2x.webp'],retained:{lensIds:['color'],speedClicks:5,allowedMountSelectors:[]}}});
