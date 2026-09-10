import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/medea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'medea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/medea/medea-directional-sun.webp",
      "two": "/scenes/medea/medea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/medea/medea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/medea/medea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
