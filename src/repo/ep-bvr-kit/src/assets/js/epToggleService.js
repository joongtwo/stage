// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epToggleService
 */

import _ from 'lodash';
import epAssignmentIndicationService from 'js/epAssignmentIndicationService';
import eventBus from 'js/eventBus';


let assignmentIndicationToggleValue = false;


/**
 *
 * @param {boolean} value - Toggles the Assignment Indication value to on/off
 */
export function setGlobalAssignmentIndicationToggleValue( value ) {
    assignmentIndicationToggleValue = value;
}

/**
 * This method will set data.turnOnToggleOnLoad to true if selection is available in storage.
 * @param { String } key: key for localStorage
 * @param { Object } scopedObject : Scope of the page, against this object selection of process/part is fetched from storage
 * @param { Object } viewModelData : data of view-model
 */
export function getToggleStateBasedOnLocalStorage( key, scopedObject, viewModelData ) {
    const nodesTobSelected = epAssignmentIndicationService.getNodeToBeSelectedFromLocalStorage( key, scopedObject );
    if( !_.isEmpty( nodesTobSelected.processOrOperationTobeSelected ) && !_.isEmpty( nodesTobSelected.partsTobeSelected ) ) {
        viewModelData.turnOnToggleOnLoad = true;
    }
}

/**
 * @returns {boolean} This returns the current indication of toggle state for assignment indication
 */
export function getGlobalAssignmentIndicationToggleValue() {
    return assignmentIndicationToggleValue;
}

/**
 * Turn of Assignment Indication programmatically
 */
export function toggleOffAssignmentIndication() {
    if( assignmentIndicationToggleValue ) {
        eventBus.publish( 'ep.explicitToggleOffAssignmentIndicationEvent' );
    }
}

export default {
    setGlobalAssignmentIndicationToggleValue,
    getGlobalAssignmentIndicationToggleValue,
    getToggleStateBasedOnLocalStorage,
    toggleOffAssignmentIndication
};
