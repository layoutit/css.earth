import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/trappist-1g/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'trappist-1g',controls,audit:{canonicalPreparedAssets:['/scenes/trappist-1g/trappist-1g-surface-shape@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
