import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/betelgeuse/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'betelgeuse',controls,audit:{canonicalPreparedAssets:['/scenes/betelgeuse/betelgeuse-surface-matisse@2x.webp'],retained:{lensIds:['matisse'],speedClicks:5,allowedMountSelectors:[]}}});
