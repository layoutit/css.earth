import {prepareCatalogueStars as prepare} from '@cssearth/nebula-reconstruction/stars/observed-catalogue';
import {catalogueColor} from '../../../adapters/sources/stellar-color.ts';
export function prepareCatalogueStars(...args:[Parameters<typeof prepare>[0],Parameters<typeof prepare>[1],Parameters<typeof prepare>[2],Parameters<typeof prepare>[3],Parameters<typeof prepare>[4]]){return prepare(...args,catalogueColor);}
