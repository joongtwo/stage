// Copyright (c) 2022 Siemens

/**
 * Service for ep effectivity.
 *
 * @module js/epEffectivityService
 */
import _ from 'lodash';
import localeSvc from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import TypeUtils from 'js/utils/mfeTypeUtils';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';

const instrMessagePath = '/i18n/InstructionsEffectivityMessages';
const SNAPSHOT_OBJECT_TYPE = 'SnapShotViewData';

/**
  * function for asking confirmation message before deleting the effectivity obj
  * @param {Object} effectivityObj - effectivity Object
  * @param {Object} selectedObject - selectedObject obj in ep editor
  * @param {Object} scopeForSelectedObject - selected scope - process or operation
  * @returns { Promise } Promise
  */
export function handleRemoveEffectivity( effectivityObj, selectedObject, scopeForSelectedObject ) {
    const resource = localeSvc.getLoadedText( instrMessagePath );

    return mfgNotificationUtils.displayConfirmationMessage( resource.removeEffectivityConfirmation, resource.remove, resource.cancel ).then(
        function( response ) {
            // on Remove
            removeEffectivity( effectivityObj, selectedObject, scopeForSelectedObject ).then( function() {
                eventBus.publish( 'wi.updateEffectivityList', {
                    toRemoveObjects: [ effectivityObj ]
                } );
            } );
        } );
}

/**
  * delete selected effectivity object under a op/process
  * @param {Object} effectivityObj - vmo of effectivity Object
  * @param {Object} selectedObject - selectedObject obj in ep editor
  * @param {Object} scopeForSelectedObject - selected scope - process or operation
  */
function removeEffectivity( effectivityObj, selectedObject, scopeForSelectedObject ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];

    const resource = localeSvc.getLoadedText( instrMessagePath );

    const occurrenceEffectivityObj = {
        objectUID: selectedObject.uid,
        unitObjectID: effectivityObj.uid,
        actionType: 'Remove',
        unit: '',
        endItem: '',
        endItemRev: ''

    };
    if( selectedObject.type === SNAPSHOT_OBJECT_TYPE ) {
        saveInputWriter.editOrRemoveOccurrenceEffectivityForProductView( occurrenceEffectivityObj, selectedObject, scopeForSelectedObject );
        relatedObjects.push( scopeForSelectedObject );
    } else{
        saveInputWriter.saveOccurrenceEffectivity( occurrenceEffectivityObj );
    }
    relatedObjects.push( selectedObject );
    relatedObjects.push( cdm.getObject( effectivityObj.uid ) );

    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        if( selectedObject.type === SNAPSHOT_OBJECT_TYPE ) {
            reloadProductViewEffectivities( selectedObject, scopeForSelectedObject, response, true );
        }
        messagingService.showInfo( resource.removedEffectivity );
    } );
}

/**
  * This method create/edit effectivity on given object
  *
  * @param {Object} selectedObject: Object on which effectivity is to be created
  * @param {Object} effectivityObj: In case existing effectivity need to be updated
  * @param {String} units: Unit field value
  * @param {Object} selectedEndItems: End Item selected from search results
  * @param {Object} scopeForSelectedObject: scope for the selected object if any
  *
  * */
