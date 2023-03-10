// Copyright (c) 2022 Siemens

/**
 * @module js/epRemoveObjectService
 */

import appCtxService from 'js/appCtxService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import localeService from 'js/localeService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import _ from 'lodash';

/**
 * Remove EBOM from current CC.
 * @param   {Object} selectedObjectFromTile - selected Object from the tile
 */
function removeEBOM( selectedObjectFromTile ) {
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    const ccObj = epTaskPageContext.collaborationContext;
    const MbomStructureContext = epTaskPageContext.MbomStructureContext;
    const relatedObjects = [ ccObj, selectedObjectFromTile ];
    const objectToRemove = [ selectedObjectFromTile.uid ];

    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
    let localizedRemoveConfirmationMessage;
    if( MbomStructureContext ) {
        objectToRemove.push( MbomStructureContext.uid );
        relatedObjects.push( MbomStructureContext );
        localizedRemoveConfirmationMessage = localTextBundle.removeEbomConfirmationMessage.format( MbomStructureContext.vmo.props.object_string.dbValue );
    } else {
        localizedRemoveConfirmationMessage = localTextBundle.removeConfirmationMessage.format( selectedObjectFromTile.vmo.props.object_string.dbValue );
    }

    return removeObjectFromWorkPackage( selectedObjectFromTile, ccObj, relatedObjects, objectToRemove, localizedRemoveConfirmationMessage, localTextBundle );
}

/**
 * Remove selected object from current CC.
 * @param   {Object} selectedObjectFromTile - selected Object from the tile
 */
function removeObject( selectedObjectFromTile ) {
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    const ccObj = epTaskPageContext.collaborationContext;
    const relatedObjects = [ ccObj, selectedObjectFromTile ];
    const objectToRemove = [ selectedObjectFromTile.uid ];

    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
    const localizedRemoveConfirmationMessage = localTextBundle.removeConfirmationMessage.format( selectedObjectFromTile.vmo.props.object_string.dbValue );
    return removeObjectFromWorkPackage( selectedObjectFromTile, ccObj, relatedObjects, objectToRemove, localizedRemoveConfirmationMessage, localTextBundle );
}

/**
 *
 * @param {*} selectedObjectFromTile
 * @param {*} ccObj
 * @param {*} relatedObjects
 * @param {*} objectToRemove
 * @param {*} localizedRemoveConfirmationMessage
 * @param {*} localTextBundle
 * @returns
 */
function removeObjectFromWorkPackage( selectedObjectFromTile, ccObj, relatedObjects, objectToRemove, localizedRemoveConfirmationMessage, localTextBundle ) {
    const ccObject = {
        id: [ ccObj.uid ]
    };
    const objectToRemoveInCC = {
        Remove: objectToRemove
    };

    const saveInputWriter = saveInputWriterService.get();
    if( selectedObjectFromTile.type === 'Cfg0ProductItem' ) {
        saveInputWriter.removeConfiguratorContext( ccObject, objectToRemoveInCC );
    } else {
        saveInputWriter.removeObjectFromCC( ccObject, objectToRemoveInCC );
    }
    let removeStructureBtnTitle;
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    if( epTaskPageContext.productionProgramStructureContext && selectedObjectFromTile.type === 'Cfg0ProductItem' ) {
        const objectToRemoveInCC = {
            Remove: [ epTaskPageContext.productionProgramStructureContext.uid ]
        };
        saveInputWriter.removeObjectFromCC( ccObject, objectToRemoveInCC );
        removeStructureBtnTitle = localTextBundle.removeStructureTitleWithPP;
    } else {
        removeStructureBtnTitle = localTextBundle.removeStructureTitle;
    }

    return mfgNotificationUtils.displayConfirmationMessage( localizedRemoveConfirmationMessage, removeStructureBtnTitle, localTextBundle.cancelButton ).then( () => {
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( () => {
            // TODO : We have published addRemove event from this service as a WORKAROUND for now.
            // Once saveEvents are available in server response, then epSaveService should publish this event.
            eventBus.publish( 'ep.addRemoveEvents', { removedSaveEvent: objectToRemove } );
            selectedObjectFromTile = {};
        } );
    }, () => {
        logger.info( `User cancelled 'Remove' operation for ${selectedObjectFromTile.vmo.props.object_string.dbValue}` );
    } );
}

