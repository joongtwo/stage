// Copyright (c) 2022 Siemens

/**
 * Helper API ( getBackingObjects ) to get the backing object's from viewModelObject's of type Awb0Element.
 * Custom code should use this async API to get the backing object's based on the input Awb0Element's.
 * @module js/occmgmtBackingObjectProviderService
 */
import AwPromiseService from 'js/awPromiseService';
import cdmSvc from 'soa/kernel/clientMetaModel';
import _ from 'lodash';

var exports = {};

/**
 * @constructor
 */
var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

/**
 * Async function to get the backing object's for input viewModelObject's.
 * viewModelObject's should be of type Awb0Element.
 * @param {Object} viewModelObjects - of type Awb0Element
 * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
 *
 */
export let getBackingObjects = function( viewModelObjects ) {
    var deferred = AwPromiseService.instance.defer();

    var bomAdapter = 'AWBCB';
    var indexBomAdapter = 'AWBIB';
    var cpdAdapter = 'AWB4GD';

    var bomLines = [];
    var indexedBomLines = [];
    var CPDLines = [];

    _.forEach( viewModelObjects, function( modelObject, index ) {
        if( modelObject && cdmSvc.isInstanceOf( 'Awb0Element', modelObject.modelType ) ) {
            switch ( true ) {
                //BOMLine Or Ptn0PartitionLine
                case modelObject.uid.endsWith( bomAdapter ):
                    bomLines[ index ] = modelObject;
                    break;
                //IndexedBOMLine
                case modelObject.uid.endsWith( indexBomAdapter ):
                    indexedBomLines[ index ] = modelObject.uid;
                    break;
                //CPDLine
                case modelObject.uid.endsWith( cpdAdapter ):
                    CPDLines[ index ] = modelObject.uid;
                    break;
                //Default
                default:
                    throw 'Unknown Input element. backing Object provider not supported';
            }
        } else {
            throw 'Unknown Input element. backing Object provider not supported';
        }
    } );

    var allLines = [];
    if( bomLines.length ) {
        getBomLines( bomLines );
        _.forEach( bomLines, function( bomLine, index ) {
            allLines[ index ] = bomLine;
        } );
    }
    if( CPDLines.length ) {
        getCPDLines( CPDLines );
        _.forEach( CPDLines, function( CPDLine, index ) {
            allLines[ index ] = allLines[ index ] ? allLines[ index ] : CPDLine;
        } );
    }
    if( indexedBomLines.length ) {
        getIndexedBomLines( indexedBomLines ).then( function() {
            _.forEach( indexedBomLines, function( indexedBomLine, index ) {
                allLines[ index ] = allLines[ index ] ? allLines[ index ] : indexedBomLine;
            } );
            deferred.resolve( allLines );
        } );
    } else {
        deferred.resolve( allLines );
    }
    return deferred.promise;
};

//BOMLine Or Ptn0PartitionLine
let getBomLines = function( viewModelObjects ) {
    _.forEach( viewModelObjects, function( modelObject, index ) {
        var modelObjectUid = modelObject.uid;
        if( modelObjectUid ) {
            // Get the Element type
            var type = modelObject.type;

            // Get the index of the Element type in the uid
            var bomLineUidIndex = modelObjectUid.indexOf( type );
            if( bomLineUidIndex !== -1 ) {
                // Add the length of the Element type and add 2 for .. to reach the start of the backing BOMLine uid
                bomLineUidIndex += type.length + 2;
            }

            // Get the index of the adapter at the end of the uid which is after ,,
            var suffixIndex = modelObjectUid.indexOf( ',,' );

            // Get the backing BOMLine uid
            var uid = modelObjectUid.substring( bomLineUidIndex, suffixIndex );

            // Remove Saved BookMark uid if it exists
            if( uid.includes( 'SBM:' ) ) {
                uid = uid.substr( uid.indexOf( ',' ) + 1 );
            }

            if( uid !== null ) {
                // Get the BOMLine type by using the first part of the uid till the ..
                var bomLineTypeIndex = uid.indexOf( '..' );
                var bomLineType = uid.substr( 0, bomLineTypeIndex );

                // Add SR::N:: as prefix
                uid = 'SR::N::' + uid;

                // Strip off the parent Partition from the uid when Partition Scheme is applied
                if ( uid.includes( '%' ) ) {
                    uid = uid.substr( 0, uid.indexOf( '%' ) );
                }

                viewModelObjects[ index ] = new IModelObject( uid, bomLineType );
            } else {
                var ptnUid = modelObjectUid.match( 'Ptn0PartitionLine(.*),' );
                if( ptnUid !== null ) {
                    ptnUid = 'SR::N::' + ptnUid[ 0 ].replace( ',,', '' );
                    viewModelObjects[ index ] = new IModelObject( ptnUid, 'Ptn0PartitionLine' );
                }
            }
        }
    }
    );
};

//IndexedBOMLine
let getIndexedBomLines = function( viewModelObjects ) {
    // If the viewModelObject happens to be an indexed line
    // Need to make provision for invoking SOA to get BOMLines
    // For now populate null object for IndexedBOMLine
    var deferred = AwPromiseService.instance.defer();
    _.forEach( viewModelObjects, function( modelObjectUid, index ) {
        if( modelObjectUid ) {
            viewModelObjects[ index ] = null;
        }
    } );
    deferred.resolve();
    return deferred.promise;
};

//CPDLine
let getCPDLines = function( viewModelObjects ) {
    // For now populate null object for CPDLine
    _.forEach( viewModelObjects, function( modelObjectUid, index ) {
        if( modelObjectUid ) {
            viewModelObjects[ index ] = null;
        }
    } );
};

export default exports = {
    getBackingObjects
};
