// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0PerformTaskCommandHandler
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import Awp0PerformTask from 'js/Awp0PerformTask';
import messagingService from 'js/messagingService';
import dmSvc from 'soa/dataManagementService';
import adapterSvc from 'js/adapterService';

var exports = {};

var modelObject;

/**
 * This function open the Panel,call the SOA,display the error before opening the Panel based on TC version.
 */
var openPerformTaskPanel = function() {
    commandPanelService.activateCommandPanel( 'Awp0PerformTaskPanel', 'aw_toolsAndInfo' );
};

/**
 * This method will check for Edit in Progress and according to that open the Panel.
 */
var updateContextAndOpenPanel = function() {
    Awp0PerformTask.isEditInProgress().then( function() {
        openPerformTaskPanel();
    } );
};

/**
 * This method will check if the process fails in background then will throw the error else
 * it will open the "Perform Task" panel.
 *
 * @param {Object} data view model object
 */
var checkForBackgroundProcessingAndOpenPanel = function( data ) {
    var assigneeObj = cdm.getObject( modelObject.props.fnd0Assignee.dbValues[ 0 ] );
    if( assigneeObj.type === 'ResourcePool' ) {
        messagingService.showError( data.i18n.taskCannotCompletedErrorMsg.replace( '{0}', modelObject.props.object_name.dbValues[ 0 ] ) );
    } else {
        updateContextAndOpenPanel();
    }
};

/**
 * This function will validate the conditions before opening the Panel.
 * @param {Object} data view model object
 */
export let validationAndActivatePerformTaskPanel = function( data ) {
    var activeCommand = appCtxService.getCtx( 'activeToolsAndInfoCommand' );
    if( activeCommand && activeCommand.commandId === 'Awp0PerformTaskPanel' ) {
        commandPanelService.activateCommandPanel( 'Awp0PerformTaskPanel', 'aw_toolsAndInfo' );
        return;
    }
    var selected = appCtxService.getCtx( 'selected' );
    if( !selected ) {
        return;
    }

    if( selected.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 || selected.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        modelObject = cdm.getObject( selected.uid );
        updateContextAndOpenPanel();
    } else {
        adapterSvc.getAdaptedObjects( [ selected ] ).then( function( adaptedObjs ) {
            // Get my workflow task for first adapted object and then get the first task
            if( adaptedObjs[ 0 ] && adaptedObjs[ 0 ].modelType.typeHierarchyArray.indexOf( 'WorkspaceObject' ) > -1 ) {
                dmSvc.getPropertiesUnchecked( [ adaptedObjs[ 0 ] ], [ 'fnd0MyWorkflowTasks' ] ).then( function() {
                    var workspaceObject = cdm.getObject( adaptedObjs[ 0 ].uid );
                    // This will check for property 'fnd0MyWorkflowTasks'. If it is not loaded then
                    // it will do nothing and return from here.
                    if( workspaceObject && workspaceObject.props && workspaceObject.props.fnd0MyWorkflowTasks && workspaceObject.props.fnd0MyWorkflowTasks.dbValues[ 0 ] ) {
                        modelObject = cdm.getObject( workspaceObject.props.fnd0MyWorkflowTasks.dbValues[ 0 ] );

                        if( modelObject && modelObject.props.fnd0Assignee ) {
                            checkForBackgroundProcessingAndOpenPanel( data );
                        } else {
                            dmSvc.getPropertiesUnchecked( [ modelObject ], [ 'fnd0Assignee', 'viewed_by_me' ] ).then( function() {
                                checkForBackgroundProcessingAndOpenPanel( data );
                            } );
                        }
                    }
                } );
            }
        } );
    }
};

export default exports = {
    validationAndActivatePerformTaskPanel
};
