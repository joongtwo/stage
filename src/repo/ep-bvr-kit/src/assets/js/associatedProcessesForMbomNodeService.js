// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 define
 */

/**
 * @module js/associatedProcessesForMbomNodeService
 */
import awPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import mfeTableService from 'js/mfeTableService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import eventBus from 'js/eventBus';
import appCtxService from 'js/appCtxService';
import navigationSvc from 'js/navigationService';

const navigationMsgs = localeService.getLoadedText( 'navigationMessages' );
const highLevelPlanningMessages = localeService.getLoadedText( 'HighLevelPlanningMessages' );


/**
  * Load  processes associated with selected MBOM node
  * @param { Object } selectedMBOMNode MBOM node
  * @param { columnConfigValues } columnConfigValues config values
  * @param { Object } navigatePageToSelectedProcess navigate to process from WI or Process planning page
  * @return { promise } promise of associated processes response
  */
function loadAssociatedProcesses( selectedMBOMNode, columnConfigValues, navigatePageToSelectedProcess ) {
    if( Array.isArray( columnConfigValues ) && columnConfigValues.length > 0 ) {
        const loadTypeInput = epLoadInputHelper.getLoadTypeInputs(  'GetAssociatedProcesses', selectedMBOMNode.uid );
        return epLoadService.loadObject( loadTypeInput ).then( ( response ) => {
            let currentRevisionAssociatedProcesses = [];
            let additionalAssocitedProcess = [];
            let mbomRevisionName;
            if( response.relatedObjectsMap && response.relatedObjectsMap[ selectedMBOMNode.uid ] && response.relatedObjectsMap[ selectedMBOMNode.uid ].additionalPropertiesMap2.associatedProcesses ) {
                currentRevisionAssociatedProcesses = response.relatedObjectsMap[ selectedMBOMNode.uid ].additionalPropertiesMap2.associatedProcesses;
            }
            if( response.relatedObjectsMap && response.relatedObjectsMap.oldRevInfo && response.relatedObjectsMap.oldRevInfo.additionalPropertiesMap2.associatedProcesses ) {
                additionalAssocitedProcess = response.relatedObjectsMap.oldRevInfo.additionalPropertiesMap2.associatedProcesses;
                mbomRevisionName = response.relatedObjectsMap.oldRevInfo.additionalPropertiesMap2.revName[0];
            }
            if( currentRevisionAssociatedProcesses.length < 1 && additionalAssocitedProcess.length < 1 ) {
                showErrorPopUp( selectedMBOMNode );
            } else {
                return  createDataForPopup( selectedMBOMNode,
                    additionalAssocitedProcess, currentRevisionAssociatedProcesses, mbomRevisionName, columnConfigValues, navigatePageToSelectedProcess );
            }
        } );
    }
    return awPromiseService.instance.reject();
}

/**
  * Open Popup with associated Process to MBOM
  * @param { Object } selectedMBOMNode MBOM node
  * @param { ObjectList } additionalAssocitedProcess data for Popup
  * @param { ObjectList } currentRevisionAssociatedProcesses data for Popup
  * @param { String } mbomRevisionName MBOM Revision Name
  * @param { columnConfigValues } columnConfigValues config values
  * @param { Object } navigatePageToSelectedProcess navigate to process from WI or Process planning page
  * @return { associatedProcessesForMbomNodeResponse }  associated processes response
*/
function createDataForPopup( selectedMBOMNode, additionalAssocitedProcess, currentRevisionAssociatedProcesses, mbomRevisionName, columnConfigValues, navigatePageToSelectedProcess ) {
    const selectedNode = cdm.getObject( selectedMBOMNode.uid );
    const props = [];
    columnConfigValues.forEach( ( column ) => {
        props.push( column.split( '.' )[ 1 ] );
    } );
    let mbomCurrentRevsion;
    let mbomCurrentName;
    if( additionalAssocitedProcess || currentRevisionAssociatedProcesses ) {
        let mergeProcessesUids = [ ...additionalAssocitedProcess, ...currentRevisionAssociatedProcesses ];

        const addLoadParams = [ {
            tagName: 'inputObjectsToLoad',
            attributeName: 'objectsUid',
            attributeValue: mergeProcessesUids
        } ];
        if( selectedMBOMNode.type === 'BOMLine' ) {
            mbomCurrentRevsion = selectedMBOMNode.props.bl_rev_item_revision_id.dbValues[0];
            mbomCurrentName = selectedMBOMNode.props.bl_rev_object_name.dbValues[0];
        }else{
            mbomCurrentRevsion = selectedMBOMNode.props.awb0ArchetypeRevId.dbValues[0];
            mbomCurrentName = selectedMBOMNode.props.awb0ArchetypeRevName.dbValues[0];
        }
        let loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.GET_PROPERTIES ], '', props, '', addLoadParams );
        return epLoadService.loadObject( loadTypeInputs, false ).then(
            function() {
                let currentRevisionProcessesList = cdm.getObjects( currentRevisionAssociatedProcesses );
                let additionalProcessList = cdm.getObjects( additionalAssocitedProcess );
                return {
                    mbomNode: selectedNode,
                    additionalProcesses: additionalProcessList,
                    currentRevisionProcesses:currentRevisionProcessesList,
                    contextObject : selectedNode,
                    mbomRevisionName : mbomRevisionName,
                    selectedMBOMNode : selectedMBOMNode,
                    currentRevisionName : mbomCurrentRevsion,
                    mbomCurrentName : mbomCurrentName,
                    navigatePageToSelectedProcess : navigatePageToSelectedProcess
                };
            }
        );
    }
}

