import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/trappist-1c/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'trappist-1c',controls,audit:{canonicalPreparedAssets:['/scenes/trappist-1c/trappist-1c-surface-shape@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
