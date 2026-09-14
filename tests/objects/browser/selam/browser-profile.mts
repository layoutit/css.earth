import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/selam/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'selam',controls:objectControls,audit:{canonicalPreparedAssets:['/scenes/selam/selam-shape-surface@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