/**
   * Show Error PopUp When no process linked with MBOM
   * @param { Object } selectedMBOMNode MBOM node
   * 
 */
function showErrorPopUp( selectedMBOMNode ) {
    let ctx = appCtxService.getCtx();

    if( ctx.sublocation.clientScopeURI === 'Mbm0MbomManagement' ) {
        const msg = navigationMsgs.errorMessageForMbomGoTo.format( selectedMBOMNode.props.object_string.dbValues[ 0 ] );
        const buttonArray =  [  navigationMsgs.OpenHLPPageButton, navigationMsgs.closeButton ].map( ( label ) => {
            return mfgNotificationUtils.createButton( label, ( noty ) => {
                if( navigationMsgs.OpenHLPPageButton === label ) {
                    let action = { actionType: 'Navigate' };
                    action.navigateTo = 'highLevelPlanning';
                    let navigationParams = {
                        uid: ctx.epTaskPageContext.processStructure.uid,
                        mcn: ctx.state.params.mcn,
                        impacting_cn: ctx.state.params.tracking_cn,
                        tracking_cn: ctx.state.params.tracking_cn,
                        ebomPCI: ctx.epPageContext.ebomPCI.uid,
                        mbomPCI: ctx.epPageContext.mbomPCI.uid,
                        processPCI: ctx.epPageContext.processPCI.uid,
                        productPCI: ctx.epPageContext.productPCI.uid
                    };
                    navigationSvc.navigate( action, navigationParams );
                    noty.close();
                } else{
                    noty.close();
                }
            } );
        } );
        messagingService.showError( msg, null, null, buttonArray );
    }else{
        let buttonArray = [];
        buttonArray.push( mfgNotificationUtils.createButton( navigationMsgs.closeButton, function( callBack ) {
            callBack.close();
        } ) );
        messagingService.showError( navigationMsgs.errorMessageForMbomGoTo.format( selectedMBOMNode.props.object_string.dbValues[ 0 ] ), null, null, buttonArray );
    }
}

/**
   * Initial loading of proceeses to show on the popup
   * @param {processes} processes associated with selected MBOM node
   * @return {promise} promise
   */
function initialLoadData( processes ) {
    let deferred = awPromiseService.instance.defer();
    deferred.resolve( {
        processes: processes,
        totalFound: processes.length
    } );
    return deferred.promise;
}

/**
   * Load Target Assemblies associated with selected Process node
   * @param { Object } selectedProcessNode Process node
   * @param { Boolean } shouldHaveAssembly true: if given node expected to have trget assebly
   * @param { Object } errorMessage: error message to show if not valid use-case
   * @return { promise } promise of Target Assemblies response
   */