/**
 * Remove Configurator Context from workpackage
 * @param {Object} selectedObjectFromTile
 * @returns
 */
function removeConfigContextFromWorkpackage( selectedObjectFromTile ) {
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
    const ccObj = epTaskPageContext.collaborationContext;
    let relatedObjects = [];
    let objectsToRemove = [];
    let localizedRemoveConfirmationMessage;
    if( epTaskPageContext.productionProgramStructureContext ) {
        const associatedPPObject = epTaskPageContext.productionProgramStructureContext;
        relatedObjects = [ ccObj, selectedObjectFromTile, associatedPPObject ];
        objectsToRemove = [ selectedObjectFromTile.uid, associatedPPObject.uid ];
        localizedRemoveConfirmationMessage = localTextBundle.removeConfigContextWithPPMessage;
        return removeObjectFromWorkPackage( selectedObjectFromTile, ccObj, relatedObjects, objectsToRemove, localizedRemoveConfirmationMessage, localTextBundle );
    }

    relatedObjects = [ ccObj, selectedObjectFromTile ];
    objectsToRemove = [ selectedObjectFromTile.uid ];
    localizedRemoveConfirmationMessage = localTextBundle.removeConfigContextMessage.format( selectedObjectFromTile.props.object_string.dbValues[ 0 ] );
    return removeObjectFromWorkPackage( selectedObjectFromTile, ccObj, relatedObjects, objectsToRemove, localizedRemoveConfirmationMessage, localTextBundle );
}

/**
 * Remove Product Variant from Production Program
 * @param {ObjectArray} selectedProductVariantObject - Selected Product Variants
 * @returns {Promise} promise for response
 */
function removeProductVariantFromProductionProgram( selectedProductVariantObject ) {
    const relatedObjects = [];
    const objectsToRemove = [];
    const saveInputWriter = saveInputWriterService.get();
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );

    const multiple = selectedProductVariantObject.length > 1;
    const targetObject = epTaskPageContext.productionProgramCollection;
    relatedObjects.push( targetObject );
    const messageParameter = multiple ? selectedProductVariantObject.length : selectedProductVariantObject[ 0 ].props.object_string.dbValues[ 0 ];
    const message = multiple ? localTextBundle.removeProductVariants : localTextBundle.removeProductVariant;
    const localizedRemoveConfirmationMessage = message.format( messageParameter );
    const removeProductVariantBtnTitle = multiple ? localTextBundle.removeProductVariantsBtnTitle : localTextBundle.removeProductVariantBtnTitle;

    selectedProductVariantObject.forEach( selection => {
        const addDeleteObj = {
            id: selection.uid,
            Type: selection.type
        };
        if( targetObject ) {
            addDeleteObj.connectTo = targetObject.uid;
            relatedObjects.push( targetObject );
        }
        objectsToRemove.push( selection.uid );
        saveInputWriter.addDeleteObject( addDeleteObj );
        relatedObjects.push( selection );
    } );

    return mfgNotificationUtils.displayConfirmationMessage( localizedRemoveConfirmationMessage, removeProductVariantBtnTitle, localTextBundle.cancelButton ).then( () => {
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( () => {
            const saveEvents = _.map( objectsToRemove, uid => ( {
                eventObjectUid: uid,
                eventType: 'DELETED_PVS'
            } ) );
            eventBus.publish( 'ep.multipleAddRemoveEvents', { DELETED_PVS: saveEvents } );
            selectedProductVariantObject = {};
        } );
    }, () => {
        logger.info( `User cancelled 'Remove' operation for ${selectedProductVariantObject.vmo.props.object_string.dbValue}` );
    } );
}

export default {
    removeEBOM,
    removeObject,
    removeObjectFromWorkPackage,
    removeConfigContextFromWorkpackage,
    removeProductVariantFromProductionProgram
};
