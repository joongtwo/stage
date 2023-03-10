// Copyright (c) 2022 Siemens

import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import localeService from 'js/localeService';
import messagingSvc from 'js/messagingService';
import cdm from 'soa/kernel/clientDataModel';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import epBOPClonePasteService from 'js/epBOPClonePasteService';
import appCtxService from 'js/appCtxService';

/**
 * EP Balancing Paste service
 *
 * @module js/epBalancingPasteService
 */


/**
 * Pastes new objects as the child of selected object.
 * @param {ViewModelObject} vmo - Parent ViewModelObject
 * @param {[ViewModelObject]} objectToPaste - objects to be pasted
 * @param {String} revRule - Revision rule of object to be pasted
 * @returns {Promise} the promise
 */
function pasteIntoParent( vmo, objectToPaste, revRule ) {
    let newObjectUID = [];
    objectToPaste && objectToPaste.forEach( object => {
        newObjectUID.push( mfeViewModelUtils.generateUniqueId( 'new_object_id' ) );
    } );


    const saveInputWriter = saveInputWriterService.get();
    let newObjUids = [];
    let relatedObjects = [];

    let parentObj = cdm.getObject( vmo.id ? vmo.id : vmo.uid );
    relatedObjects.push( parentObj );
    const areObjectsCut = appCtxService.getCtx( 'cutIntent' );
    objectToPaste.forEach( function( element, index ) {
        if( areObjectsCut ) {
            epBOPClonePasteService.addMoveObjectInput( saveInputWriter, parentObj, element );
        } else {
            newObjUids.push( epBOPClonePasteService.addPasteInput( saveInputWriter, parentObj, element, newObjectUID[ index ], revRule ) );
        }
        relatedObjects.push( element );
    } );
    relatedObjects.push( vmo );

    let newObjUid = newObjUids[ 0 ];
    saveInputWriter.addRelatedObjects( relatedObjects );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( serviceResponse ) {
        const resource = localeService.getLoadedText( 'clonePasteObjectMessages' );
        const createdObject = getCreatedObjectFromResponse( newObjUid, serviceResponse );
        if( createdObject ) {
            const pastedObjMessage = getPastedLocalizedMessage( resource, objectToPaste, createdObject, vmo );
            messagingSvc.showInfo( pastedObjMessage );
        }
        return createdObject;
    } );
}

/**
 * Get the created Object for given Uid from serviceResponse
 *
 * @param {String} newObjectID - new Object ID
 * @param {Object} serviceResponse service Response
 * @returns {Object} created Object for given Uid from serviceResponse
 */
function getCreatedObjectFromResponse( newObjectID, serviceResponse ) {
    if( serviceResponse && serviceResponse.saveResults ) {
        let createdObjectUid = null;
        serviceResponse.saveResults.every( ( saveResult ) => {
            if( saveResult.clientID && saveResult.clientID === newObjectID ) {
                createdObjectUid = saveResult.saveResultObject.uid;
                return false;
            }
            return true;
        } );
        if( createdObjectUid ) {
            return cdm.getObject( createdObjectUid );
        }
    }
    return null;
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {[Object]} objectsToPaste array of all objects needed to paste
 * @param {Object} pastedObject pasted object
 * @param {Object} targetObj target object
 * @returns {String} localizedValue - The localized message string
 */
function getPastedLocalizedMessage( localTextBundle, objectsToPaste, pastedObject, targetObj ) {
    return objectsToPaste && objectsToPaste.length === 1 ? localTextBundle.pasteSuccessMessage
        .format( pastedObject.props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteMultipleSuccessMessage.format( objectsToPaste.length, targetObj.props.object_string.uiValues[ 0 ] );
}

export default {
    pasteIntoParent
};
