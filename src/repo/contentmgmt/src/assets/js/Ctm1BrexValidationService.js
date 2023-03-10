// Copyright (c) 2022 Siemens

/**
 * @module js/Ctm1BrexValidationService
 */
import cdm from 'soa/kernel/clientDataModel';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import messageSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import _ from 'lodash';

/**
 * The FMS proxy servlet context. This must be the same as the FmsProxyServlet mapping in the web.xml
 */
var WEB_XML_FMS_PROXY_CONTEXT = 'fms';

/**
 * Relative path to the FMS proxy download service.
 */
var CLIENT_FMS_DOWNLOAD_PATH = WEB_XML_FMS_PROXY_CONTEXT + '/fmsdownload/';

var exports = {};

/**
 * Gets the isAsync input for the brexValidation SOA.
 *
 * @param {Object} data - The qualified data of the viewModel
 * @returns {Boolean} The input for brexValidation
 */
export let getAsyncInput = function( data ) {
    var uiValue = true;
    if( data.brexIsSync !== undefined && data.brexIsSync.dbValue !== undefined ) {
        // radio button's true corresponds to "async", false means "is not async"
        uiValue = data.brexIsSync.dbValue;
    }
    return uiValue;
};

/**
 * Get the inputs array for the brexValidation SOA.
 *
 * @param {Object} context - the current state
 * @returns {Array} The array of SOA input objects
 *
 */
export let getValidationInputs = function( context ) {
    var inputs = [];
    _.forEach( context.occmgmtContext.selectedModelObjects, function( modelObj ) {
        var underlyingObj = modelObj;
        if( modelObj.props.awb0UnderlyingObject ) {
            underlyingObj = cdm.getObject( modelObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }

        var input = {
            clientId: 'AW Brex Validate',
            businessObject: underlyingObj,
            dmTransientFileReadTicket: '',
            brexFileReadTicket: ''
        };
        inputs.push( input );
    } );
    return inputs;
};

var buildUrlFromFileTicket = function( fileTicket, overrideFileName ) {
    var fileName = fmsUtils.getFilenameFromTicket( fileTicket );
    var downloadUri = CLIENT_FMS_DOWNLOAD_PATH + fileName + '?ticket=' +
        fileTicket.substring( fileTicket.indexOf( '=' ) + 1 );
    var baseUrl = browserUtils.getBaseURL();
    var urlFullPath = baseUrl + downloadUri;

    if( overrideFileName !== undefined && overrideFileName.length > 0 ) {
        fileName = overrideFileName;
    }

    return { fileName, urlFullPath };
};

var onDownloadSuccess = function( brexLogText, validationFailed ) {
    var localMsg = localeSvc.getLoadedText( 'ContentMgmtMessages' ).brexLogDownloadSuccess;
    if( localMsg[ localMsg.length - 1 ] !== '\n' ) {
        localMsg += '\r\n';
    }
    localMsg += brexLogText;
    if( validationFailed ) {
        messageSvc.showError( localMsg, null, null, [ {
            addClass: 'btn btn-notify',
            text: localeSvc.getLoadedText( 'ContentMgmtMessages' ).closeBrexLog,
            onClick: function( $noty ) {
                $noty.close();
            }
        } ] );
    } else {
        messageSvc.showInfo( localMsg, null, null, [ {
            addClass: 'btn btn-notify',
            text: localeSvc.getLoadedText( 'ContentMgmtMessages' ).closeBrexLog,
            onClick: function( $noty ) {
                $noty.close();
            }
        } ] );
    }
};

var onDownloadFail = function() {
    var localMsg = localeSvc.getLoadedText( 'ContentMgmtMessages' ).brexLogDownloadFail;
    messageSvc.showError( localMsg );
};

var didValidationFail = function( svcData ) {
    var validationFailed = false;

    if( svcData && svcData.partialErrors ) {
        for( var ipe = 0; ipe < svcData.partialErrors.length; ++ipe ) {
            var partialError = svcData.partialErrors[ ipe ];
            if( partialError.errorValues ) {
                for( var iev = 0; iev < partialError.errorValues.length; ++iev ) {
                    var errorValue = partialError.errorValues[ iev ];
                    if( errorValue.code === 239430 ) {
                        validationFailed = true;
                        break;
                    }
                }
            }
        }
    }

    return validationFailed;
};

/**
 * Download the transient log file from the server that is produced by the brexValidation SOA.
 *
 * @param {Object} data - The qualified data of the viewModel
 */
export let downloadBrexLog = function( data ) {
    if( !data.brexReadTicket || data.brexReadTicket === '' ) {
        return;
    }

    var dlInfo = buildUrlFromFileTicket( data.brexReadTicket );
    var xhr = new XMLHttpRequest();
    xhr.open( 'GET', dlInfo.urlFullPath, true );
    xhr.responseType = 'text';
    xhr.onload = function() {
        if( this.response ) {
            var validationFailed = didValidationFail( data.brexSvcData );
            onDownloadSuccess( this.response, validationFailed );
        } else {
            onDownloadFail();
        }
    };
    xhr.onabort = onDownloadFail;
    xhr.onerror = onDownloadFail;
    xhr.ontimeout = onDownloadFail;
    xhr.send();

    data.brexReadTicket = null;
};

exports = {
    getAsyncInput,
    getValidationInputs,
    downloadBrexLog
};

export default exports;
