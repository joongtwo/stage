// Copyright (c) 2022 Siemens

/**
 * A service that delete Category / Subcategory.<br>
 *
 * @module js/deleteProductAreaService
 */
import prefService from 'js/adminPreferencesService';
import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
import soaService from 'soa/kernel/soaService';
import cmdPanelService from 'js/commandPanel.service';
import _ from 'lodash';

var exports = {};

/**
 * Populate the fields on create product area panel.
 *
 * @param  {Object} data - viewModel
 */
export let populateDeleteProductAreaPanel = function( data ) {
    // build the product area list
    var productAreaList = prefService.getProductAreaList();
    return productAreaList;
};

/**
 * Activate a panel to delete product area.
 * It will first check any unsaved modifications on summary page.
 * If there is any  unsaved modifications, it will prompt confirmation dialog to save or discard the modifications.
 * If there is NO unsaved modifications, it will open the delete product area panel.
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
 * Delete Product Area
 * @param  {Object} data - viewModel
 *
 * @returns {Promise} soa response promise
 */
export let deleteProductArea = function( data ) {
    // Create Input Data
    var productArea = data.fnd0ProductArea.dbValue;
    var categoryNames = [];

    if( productArea !== null && productArea !== '' ) {
        categoryNames.push( productArea );
    }
    var createCategoriesInput = {
        categoryNames: categoryNames
    };
    // SOA call to create category
    return soaService.postUnchecked( 'Internal-Administration-2018-06-PreferenceManagement', 'deletePreferenceCategories', //
        createCategoriesInput )
        .then( function( response ) {
            // handle the error
            var err = adminPreferenceUserUtil.handleSOAResponseError( response );
            if( !_.isUndefined( err ) ) {
                return adminPreferenceUserUtil.getRejectionPromise( err );
            }
            //prefService.resetService();
            //adminPreferenceUserUtil.resetStates();
        } );
};

export default exports = {
    populateDeleteProductAreaPanel,
    activateCommandPanel,
    deleteProductArea
};
