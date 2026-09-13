import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/kleopatra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kleopatra',controls,audit:{canonicalPreparedAssets:['/scenes/kleopatra/kleopatra-shape-surface@2x.webp','/scenes/kleopatra/kleopatra-directional-sun@2x.webp'],retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}}});
