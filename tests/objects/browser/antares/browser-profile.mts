import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/antares/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'antares',controls,audit:{canonicalPreparedAssets:['/scenes/antares/antares-surface-shape@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
