// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 define
 */

/**
 * @module js/senReviseService
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import adapterSvc from 'js/adapterService';

/**
 * Adapts given objects in ItemRevision.
 *
 * @param {Object} objectstoAdapt Array of objects to Adapt in the ItemRevision type.
 *
 * @returns {Promise} promise will be retured with array of Adapted object(objects adapted in ItemRevision).
 */
const getAdaptedObject = function( objectstoAdapt ) {
    let deferred = AwPromiseService.instance.defer();
    adapterSvc.getAdaptedObjects( objectstoAdapt ).then( function( adaptedObjs ) {
        deferred.resolve( adaptedObjs );
    } );
    return deferred.promise;
};

/**
 * This method will return input Object for Revise SOA
 *
 * @param {Object} objectsToRevise array of ItemRevision Object to be Revised.
 * @param {Object} parents array of parent object Uid.
 *
 * @returns {Objects} Input for Revise Soa will be returned.
 */
export const getReviseInputs = function( objectsToRevise, parents ) {
    let [ objsToGetDeepCopyData, reviseInputsMap ] = getInputObjects( objectsToRevise, parents );
    let deferred = AwPromiseService.instance.defer();
    let inputData = {
        deepCopyDataInput: getDeepCopyDataInputs( objsToGetDeepCopyData )
    };

    let deepCopyInfoMap = [];
    let promise = soaSvc.post( 'Core-2014-10-DataManagement', 'getDeepCopyData', inputData );
    if( promise ) {
        promise.then( function( response ) {
            if( response !== undefined ) {
                deepCopyInfoMap = response.deepCopyInfoMap;
                for( let i = 0; i < objsToGetDeepCopyData.length; i++ ) {
                    for( let b in deepCopyInfoMap[ 0 ] ) {
                        if( deepCopyInfoMap[ 0 ][ b ].uid === objsToGetDeepCopyData[ i ].uid ) {
                            let reviseIn = reviseInputsMap.get( deepCopyInfoMap[ 0 ][ b ].uid );
                            reviseIn.deepCopyDatas = getConvertedDeepCopyData( deepCopyInfoMap[ 1 ][ b ] );
                            break;
                        }
                    }
                }
            }
            deferred.resolve( Array.from( reviseInputsMap.values() ) );
        } );
    }
    return deferred.promise;
};

/**
 * This method will return InputMap and array of objects to be revise.
 *
 * @param {Object} objects array of objects.
 * @param {Object} parents array of uids.
 *
 * @returns {Objects} Array of objects will be returned, first element in array is objectsToRevise second is revise input map.
 */
const getInputObjects = function( objects, parents ) {
    let reviseInputsArray = [];
    let reviseInputsMap = new Map();
    let objectsToRevise = objects;
    for( let i = 0; i < objectsToRevise.length; i++ ) {
        let reviseInputs = {};
        reviseInputs.item_revision_id = [ '' ];
        reviseInputs.object_desc = [ '' ];
        if( parents.length === 1 && parents[0] ) {
            reviseInputs.fnd0ContextProvider = parents;
        }
        let reviseInput = {};
        reviseInput.targetObject = objectsToRevise[ i ];
        reviseInput.reviseInputs = reviseInputs;
        reviseInputsArray.push( reviseInput );
        reviseInputsMap.set( objectsToRevise[ i ].uid, reviseInput );
    }
    return [ objectsToRevise, reviseInputsMap ];
};

/**
 * Convert Deep Copy Data from client to server format
 *
 * @param deepCopyData property name.
 * @return A list of deep copy data's.
 */
