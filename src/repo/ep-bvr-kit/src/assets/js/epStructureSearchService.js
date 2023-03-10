// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import { constants as epBvrConstants } from 'js/epBvrConstants';

/**
 * Structure Search BOM Service for EasyPlan.
 *
 * @module js/epStructureSearchService
 */

 'use strict';

/**
 * Returns the selected searched item in the Mbom tree.
 * In case the item is packed - return its packing item otherwise, return the item itself.
 *
 * @param {Object} vmoObj - the selected item in the search results
 * @param {Object} response - the load soa response for the selected item 'bl_pack_master' property
 *
 * @returns {Object} object in Mbom tree
 */
 export function findSelectedItemInMbomTree( vmoObj, response ) {
    let vmo = vmoObj;
    if( vmoObj && vmoObj.uid ) {
        if( response && response.ServiceData && response.ServiceData.modelObjects ) {
            const resModelObjects = response.ServiceData.modelObjects;
            if( resModelObjects[ vmoObj.uid ] && resModelObjects[ vmoObj.uid ].props[ epBvrConstants.BL_PACK_MASTER ] ) {
                vmo = resModelObjects[ vmoObj.uid ].props[ epBvrConstants.BL_PACK_MASTER ].dbValues[ 0 ];
                vmo = vmo && vmo !== '' ? resModelObjects[ vmo ] : vmoObj;
            }
        }
        return vmo;
    }
    return vmo;
}

/**
 * Format "no. of results found string"
 * 
 * @param { String } unformattedString the string without the # of results
 * @returns { String } the formatted string with # of results
 */
export function getResultsFoundMessage( unformattedString, resultsCount ) {
    return unformattedString.format( resultsCount );
}

const exports = {
    findSelectedItemInMbomTree,
    getResultsFoundMessage
};

export default exports;