export function getTargetAssemblies( selectedProcessNode, shouldHaveAssembly, errorMessage ) {
    let deferred = awPromiseService.instance.defer();
    let buttonArray = [];
    let errorMessageToShow = null;
    const processNode = Array.isArray( selectedProcessNode ) ? cdm.getObject( selectedProcessNode[ 0 ].uid ) : cdm.getObject( selectedProcessNode.uid );

    if( errorMessage.objectType && errorMessage.commandName ) {
        if( errorMessage.objectType === 'folder' ) {
            errorMessageToShow = highLevelPlanningMessages.processPanelFolderError.format( processNode.props.object_string.dbValues[ 0 ], highLevelPlanningMessages[ errorMessage.commandName ] );
        }
        if( errorMessage.objectType === 'plan' ) {
            errorMessageToShow = highLevelPlanningMessages.processPanelPlanError.format( processNode.props.object_string.dbValues[ 0 ], highLevelPlanningMessages[ errorMessage.commandName ] );
        }
    } else {
        buttonArray.push( mfgNotificationUtils.createButton( navigationMsgs.closeButton, function( callBack ) {
            callBack.close();
        } ) );
        errorMessageToShow = errorMessage.format( processNode.props.object_string.dbValues[ 0 ] );
    }

    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.GET_PROPERTIES ], processNode.uid, [ epBvrConstants.TARGET_ASSEMBLY_PROPERTY ] );
    epLoadService.loadObject( loadTypeInput ).then( () => {
        const targetAssembly = processNode.props[ epBvrConstants.TARGET_ASSEMBLY_PROPERTY ] ? processNode.props[ epBvrConstants.TARGET_ASSEMBLY_PROPERTY ].dbValues : [];
        if( shouldHaveAssembly && targetAssembly.length < 1 ) {
            messagingService.showError( errorMessageToShow, null, null, buttonArray );
            deferred.reject();
        }
        if( !shouldHaveAssembly && targetAssembly.length > 0 ) {
            messagingService.showError( errorMessageToShow );
            deferred.reject();
        } else {
            deferred.resolve( targetAssembly );
        }
    } );

    return deferred.promise;
}


/**
  * Revise and Relink of processes for MBOM 
  * @param {processes} selectedBOPUid selected process Uid
  * @param {selectedMBOMNode} selectedMBOMNode selected MBOM Node 
  * @param {dataProvider} dataProvider
  * @returns {Promise}  promise
  */
export function reviseAndRelink( selectedBOPUid, selectedMBOMNode, dataProvider ) {
    dataProvider.selectedObjects = [];
    let relModelObject = {};
    let processModelObject = {};
    let relatedObjects = [];
    const saveWriter = saveInputWriterService.get();
    const selectedProcess = cdm.getObject( selectedBOPUid );
    if( selectedMBOMNode ) {
        const newObj = {
            id: selectedBOPUid
        };
        const targetAsm = {
            targetObjects: selectedMBOMNode.uid
        };
        relModelObject = {
            uid: selectedMBOMNode.uid,
            type: selectedMBOMNode.type
        };
        processModelObject = {
            uid: selectedProcess.uid,
            type: selectedProcess.type
        };
        relatedObjects.push( relModelObject, processModelObject );
        saveWriter.associateWIToAssembly( newObj, targetAsm );
    }
    return epSaveService.saveChanges( saveWriter, false, relatedObjects ).then( function( serviceResponse ) {
        let eventData = {};
        if( selectedBOPUid ) {
            mfeTableService.removeFromDataProvider( selectedBOPUid, dataProvider );
            mfeTableService.refreshTable( 'additionalProcessesTable' );
        }
        if ( serviceResponse.saveEvents && serviceResponse.saveEvents.length > 0 ) {
            serviceResponse.saveEvents.forEach( saveEvent => {
                if ( saveEvent.eventType === epSaveConstants.EVENT_ASSOCIATED_PROCESS ) {
                    eventData = saveEvent.eventObjectUid;
                }
            } );
        }
        eventBus.publish( 'ep.associatedProcess', { eventData } );
        if( dataProvider.viewModelCollection.loadedVMObjects.length === 0 ) {
            eventBus.publish( 'ep.hideAdditionalProcessTable' );
        }
    } );
}

/**
  * Enable Revise and Link Command 
  * @param {dataProvider} dataProvider 
  * @return {boolean} showReviseCommand
  * 
  */

export function checkReleaseStatusInPrefernce( dataProvider ) {
    let ctx = appCtxService.getCtx();
    let preferencesValue = ctx.preferences.MEReleaseStatusListForAutoRevise;
    let selectedObject = dataProvider.selectedObjects[0].props.bl_rev_release_status_list.dbValues[0].split( ',' );
    const valueExist = selectedObject.some( val=> preferencesValue.includes( val ) );
    return {
        showReviseCommand: valueExist
    };
}

export default {
    loadAssociatedProcesses,
    initialLoadData,
    getTargetAssemblies,
    reviseAndRelink,
    checkReleaseStatusInPrefernce
};

