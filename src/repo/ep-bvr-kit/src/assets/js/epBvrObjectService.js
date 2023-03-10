// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epBvrObjectService
 */
import _ from 'lodash';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import cdm from 'soa/kernel/clientDataModel';


/**
 * gets the related model objects array by given propery of object.
 */
export const getRelatedObjects = function( modelObject, propertyName ) {
    if ( modelObject && propertyName ) {
        let relatedObjs = [];
        let parentProps = modelObject.props;
        let relatedIDs;
        if( parentProps && parentProps[ propertyName ] ) {
            relatedIDs = parentProps[ propertyName ].dbValues;
            relatedIDs.map( id => id && relatedObjs.push( cdm.getObject( id ) ) );
        }
        return relatedObjs;
    }
};

/**
 *
 * @param {Object} modelObject Parent Obj
 * @param {String} childPropertyName  Property Name
 */
export const getSequencedChildren = function( modelObject, childPropertyName ) {
    let children = getRelatedObjects( modelObject, childPropertyName );
    if( children ) {
        children.sort( function( object1, object2 ) {
            const bl_sequence_no_obj1 = object1.props[ epBvrConstants.BL_SEQUENCE_NO ] ? Number( object1.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[0] ) : 0;
            const bl_sequence_no_obj2 = object2.props[ epBvrConstants.BL_SEQUENCE_NO ] ? Number( object2.props[ epBvrConstants.BL_SEQUENCE_NO ].dbValues[0] ) : 0;
            return bl_sequence_no_obj1 - bl_sequence_no_obj2;
        } );
    }
    return children;
};
/**
 * Get parent uid of the object
 * @param {Object} object object of which parent object needs to be fetched
 * @returns {Object} uid of the parent object of the given object
 */
export const getParent = function( object ) {
    return object && object.props && object.props[ epBvrConstants.BL_PARENT ] && !_.isEmpty( object.props[ epBvrConstants.BL_PARENT ].dbValues ) &&
         cdm.getObject( object.props[ epBvrConstants.BL_PARENT ].dbValues[ 0 ] );
};

export default {
    getParent,
    getRelatedObjects,
    getSequencedChildren
};
