// Copyright (c) 2022 Siemens

/**
 * A service that manages Export preferences.<br>
 *
 * @module js/exportPreferencesService
 */
import prefService from 'js/adminPreferencesService';
import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
import soaService from 'soa/kernel/soaService';
import cmdPanelService from 'js/commandPanel.service';
import _ from 'lodash';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';

var exports = {};

/**
 * Activate a panel to export preferences.
 * It will first check any unsaved modifications on summary page.
 * If there is any  unsaved modifications, it will prompt confirmation dialog to save or discard the modifications.
 * If there is NO unsaved modifications, it will open the panel to export preferences.
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
 * Populate the fields on export panel.
 *
 * @param  {Object} data - viewModel
 * @param  {Object} sourcePref - source preference instance
 */
export let populateExportPreferencesPanel = function( data ) {
    // Default file name
    var t = new Date();
    var month = t.getMonth() + 1;
    let fnd0FileName = data.fnd0FileName;
    let defaultFileName = 'Preferences_' + month + t.getDate() + t.getFullYear() + '.xml';
    fnd0FileName.dbValue = defaultFileName;
    fnd0FileName.uiValue = defaultFileName;

    // Build location list
    let locationList = prefService.getLocations( 'export' );

    // Build the product area list
    let productAreaList = prefService.getProductAreaListToExport();
    return { fnd0FileName, locationList, productAreaList };
};

/**
 * Download File
 *
 * @param {String} fileURL fileUrl
 *
 */
export let downloadFile = function( fileURL ) {
    window.open( fileURL, '_self', 'enabled' );
};

/**
 * Build URL from FileTicket
 *
 * @param {String} fileTicket - fileTicket
 * @param {String} downloadFileName - file name to download
 *
 * @returns {String} - URL to download
 */
export let buildUrlFromFileTicket = function( fileTicket, downloadFileName ) {
    var fileName = '';
    if( downloadFileName && downloadFileName.length > 0 ) {
        fileName = encodeURIComponent( downloadFileName );
    } else {
        fileName = fmsUtils.getFilenameFromTicket( fileTicket );
    }
    var downloadUri = 'fms/fmsdownload/' + fileName + '?ticket=' + encodeURIComponent( fileTicket );
    var baseUrl = browserUtils.getBaseURL();
    return baseUrl + downloadUri;
};

/**
 * Export Preferences
 *
 * @param  {Object} data - viewModel
 *
 * @returns {*} soa response
 */
export let exportPreferences = function( data ) {
    // Create Input Data
    var categoryNames = [];
    if( data.fnd0Location.dbValue === 'SITE' && data.fnd0ProductArea.dbValue !== 'all' ) {
        categoryNames.push( data.fnd0ProductArea.dbValue );
    }

    var exportPreferencesInput = {
        exportPrefs: {
            preferenceScope: data.fnd0Location.dbValue,
            categoryNames: categoryNames
        }
    };

    // SOA call to export Preferences
    return soaService.postUnchecked( 'Internal-Administration-2007-06-PreferenceManagement', 'exportPreferences', //
        exportPreferencesInput )
        .then( function( response ) {
            // handle the error
            var err = adminPreferenceUserUtil.handleSOAResponseError( response );
            if( !_.isUndefined( err ) ) {
                return adminPreferenceUserUtil.getRejectionPromise( err );
            }

            // Build URL from FileTicket
            var fileURL = exports.buildUrlFromFileTicket( response.fileTicket, data.fnd0FileName.dbValue );

            // Download File
            exports.downloadFile( fileURL );
        }, function( err ) {
            throw err;
        } );
};

export default exports = {
    activateCommandPanel,
    populateExportPreferencesPanel,
    downloadFile,
    buildUrlFromFileTicket,
    exportPreferences
};
