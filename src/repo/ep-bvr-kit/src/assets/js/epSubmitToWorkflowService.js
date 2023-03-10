// Copyright (c) 2022 Siemens

/**
 * @module js/epSubmitToWorkflowService
 */
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import prefSvc from 'soa/preferenceService';
import listBoxSvc from 'js/listBoxService';
import soaSvc from 'soa/kernel/soaService';
import dataMgmtService from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';

/**
 * This method submits the selected objects to given workflow
 * @param {Array} selectedObjects - selectedObjects
 * @param {Object} workflowTemplate - workflowTemplate
 * @param {String} workflowName - workflowName
 * @param {String} workflowDescription - workflowDescription
 */
export function submitToWorkflow( selectedObjects, workflowTemplate, workflowName, workflowDescription ) {
    const workflowObject = {
        Object: [],
        desc: workflowDescription,
        name: workflowName,
        templateId: workflowTemplate.uid
    };
    const relatedObjects = [ workflowTemplate ];
    selectedObjects.forEach( ( object ) => {
        workflowObject.Object.push( object.uid );
        relatedObjects.push( object );
    } );
    const saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addWorkflowInput( workflowObject );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( ( response ) => {
        if ( response.ServiceData && !response.ServiceData.partialErrors ) {
            const resource = localeService.getLoadedText( 'WorkflowMessages' );
            const resourceMultipleMsg = localeService.getLoadedText( 'WorkflowCommandPanelsMessages' );
            let successMsg = '';
            if( selectedObjects.length === 1 ) {
                successMsg = resource.submittedToWorkflowInfo.format( selectedObjects[0].props.object_string.dbValues[0] );
            }else{
                //TODO: Message for multiple selections is used from workflow module because of code freeze.
                //Please replace this message with our own message in AW5.2 / next release.
                successMsg = resourceMultipleMsg.submitToWorkflowSuccess.format( selectedObjects.length );
            }
            return messagingService.showInfo( successMsg );
        }
    } );
}

/**
 * This method checks CR_allow_alternate_procedures preference and based on its value, it displays
 * all or assigned workflow templates in the list
 * @param {Object} data data
 */
function loadPreferenceAndPopulateTemplatesList( viewModel ) {
    return prefSvc.getStringValue( 'CR_allow_alternate_procedures' ).then( function( prefValue ) {
        if ( !prefValue || prefValue.length <= 0 ) {
            prefValue = 'none';
        }
        /**
         * Check the preference value. If the value is 'none', then don't show the radio button and show the filtered list by default.
         * If the value is 'Assigned', then select 'Assigned' radio button and show filtered list
         * If the value is 'Any', then select 'Any' radio button and show all the templates
         */
        viewModel.data.isAllowAlternateProcedures.dbValue = true;
        const propName = 'props.object_string';
        if ( prefValue === 'none' ) {
            viewModel.data.isAllowAlternateProcedures.dbValue = false;
            viewModel.data.allowAlternateProcedures.dbValue = false;
            viewModel.data.workflowsList = listBoxSvc.createListModelObjects( viewModel.data.templatesOutput[1].workflowTemplates, propName );
        } else if ( prefValue === 'any' ) {
            viewModel.data.allowAlternateProcedures.dbValue = true;
        } else if ( prefValue === 'Assigned' ) {
            viewModel.data.allowAlternateProcedures.dbValue = false;
        }

        getValidTemplates( viewModel );
    } );
}

/**
 * Get list of templates based on radio button selection and CR_allow_alternate_procedures preference value
 * @param {Object} data data
 */
export function getValidTemplates( viewModel ) {
    const propName = 'props.object_string';
    let data = { ...viewModel.getData() };
    data.workflowsList = [];
    data.workflowsListBox.dbValue = '';
    data.workflowsListBox.uiValue = '';
    if ( data.templatesOutput && data.templatesOutput.length ) {
        if ( data.allowAlternateProcedures && data.allowAlternateProcedures.dbValue && data.templatesOutput[0].workflowTemplates ) {
            data.workflowsList = listBoxSvc.createListModelObjects( data.templatesOutput[0].workflowTemplates, propName );
            data.workflowsListBox.dbValue = data.workflowsList[0];
        } else if ( data.templatesOutput[1] && data.templatesOutput[1].workflowTemplates ) {
            data.workflowsList = listBoxSvc.createListModelObjects( data.templatesOutput[1].workflowTemplates, propName );
            data.workflowsListBox.dbValue = data.workflowsList[0];
        }
    }
    viewModel.dispatch( { path: 'data', value: data } );
}

/**
 * This function calls getWorkflowTemplates SOA and initializes popup data
 * @param {Object} selection selection to submit to workflow
 * @param {Object} data data
 */
export function getWorkflowTemplatesList( selection, viewModel ) {
    const selectedObjectUids = selection.map( obj => obj.uid );
    /* Filtering of workflow templates based on object type works only with persistent objects.
    * Hence call getProperties to fetch bl_revision and fnd0bl_line_object_type props. */
    return dataMgmtService.getProperties( selectedObjectUids, [ 'bl_revision', 'fnd0bl_line_object_type' ] ).then( function() {
        const selectedObjects = cdm.getObjects( selectedObjectUids );
        const inputData = getWorkflowTemplatesSOAInput( selectedObjects );
        return soaSvc.post( 'Workflow-2013-05-Workflow', 'getWorkflowTemplates', inputData ).then( function( response ) {
            // let data = { ...viewModel.getData() };
            viewModel.data.templatesOutput = response.templatesOutput;
            return loadPreferenceAndPopulateTemplatesList( viewModel );
        } );
    } );
}

/**
 * Prepare getWorkflowTemplates SOA input
 * @param {Object} selectedObjects selectedObjects
 * @returns {Object} SOA input object
 */
function getWorkflowTemplatesSOAInput( selectedObjects ) {
    const targets = selectedObjects.map( obj => {
        if( obj.props.fnd0bl_line_object_type ) {
            return {
                type : obj.props.fnd0bl_line_object_type.dbValues[0],
                uid : obj.props.bl_revision.dbValues[0]
            };
        }
        return {
            type : obj.type,
            uid : obj.uid
        };
    } );
    const allInputInternal = {
        clientId: 'allTemplates',
        getFiltered: false,
        targetObjects: targets
    };
    const filterInputInternal = {
        clientId: 'filterTemplates',
        getFiltered: true,
        targetObjects: targets
    };
    return {
        input: [
            allInputInternal,
            filterInputInternal
        ]
    };
}

export default {
    submitToWorkflow,
    getValidTemplates,
    getWorkflowTemplatesList
};
