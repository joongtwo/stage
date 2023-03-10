// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0EPMTaskPerform
 */
import viewModelObjSvc from 'js/viewModelObjectService';
import Awp0PerformTask from 'js/Awp0PerformTask';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import cdm from 'soa/kernel/clientDataModel';
import editHandlerService from 'js/editHandlerService';
import uwPropertySvc from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};

export let getComments = function( data ) {
    return Awp0PerformTask.getComments( data );
};

/**
 * Populate the properties on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 *
 * @returns {Object} Object with properties needs to be updated on UI
 */
export let populatePanelData = function( data, selection ) {
    let selectedObject = selection;

    // Check if input selected object is null then return from here
    if( !selection ) {
        return;
    }
    selectedObject = cdm.getObject( selectedObject.uid );
    if( selectedObject && !viewModelObjSvc.isViewModelObject( selectedObject ) ) {
        selectedObject = viewModelObjSvc.createViewModelObject( selectedObject );
    }

    // This method is needed to set the correct style for panel when it will be visible in secondary area
    Awp0PerformTask.updateStyleForSecondaryPanel();

    let formObjectVMO;
    if( typeof selectedObject.props.fnd0PerformForm !== typeof undefined &&
        typeof selectedObject.props.fnd0PerformForm.dbValues !== typeof undefined &&
        selectedObject.props.fnd0PerformForm.dbValues[ 0 ] !== '' ) {
        const fromTaskValue = selectedObject.props.fnd0PerformForm.dbValues[ 0 ];

        if( typeof fromTaskValue !== typeof undefined ) {
            const formObject = cdm.getObject( fromTaskValue );
            if( formObject ) {
                formObjectVMO = viewModelObjSvc.createViewModelObject( formObject );
            }
        }
    }

    // Populate the name value
    const newDataTaskName = _.clone( data.taskName );
    let nameValue = '';
    nameValue = selectedObject.props.object_string.dbValues[ 0 ];

    newDataTaskName.dbValue = nameValue;
    newDataTaskName.uiValue = nameValue;

    // Populate the description value
    const newDataDesc = awp0InboxUtils.populateDescription( data.description, selectedObject );

    // Populate the comments value
    const newDataComments = _.clone( data.comments );
    let commentsText = '';
    commentsText = selectedObject.props.comments.dbValue;
    newDataComments.dbValue = commentsText;
    newDataComments.uiValue = commentsText;

    // Populate the job description value
    const newDataJobDescription = awp0InboxUtils.populateJobDescription( data.workflowDescription, selectedObject );

    // Populate the isSecureTask value
    const isSecureTask = selectedObject.props.secure_task.dbValues[ 0 ] === '1';

    // Populate the hasFailurePaths value
    const hasFailurePaths = selectedObject.props.has_failure_paths.dbValues[ 0 ] === '1';

    return {
        taskName: newDataTaskName,
        description: newDataDesc,
        comments: newDataComments,
        workflowDescription: newDataJobDescription,
        isSecureTask: isSecureTask,
        hasFailurePaths: hasFailurePaths,
        formObject: formObjectVMO
    };
};

/**
 * Add that value to localization for confirm message to show correctly.
 *
 * @param {String} taskResult - Slected button from UI
 * @param {object} data - the data Object
 *
 * @returns {String} Task result string
 */
export let getSelectedPath = function( taskResult, data ) {
    data.i18n.selectedPath = taskResult;
    return taskResult;
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the correct
 * errors only to the user.
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorMessageOnPerformAction = function( response ) {
    return Awp0PerformTask.populateErrorMessageOnPerformAction( response );
};

/**
 * Return the properties that are modified from UI and return those properties.
 *
 * @returns {Array} Proeprties that needs to be saved
 */
export let getPropertiesToSave = function( editHandler ) {
    let modifiedProperties = [];
    if( !editHandler ) {
        editHandler = editHandlerService.getEditHandler( 'SAVEAS_PANEL_CONTEXT' );
    }
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            const viewModelProperties = dataSource.getAllEditableProperties();
            _.forEach( viewModelProperties, function( vmProp ) {
                if( uwPropertySvc.isModified( vmProp ) ) {
                    modifiedProperties.push( {
                        name: vmProp.propertyName,
                        values: uwPropertySvc.getValueStrings( vmProp )
                    } );
                }
            } );
        }
    }

    return modifiedProperties;
};

/**
 * This API is added to form the message string from the Partial error being thrown from the SOA
 *
 * @param {Object} messages - messages array
 * @param {Object} msgObj - message object
 */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * This API is added to process the Partial error being thrown from the SOA
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let processPartialErrors = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

export default exports = {
    getComments,
    populatePanelData,
    getSelectedPath,
    populateErrorMessageOnPerformAction,
    getPropertiesToSave,
    processPartialErrors
};
