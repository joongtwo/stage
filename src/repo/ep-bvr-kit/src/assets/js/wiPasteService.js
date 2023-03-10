// Copyright (c) 2022 Siemens

import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import localeService from 'js/localeService';
import messagingSvc from 'js/messagingService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import epBvrObjectService from 'js/epBvrObjectService';
import appCtxService from 'js/appCtxService';
import epReloadService from 'js/epReloadService';

/**
 * WI Paste service
 *
 * @module js/wiPasteService
 */

/**
 * @param {ViewModelObject} Vmo - Parent ViewModelObject
 */
export function pasteInto( vmo, newObjectID, objectToPaste ) {
    const areObjectsCut = appCtxService.getCtx( 'cutIntent' );
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];

    relatedObjects = objectToPaste.map( element => {
        areObjectsCut ? addMoveObjectInput( saveInputWriter, vmo, element ) : addPasteInput( saveInputWriter, vmo, element, newObjectID );
        return element;
    } );
    relatedObjects.push( vmo );

    saveInputWriter.addRelatedObjects( relatedObjects );
    const policyId = policySvc.register( getPastePolicy() );

    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
        policyId && policySvc.unregister( policyId );
        const resource = localeService.getLoadedText( 'InstructionsMessages' );
        const pastedObjMessage = getPastedLocalizedMessage( resource, objectToPaste, vmo );
        messagingSvc.showInfo( pastedObjMessage );
        epReloadService.unregisterReloadInput( 'epPaste' );
    } );
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste into section
 */
function addPasteInput( saveInputWriter, connectedTo, cloneFrom, newObjUid ) {
    const objToClone = {
        id: newObjUid,
        connectTo: connectedTo.uid,
        cloneFrom: cloneFrom.uid
    };
    saveInputWriter.addCloneObject( objToClone );

    return newObjUid;
}

function modifySequenceNumberProperty( objUid, seq_no, inputwriter ) {
    const seqArray = new Array( String( seq_no ) );
    inputwriter.addModifiedProperty( objUid, epBvrConstants.BL_SEQUENCE_NO, seqArray );
}

/**
 * @param {Object} referenceObjects : selected VMO on tree and parent of selected object
 * @param {VMO} newOps Newly copied objects
 * @param {Object} inputwriter Input writer
 * @param {Object} pasteInfo : isPasteBefore flag and object to be pasted
 */
function addObjectsToResequence( referenceObjects, newOps, inputwriter, pasteInfo ) {
    let isFirstChild = false;
    //will work just for classic BOP
    const objects = epBvrObjectService.getSequencedChildren( referenceObjects.parent, epBvrConstants.MFG_SUB_ELEMENTS );
    if( objects ) {
        const base_Seq_no = 10;
        const seq_no_interval = 10;
        let seq_no = base_Seq_no;

        objects.sort( ( obj1, obj2 ) =>  obj1.props.bl_sequence_no.dbValues[ 0 ] > obj2.props.bl_sequence_no.dbValues[ 0 ]  ? 1 : -1 );
        let index = objects.findIndex( object => object.uid === referenceObjects.selectedVMO.uid );
        index = pasteInfo.isPasteBefore ? index : index + 1;
        //TODO: Update mfe Tree.
        isFirstChild =  index === 0;
        if( newOps.length > 0 ) {
            objects.splice( index, 0, ...newOps );
        } else {
            // To Support cut paste under same parent only
            // Repositioning of object which is cut(delete) and then pasted to different postion.
            const oldIndex = objects.findIndex( object => object.uid === pasteInfo.objectToPaste.uid );
            objects.splice( index, 0, objects.splice( oldIndex, 1 )[ 0 ] );
        }
        objects.forEach( object => {
            modifySequenceNumberProperty( object.uid ? object.uid : object, seq_no, inputwriter );
            seq_no += seq_no_interval;
        } );
    }
    return {
        objects: objects,
        isFirstChild: isFirstChild
    };
}

/**
 *This method implements paste before for selected copied object
 * @param {ViewModelObject} Vmo - Paste before object
 */
export function pasteBefore( vmo, id, objectToPaste ) {
    pasteBeforeAfter( vmo, true, id, objectToPaste );
}

/**
 *
 * @param {VMOObject} vmo Selected object
 * @param {Boolean} isPasteBefore PASTE BEFORE : TRUE , PASTE AFTER : FALSE
 */
