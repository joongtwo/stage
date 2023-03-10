//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/* global */

import popupSvc from 'js/popupService';
import tabRegistrySvc from 'js/tabRegistry.service';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import _ from 'lodash';

/**
 * @module js/mfeContentPanelUtil
 */



let _popupRef = null;

/**
 * Set the tab data to be available in the command context
 *
 * Please use following object names in the commandContext for consistency:
 * inputObject - the object whose data is displayed in the tab
 * selection - the selected objects in the tab
 * name - the tab display name
 * contentCount - the number of objects displayed in the tab content
 * namePrefix - the tab display name prefix when displaying its content quantity as part of the tab display name
 * propertiesToLoad - the inputObject property which contains the objects to be displayed in the tab content
 *
 * @param {object} tabModel - the object where the current command context is saved
 * @param {object} commandContext - anything you want to be set as the command context
 */
export function setCommandContext( tabModel, commandContext ) {
    if( tabModel && commandContext && typeof commandContext === 'object' ) {
        tabModel.update( { ...tabModel.getValue(), ...commandContext } );
    }
}

/**
 * Will inititialize the contentPanelData in the data
 * @param {Object} contentPanelData Received from parent wrapper viewmodel
 * @param {string} currentContentPanelData Recieved current value if any
 * @returns {Object} updated contentPanelData
 */
export function setContentPanelData( contentPanelData, currentContentPanelData ) {
    const initData = {};
    // cmdDisplayOption can be one of [menu, toolbarBelowTabs, toolbarWithTabs] (Default: toolbarWithTabs)
    if( currentContentPanelData !== undefined && currentContentPanelData.cmdDisplayOption ) {
        // Retain current cmdDisplayOption
        initData.cmdDisplayOption = currentContentPanelData.cmdDisplayOption;
    } else {
        // Initialize cmdDisplayOption
        initData.cmdDisplayOption = contentPanelData.cmdDisplayOption ? contentPanelData.cmdDisplayOption : 'toolbarWithTabs';
    }

    return {
        initData
    };
}

/**
 * Hide popup menu
 *
 */
export function hideMfePopupMenu() {
    if( _popupRef !== null ) {
        popupSvc.hide( _popupRef );
        _popupRef = null;
    }
}

/**
 * Makes Toobar below the tabs visible for mfeContentPanel
 *
 * @param {Object} contentPanelData received from area viewmodel
 */
export function showToolbarBelowTabs( contentPanelData ) {
    setMfeToolBarMode( contentPanelData, 'toolbarBelowTabs' );
    if( _popupRef !== null ) {
        popupSvc.hide( _popupRef );
        _popupRef = null;
    }
}

/**
 * set Toolbarmode
 *
 * @param {Object} contentPanelData received from parent view
 * @param {string} mode toolbarBelowTabs, toolbarWithTabs, menu
 */
export function setMfeToolBarMode( contentPanelData, mode ) {
    let newContentPanelData = { ...contentPanelData.value };
    newContentPanelData.cmdDisplayOption = mode;
    contentPanelData.update( newContentPanelData );
}

/**
 *
 * @param {object[]} tabs - the array of "tab" objects
 * @param {string} tabSetId - the id of the current tabSet
 * @param {string} tabIdToSelect - the tab key to select
 */
export function setSelectedTab( tabs, tabSetId, tabIdToSelect ) {
    const tabToSelect = _.find( tabs, ( tab ) =>  tab.tabKey === tabIdToSelect || tab.viewId === tabIdToSelect );
    tabRegistrySvc.changeTab( tabSetId, tabToSelect.tabKey );
}

/**
 * Update parentSelectionData with localSelectionData.
 * @param {*} sharedSelectionData parentSelectionData
 * @param {*} localSelectionData localSelectionData
 */
export function updateParentSelectionData( sharedSelectionData, localSelectionData ) {
    if( localSelectionData && sharedSelectionData ) {
        const newSelectionData = sharedSelectionData.getValue();
        newSelectionData.selected = localSelectionData.selected;
        sharedSelectionData.update( { ...newSelectionData } );
    }
}

const exports = {
    setCommandContext,
    setContentPanelData,
    hideMfePopupMenu,
    setMfeToolBarMode,
    showToolbarBelowTabs,
    setSelectedTab,
    updateParentSelectionData
};

export default exports;
