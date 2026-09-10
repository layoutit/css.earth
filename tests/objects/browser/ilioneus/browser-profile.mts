import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ilioneus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ilioneus',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ilioneus/ilioneus-directional-sun.webp",
      "two": "/scenes/ilioneus/ilioneus-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ilioneus/ilioneus-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ilioneus/ilioneus-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
