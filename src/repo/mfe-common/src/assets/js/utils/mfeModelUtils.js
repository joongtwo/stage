//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

import tcPropConstants from 'js/constants/tcPropertyConstants';

/**
 * @module js/utils/mfeModelUtils
 */


/**
 * @param {modelObject} modelObject - the given modelObject
 * @return {boolean} true if the given object can be checked out
 */
export function isCheckoutable( modelObject ) {
    if( modelObject && modelObject.props[ tcPropConstants.IS_CHECKOUTABLE ] ) {
        return modelObject.props[ tcPropConstants.IS_CHECKOUTABLE ].uiValues[ 0 ].toLowerCase() === 'true' &&
            isModifiable( modelObject );
    }
    return false;
}

/**
 * @param {modelObject} modelObject - the given modelObject
 * @param {modelObject} userObj - the user object
 * @return {boolean} true if the given object is checked out by the current user
 */
export function isCheckedOutByCurrentUser( modelObject, userObj ) {
    if( modelObject && userObj && modelObject.props[ tcPropConstants.CHECKED_OUT_USER ] ) {
        return userObj.props.uid === modelObject.props[ tcPropConstants.CHECKED_OUT_USER ].dbValues[ 0 ];
    }
    return false;
}

/**
 * @param {modelObject} modelObject - the given modelObject
 * @return {boolean} true if the given object is modifiable
 */
export function isModifiable( modelObject ) {
    if( modelObject && modelObject.props[ tcPropConstants.IS_MODIFIABLE ] ) {
        return modelObject.props[ tcPropConstants.IS_MODIFIABLE ].uiValues[ 0 ].toLowerCase() === 'true';
    }
    return false;
}

/**
 * Get the Unique uid
 *
 * @param {Object} uid - the vmo uid f
 */
export function getUniqueIdFromVmo( uid ) {
    return uid.replaceAll( /[&\/\\#, +()$~%.'":*?<>{}]/g, '' );
}

export default {
    isCheckedOutByCurrentUser,
    isModifiable,
    isCheckoutable,
    getUniqueIdFromVmo
};
