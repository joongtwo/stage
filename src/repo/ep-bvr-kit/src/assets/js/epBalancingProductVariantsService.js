// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Balancing Chips related services
 *
 * @module js/epBalancingProductVariantsService
 */

import cdm from 'soa/kernel/clientDataModel';
import epContextService from 'js/epContextService';
import typeDisplayNameService from 'js/typeDisplayName.service';
import { constants as epLoadConstants } from 'js/epLoadConstants';

/**
 * Get productVariants list to display in balancing dashboard
 *
 * @param {Array} staticProductVariantsList 3 static values list
 * @param {Array} productVariantsFromCache productVariants uid list from cache
 *
 * @returns {ObjectList} The full list of pvs + 3 static values
 */
export function getProductVariantsList( staticProductVariantsList, productVariantsFromCache ) {
    let productVariantsList = productVariantsFromCache.map( pvUid => {
        return {
            propDisplayValue: typeDisplayNameService.instance.getDisplayName( cdm.getObject( pvUid ) ),
            propInternalValue: pvUid
        };
    } );

    productVariantsList = sortProductVariantsList( productVariantsList );
    return [ ...staticProductVariantsList, ...productVariantsList ];
}

/**
 * Sort the product variants list
 *
 * @param {ObjectArray} productVariantsList the productVariants list
 *
 * @return {ObjectArray} the sorted productVariantsList
 */
function sortProductVariantsList( productVariantsList ) {
    return productVariantsList.sort( ( pvA, pvB ) => {
        const nameA = pvA.propDisplayValue.toUpperCase(); // ignore upper and lowercase
        const nameB = pvB.propDisplayValue.toUpperCase(); // ignore upper and lowercase
        if( nameA < nameB ) {
            return -1;
        }
        if( nameA > nameB ) {
            return 1;
        }
        // names must be equal
        return 0;
    } );
}

/**
 * Set selected ProductVariant to filter the station or process resource operations by
 *
 * @param {Object} productVariant the selected productVariant
 */
export function setSelectedProductVariant( productVariant ) {
    const productVariantType = productVariant === epLoadConstants.ALL || productVariant === epLoadConstants.MAXIMUM || productVariant === epLoadConstants.WEIGHTED ? productVariant : epLoadConstants.PV_UID;
    const productVariantUid = productVariant === epLoadConstants.ALL || productVariant === epLoadConstants.MAXIMUM || productVariant === epLoadConstants.WEIGHTED ? null : productVariant;
    epContextService.setProductVariant( productVariantUid, productVariantType );
}

/**
 * When product variant is selected from time distribution
 * the selected value in the product variants list should be updated
 *
 * @param {ObjectList} productVariantsList the product variants list
 *
 * @returns {Object} the selected pv
 */
export function getProductVariantToDisplay( productVariantsList ) {
    const productVariantTypeInCtx = epContextService.getProductVariantType();
    const productVariantUidInCtx = epContextService.getProductVariantUid();
    let selectedVal = null;

    if( !productVariantUidInCtx && !productVariantTypeInCtx ) {
        return productVariantsList[0];
    } else if( productVariantTypeInCtx && productVariantTypeInCtx !== epLoadConstants.PV_UID ) {
        selectedVal = productVariantsList.find( ( pv ) => {
            return pv.propInternalValue === productVariantTypeInCtx;
        } );
    } else {
        selectedVal = productVariantsList.find( ( pv ) => {
            return pv.propInternalValue === productVariantUidInCtx;
        } );
    }

    return selectedVal ? selectedVal : productVariantsList[ 0 ];
}


export default {
    getProductVariantsList,
    setSelectedProductVariant,
    getProductVariantToDisplay
};
