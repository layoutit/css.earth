import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/aschera/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aschera',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/aschera/aschera-directional-sun.webp",
      "two": "/scenes/aschera/aschera-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/aschera/aschera-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/aschera/aschera-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
