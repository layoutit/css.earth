import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/juno/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'juno',controls,audit:{preparedAssetPairs:[{one:'/scenes/juno/juno-directional-sun.webp',two:'/scenes/juno/juno-directional-sun@2x.webp'}],canonicalPreparedAssets:['/scenes/juno/juno-shape-surface@2x.webp','/scenes/juno/juno-elevation-surface@2x.webp'],retained:{lensIds:['shape','elevation'],speedClicks:5,allowedMountSelectors:[]}}});
