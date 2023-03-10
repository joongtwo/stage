// Copyright (c) 2022 Siemens

import _ from 'lodash';
import app from 'app';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import localeService from 'js/localeService';
import messagingSvc from 'js/messagingService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import epBvrObjectService from 'js/epBvrObjectService';
import epCutCopyService from 'js/epCutCopyService';
import epReloadService from 'js/epReloadService';
import cdm from 'soa/kernel/clientDataModel';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import viewModelObjectSvc from 'js/viewModelObjectService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import appCtxService from 'js/appCtxService';

/**
 * EP BOP Clone Paste service
 *
 * @module js/epBOPClonePasteService
 */

const relatedObjectChildrenKey = 'childAssembly';
/**
 * Pastes new objects as the child of selected object.
 * @param {ViewModelObject} vmo - Parent ViewModelObject
 * @param {String} newObjectID - id of new object
 * @param {[ViewModelObject]} objectToPaste - objects to be pasted
 * @param {String} revRule - Revision rule of object to be pasted
 * @returns {Promise} the promise
 */
export function pasteInto( vmo, newObjectID, objectToPaste, revRule ) {
    //For Multiple Copy Paste Into Case In Assembly Planning Page
    let newObjectUID = [];
    if( objectToPaste.length > 1 ) {
        objectToPaste.forEach( object => {
            newObjectUID.push( mfeViewModelUtils.generateUniqueId( 'new_object_id' ) );
        } );
    } else {
        newObjectUID.push( newObjectID );
    }

    const areObjectsCut = appCtxService.getCtx( 'cutIntent' );
    // In case of process cut-paste check if we are pasting under same parent,  as server do not process this use-case
    if( areObjectsCut && objectToPaste.length === 1 && mfeTypeUtils.isOfType( vmo, epBvrConstants.MFG_BVR_PROCESS ) && mfeTypeUtils.isOfType( objectToPaste[ 0 ], epBvrConstants
        .MFG_BVR_PROCESS ) ) {
        if( objectToPaste[ 0 ].props.bl_parent.dbValues[ 0 ] === vmo.uid ) {
            epCutCopyService.removeExistingCutIndication();
            eventBus.publish( 'epTreeTable.plTable.clientRefresh' );
            return new Promise();
        }
    }
    let saveInputWriter = saveInputWriterService.get();

    let relatedObjects = [];

    let parentObj = cdm.getObject( vmo.id ? vmo.id : vmo.uid );
    relatedObjects.push( parentObj );

    objectToPaste.forEach( function( element, index ) {
        if( areObjectsCut ) {
            addMoveObjectInput( saveInputWriter, parentObj, element );
        } else {
            addPasteInput( saveInputWriter, parentObj, element, newObjectUID[ index ], revRule );
        }
        relatedObjects.push( element );
    } );
    relatedObjects.push( vmo );
    const children = getChildren( parentObj, relatedObjectChildrenKey );
    relatedObjects = relatedObjects.concat( children );
    saveInputWriter.addRelatedObjects( relatedObjects );
    const policyId = policySvc.register( getPastePolicy() );
    addRegenarateFindNumberInput( saveInputWriter, parentObj );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( serviceResponse ) {
        handleSaveResponse( serviceResponse, policyId, 'pasteInto', objectToPaste, newObjectUID, vmo  );
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
 *
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {VMO} connectedTo Parent of copied Object
 * @param {VMO} cloneFrom object to be copied
 * @param {String} newObjUid Newly copied object uid
 * @param {String} revisionRule revision Rule
 * @returns {String} Newly copied object uid
 */
function addPasteInput( saveInputWriter, connectedTo, cloneFrom, newObjUid, revisionRule ) {
    let revrule = '';
    if( revisionRule ) {
        revrule = revisionRule;
    }
    const objToClone = {
        id: newObjUid,
        connectTo: connectedTo.uid,
        cloneFrom: cloneFrom.uid,
        revisionRule: revrule
    };
    saveInputWriter.addCloneObject( objToClone );

    return newObjUid;
}

/**
 *
 * @param {Object} parent parent
 * @param {String} relatedObjectChildrenKey key
 * @returns {Array} parents children with Process resource children if there is such
 */
function getChildren( parent, relatedObjectChildrenKey ) {
    let children = cdm.getObjects( epObjectPropertyCacheService.getProperty( parent.uid, relatedObjectChildrenKey ) );
    children.forEach( child =>{
        if ( mfeTypeUtils.isOfType( child, epBvrConstants.MFG_BVR_PROCESS_RESOURCE ) ) {
            children = [ ...children, ...cdm.getObjects( epObjectPropertyCacheService.getProperty( child.uid, relatedObjectChildrenKey ) ) ];
        }
    } );
    return children;
}
/**
 *This method implements paste before for selected copied object

 * @param {ViewModelObject} vmo - Paste before object
 * @param {String} id of new object being pasted
 * @param {[VMOObject]} objectToPaste array of all objects needed to paste

 */
export function pasteBefore( vmo, id, objectToPaste ) {
    pasteBeforeAfter( vmo, true, id, objectToPaste );
}

/**
 * Add regenarate input to save input writer
 * @param {Object} saveInputWriter save input writer
 * @param {Object} parentObj Parent obj
 */
function addRegenarateFindNumberInput( saveInputWriter, parentObj ) {
    saveInputWriter.regenerateFindNumber( {
        objectUid: parentObj.uid,
        startNumber: '10',
        increment: '10',
        isBasedOnFlows: 'false',
        isKeepParallelFindNumber: 'false',
        isRecursive: 'false'
    } );
}
/**
 *
 * @param {VMOObject} vmo Selected object
 * @param {Boolean} isPasteBefore PASTE BEFORE : TRUE , PASTE AFTER : FALSE
 * @param {String} id of new object being pasted
 * @param {[VMOObject]} objectToPaste array of all objects needed to paste
 * @param {String} revisionRule revision rule name for cloned object
 * @returns {Promise} the promise
 */
function pasteBeforeAfter( vmo, isPasteBefore, id, objectToPaste, revisionRule ) {
    let relatedObjects = [];

    let newObjectUID = [];
    let saveInputWriter = saveInputWriterService.get();
    relatedObjects.push( vmo );

    //For MultipleCutCopyCase In Assembly Planning Page
    if( objectToPaste.length > 1 ) {
        objectToPaste.forEach( object => {
            newObjectUID.push( mfeViewModelUtils.generateUniqueId( 'new_object_id' ) );
        } );
    } else {
        newObjectUID.push( id );
    }

    //get parent object
    const parentObj = epBvrObjectService.getParent( vmo );
    if( parentObj ) {
        const areObjectsCut = appCtxService.getCtx( 'cutIntent' );

        relatedObjects.push( parentObj );
        objectToPaste.forEach( function( element, index ) {
            if( areObjectsCut ) {
                addMoveObjectInput( saveInputWriter, parentObj, element );
                isPasteBefore ? addSuccessor( saveInputWriter, element.uid, vmo ) : addPredecessor( saveInputWriter, element.uid, vmo );
            } else {
                addPasteInput( saveInputWriter, parentObj, element, newObjectUID[ index ], revisionRule );
                isPasteBefore ? addSuccessor( saveInputWriter, newObjectUID[ index ], vmo ) : addPredecessor( saveInputWriter, newObjectUID[ index ], vmo );
                relatedObjects.push( newObjectUID[ index ] );
            }
            relatedObjects.push( element );
        } );
        const children = getChildren( parentObj, relatedObjectChildrenKey );
        relatedObjects = relatedObjects.concat( children );

        saveInputWriter.addRelatedObjects( relatedObjects );
        const policyId = policySvc.register( getPastePolicy() );
        addRegenarateFindNumberInput( saveInputWriter, parentObj );
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( serviceResponse ) {
            const pasteType = isPasteBefore ? 'pasteBefore' : 'pasteAfter';
            handleSaveResponse( serviceResponse, policyId, pasteType, objectToPaste, newObjectUID, vmo );
        } );
    }
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
            }, {
                name: epBvrConstants.MFG_SUB_ELEMENTS
            } ]
        } ]
    };
}
/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {[Object]} objectsToPaste array of all objects needed to paste
 * @param {Object} pastedObject pasted object
 * @returns {String} localizedValue - The localized message string
 */
