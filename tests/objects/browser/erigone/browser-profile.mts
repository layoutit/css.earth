import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/erigone/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'erigone',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/erigone/erigone-directional-sun.webp",
      "two": "/scenes/erigone/erigone-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/erigone/erigone-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/erigone/erigone-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
