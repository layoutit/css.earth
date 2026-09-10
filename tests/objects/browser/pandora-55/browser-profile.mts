import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/pandora-55/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pandora-55',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/pandora-55/pandora-55-directional-sun.webp",
      "two": "/scenes/pandora-55/pandora-55-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/pandora-55/pandora-55-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/pandora-55/pandora-55-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
