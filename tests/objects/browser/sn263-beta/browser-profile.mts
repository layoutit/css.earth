import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/sn263-beta/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sn263-beta',controls:objectControls,audit:{preparedAssetPairs:[{one:'/scenes/sn263-beta/sn263-beta-directional-sun.webp',two:'/scenes/sn263-beta/sn263-beta-directional-sun@2x.webp'}],canonicalPreparedAssets:['/scenes/sn263-beta/sn263-beta-shape-surface@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
