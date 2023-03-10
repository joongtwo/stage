// Copyright (c) 2022 Siemens

/**
 * Module for Set Step Status Panel
 *
 * @module js/Ewi0StepStatus
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';

/**
 * Get the current step status data to display in the panel
 *
 * @param {Object} statusList the status list
 *
 * @returns {Object} the step status data
 */
export function updatePanelData( statusList ) {
    let executionStatus;
    const currStep = appCtxSvc.getCtx( 'EWI0currentStep' );
    const statusVal = currStep.props.ewi0ExecutionStatus.uiValues[ 0 ];
    if( statusVal !== '' ) {
        const index = statusList.findIndex( status => status.propDisplayValue  === statusVal );
        executionStatus = {
            dbValue: index,
            uiValue: statusVal
        };
    } else {
        executionStatus = {
            dbValue: 0,
            uiValue: statusList[ 0 ].propDisplayValue
        };
    }

    let sliderVal = currStep.props.ewi0ExecutionPercentage.dbValues[ 0 ];
    sliderVal = sliderVal === '' ? 0 : parseInt( sliderVal );

    const comment = currStep.props.ewi0ExecutionComment.uiValues[ 0 ];

    return {
        executionStatus,
        sliderVal,
        comment
    };
}

/**
  * Return an empty ListModel object.
  *
  * @return {Object} - Empty ListModel object.
  */
function _getEmptyListModel() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
}

/**
  * Get status list
  *
  * @param {Object} response - the soa response of the status LOV values
  *
  * @return {ObjectArray} statusList - ewi0ExecutionStatusList the status list to display
  */
export function getStatusList( response ) {
    let statusList = [];

    for( let lovValRow in response.lovValues ) {
        if( response.lovValues.hasOwnProperty( lovValRow ) ) {
            let status = _getEmptyListModel();
            status.propDisplayValue = response.lovValues[ lovValRow ].propDisplayValues.lov_values[ 0 ];
            status.propInternalValue = lovValRow;
            statusList.push( status );
        }
    }

    return statusList;
}

/**
  * Status was updated - if completed status is selected then set the slider to 100%
  *
  * @param {String} selectedStatus - the selected Execution Status dbValue
  * @param {Integer} sliderVal - the slider value
  *
  * @returns {Object} the slider value & state
  */
export function statusUpdated( selectedStatus, sliderVal ) {
    const preferences = appCtxSvc.getCtx( 'preferences' );
    const completeList = preferences.EWI_StepExecutionStatusCompleteIndex;
    const isCompleteStatus = completeList.includes( selectedStatus.toString() );

    const sliderValue = isCompleteStatus === true ? 100 : sliderVal;
    const sliderDisable = isCompleteStatus === true;
    if( isCompleteStatus === true ) {
        eventBus.publish( 'ewi.completeStatusChanged' );
    }
    return {
        sliderValue,
        sliderDisable
    };
}

/**
  * Check if something was changed and needs to be saved
  *
  * @param {String} executionStatus - the execution status field
  * @param {String} sliderVal - the slider value
  * @param {String} comment - the comment field
  *
  * @return {ObjectArray} dataToSave - the data that needs to be saved as input for the SOA
  */
export function getDataToSave( executionStatus, sliderVal, comment ) {
    let dataToSave = [];
    const currStep = appCtxSvc.getCtx( 'EWI0currentStep' );

    if( executionStatus !== currStep.props.ewi0ExecutionStatus.uiValues[ 0 ] ) {
        dataToSave.push( {
            name: 'ewi0ExecutionStatus',
            values: [ executionStatus ]
        } );
    }

    if( comment !== currStep.props.ewi0ExecutionComment.uiValues[ 0 ] ) {
        dataToSave.push( {
            name: 'ewi0ExecutionComment',
            values: [ comment ]
        } );
    }

    // Get the slider value as string for the "setProperties" SOA call input
    if( sliderVal.toString() !== currStep.props.ewi0ExecutionPercentage.uiValues[ 0 ] ) {
        dataToSave.push( {
            name: 'ewi0ExecutionPercentage',
            values: [ sliderVal.toString() ]
        } );
    }

    return dataToSave;
}

/**
  * Update the current step properties in ctx
  *
  * @param {String} executionStatus - the execution status field value
  * @param {String} sliderVal - the slider value
  * @param {String} comment - the comment field value
  */
export function updateCurrStepCtx( executionStatus, sliderVal, comment ) {
    const currStep = appCtxSvc.getCtx( 'EWI0currentStep' );
    currStep.props.ewi0ExecutionStatus.uiValues[ 0 ] = executionStatus;
    currStep.props.ewi0ExecutionComment.uiValues[ 0 ] = comment;
    currStep.props.ewi0ExecutionPercentage.dbValues[ 0 ] = sliderVal.toString();
    appCtxSvc.updateCtx( 'EWI0currentStep', currStep );
}

export default {
    updatePanelData,
    getStatusList,
    statusUpdated,
    getDataToSave,
    updateCurrStepCtx
};
