import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/kleopatra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kleopatra',controls,audit:{preparedAssetPairs:[{one:'/scenes/kleopatra/kleopatra-directional-sun.webp',two:'/scenes/kleopatra/kleopatra-directional-sun@2x.webp'}],canonicalPreparedAssets:['/scenes/kleopatra/kleopatra-shape-surface@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
