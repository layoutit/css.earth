import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/dactyl/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dactyl',controls:objectControls,audit:{preparedAssetPairs:[],canonicalPreparedAssets:['/scenes/dactyl/dactyl-shape-surface@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
