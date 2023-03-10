// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/*eslint class-methods-use-this: ["error", { "exceptMethods": [post,get,getHeaders,setBODDownloadInfo] }] */

/**
 * Service Proxy class
 * @module js/ssp0SpGraphicsServiceProxy
 */
import AwHttpService from 'js/awHttpService';
import browserUtils from 'js/browserUtils';
import logger from 'js/logger';

const $http = AwHttpService.instance;

class ssp0SpGraphicsServiceProxy {
    constructor() {
        /**
         * Vis service URL
         */
        this.visServiceUrl = browserUtils.getBaseURL() + 'micro/mfe-vis/v1/';

        /**
         * App service URL
         */
        this.appServiceUrl = browserUtils.getBaseURL() + 'micro/TCSLMASSETMGMT/';
    }

    /**
     * LoadStructure
     * @param {Object} input input
     * @return {Promise} deferred promise
     */
    loadStructure( input ) {
        return $http.post( `${this.appServiceUrl}loadStructureForVis`, input );
    }


    /**
   * Returns header with Log-Correlation-ID
   * @return {Object}header with Log-Correlation-ID
   */
    getHeaders() {
        return {
            //Only US-ASCII characters are allowed in HTTP headers
            //http://stackoverflow.com/questions/34670413/regexp-to-validate-a-http-header-value/34710882#34710882
            'Log-Correlation-ID': logger.getCorrelationID().replace( /[^\x20-\x7E]+/g, '' )
        };
    }

    /**
    * Posts a request via http POST
    * @param {*} url the url to request
    * @param {*} input body
    * @returns {*} Promise
    */
    post( url, input ) {
        const headers = this.getHeaders();
        return $http.post( url, input, {
            headers: headers
        } );
    }

    /**
     * Posts a request via http GET
     * @param {*} url the url to request
     * @returns {*} Promise
     */
    get( url ) {
        const headers = this.getHeaders();
        return $http.get( url, {
            headers: headers
        } );
    }

    /**
     * @function setBODDownloadInfo
     * @desc Given the Part object, this method sets the information for BOD download of that part.
     * @instance
     * @memberof EpGraphicsServiceProxy
     * @param {Object} partObject part
     */
    setBODDownloadInfo( partObject ) {
        //if the BOD storage mechanism is set to FMS
        if ( partObject.fileRef && partObject.fileDownloadInfo ) {
            if ( partObject.fileDownloadInfo.readTicket !== undefined ) {
                partObject.baseRef = 'fms';
                partObject.fileRef = `fmsdownload/${partObject.fileRef.replace( '%20', '_' )}?ticket=${partObject.fileDownloadInfo.readTicket}`;
            } else if ( partObject.fileDownloadInfo.basePath !== undefined ) {
                partObject.baseRef = '/micro' + partObject.fileDownloadInfo.basePath;
            }
            delete partObject.fileDownloadInfo;
        }
    }
}

export default new ssp0SpGraphicsServiceProxy();