function pasteBeforeAfter( vmo, isPasteBefore, id, objectToPaste ) {
    const areObjectsCut = appCtxService.getCtx( 'cutIntent' );
    let relatedObjects = [];
    let newObjUids = [];
    const saveInputWriter = saveInputWriterService.get();

    //get parent object
    const parentObj = epBvrObjectService.getParent( vmo );
    if( parentObj ) {
        relatedObjects.push( parentObj );
        objectToPaste.forEach( element => {
            if( !areObjectsCut ) {
                relatedObjects.push( vmo );
                relatedObjects.push( element );
            } else {
                addMoveObjectInput( saveInputWriter, parentObj, element );
            }
        } );

        const referenceObjects = {
            selectedVMO: vmo,
            parent: parentObj
        };
        const pasteInfo = {
            isPasteBefore: isPasteBefore,
            objectToPaste: objectToPaste[ 0 ]
        };

        const resequenceData = addObjectsToResequence( referenceObjects, newObjUids, saveInputWriter, pasteInfo );
        relatedObjects = resequenceData.objects ? relatedObjects.concat( resequenceData.objects ) : relatedObjects;

        saveInputWriter.addRelatedObjects( relatedObjects );
        const policyId = policySvc.register( getPastePolicy() );
        epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
            policyId && policySvc.unregister( policyId );
            eventBus.publish( 'epTreeTable.plTable.reload' );
            const resource = localeService.getLoadedText( 'InstructionsMessages' );
            const pastedObjMessage = isPasteBefore ? getPastedBeforeSucessLocalizedMessage( resource, objectToPaste, vmo ) : getPastedAfterSucessLocalizedMessage( resource, objectToPaste, vmo );
            messagingSvc.showInfo( pastedObjMessage );
            epReloadService.unregisterReloadInput( 'epPaste' );
        } );
    }
}

/**
 *
 * @param {Object} saveInputWriter Input writer instance to add entry
 * @param {VMO} objToLoad object to reload
 */
function addReloadSection( saveInputWriter, objToReload ) {
    const loadType = {
        loadType: [ 'GetWIData' ]
    };
    saveInputWriter.addReloadSectionWithObject( loadType, objToReload );
}
/**
 * Get the property policy
 *
 * @returns {Object} Policy object - Policy object
 */
function getPastePolicy() {
    return {
        types: [ {
            name: epBvrConstants.IMAN_ITEM_BOP_LINE,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            }, {
                name: epBvrConstants.BL_SEQUENCE_NO
            } ]
        } ]
    };
}
/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {String} objectsToDelete - The objects to delete
 * @returns {String} localizedValue - The localized message string
 */
function getPastedLocalizedMessage( localTextBundle, objectsPasted, targetObj ) {
    return objectsPasted && objectsPasted.length === 1 ? localTextBundle.pasteSuccessMessage.format( objectsPasted[ 0 ].props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteMultipleSuccessMessage.format( objectsPasted.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {String} objectsToDelete - The objects to delete
 * @returns {String} localizedValue - The localized message string
 */
function getPastedBeforeSucessLocalizedMessage( localTextBundle, objectsPasted, targetObj ) {
    return objectsPasted && objectsPasted.length === 1 ?
        localTextBundle.pasteBeforeSuccessMessage.format( objectsPasted[ 0 ].props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteBeforeMultipleSuccessMessage.format( objectsPasted.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 *This method implements paste before for selected copied object
 * @param {ViewModelObject} Vmo - Paste before object
 */
export function pasteAfter( vmo ) {
    pasteBeforeAfter( vmo, false );
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {String} objectsToDelete - The objects to delete
 * @returns {String} localizedValue - The localized message string
 */
function getPastedAfterSucessLocalizedMessage( localTextBundle, objectsPasted, targetObj ) {
    return objectsPasted && objectsPasted.length === 1 ?
        localTextBundle.pasteAfterSuccessMessage.format( objectsPasted[ 0 ].props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteAfterMultipleSuccessMessage.format( objectsPasted.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {Object} parentObject new parent object
 * @param {Object} objectToMove object to move
 */
function addMoveObjectInput( saveInputWriter, parentObject, objectToMove ) {
    saveInputWriter.addMoveObject( { id: [ objectToMove.uid ] }, { bl_parent: [ parentObject.uid ] } );
}

let exports = {};
export default exports = {
    pasteInto,
    pasteBefore,
    pasteAfter
};
