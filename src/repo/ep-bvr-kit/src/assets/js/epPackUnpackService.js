// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * This service helps pack or unpack a bomline
 *
 * @module js/epPackUnpackService
 */

import soaService from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import {
    constants as epBvrConstants
} from 'js/epBvrConstants';
import cdm from 'soa/kernel/clientDataModel';


/**
 * Flag for pack bomlines
 */
const PACK = 0;
/**
 * Flag for unpack bomlines
 */
const UNPACK = 1;

/**
 * Flag for pack all bomlines
 */
const PACKALL = 2;
/**
 * Flag for unpack all bomlines
 */
const UNPACKALL = 3;
/**
 * @param {Object} obj - The message bundles localized files
 * @param {Boolean} packUnpackFlag -  true => pack, false => unpack
 */
function packOrUnpack( obj, packUnpackFlag ) {
    let selectedObjs = [];
    selectedObjs.push( obj );
    const packFlag = '0';
    let input = {
        lines: selectedObjs,
        flag: packUnpackFlag === packFlag ? PACK : UNPACK
    };
    return soaService.post( 'StructureManagement-2010-09-Structure', 'packOrUnpack', input )
        .then( function( response ) {
            eventBus.publish( 'epPostPackOrUnpackEvent', { selectedLine: obj } );
        } );
}

/**
 * Pack or unpack All given sub assembly
 *
 * @param {Object} obj - selected line
 * @param {Boolean} packUnpackAllFlag -  true => pack, false => unpack
 * @returns {Object} lines
 */
function packOrUnpackAll( obj, packUnpackAllFlag ) {
    let selectedObjs = [];
    if( mfeTypeUtils.isOfTypes( obj, [ epBvrConstants.MFG_BVR_PART ] ) ) {
        selectedObjs.push( cdm.getObject( obj.props.bl_parent.value ) );
    } else{
        selectedObjs.push( obj );
    }
    const packALLFlag = '2';
    let input = {
        lines: selectedObjs,
        flag: packUnpackAllFlag === packALLFlag ? PACKALL : UNPACKALL
    };
    return soaService.post( 'StructureManagement-2010-09-Structure', 'packOrUnpack', input )
        .then( function( response ) {
            eventBus.publish( 'epPostPackOrUnpackEvent', { selectedLine: obj } );
        } );
}
/**
 * Update postPackUnpack for given treeTable
 *
* @param {Object} dataprovider dataprovider that contains list that needs to be updated
 */
function updateOnPackOrUnpack( dataProvider ) {
    dataProvider.getViewModelCollection().clear();
    dataProvider.resetDataProvider();
}

/**
 * Checks whether the input object is a packed line
 * @param {String} objectUid object uid
 */
function isPacked( objectUid ) {
    const vmo = cdm.getObject( objectUid );
    if( vmo ) {
        return vmo.props.bl_is_packed ? vmo.props.bl_is_packed.dbValues[ 0 ] === '1' : false;
    }
    return false;
}

export default {
    packOrUnpack,
    packOrUnpackAll,
    updateOnPackOrUnpack,
    isPacked
};
