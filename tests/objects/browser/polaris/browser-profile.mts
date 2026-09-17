import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/polaris/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polaris',controls,audit:{canonicalPreparedAssets:['/scenes/polaris/polaris-surface-shape@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
