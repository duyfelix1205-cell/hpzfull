import React from 'react';

// Exact labels from the approved ZWM_FV05_Direct_Extraction_V1.5.2_FULL.zip
// Manifest. These are PRESENTATION aliases, not business categories.
// Do not fuzzy-match or introduce a new category into posts/filters.
import{resolveZwmCategoryIcon}from'./zwmarket-category-icon-map.js';

const BASE='/zwmarket/category-icons/v1.5.2';
// Icon originals are opaque RGB with a baked-in Navy background.
// No masking, color filters, blend modes, shadows or alpha transformations.
export function ZwmCategoryIcon({category,small=false}){
  const id=resolveZwmCategoryIcon(category);
  if(!id)return null; // Keep existing plain-text badge for unmatched categories.
  return <picture className={'zwm-category-icon'+(small?' zwm-category-icon--small':'')} aria-hidden="true">
    <source type="image/webp" srcSet={BASE+'/webp/'+id+'.webp'}/>
    <img src={BASE+'/png/'+id+'.png'} alt="" loading="lazy" decoding="async" width="256" height="256"/>
  </picture>;
}
