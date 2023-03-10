// Copyright (c) 2022 Siemens

/**
 * @module js/epSaveEffectivityService
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import epSaveService from 'js/epSaveService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import saveInputWriterService from 'js/saveInputWriterService';
import epEffectivityContainer from 'js/epEffectivityContainer';
import { constants as epEffectivityConstants } from 'js/epEffectivityConstants';
import _ from 'lodash';
import epValidateEffectivityService from 'js/epValidateEffectivityService';

const instrMessagePath = '/i18n/InstructionsEffectivityMessages';

/**
 * 
 * @param {Object} endItem end item
 * @param {Object} validateEffectivityData effectivity data
 * @param {Object} configData config data
 * @param {Boolean} hasEffectivityUpdated has effectivty updated
 */
function saveEffectivity( endItem, validateEffectivityData, configData, hasEffectivityUpdated = false ) {
    const rowObjectToEffectivityArray = epEffectivityContainer.getUpdatedEffectivityData();
    const currentEndItem = epEffectivityContainer.getEndItem();
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];
    const currentEndItemObj = cdm.getObject( currentEndItem );
    let currentContextObjects = [];

    _.forEach( rowObjectToEffectivityArray, function( rowData ) {
        if ( rowData.isDirty ) {
            currentContextObjects.push( rowData.object );
            let effectivityString = rowData.effectivityString;

            let occurrenceEffectivityObj = {};
            if ( rowData.effectivityObj && rowData.effectivityObj.uid ) {
                occurrenceEffectivityObj = {
                    objectUID: rowData.object.uid,
                    actionType: 'Edit',
                    unitObjectID: rowData.effectivityObj.uid,
                    unit: effectivityString,
                    endItem: currentEndItem,
                    endItemRev: ''
                };
            } else {
                occurrenceEffectivityObj = {
                    objectUID: rowData.object.uid,
                    actionType: 'Create',
                    unitObjectID: '',
                    unit: effectivityString,
                    endItem: currentEndItem,
                    endItemRev: ''
                };
            }

            saveInputWriter.saveOccurrenceEffectivity( occurrenceEffectivityObj );
            relatedObjects.push( rowData.object );
            relatedObjects.push( currentEndItemObj );
            if ( rowData.effectivityObj && rowData.effectivityObj.uid ) {
                relatedObjects.push( rowData.effectivityObj );
            }
        }
    } );

    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        const eventData = {
            updatedSelectedObjects: currentContextObjects,
            viewModelObjects: response.ServiceData.modelObjects
        };
        epValidateEffectivityService.epUpdateValidateEffectivityDataAfterSave( eventData );
        hasEffectivityUpdated && epValidateEffectivityService.endItemSelectionChangeAfterConfirmation( endItem, validateEffectivityData, configData );

        appCtxService.updatePartialCtx( epEffectivityConstants.EP_EFFECTIVITY_IS_DIRTY, false );
    } );
}

/**
 * 
 * @param {Object} endItem end item
 * @param {Object} validateEffectivityData effectivity data
 * @param {Object} configData config data
 * @param {Boolean} hasEffectivityUpdated has effectivty updated
 */
function handleUnsavedEffectivity( endItem, validateEffectivityData, configData, hasEffectivityUpdated = false ) {
    const resource = localeService.getLoadedText( instrMessagePath );
    return mfgNotificationUtils.displayConfirmationMessage( resource.leaveConfirmation, resource.discard, resource.save ).then(
        function( response ) {
            //on discard
            hasEffectivityUpdated && epValidateEffectivityService.endItemSelectionChangeAfterConfirmation( endItem, validateEffectivityData, configData );
        },
        function() {
            // on Save
            saveEffectivity( endItem, validateEffectivityData, configData, hasEffectivityUpdated );
        } );
}

function removeEffectivity( data ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];
    let currentContextObjects = [];

    const resource = localeService.getLoadedText( instrMessagePath );

    const epCtx = appCtxService.getCtx( 'WiEditor' );
    if ( epCtx.selectedObjectData.selectedObject && epCtx.selectedObjectData.selectedObject.uid ) {
        currentContextObjects.push( epCtx.selectedObjectData.selectedObject );
        relatedObjects.push( epCtx.selectedObjectData.selectedObject );
    }

    const occurrenceEffectivityObj = {
        objectUID: epCtx.selectedObjectData.selectedObject.uid,
        unitObjectID: data.vmo.uid,
        actionType: 'Remove',
        unit: '',
        endItem: '',
        endItemRev: ''

    };
    saveInputWriter.saveOccurrenceEffectivity( occurrenceEffectivityObj );

    relatedObjects.push( cdm.getObject( data.vmo.uid ) );

    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        eventBus.publish( 'updateEffectivityPopup', {
            toRemoveObjects: [ data.vmo ]
        } );
        messagingService.showInfo( resource.removedEffectivity );
    } );
}

const exports = {
    handleUnsavedEffectivity,
    saveEffectivity,
    removeEffectivity
};

export default exports;
