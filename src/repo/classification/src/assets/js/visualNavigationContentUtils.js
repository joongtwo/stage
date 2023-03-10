// Copyright 2020 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 *
 * @module js/visualNavigationContentUtils
 */

import _appCtxSvc from 'js/appCtxService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import _ from 'lodash';

/**
 * @function processSortTypeForVNC
 * @param {Object} sortingTypeForVNC The sorting type
 * @returns {Object} The sorting type for VNC
 */
export let processSortTypeForVNC = function( sortingTypeForVNC ) {
    if( _appCtxSvc && _appCtxSvc.ctx && _appCtxSvc.ctx.preferences &&
        _appCtxSvc.ctx.preferences.AWC_cls_object_filter_sorting && _appCtxSvc.ctx.preferences.AWC_cls_object_filter_sorting[ '0' ] ) {
        sortingTypeForVNC = _appCtxSvc.ctx.preferences.AWC_cls_object_filter_sorting[ '0' ];
    }
    return sortingTypeForVNC;
};

/**
 * @function processSortTypeForVNCAscending
 * @param {Object} a parameter to compare
 * @param {Object} b parameter to compare
 * @returns {Integer} result
 */
export let processSortTypeForVNCAscending = function( a, b ) {
    var value1; var value2;
    if( a && a.props && a.props.object_name && a.props.object_name.uiValues[ '0' ] ) {
        value1 = a.props.object_name.uiValues[ '0' ].toUpperCase();
    }
    if( b && b.props && b.props.object_name && b.props.object_name.uiValues[ '0' ] ) {
        value2 = b.props.object_name.uiValues[ '0' ].toUpperCase();
    }
    var result = value1 > value2 ? 1 : 0;
    return value1 < value2 ? -1 : result;
};

/**
 * @function processSortTypeForVNCDescending
 * @param {Object} a parameter to compare
 * @param {Object} b parameter to compare
 * @returns {Integer} result
 */
export let processSortTypeForVNCDescending = function( a, b ) {
    var value1; var value2;
    if( a && a.props && a.props.object_name && a.props.object_name.uiValues[ '0' ] ) {
        value1 = a.props.object_name.uiValues[ '0' ].toUpperCase();
    }
    if( b && b.props && b.props.object_name && b.props.object_name.uiValues[ '0' ] ) {
        value2 = b.props.object_name.uiValues[ '0' ].toUpperCase();
    }
    var result = value1 > value2 ? 1 : 0;
    return value1 > value2 ? -1 : result;
};

/**
 * @function processSortTypeForCount
 * @param {Object} searchResult A Seach result
 * @param {Object} categoryName the category name
 */
export let processSortTypeForCaseCount = function( searchResult, categoryName ) {
    if( searchResult && searchResult.props && searchResult.props.awp0CellProperties && searchResult.props.awp0CellProperties.dbValues[0] ) {

        var index  = searchResult.props.awp0CellProperties.dbValues[0].indexOf(':')+1;
        var facetValue = searchResult.props.awp0CellProperties.dbValues[0].substring( index );
    }

    _.forEach( _appCtxSvc.ctx.searchResponseInfo.searchFilterMap[ categoryName ], function( objectFacet ) {
        if( objectFacet.stringDisplayValue === facetValue ) {
            searchResult.count = objectFacet.count;
        }
    } );
};

/**
 * @function getCatNameForCaseCount
 * @param {Object} responseResults1 Response Results 1
 * @param {Object} responseResults2 Response Results 2
 * @returns {String} categoryName
 */
export let getCatNameForCaseCount = function( responseResults1, responseResults2 ) {
    var categoryName;
    if( responseResults1 || responseResults2 ) {
        categoryName = 'CLS.type';
    } else {
        categoryName = 'Lbr0LibraryElement.lbr0Ancestors';
    }

    return categoryName;
};

