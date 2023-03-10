// Copyright (c) 2022 Siemens

/**
 * Service used to back track objects
 *
 * @module js/ssp0BackingObjectProviderService
 *
 */
import _ from 'lodash';

let exports = {};

/**
  * @param {String} uid uid
  * @param {String} type type
  */
const IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

/**
  * Get Design Element from Bom Line
  * @param {String} bomLineUid  Array of bomLineUid
  * @return {String} uid of design element object
  */
export let getDesignElementObject = function( bomLineUid ) {
    if ( bomLineUid.length > 0 ) {
        bomLineUid = bomLineUid.replace( 'SR::N::', 'SR::N::Awb0PartElement..' );
        return bomLineUid.concat( ',,AWBCB' );
    }
};

/**
  * Get Bom Lines of view Model Objects
  * @param {Array.Object} viewModelObjects viewModelObjects
  * @return {Array.Object} uid of Service Plan
  */
export let getBomLines = function( viewModelObjects ) {
    _.forEach( viewModelObjects, function( modelObjectUid, index ) {
        if ( modelObjectUid ) {
            let uid = modelObjectUid.uid.match( 'BOMLine(.*),' );
            uid = 'SR::N::' + uid[0].replace( ',,', '' );
            viewModelObjects[index] = new IModelObject( uid, 'BOMLine' );
        }
    } );
    return viewModelObjects;
};

/**
  * Get Bom Line of view Model Object
  * @param {Array.Object} viewModelObject viewModelObject
  * @return {Array.Object} uid of Service Plan
  */
export let getBomLine = function( viewModelObject ) {
    if ( viewModelObject ) {
        const vmo = getBomLines( [ viewModelObject ] );
        return vmo[0];
    }
};

/**
  * Get Bom Line Uid of view Model Object
  * @param {Array.Object} viewModelObject viewModelObject
  * @return {Object} object contains uid
  */
export let getBomLineUid = function( viewModelObject ) {
    if ( viewModelObject ) {
        const vmo = getBomLine( viewModelObject );
        return {
            bomLineUid: vmo.uid
        };
    }
};

export default exports = {
    getBomLines,
    getBomLine,
    getBomLineUid,
    getDesignElementObject
};
