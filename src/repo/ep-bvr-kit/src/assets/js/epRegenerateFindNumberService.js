// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * This service helps to regenerate find numbers
 *
 * @module js/epRegenerateFindNumberService
 */
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
/**
  * @param {Number} object - loadedObject
  * @param {Number} startNumber -  start number of Find Number
  * @param {Number} increment -  increment of find number
 * @param {Boolean} isRecursive -  to include descendent or not
 * @param {Boolean} isBasedOnFlows -  to consider flows
  *  @returns {Object} find numbers
  */
function regenerateFindNumber( object, startNumber, increment, isRecursive, isBasedOnFlows ) {
    let saveInputWriter = saveInputWriterService.get();
    let eventData = { selectedNode: object };
    let relatedObjects = [];
    let rObj = {
        uid: object.uid,
        type: object.type
    };
    relatedObjects.push( rObj );
    object.children && object.children.length > 0 && object.children.forEach( ( child )=>{
        relatedObjects.push(  {
            uid: child.uid,
            type: child.type
        } );
    } );

    let inputData = getInputData( object.uid, startNumber, increment, isRecursive, isBasedOnFlows );
    saveInputWriter.regenerateFindNumber( inputData.regenerateFindNumberInptObj );
    saveInputWriter.addReloadSection( inputData );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        if( response.saveEvents && response.saveEvents.length > 0 ) {
            response.saveEvents.forEach( saveEvent => {
                if( saveEvent.eventType === epSaveConstants.GET_WI_LIST_EVENT ) {
                    eventData.wiEditorData = saveEvent.eventData;
                }
            } );
        }
        return eventData;
    } );
}

/**
 * Generate Input for find numder and WiEditor Refresh
 * @param {Number} uid - loadedObject id
 * @param {Number} startNumber -  start number of Find Number
 * @param {Number} increment -  increment of find number
 *  @returns {Object} find numbers and WiEditor dataentries
 */

const getInputData = function( uid, startNumber, increment, isRecursive, isBasedOnFlows ) {
    let entry = {
        typeToLoad: {
            nameToValuesMap: {
                loadType: [ epSaveConstants.GET_WI_DATA_LIST_TYPE ] // Event type
            } },
        objectToLoad: {
            nameToValuesMap: {
                objectUid: [ uid ]
            } }
    };
    let dataEntries = [];
    dataEntries.push( { entry } );
    const regenerateFindNumberInptObj = {
        objectUid: uid,
        startNumber: [ String( startNumber ) ],
        increment:  [ String(  increment ) ],
        isRecursive:  [ isRecursive ? 'true' : 'false' ],
        isBasedOnFlows:  [ isBasedOnFlows ? 'true' : 'false' ],
        isKeepParallelFindNumber :  [ 'true' ]// for now sending default values
    };
    return { dataEntries, regenerateFindNumberInptObj };
};


export default {
    regenerateFindNumber
};

