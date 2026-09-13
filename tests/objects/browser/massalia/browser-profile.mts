import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/massalia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'massalia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/massalia/massalia-directional-sun.webp",
      "two": "/scenes/massalia/massalia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/massalia/massalia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/massalia/massalia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
