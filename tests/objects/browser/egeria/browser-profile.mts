import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/egeria/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'egeria',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/egeria/egeria-directional-sun.webp",
      "two": "/scenes/egeria/egeria-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/egeria/egeria-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/egeria/egeria-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