export function createOccurrenceEffectivity( selectedObject, effectivityObj, units, selectedEndItems, scopeForSelectedObject ) {
    const resource = localeSvc.getLoadedText( instrMessagePath );
    const saveInputWriter = saveInputWriterService.get();

    let endItemObj = selectedEndItems[ 0 ] ? cdm.getObject( selectedEndItems[ 0 ].uid ) : cdm.getObject( effectivityObj.props.end_item.dbValues[ 0 ] );
    if( TypeUtils.isOfType( endItemObj, epBvrConstants.ITEM_REVISION ) ) {
        endItemObj = cdm.getObject( endItemObj.props.items_tag.dbValues[ 0 ] );
    }

    let relatedObjects = [];
    let occurrenceEffectivityObj = getEffectivityInput( selectedObject, units, endItemObj, effectivityObj );

    if( selectedObject.type === SNAPSHOT_OBJECT_TYPE ) {
        if( occurrenceEffectivityObj.actionType === 'Create' ) {
            saveInputWriter.saveOccurrenceEffectivityForProductView( occurrenceEffectivityObj, scopeForSelectedObject );
        } else if( occurrenceEffectivityObj.actionType === 'Edit' ) {
            saveInputWriter.editOrRemoveOccurrenceEffectivityForProductView( occurrenceEffectivityObj, selectedObject, scopeForSelectedObject );
        }
        relatedObjects.push( scopeForSelectedObject );
    } else{
        saveInputWriter.saveOccurrenceEffectivity( occurrenceEffectivityObj );
    }
    relatedObjects.push( selectedObject );
    relatedObjects.push( endItemObj );
    effectivityObj && relatedObjects.push( effectivityObj );

    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        if( selectedObject.type === SNAPSHOT_OBJECT_TYPE ) {
            reloadProductViewEffectivities( selectedObject, scopeForSelectedObject, response, false );
        } else{
            eventBus.publish( 'aw.closePopup' );
        }
        const message = effectivityObj ? resource.modified : resource.created;
        response.ServiceData && messagingService.showInfo( resource.addedEffectivity
            .format( message, selectedObject.props.object_string.dbValues[ 0 ] ) );
    } );
}

/**
  * Reload the effectivities associated with the product view
  * @param {*} selectedObject - selected product view
  * @param {*} scopeForSelectedObject - scope for the selected product view
  * @param {*} response - response from the save soa on creating the effectivity
  * @param {*} isActionTypeRemove - Is the action type Remove
  */
function reloadProductViewEffectivities( selectedObject, scopeForSelectedObject, response, isActionTypeRemove ) {
    if ( response.saveEvents && response.saveEvents.length > 0 && response.saveEvents[0] && response.saveEvents[0].eventData ) {
        let uidsNewEff = response.saveEvents[0].eventData;
        if ( uidsNewEff ) {
            let loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( epLoadConstants.FILM_STRIP_PANEL, scopeForSelectedObject.uid );
            epLoadService.loadObject( loadTypeInputs, false ).then( function( output ) {
                const modelObjs = output.ServiceData.modelObjects;
                let datasetsToShow = _.filter( modelObjs, obj => _.includes( [ SNAPSHOT_OBJECT_TYPE ], obj.type ) );
                eventBus.publish( 'epVisualsGallery.updateProductViewVMOs', {
                    datasetsToShow: datasetsToShow,
                    relatedObjectsMap: output.relatedObjectsMap
                } );
                if ( !isActionTypeRemove ) { //The effectivity popup remains open for Remove action
                    eventBus.publish( 'aw.closePopup' );
                }
            } );
        }
    } else if( isActionTypeRemove ) { //No effectivity uid returned by server
        selectedObject.effectivities = [];
    }
}

/**
  * This method returns Save Effectivity Input
  * @param { Object } inputObject: object on which effectivity to be created
  * @param { String } units: units field value
  * @param { Object } endItem: selected End Item
  * @param { Object } effectivityObj: In case existing effectivity need to be updated
  * @returns { Object }: occurrenceEffectivityObj {
  *   objectUID: ,
  *   actionType: Create / Edit,
  *   unitObjectID: ,
  *   unit: ,
  *   endItem:
  *  }
  */
function getEffectivityInput( inputObject, units, endItem, effectivityObj ) {
    let occurrenceEffectivityObj = {
        objectUID: inputObject.uid,
        unit: units,
        endItem: endItem.uid
    };
    if( effectivityObj && effectivityObj.uid ) {
        occurrenceEffectivityObj.actionType = 'Edit';
        occurrenceEffectivityObj.unitObjectID = effectivityObj.uid;
    } else {
        occurrenceEffectivityObj.actionType = 'Create';
        occurrenceEffectivityObj.unitObjectID = '';
    }
    return occurrenceEffectivityObj;
}

let exports;
export default exports = {
    handleRemoveEffectivity,
    createOccurrenceEffectivity
};
