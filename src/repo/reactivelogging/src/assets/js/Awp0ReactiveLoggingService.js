// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0ReactiveLoggingService
 */
import appCtxSvc from 'js/appCtxService';
import listBoxSvc from 'js/listBoxService';
import localStorage from 'js/localStorage';

/** The exports */
var exports = {};

/**The fmsTicketURL */
var fmsTicketURL = '';

/**
 * This function gets the module name list from the SOA Internal-DebugMonitor-2011-06-DebugLogging-getModuleJournalStatus
 * and populates the "Type:" multi select drop down list.
 * @param {Data} data - The data of the startLogging SOA service
 * @return A list of module names to be consumed by the option field "Type"
 *
 */
export let getModuleName = function( data ) {
    return listBoxSvc.createListModelObjects( data.moduleList, 'moduleName' );
};


/**
 * This function provides the JournalModule information.
 * @param {Data} data - The data of the startLogin SOA service
 * @return selected modules.
 */
export let getSelectedJournalModule = function( data ) {
    let journalModules = data.data.listBoxJournalModules.dbValue;
    return journalModules.map( ( { moduleName } ) => moduleName ).join();
};

/**
 * This function provides the Fms Ticket information.
 * @param {Data} data - The data of the stopLogging SOA service
 * @return A fms ticket link to be downloaded.
 */
export let fmsTicket = function( data ) {
    var uri = '';
    fmsTicketURL = '';
    if( data.prevDebugLoggingFlags !== undefined && data.prevDebugLoggingFlags.url !== undefined ) {
        uri = data.prevDebugLoggingFlags.url;
        fmsTicketURL = window.location.origin + window.location.pathname + uri;
    }

    return fmsTicketURL;
};

/**
 * This function provides the zip folder name.
 * @param {Data} data - The data of the stopLogging SOA service
 * @return A fms ticket link to be downloaded.
 */
export let folderName = function( data ) {
    var folderName = '';
    if( data.prevDebugLoggingFlags !== undefined && data.prevDebugLoggingFlags.reactiveLogs !== undefined ) {
        folderName = data.prevDebugLoggingFlags.reactiveLogs;
        var n = folderName.lastIndexOf( '\\' );
        folderName = folderName.substring( n + 1 );
    }
    return folderName;
};

/**
 * This function provides the download link for the download button
 * @return A fms ticket link to be downloaded.
 */
export let downloadLink = function() {
    if( fmsTicketURL !== '' ) {
        return window.open( fmsTicketURL );
    }
};

/**
 * This function returns an empty string
 * @return An empty string
 */
export let emptyString = function() {
    return ' ';
};


/**
 * This function sets current state of loggingInProgess using the onmount lifecyclehook and a localStorage
 * variable so as to display the current state of START or STOP button. (LCS-669199)
 */
export let setLoggingStatus = function() {
    var state = localStorage.get( 'AW_PERFORMANCE_LOGGING' );
    if( state === null || state === 'false' ) {
        appCtxSvc.updateCtx( 'loggingInProgress', false );
    } else {
        appCtxSvc.updateCtx( 'loggingInProgress', true );
    }
};

/**
 * This function helps in swapping the Start/Stop button based on whether the loggingInProgress context is set to
 * true/false. This function also helps in enabling anesets the notification bubble on the settings command
 * notifying the user that logging is in progress.
 * @param {Data} data - The data of the startLogging SOA service
 */
export let loggingStatus = function() {
    var state = localStorage.get( 'AW_PERFORMANCE_LOGGING' );

    if( state === null || state === 'false' ) {
        appCtxSvc.updateCtx( 'loggingInProgress', true );
        localStorage.publish( 'AW_PERFORMANCE_LOGGING', 'true' );
    } else {
        appCtxSvc.updateCtx( 'loggingInProgress', false );
        localStorage.removeItem( 'AW_PERFORMANCE_LOGGING' );
    }
    //console.log( angular.element(document.body).injector().get('appCtxService').ctx );
};

/**
 * This factory creates service to listen to subscribe to the event when templates are loaded
 *
 * @member Awp0ReactiveLoggingService
 * @param $q
 */

export default exports = {
    getModuleName,
    fmsTicket,
    folderName,
    downloadLink,
    emptyString,
    setLoggingStatus,
    loggingStatus,
    getSelectedJournalModule
};
