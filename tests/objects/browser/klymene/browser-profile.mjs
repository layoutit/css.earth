import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/klymene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'klymene',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/klymene/klymene-directional-sun.webp",
      "two": "/scenes/klymene/klymene-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/klymene/klymene-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/klymene/klymene-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
