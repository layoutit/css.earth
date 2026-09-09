import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/coelestina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'coelestina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/coelestina/coelestina-directional-sun.webp",
      "two": "/scenes/coelestina/coelestina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/coelestina/coelestina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/coelestina/coelestina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
