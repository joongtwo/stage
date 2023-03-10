// Copyright (c) 2022 Siemens

/**
 * @module js/includeExcludeFilterService
 */
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
import occmgmtUtils from 'js/occmgmtUtils';
import objectToCSIDGeneratorService from 'js/objectToCSIDGeneratorService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
var exports = {};

/**
 * Function to apply selected element recipe
 * trigger acePwa.reset event to reload content
 */
export let applySelectedElementFilterInRecipe = function() {
    var selected = appCtxSvc.getCtx( 'mselected' );

    var selectedObjCloneIds = [];
    var selectedObjUiValues = [];

    for( var i = 0; i < selected.length; i++ ) {
        if( selected.length > 0 ) {
            selectedObjCloneIds[ i ] = objectToCSIDGeneratorService.getCloneStableIdChain( selected[ i ] );
            selectedObjUiValues[ i ] = selected[ i ].props.awb0Archetype.uiValues[ 0 ];
        }
    }
    var operatorType = appCtxSvc.ctx.panelContext.operation;
    var criteriaValueList = selectedObjCloneIds;
    if( occmgmtSubsetUtils.isTCVersion142OrLater() && operatorType === 'Include' || operatorType === 'IncludeWithoutChildren' ) {
        if ( operatorType === 'Include' ) {
            criteriaValueList[criteriaValueList.length] = 'True';
        } else {
            criteriaValueList[criteriaValueList.length] = 'False';
        }
        operatorType = 'Include';
    }

    var displayString = createTransientSelectedElementDisplayString( selectedObjUiValues );
    var selectedElementCriteria = {
        criteriaType: 'SelectedElement',
        criteriaOperatorType: operatorType,
        criteriaDisplayValue: displayString,
        criteriaValues: criteriaValueList,
        subCriteria: []
    };
    // Reset the operaation on panel context after the include/exclude
    occmgmtUtils.updateValueOnCtxOrState( 'operation', '', 'panelContext' );
    return selectedElementCriteria;
};

var createTransientSelectedElementDisplayString = function( selectedObjUiValues ) {
    var selectedString = '';
    if( selectedObjUiValues !== null && selectedObjUiValues.length > 0 ) {
        // Get the filter separator value from the preference AW_FacetValue_Separator
        var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
        for( var i = 0; i < selectedObjUiValues.length; i++ ) {
            selectedString = selectedString.concat( selectedObjUiValues[ i ] );
            if ( i !== selectedObjUiValues.length - 1 ) {
                selectedString = selectedString.concat( filterSeparator );
            }
        }
        var resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
        var selectedElementDisplayString = resource.selectedElementDisplayString + '_$CAT_' + selectedString;
    }
    return selectedElementDisplayString;
};


export default exports = {
    applySelectedElementFilterInRecipe
};
