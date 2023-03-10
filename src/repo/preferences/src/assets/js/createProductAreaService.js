// Copyright (c) 2022 Siemens

/**
 * A service that create Category / Subcategory.<br>
 *
 * @module js/createProductAreaService
 */
import prefService from 'js/adminPreferencesService';
import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
import soaService from 'soa/kernel/soaService';
import localeService from 'js/localeService';
import cmdPanelService from 'js/commandPanel.service';
import _ from 'lodash';

var exports = {};

/**
 * Populate the fields on create product area panel.
 *
 */
export let populateCreateProductAreaPanel = function( vmData ) {
    // build the product area list
    var productAreaList = prefService.getProductAreaList();
    var totalFound = productAreaList.length;
    return { productAreaList, totalFound };
};

/**
 * Activate a panel to create product area.
 * It will first check any unsaved modifications on summary page.
 * If there is any  unsaved modifications, it will prompt confirmation dialog to save or discard the modifications.
 * If there is NO unsaved modifications, it will open the create product area panel.
 *
 * @param {String} commandId - ID of the command to open. Should map to the view model to activate.
 * @param {String} location - Which panel to open the command in. "aw_navigation" (left edge of screen) or "aw_toolsAndInfo" (right edge of screen)
 * @param {Object} prefCtx - context for the preferences page
 *
 */
export let activateCommandPanel = function( commandId, location, prefCtx ) {
    var hasUnsavedEdits = adminPreferenceUserUtil.checkUnsavedEdits();
    if( hasUnsavedEdits ) {
        adminPreferenceUserUtil.handleUnsavedEdits( prefCtx );
    } else {
        cmdPanelService.activateCommandPanel( commandId, location );
    }
};

/**
 * Create Product Area
 *
 * @param  {Object} data - viewmodel
 * @returns {Promise} soa response
 */
export let createProductArea = function( data ) {
    // Create Input Data
    var productArea = data.fnd0ProductArea.dbValue;
    var subCategoryName = data.fnd0SubcategoryName.dbValue;
    var categoryNames = null;
    var localTextBundle = localeService.getLoadedText( 'preferenceInfoMessages' );
    var defaultProductAreaVal = localTextBundle.ProductAreaLabel;

    if( productArea !== null && productArea !== '' && productArea !== defaultProductAreaVal && subCategoryName !== null && subCategoryName !== '' ) {
        categoryNames = [ productArea + '.' + subCategoryName ];
    } else if( subCategoryName !== null && subCategoryName !== '' ) {
        categoryNames = [ subCategoryName ];
    }
    var createCategoriesInput = {
        categoryNames: categoryNames
    };

    // SOA call to create category
    return soaService.postUnchecked( 'Internal-Administration-2007-06-PreferenceManagement', 'createPreferenceCategories', //
        createCategoriesInput )
        .then( function( response ) {
            // handle the error
            var err = adminPreferenceUserUtil.handleSOAResponseError( response );
            if( !_.isUndefined( err ) ) {
                return adminPreferenceUserUtil.getRejectionPromise( err );
            }
            //prefService.resetService();
            //adminPreferenceUserUtil.resetIsInitialized();
        } );
};

export default exports = {
    populateCreateProductAreaPanel,
    activateCommandPanel,
    createProductArea
};
