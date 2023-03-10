// Copyright (c) 2022 Siemens

/**
 * A service that manages Import preferences.<br>
 *
 * @module js/importPreferencesService
 */
import prefService from 'js/adminPreferencesService';
import soaService from 'soa/kernel/soaService';
import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
import msgService from 'js/messagingService';
import localeService from 'js/localeService';
import cmdPanelService from 'js/commandPanel.service';
import _ from 'lodash';
import browserUtils from 'js/browserUtils';

var exports = {};

/**
 * Activate a panel to import preferences.
 * It will first check any unsaved modifications on summary page.
 * If there is any  unsaved modifications, it will prompt confirmation dialog to save or discard the modifications.
 * If there is NO unsaved modifications, it will open the panel to import preferences.
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
 * Populate the fields on import panel.
 *
 * @param  {Object} data - viewModel
 *
 */
export let populateImportPreferencesPanel = function( data ) {
    // Build location list
    data.locationList = prefService.getLocations( 'import' );

    // Create Fms Upload URL
    data.fmsUploadUrl = browserUtils.getBaseURL() + 'fms/fmsupload/';
};

/**
 * Import Preferences
 *
 * @param  {Object} data - viewModel
 * @returns {*} soa response
 */
export let importPreferences = function( data ) {
    // Create Input Data
    var importPreferencesInput = {
        importPreferenceIn: {
            categoryNames: [],
            fileTicket: data.fmsTicket,
            importAction: data.fnd0ImportAction.dbValue,
            locations: [ {
                location: data.fnd0Location.dbValue
            } ]
        }
    };

    // SOA call to import Preferences
    return soaService.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'importPreferencesAtLocations', //
        importPreferencesInput )
        .then( function( response ) {
            // handle the error
            var err = adminPreferenceUserUtil.handleSOAResponseError( response.ServiceData );
            if( !_.isUndefined( err ) ) {
                data.responseState = 'fail';
            } else {
                data.responseState = 'success';
                //prefService.resetService();
            }
            data.reportFileTicket = response.fileTicket;
            // Show Message
            exports.showMessage( data );
        }, function( err ) {
            throw err;
        } );
};

/**
 * Show Error Message for Import Preferences
 *
 * @param {Object} data - the data
 *
 */
export let showMessage = function( data ) {
    var localTextBundle = localeService.getLoadedText( 'preferenceMessages' );
    var msg;
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $notify ) {
            $notify.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.downloadReport,
        onClick: function( $notify ) {
            $notify.close();
            // View Report Clicked
            exports.downloadImportReportFile( data );
        }
    } ];

    if( data.responseState === 'success' ) {
        msg = localTextBundle.importSuccessMessage.replace( '{0}', data.fileName );
        msgService.showInfo( msg, buttons );
    } else if( data.responseState === 'fail' ) {
        msg = localTextBundle.importErrorMessage;
        msgService.showWarning( msg, buttons );
    }
};

/**
 * Download Import Report File
 *
 * @param {Object} data data object
 *
 */
export let downloadImportReportFile = function( data ) {
    var downloadFileName = data.fileNameNoExt + '_report.txt';
    var fileTicket = data.reportFileTicket;

    var fileName = encodeURIComponent( downloadFileName );

    var downloadUri = 'fms/fmsdownload/' + fileName + '?ticket=' + encodeURIComponent( fileTicket );
    var baseUrl = browserUtils.getBaseURL();
    var urlFullPath = baseUrl + downloadUri;

    window.open( urlFullPath, '_self', 'enabled' );
};

export default exports = {
    activateCommandPanel,
    populateImportPreferencesPanel,
    importPreferences,
    showMessage,
    downloadImportReportFile
};
