import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/dactyl/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dactyl',controls:objectControls,audit:{preparedAssetPairs:[{one:'/scenes/dactyl/dactyl-directional-sun.webp',two:'/scenes/dactyl/dactyl-directional-sun@2x.webp'}],canonicalPreparedAssets:['/scenes/dactyl/dactyl-shape-surface@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