function getPastedIntoLocalizedMessage( localTextBundle, objectsToPaste, pastedObject, targetObj ) {
    return objectsToPaste && objectsToPaste.length === 1 ? localTextBundle.pasteSuccessMessage
        .format( pastedObject.props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteMultipleSuccessMessage.format( objectsToPaste.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {[Object]} objectsToPaste array of all objects needed to paste
 * @param {Object} pastedObject pasted object
 * @returns {String} localizedValue - The localized message string
 */
function getPastedBeforeSucessLocalizedMessage( localTextBundle, objectsToPaste, pastedObject, targetObj ) {
    return objectsToPaste && objectsToPaste.length === 1 ?
        localTextBundle.pasteBeforeSuccessMessage.format( pastedObject.props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteBeforeMultipleSuccessMessage.format( objectsToPaste.length, targetObj.props.object_string.uiValues[ 0 ] );
}

/**
 *This method implements paste before for selected copied object
 * @param {ViewModelObject} vmo - Paste before object
 * @param {String} id of new object being pasted
 * @param {[VMOObject]} objectToPaste array of all objects needed to paste
 */
export function pasteAfter( vmo, id, objectToPaste ) {
    pasteBeforeAfter( vmo, false, id, objectToPaste );
}

/**
 *This method implements cloning of object and connecting it to selected object
 * @param {ViewModelObject} selectedObject - Selected object to add cloned object before/after/into.
 * @param {ViewModelObject} objectToClone - object which is being cloned
 * @param {ViewModelObject} revisionRule - Revision rule of objectToClone
 * @param {String} newObjectID - new generated object id

 */
export function cloneObject( selectedObject, objectToClone, revisionRule, newObjectID ) {
    let toCloneArray = [];
    toCloneArray.push( objectToClone );
    let revRule;
    if( revisionRule ) {
        revRule = revisionRule.uiValue;
    }
    if( mfeTypeUtils.isOfType( selectedObject, epBvrConstants.MFG_BVR_OPERATION ) ) {
        pasteBeforeAfter( selectedObject, false, newObjectID, toCloneArray, revRule );
    } else if( mfeTypeUtils.isOfType( selectedObject, epBvrConstants.MFG_BVR_PROCESS ) ) {
        pasteInto( selectedObject, [ newObjectID ], toCloneArray, revRule );
    }
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {[Object]} objectsToPaste array of all objects needed to paste
 * @param {Object} pastedObject pasted object
 * @returns {String} localizedValue - The localized message string
 */
function getPastedAfterSucessLocalizedMessage( localTextBundle, objectsToPaste, pastedObject, targetObj ) {
    return objectsToPaste && objectsToPaste.length === 1 ?
        localTextBundle.pasteAfterSuccessMessage.format( pastedObject.props.object_string.uiValues[ 0 ], targetObj.props.object_string.uiValues[ 0 ] ) :
        localTextBundle.pasteAfterMultipleSuccessMessage.format( objectsToPaste.length, targetObj.props.object_string.uiValues[ 0 ] );
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

/**
 * Add Predecessor Object
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {String} objectToMoveUid object to move uid
 * @param {Object} predecessorObject predecessor obj
 */
function addPredecessor( saveInputWriter, objectToMoveUid, predecessorObject ) {
    const predecessorInfo = {
        objectId: objectToMoveUid,
        predecessorId: predecessorObject.uid
    };
    saveInputWriter.addPredecessor( predecessorInfo );
}

/**
 * Add Successor Object
 * @param {Object} saveInputWriter To add entry for paste into section
 * @param {String} objectToMoveUid object to move
 * @param {Object} successorObject Successor obj
 */
function addSuccessor( saveInputWriter, objectToMoveUid, successorObject ) {
    const successorInfo = {
        objectId: objectToMoveUid,
        successorId: successorObject.uid
    };
    saveInputWriter.addSuccessor( successorInfo );
}
/**
 * Returns object for reload
 * @param {Object} successorObject new parent obj
 */
function getObjectToReload( newPasteID, newObjectID ) {
    const isCutAction = appCtxService.getCtx( 'cutIntent' );
    return isCutAction ? newPasteID : newObjectID;
}

/**
 * return reload object data
 * @param {Object} selectedObject new parent obj
 * * @param {Object} copiedObjects copied Objects
 */
function getReloadDataForPasteInto( selectedObject, copiedObjects, reloadType, data ) {
    if( reloadType ) {
        let newObjectIDs = generateUniqueIDsAndSetInViewModel( copiedObjects, data );
        return getReloadData( selectedObject, copiedObjects, newObjectIDs );
    }
    return {};
}
/**
 * return reload object data
 * @param {Object} selectedObject new parent obj
 * * @param {Object} copiedObjects copied Objects
 */
function getReloadDataForPasteBeforeAfter( selectedObject, copiedObjects, reloadType, data ) {
    if( reloadType ) {
        const parentObj = epBvrObjectService.getParent( selectedObject );
        let newObjectIDs = generateUniqueIDsAndSetInViewModel( copiedObjects, data );
        return getReloadData( parentObj, copiedObjects, newObjectIDs );
    }
    return {};
}

/**
 * return reload object data
 * @param {Object} targetParent new parent obj
 * * @param {Object} copiedObjects copied Objects
 */
function getReloadData( targetParent, copiedObjects, newObjectIDs ) {
    let reloadData = {};
    const areObjectsCut = appCtxService.getCtx( 'cutIntent' );
    reloadData.reloadObjId = areObjectsCut ? copiedObjects : newObjectIDs;
    reloadData.reloadType = 'GetWIData';
    return reloadData;
}

/**
 * Clone And Associate Process Confirmation and then call clone based on confirmation.
 * @param { Object } objectToClone : Object to clone
 * @param { String } newObjectID : Object ID for new cloned object
 * @param { String } targetAssemblyUid: target assembly ID which will be associated with process
 * @param { String } revRule : revision rule
 */
export function cloneAndAssociateProcessConfirmation( objectToClone, newObjectID, targetAssemblyUid, revRule ) {
    let targetAssembly;

    if( targetAssemblyUid ) {
        targetAssembly = viewModelObjectSvc.createViewModelObject( cdm.getObject( targetAssemblyUid ) );
    }
    if( targetAssembly && objectToClone ) {
        const resource = localeService.getLoadedText( 'HighLevelPlanningMessages' );
        let confirmationMessage = resource.cloneConfirmationMessage.format( objectToClone.props.object_string.dbValues[ 0 ], targetAssembly.props.object_string.dbValues[ 0 ] );
        mfgNotificationUtils.displayConfirmationMessage( confirmationMessage, resource.cloneButtonText, resource.discardButtonText ).then(
            () => {
                performCloneAndAssociationToProcess( objectToClone, newObjectID, targetAssembly, revRule );
            }
        );
    }
}

/**
 * Call Clone and associate process.
 * @param { Object } objectToClone : Object to clone
 * @param { String } newObjectID : Object ID for new cloned object
 * @param { Object } targetAssembly: target assembly object which will be associated with process
 * @param { String } revRule : revision rule
 */
function performCloneAndAssociationToProcess( objectToClone, newObjectID, targetAssembly, revRule ) {
    const objectToPaste = cdm.getObject( objectToClone.props.bl_revision.dbValue );
    const parentObjVmo = viewModelObjectSvc.createViewModelObject( epBvrObjectService.getParent( objectToClone ) );
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [ objectToPaste, parentObjVmo ];
    const newObjectId = addPasteInput( saveInputWriter, parentObjVmo, objectToPaste, newObjectID, revRule );
    saveInputWriter.addRelatedObjects( relatedObjects );
    if( targetAssembly ) {
        const newObj = {
            id: newObjectId
        };

        const targetAsm = {
            targetObjects: targetAssembly.uid
        };

        let relModelObject = {
            uid: targetAssembly.uid,
            type: targetAssembly.type
        };
        relatedObjects.push( relModelObject );

        saveInputWriter.associateWIToAssembly( newObj, targetAsm );
    }
    const policyId = policySvc.register( getPastePolicy() );

    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
        policyId && policySvc.unregister( policyId );
        epReloadService.unregisterReloadInput( 'epPaste' );
    } );
}

/**
 * generates Unique ids for reload service and sets then in ViewModel
 * @param {Object} data ViewModel data
 * * @param {Object} copiedObjects copied Objects
 */
function generateUniqueIDsAndSetInViewModel( copiedObjects, data ) {
    let newObjectIDs = [];
    copiedObjects.forEach( object => {
        newObjectIDs.push( mfeViewModelUtils.generateUniqueId( 'new_object_id' ) );
    } );
    mfeViewModelUtils.setValueInViewModel( data, 'newObjectID', newObjectIDs );
    return newObjectIDs;
}

/**
 * Pastes new objects as the child of selected object.
 * @param {ViewModelObject} vmo - Parent ViewModelObject
 * @param {String} newObjectID - id of new object
 * @param {[ViewModelObject]} objectToPaste - objects to be pasted
 * @param {String} revRule - Revision rule of object to be pasted
 */
export function pasteAssignParts( vmo, newObjectID, objectToPaste, revRule ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];
    relatedObjects = objectToPaste.map( element => {
        addAssignedPasteInput( saveInputWriter, vmo, element, newObjectID, revRule );
        return element;
    } );
    relatedObjects.push( vmo );
    saveInputWriter.addRelatedObjects( relatedObjects );
    const policyId = policySvc.register( getPastePolicy() );
    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( serviceResponse ) {
        policyId && policySvc.unregister( policyId );
    } );
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste into section
 */
function addAssignedPasteInput( saveInputWriter, connectedTo, assignedParts, newObjUid, revisionRule ) {
    const targetObject = {
        id: connectedTo.uid
    };
    const objToPaste = {
        Add: assignedParts.uid,
        useDefaultRelationType: 'true',
        AssignmentMode: 'Reference'
    };
    saveInputWriter.addAssignedParts( targetObject, objToPaste );
}
/**
 * This methood handles save response
 * @param {objet} serviceResponse response
 * @param {string} policyId policyId
 * @param {string} pasteType type
 * @param {object} objectToPaste objects
 * @param {string} newObjectID object id
 * @param {object} vmo vmo
 */
function handleSaveResponse( serviceResponse, policyId, pasteType, objectToPaste, newObjectID, vmo ) {
    policyId && policySvc.unregister( policyId );
    const resource = localeService.getLoadedText( app.getBaseUrlPath() + '/i18n/clonePasteObjectMessages' );
    const createdObject = getCreatedObjectFromResponse( newObjectID, serviceResponse );
    if( createdObject ) {
        if( pasteType === 'pasteBefore' ) {
            messagingSvc.showInfo( getPastedBeforeSucessLocalizedMessage( resource, objectToPaste, createdObject, vmo ) );
        } else if( pasteType === 'pasteAfter' ) {
            messagingSvc.showInfo( getPastedAfterSucessLocalizedMessage( resource, objectToPaste, createdObject, vmo ) );
        } else if( pasteType === 'pasteInto' ) {
            messagingSvc.showInfo( getPastedIntoLocalizedMessage( resource, objectToPaste, createdObject, vmo ) );
        }
    }
    epReloadService.unregisterReloadInput( 'epPaste' );
}

/**
 * Pastes new Inspection Definition objects as the children of selected object.
 * @param {ViewModelObject} vmo - Parent ViewModelObject
 * @param {String} newObjectID - id of new object
 * @param {[ViewModelObject]} objectToPaste - objects to be pasted
 * @param {String} revRule - Revision rule of object to be pasted
 */
export function pasteAssignInspectionParts( vmo, newObjectID, objectToPaste, revRule ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];
    relatedObjects = objectToPaste.map( element => {
        const inspectionObjects = cdm.getObject( element.props.awb0UnderlyingObject.dbValues[0] );
        addAssignedPasteInspectionInput( saveInputWriter, vmo, inspectionObjects, newObjectID, revRule );
        return inspectionObjects;
    } );
    relatedObjects.push( vmo );
    saveInputWriter.addRelatedObjects( relatedObjects );
    const policyId = policySvc.register( getPastePolicy() );
    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( ) {
        policyId && policySvc.unregister( policyId );
    } );
}

/**
 *
 * @param {Object} saveInputWriter To add entry for paste section
 */
function addAssignedPasteInspectionInput( saveInputWriter, connectedTo, assignedParts ) {
    const targetObject = {
        id: connectedTo.uid
    };
    const objToPaste = {
        Add: assignedParts.uid
    };
    saveInputWriter.addAssignedParts( targetObject, objToPaste );
}

let exports = {};
export default exports = {
    pasteInto,
    pasteBefore,
    pasteAfter,
    cloneObject,
    getObjectToReload,
    getReloadDataForPasteInto,
    getReloadDataForPasteBeforeAfter,
    cloneAndAssociateProcessConfirmation,
    pasteAssignParts,
    addPasteInput,
    addMoveObjectInput,
    pasteAssignInspectionParts
};
