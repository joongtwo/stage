// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/workinstrFileTicketService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';


/**
 * File tickets list as [busObjectUid:[fileTickets]]
 */
let fileTickets = {};

/**
 * Add file tickets to the list
 *
 * @param {StringArray} fileTicketsVector the file tickets to add to the list
 */
export function updateFileTickets( fileTicketsVector ) {
    fileTicketsVector.forEach( ( currentFileTicket ) => {
        const busObject = currentFileTicket.busObject;
        let mappedTickets = fileTickets[ busObject.uid ];
        if( mappedTickets ) {
            mappedTickets[ mappedTickets.length ] = currentFileTicket.ticket;
        } else {
            fileTickets[ busObject.uid ] = [ currentFileTicket.ticket ];
        }
    } );
}

/**
 * Set the input for the SOA to get file tickets of the busObjects that are not in the fileTickets list
 *
 * @param {StringArray} fileObjectsUid - The file objects uid
 * @return {StringArray} the soa file objects uid input
 */
export function getInput( fileObjectsUid ) {
    let input = {
        input: []
    };

    let fileTicket;
    fileObjectsUid.forEach( ( currFileObjUid ) => {
        fileTicket = fileTickets[ currFileObjUid ];
        if( !fileTicket || fileTicket.length === 0 ) {
            const imanFileObj = cdm.getObject( currFileObjUid );
            input.input.push( {
                fileObject: imanFileObj
            } );
        }
    } );

    return input;
}

/**
 * Get file tickets SOA
 * Calls the EWI soa to get file tickets from the server. (when they are not present in the cache)
 * We need to call ewi SOA which will do processing for vmb file and for rest of files, will return the read ticket.
 *
 * @param {StringArray} fileObjectsUid - The file objects uid
 * @return {StringArray} the file tickets
 */
export function getFileTickets( fileObjectsUid ) {
    let deferred = AwPromiseService.instance.defer();

    const input = getInput( fileObjectsUid );
    if( input.input.length > 0 ) {
        soaSvc.post( 'Ewia-2012-10-DataManagement', 'getCortonaAnimationFileTicket', input ).then( function( response ) {
            const output = response.output;
            const outputLen = output.length;
            let fileTicketsVector = [];
            for( let fileIndx = 0; fileIndx < outputLen; fileIndx++ ) {
                const fileTicket = {
                    busObject: output[ fileIndx ].fileObject,
                    ticket: output[ fileIndx ].fileReadTicket
                };
                fileTicketsVector[ fileIndx ] = fileTicket;
            }

            updateFileTickets( fileTicketsVector );
            deferred.resolve( fileTickets );
        } );
    } else {
        deferred.resolve( fileTickets );
    }
    return deferred.promise;
}

/**
 * Get the file URL
 *
 * @param {String} fileTicket - The file ticket
 * @return {String} the file URL
 */
export function getFileURL( fileTicket ) {
    if( fileTicket ) {
        const FMS_DOWNLOAD = 'fms/fmsdownload/';
        let baseURL = browserUtils.getBaseURL();
        const fileName = fmsUtils.getFilenameFromTicket( fileTicket );
        const fileExtension = getFileExtension( fileName ).toLowerCase();
        if( fileExtension === 'jt' || fileExtension === 'vmb' ) {
            return FMS_DOWNLOAD + '?ticket=' + fileTicket;
        } else if( fileExtension === 'pdf' ) {
            return FMS_DOWNLOAD + fileName + '?ticket=' + fileTicket;
        }
        return baseURL + FMS_DOWNLOAD + fileName + '?ticket=' + fileTicket;
    }
}

/**
 * Download the file
 *
 * @param {String} fileTicket - The file ticket
 */
export function downloadFile( fileTicket ) {
    window.open( fileTicket, '_self', 'enabled' );
}

/**
 * Get a web URL
 *
 * @param {String} url - The current url string
 * @return {String} the url address as a trusted url
 */
export function getUrl( url ) {
    if( _.isString( url ) && url.length > 0 ) {
        if( url.indexOf( 'http://' ) === -1 && url.indexOf( 'https://' ) === -1 ) {
            url = 'http://' + url;
        }
        return url.replace( 'watch?v=', 'embed/' );
    }
}

/**
 * Open the url in new window
 *
 * @param {String} url - The url to open in a new window
 */
export function openUrlInNewWindow( url ) {
    window.open( getUrl( url ), '_blank', 'enabled' );
}

/**
 * Get file name extension from file name
 *
 * @param {String} fileName file name
 * @return {String} file name extension
 */
export function getFileExtension( fileName ) {
    const extIndex = fileName.lastIndexOf( '.' );
    if( extIndex > -1 ) {
        return fileName.substring( extIndex + 1 );
    }
    return null;
}

let exports;
export default exports = {
    updateFileTickets,
    getInput,
    getFileTickets,
    getFileURL,
    downloadFile,
    getUrl,
    openUrlInNewWindow,
    getFileExtension
};
