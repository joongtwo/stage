// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwClsAddPanelUtilsService} which manages the full screen for change summary
 *
 * @module js/AwClsAddPanelUtilsService
 */
import _ from 'lodash';
import searchCommonUtils from 'js/searchCommonUtils';

var exports = {};

/**
  * Switch to some other toggle.
  * @function clsAddPanelToggle
  * @param {Object} commandContext - command context to update toggle from
  * @param {Object} viewMode - toggle to be set.
  * @return {Object} tmpContext - the updated context.
  * @memberOf AwClsAddPanelUtilsService
  */
export let clsAddPanelToggle = function( commandContext, viewMode ) {
    let tmpContext = { ...commandContext };
    tmpContext.showNavigate = viewMode;
    return tmpContext;
};

/**
  * Update the Add Panel's selection so that it can be added to the target.
  * @function updateAddCandidate
  * @param {Object} addState - add state to update.
  * @param {Object} selection - selection to add to assembly on button press.
  * @memberOf AwClsAddPanelUtilsService
  */
export let updateAddCandidate = function( addState, selection ) {
    let tmpContext = { ...addState.value };
    tmpContext.sourceObjects = selection;
    tmpContext.creationType = null;
    addState.update( tmpContext );
};

/**
  * Update the Add Panel's selection to being blank to hide Add button on panel.
  * @function updateAddCandidate
  * @param {Object} addState - add state to update.
  * @memberOf AwClsAddPanelUtilsService
  */
export let removeSelection = function( addState ) {
    let tmpContext = { ...addState.value };
    tmpContext.sourceObjects = [];
    tmpContext.creationType = null;
    addState.update( tmpContext );
};

/**
 *
 * @param {Object} addPanelState - The addACopy state of the add panel
 */
export let disableAddACopyState = function( addPanelState ) {
    let newAddPanelState = { ...addPanelState.value };
    newAddPanelState.isCopyButtonEnabled = false;
    if( newAddPanelState.Awb0ElementCreateSubView ) {
        newAddPanelState.Awb0ElementCreateSubView = false;
    }
    addPanelState.update( newAddPanelState );
};

export default exports = {
    clsAddPanelToggle,
    disableAddACopyState,
    updateAddCandidate,
    removeSelection
};
