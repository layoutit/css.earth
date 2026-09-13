import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/phocaea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'phocaea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/phocaea/phocaea-directional-sun.webp",
      "two": "/scenes/phocaea/phocaea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/phocaea/phocaea-shape-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/phocaea/phocaea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