/**
 * @function checkTicketExtensions
 * @param {Object} ticket Ticket
 * @param {Boolean} isSupported To check if one of the extensions is supported
 * @returns {Boolean} isSupported
 */
export let checkTicketExtensions = function( ticket ) {
    var isSupported = false;
    if( ticket && ticket.length > 28 ) {
        var n = ticket.lastIndexOf( '.' );
        var ticketExt = ticket.substring( n + 1 ).toUpperCase();
        if( [ 'GIF', 'JPG', 'JPEG', 'PNG', 'BMP' ].indexOf( ticketExt ) > -1 ) {
            isSupported = true;
        }
    }

    return isSupported;
};

/**
 * @function processSearchResults
 * @param {Object} response soa_kernel_soaService response
 * @param {Object} currentCategory selected category
 * @param {Iterable} i The iterable
 * @param {Object} _iconSvc IconService
 * @returns {Object} soa_kernel_soaService response
 */
export let processSearchResults = function( response, currentCategory, i, _iconSvc ) {
    var ticket = null;
    var isTicketAvailable = response && response.searchResults[ i ] && response.searchResults[ i ].props.awp0ThumbnailImageTicket;
    if( isTicketAvailable && response.searchResults[ i ].props.awp0ThumbnailImageTicket.dbValues[ 0 ] ) {
        ticket = response.searchResults[ i ].props.awp0ThumbnailImageTicket.dbValues[ 0 ];
    }

    // Check if the ticket is having one of the supported extensions
    var isSupported = checkTicketExtensions( ticket );

    var iconAvailable = false;
    if( ticket && isSupported ) {
        iconAvailable = true;
    }

    if( iconAvailable === true ) {
        response.searchResults[ i ].imageUrl = browserUtils.getBaseURL() +
            'fms/fmsdownload/' +
            fmsUtils.getFilenameFromTicket( ticket ) + '?ticket=' +
            ticket;
    } else {
        // If the class doesn't have an image, then display the 'default' icon.
        // Since we are not a real VMO, we can't use the type icon mechanism directly.
        var classifyIconName = 'typeClassificationElement48.svg';
        response.searchResults[ i ].imageUrl = _iconSvc.getTypeIconFileUrl( classifyIconName );
    }

    response.searchResults[ i ].node = currentCategory.filterValues.childnodes[ i ];

    return response;
};

/**
 * @function processSearchCriteria
 * @param {Object} searchCriteria Search Criteria
 * @returns {Integer} The vnc threshold
 */
export let processSearchCriteria = function( searchCriteria ) {
    if( !_appCtxSvc.ctx.searchCriteria ) {
        _appCtxSvc.registerCtx( 'searchCriteria', searchCriteria );
    } else {
        _appCtxSvc.updateCtx( 'searchCriteria', searchCriteria );
    }

    var vnc_threshold = 15;
    if( _appCtxSvc.ctx && _appCtxSvc.ctx.preferences.AWC_classification_vnc_threshold && _appCtxSvc.ctx.preferences.AWC_classification_vnc_threshold[ 0 ] ) {
        vnc_threshold = parseInt( _appCtxSvc.ctx.preferences.AWC_classification_vnc_threshold[ 0 ], 10 );
    }

    return vnc_threshold;
};

/**
 * @function thenRegisterResponse
 * @param {Object} vncResponse VNC Response
 */
export let thenRegisterResponse = function( vncResponse ) {
    if( !_appCtxSvc.ctx.vncResponse ) {
        _appCtxSvc.registerCtx( 'vncResponse', vncResponse );
    } else {
        _appCtxSvc.updateCtx( 'vncResponse', vncResponse );
    }
};

export default {
    processSortTypeForVNC,
    processSortTypeForVNCAscending,
    processSortTypeForVNCDescending,
    processSortTypeForCaseCount,
    processSearchResults,
    checkTicketExtensions,
    processSearchCriteria,
    thenRegisterResponse,
    getCatNameForCaseCount
};
