// Copyright (c) 2022 Siemens

/**
 * Service for Background Parts
 *
 * @module js/epBackgroundPartsToEBOMCacheService
 */

let epBackgroundPartsToEBOMCache = {};

/**
   *
   * @param {String} backgroundPartUid background part
   * @returns {String} composite
   */
function getmatchingEBOMLine( backgroundPartUid ) {
    if( backgroundPartUid && epBackgroundPartsToEBOMCache[backgroundPartUid] ) {
        return epBackgroundPartsToEBOMCache[backgroundPartUid];
    }
}

/**
   *
   * @param {String} backgroundPartUid backgroundPart uid
   * @param {string} ebomLineUid ebomLine uid
   */
function setmatchingEBOMLine( backgroundPartUid, ebomLineUid ) {
    epBackgroundPartsToEBOMCache[backgroundPartUid] = ebomLineUid;
}


/**
   * This method clears epBackgroundPartsToEBOMCache
   */
function clearEpBackgroundPartsToEBOMCacheService(  ) {
    epBackgroundPartsToEBOMCache = {};
}

export default  {
    getmatchingEBOMLine,
    clearEpBackgroundPartsToEBOMCacheService,
    setmatchingEBOMLine
};


