// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epAddObjectService
 */

import appCtxService from 'js/appCtxService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import dataManagementService from 'soa/dataManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import popupService from 'js/declpopupService';
import eventBus from 'js/eventBus';
import epInitializationService from 'js/epInitializationService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import localeService from 'js/localeService';
import logger from 'js/logger';
import epContextService from 'js/epContextService';

/**
 * Add's selected object to the current CC.
 *@param   {Object} data - declViewModel
 *@param   {Object} selectedObject - selected Object from search popup
 *@param   {Object} revisionRule - selected rev Rule
 */
export function addObject( data, selectedObject, revisionRule ) {
    const saveInputWriter = saveInputWriterService.get();
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const ccUid = epPageContext.collaborationContext.uid;
    const objectToAdd = selectedObject.uid;
    const revRule = revisionRule.dbValue;
    const ccObject = {
        id: [ ccUid ]
    };

    const objectToAddInCC = {
        Add: [ objectToAdd ],
        revisionRule: [ revRule ]
    };
    saveInputWriter.addObjectToCC( ccObject, objectToAddInCC );

    const objectToLoad = [ ccUid, objectToAdd, revRule ];

    return dataManagementService.loadObjects( objectToLoad ).then( function() {
        const ccObject = cdmSvc.getObject( ccUid );
        const objectToAddObj = cdmSvc.getObject( objectToAdd );
        const revRuleObj = cdmSvc.getObject( revRule );
        const relatedObjects = [ ccObject, objectToAddObj, revRuleObj ];
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
            // TODO : We have published addRemove event from this service as a WORKAROUND for now.
            // Once saveEvents are available in server response, then epSaveService should publish this event.
            const ccObjectUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext' ).uid;
            const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccObjectUid );
            return epLoadService.loadObject( loadTypeInput ).then( ( response ) => {
                epInitializationService.updateTaskPageContext( response );
                eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent : objectToAdd } );
                popupService.hide( data.popupId );
            } );
        } );
    } );
}

/**
 * Add configurator context to the workpackage
 * @param {*} data - declViewModel
 * @param {*} selectedObject - selected Object from search popup
 * @returns
 */
function addConfiguratorContext( data, selectedObject ) {
    const saveInputWriter = saveInputWriterService.get();
    const epPageContext = appCtxService.getCtx( 'epPageContext' );
    const ccUid = epPageContext.collaborationContext.uid;
    const objectToAdd = selectedObject.uid;
    const ccObject = {
        id: [ ccUid ]
    };
    const objectToAddInCC = {
        Add: [ objectToAdd ]
    };
    saveInputWriter.addConfiguratorContext( ccObject, objectToAddInCC );
    const objectToLoad = [ ccUid, objectToAdd ];

    return dataManagementService.loadObjects( objectToLoad ).then( function() {
        const ccObject = cdmSvc.getObject( ccUid );
        const objectToAddObj = cdmSvc.getObject( objectToAdd );
        const relatedObjects = [ ccObject, objectToAddObj ];
        const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
        const associateConfigContextConfirmationMessage = localTextBundle.associateConfigContextMessage.format( objectToAddObj.props.object_string.dbValues[0] );
        return mfgNotificationUtils.displayConfirmationMessage( associateConfigContextConfirmationMessage, localTextBundle.associateButton, localTextBundle.cancelButton ).then( () => {
            return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function() {
                // TODO : We have published addRemove event from this service as a WORKAROUND for now.
                // Once saveEvents are available in server response, then epSaveService should publish this event.
                const ccObjectUid = appCtxService.getCtx( 'epTaskPageContext.collaborationContext' ).uid;
                const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.CC, epLoadConstants.HEADER ], ccObjectUid );
                return epLoadService.loadObject( loadTypeInput ).then( ( response ) => {
                    epInitializationService.updateTaskPageContext( response );
                    for( let object in  response.loadedObjectsMap ) {
                        epContextService.setPageContext( object,  response.loadedObjectsMap[ object ][ 0 ] );
                    }
                    eventBus.publish( 'ep.addRemoveEvents', { addedSaveEvent : objectToAdd } );
                    popupService.hide( data.popupId );
                } );
            } );
        }, () => {
            logger.info( 'User cancelled operation' );
        } );
    } );
}

export default {
    addObject,
    addConfiguratorContext
};
