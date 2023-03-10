// Copyright (c) 2022 Siemens

/**
 * Defines a service that can accept product and set of model objects return chain of Clone Stable Ids (CSIDs) of packed
 * occurrences corresponding to those.
 *
 * @module js/objectsToPackedOccurrenceCSIDsService
 */
import _cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import acePartialSelectionService from 'js/acePartialSelectionService';

let exports = {};

let isPackedOccurrencePresentInParentHierarchy = function( selectedObject ) {
    const isMinimumTCVersion132 = occmgmtUtils.isMinimumTCVersion( 13, 2 );

    if( !( selectedObject && selectedObject.props && selectedObject.props.awb0IsPacked ) ) {
        // awb0IsPacked is not present in property policy
        // decision can not be made whether selected object or its parent are packed occurrences
        // return true to make getPackedOccurrenceCSIDs SOA call
        return true;
    }

    if( isMinimumTCVersion132 && !( selectedObject && selectedObject.props && selectedObject.props.awb0QuantityManaged ) ) {
        // awb0QuantityManaged is not present in property policy
        // decision can not be made whether selected object or its parent are quantity managed occurrences
        // return true to make getPackedOccurrenceCSIDs SOA call
        return true;
    }

    let object = selectedObject;
    while( object && object.props && object.props.awb0Parent && !_.isEmpty( object.props.awb0Parent.dbValues[ 0 ] ) ) {
        if( object.props && object.props.awb0IsPacked && _.isEqual( object.props.awb0IsPacked.dbValues[ 0 ], '1' ) ) {
            // if any of the occurrence in parent hierarchy is packed
            // return true to make getPackedOccurrenceCSIDs SOA call
            return true;
        }

        if( !( object.props && object.props.awb0IsPacked ) ) {
            // if any of the parent do not have the awb0IsPacked or awb0QuantityManaged property
            // decision can not be made whether selected object or its parent are packed occurrences
            // return true to make getPackedOccurrenceCSIDs SOA call
            return true;
        }

        if( object.props && isMinimumTCVersion132 ) {
            if( !object.props.awb0QuantityManaged || !_.isEqual( object.props.awb0QuantityManaged.dbValues[ 0 ], '0' ) ) {
                // if any of the parent do not have the awb0QuantityManaged property
                // decision can not be made whether selected object or its parent are packed occurrences
                // or if any of the parent is quantity managed then
                // return true to make getPackedOccurrenceCSIDs SOA call
                return true;
            }
        }

        let parentUid = object.props.awb0Parent.dbValues[ 0 ];
        object = _cdm.getObject( parentUid );
    }
    // we do not have any packed occurrences in parent hierarchy
    // return false, to avoid making getPackedOccurrenceCSIDs SOA call for selectedObject
    return false;
};

export let getCloneStableIDsWithPackedOccurrences = function( productContextInfo, selectedObjects ) {
    let packedOccurrenceInputObjects = [];
    _.forEach( selectedObjects, function( selectedObject ) {
        if( isPackedOccurrencePresentInParentHierarchy( selectedObject ) &&
            !acePartialSelectionService.isPartiallySelected( selectedObject.uid ) ) {
            packedOccurrenceInputObjects.push( selectedObject );
        }
    } );

    if( packedOccurrenceInputObjects.length === 0 ) {
        return;
    }

    return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2017-12-OccurrenceManagement',
        'getPackedOccurrenceCSIDs', {
            occurrences: selectedObjects,
            productContextInfo: productContextInfo
        }, {} );
};

export default exports = {
    getCloneStableIDsWithPackedOccurrences
};
