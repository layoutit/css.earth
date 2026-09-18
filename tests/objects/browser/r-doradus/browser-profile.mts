import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/r-doradus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'r-doradus',controls,audit:{canonicalPreparedAssets:['/scenes/r-doradus/r-doradus-surface-alma@2x.webp'],retained:{lensIds:['alma','shape'],speedClicks:5,allowedMountSelectors:[]}}});
