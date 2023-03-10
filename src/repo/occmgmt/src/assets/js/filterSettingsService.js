// Copyright (c) 2022 Siemens

/**
 * @module js/filterSettingsService
 */
import uwPropertySvc from 'js/uwPropertyService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';

var exports = {};

export let processPreferenceResponse = function( result, data, sharedData ) {
    if ( result && result.response.length > 0 ) {
        var initialToggleValue;
        var vmProp = uwPropertySvc.createViewModelProperty( '', data.i18n.delayFiltering, 'BOOLEAN', '',
            '' );
        uwPropertySvc.setPropertyLabelDisplay(  vmProp, 'PROPERTY_LABEL_AT_SIDE' );

        var prefValue = result.response[0].values.values[0];
        if(  prefValue.toUpperCase() === 'TRUE' ) {
            uwPropertySvc.setValue( vmProp,  false );
            initialToggleValue = false;
        } else {
            uwPropertySvc.setValue( vmProp, true );
            initialToggleValue = true;
        }

        if( sharedData.enableFilterApply ) {
            uwPropertySvc.setIsEditable( vmProp, false );
            uwPropertySvc.setIsEnabled( vmProp, false );
        }else {
            uwPropertySvc.setIsEditable( vmProp, true );
            uwPropertySvc.setIsEnabled( vmProp, true );
        }

        data.dispatch( { path: 'data.initialToggleValue', value: initialToggleValue } );
        return vmProp;
    }
};

export let updateDelayFilteringToggle = function(  toggle ) {
    //User preference is for delayed apply whereas the Settings panel for filter panel has option Auto-update
    // so we need to negate the value
    var delayedApplyUpdatedValue;
    if( toggle ) {
        delayedApplyUpdatedValue = 'false';
    }else{
        delayedApplyUpdatedValue = 'true';
    }
    return delayedApplyUpdatedValue;
};

export let updateSharedData = function(  activeViewSharedData, sharedData, nextActiveView, delayedApplyUpdatedValue ) {
    //User preference is for delayed apply whereas the Settings panel for filter panel has option Auto-update
    // so we need to negate the value
    var autoApply;
    if( delayedApplyUpdatedValue === 'false' ) {
        autoApply = true;
    }else  if( delayedApplyUpdatedValue === 'true' ) {
        autoApply = false;
    }
    occmgmtSubsetUtils.updateAutoApplyOnSharedData( activeViewSharedData, sharedData, nextActiveView, autoApply );
};


export default exports = {
    processPreferenceResponse,
    updateDelayFilteringToggle,
    updateSharedData
};