const getConvertedDeepCopyData = function( deepCopyData ) {
    let deepCopyDataList = [];
    for( let i = 0; i < deepCopyData.length; i++ ) {
        let newDeepCopyData = {};
        let valuesMap = deepCopyData[ i ].propertyValuesMap;

        newDeepCopyData.attachedObject = deepCopyData[ i ].attachedObject;
        newDeepCopyData.copyAction = valuesMap.copyAction[ 0 ];
        newDeepCopyData.propertyName = valuesMap.propertyName[ 0 ];
        newDeepCopyData.propertyType = valuesMap.propertyType[ 0 ];

        newDeepCopyData.copyRelations = hasProperty( valuesMap, 'copy_relations' );
        newDeepCopyData.isTargetPrimary = hasProperty( valuesMap, 'isTargetPrimary' );
        newDeepCopyData.isRequired = hasProperty( valuesMap, 'isRequired' );

        newDeepCopyData.operationInputTypeName = deepCopyData[ i ].operationInputTypeName;

        let operationInputs = {};
        operationInputs = deepCopyData[ i ].operationInputs;
        newDeepCopyData.operationInputs = operationInputs;

        if( deepCopyData[ i ].childDeepCopyData.length > 0 ) {
            newDeepCopyData.childDeepCopyData =  getConvertedDeepCopyData( deepCopyData[ i ].childDeepCopyData );
        }else{
            newDeepCopyData.childDeepCopyData = [];
        }
        deepCopyDataList.push( newDeepCopyData );
    }
    return deepCopyDataList;
};


/**
 * This method will check property value in the given array
 *
 * @param {Object} object array of Objects .
 * @param {String} propertyName name of property to check.
 *
 * @returns {Boolean} returns true if value is present and false if not.
 */
const hasProperty = function( object, propertyName ) {
    if( object ) {
        let values = object[ propertyName ];
        if( values && values[ 0 ] === '1' ) {
            return true;
        }
    }
    return false;
};

/**
 * This method will return input Object for getDeepCopyData SOA
 *
 * @param {Object} objsToGetDeepCopyData array of objects to get Deep copy data.
 *
 * @returns {Objects} Array of Input objects will be returned.
 */
const getDeepCopyDataInputs = function( objsToGetDeepCopyData ) {
    let deepCopyDataInputs = [];
    for( let i = 0; i < objsToGetDeepCopyData.length; i++ ) {
        let dcd = {
            operation: 'Revise',
            businessObject: objsToGetDeepCopyData[ i ]
        };
        deepCopyDataInputs.push( dcd );
    }
    return deepCopyDataInputs;
};

/**
 * Convert given selectedObjects in ItemRevision objetc type and returns the InputObject for Revise
 *
 * @param {Object} selectedObjects Objects to Revise
 * @param {String} parent parent uid.
 *
 * @return  {Promise} A list of deep copy datas
 */
export const preprocessAndCreateReviseInput = function( selectedObjects, parent ) {
    let deferred = AwPromiseService.instance.defer();
    let adaptedobj = getAdaptedObject( selectedObjects );
    adaptedobj.then( ( adaptedobj ) => {
        let revInputPromise = getReviseInputs( adaptedobj, [ parent ] );
        revInputPromise.then( ( response ) => {
            deferred.resolve( response );
        } );
    } );
    return deferred.promise;
};

/**
 * Fresh reloads the revisedObjects.
 *
 * @param {Object} eventdata eventdata with revised Objects.
 *
 */
export const reloadRevisedObjects = function( eventdata ) {
    for( let i = 0; i < eventdata.revisedObjects.length; i++ ) {
        let inputData = {
            input: {
                element: eventdata.selectedObjects[i],
                workspaceObject: {
                    uid: eventdata.revisedObjects[ i ].objectCopy.uid,
                    type: eventdata.revisedObjects[ i ].objectCopy.type
                },
                productContext: {
                    uid: appCtxSvc.getCtx( 'sbomContext.productContextInfo.uid' ),
                    type: 'Awb0ProductContextInfo'
                }
            }
        };
        soaSvc.post( 'Internal-ActiveWorkspaceBom-2021-06-OccurrenceManagement', 'updateContentBasedOnRevision2', inputData );
    }
};

export default {
    reloadRevisedObjects,
    preprocessAndCreateReviseInput
};
