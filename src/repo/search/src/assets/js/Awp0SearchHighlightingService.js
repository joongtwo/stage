// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 *
 * @module js/Awp0SearchHighlightingService
 */

import highlighterSvc from 'js/highlighterService';
import appCtxService from 'js/appCtxService';
import sanitizer from 'js/sanitizer';
import $ from 'jquery';
/**
 * getHighlightKeywords - function to get the keywords for highlighting from performSearchViewModel4 response
 * @param { Object } data
 * @returns { Boolean } true/false
 */
const HIGHLIGHT_CSS = 'aw-ui-showHighlight';
export let getHighlightKeywords = function( data ) {
    if( data.additionalSearchInfoMap !== undefined ) {
        highlighterSvc.highlightKeywords( data.additionalSearchInfoMap.searchTermsToHighlight );
        return true;
    }
    return false;
};

/**
 * initHighlight - init the body tag and context for highlighting
 */

export let initHighlight = function() {
    let prefVal = appCtxService.getCtx( 'preferences' ).AW_Highlighting;
    if( !prefVal ) {
        prefVal = [ 'true' ];
    }
    let booleanPrefValue = prefVal[ 0 ] && prefVal[ 0 ].toLowerCase() === 'true';
    if( booleanPrefValue ) {
        $( document.body ).addClass( HIGHLIGHT_CSS );
    } else {
        $( document.body ).removeClass( HIGHLIGHT_CSS );
    }
    return booleanPrefValue;
};

/**
 * resetHighlight - remove the body tag and context for highlighting
 */
export let resetHighlight = function() {
    //removeClass will go through regardless css class exists or not, so no need to check its existence.
    $( document.body ).removeClass( HIGHLIGHT_CSS );
};

/**
 * toggleHighlightSelection - toggle to turn highlighting on/off
 * @param { Object } prefVals
 * @param { Boolean } toToggle
 * @returns { Boolean } return the preference value of AW_Highlighting
 */

export let toggleHighlightSelection = function( prefVals, toToggle, searchTermsToHighlight ) {
    let prefVal = prefVals.AW_Highlighting;
    if( !prefVal ) {
        // if the preference is not (yet) defined. This should not happen in production env.
        prefVal = [ 'true' ];
    }
    let booleanPrefValue = prefVal[ 0 ] && prefVal[ 0 ].toLowerCase() === 'true';
    if( toToggle ) {
        booleanPrefValue = !booleanPrefValue;
        prefVal[ 0 ] = booleanPrefValue ? 'true' : 'false';
        appCtxService.updateCtx( 'preferences.AW_Highlighting', prefVal );
        if( booleanPrefValue && searchTermsToHighlight ) {
            highlighterSvc.highlightKeywords( searchTermsToHighlight );
        } else {
            highlighterSvc.highlightKeywords( [] );
        }
        if( booleanPrefValue ) {
            $( document.body ).addClass( HIGHLIGHT_CSS );
        } else {
            $( document.body ).removeClass( HIGHLIGHT_CSS );
        }
    }
    return prefVal;
};

/**
 * toggleColorFiltering - toggle to turn color filtering on/off
 * @returns { Boolean } return the preference value of AWC_ColorFiltering
 */
export let toggleColorFiltering = function( forceToggleOff ) {
    if ( forceToggleOff ) {
        $( document.body ).addClass( 'aw-ui-hideColorFiltering' );
        return;
    }
    let colorPrefs = appCtxService.getCtx( 'preferences' ).AWC_ColorFiltering;
    let decoratorToggle = colorPrefs ? colorPrefs[ 0 ] === 'true' : false;
    if( decoratorToggle ) {
        $( document.body ).removeClass( 'aw-ui-hideColorFiltering' );
    } else {
        $( document.body ).addClass( 'aw-ui-hideColorFiltering' );
    }
    return decoratorToggle;
};
/**
 * escapeRegexSpecialChars
 *
 * @function escapeRegexSpecialChars
 * @param {Object} regex regex
 * @return {String} escaped regex string
 */
export let escapeRegexSpecialChars = function( regex ) {
    return regex.replace( /[-\/\\^$*+?.()|[\]{}]/g, '\\$&' );
};

/**
 * highlightSearchResults
 *
 * @function highlightSearchResults
 * @param {Object} item item
 * @param {String} text text
 * @return {HTML} HTML string with bold texts
 */
export let highlightSearchResults = function( item, text ) {
    if( item === undefined || item === '' ) {
        return undefined;
    }
    let cleanText = sanitizer.htmlEscapeAllowEntities( text );
    let cleanItem = sanitizer.htmlEscapeAllowEntities( item );
    if( !cleanText ) {
        return cleanItem;
    }
    var words = Awp0SearchHighlightingService.escapeRegexSpecialChars( cleanText ).split( ' ' ).join( '|' );
    var regExp = new RegExp( '(' + words + ')', 'gi' );
    return cleanItem.toString().replace( regExp, '<strong>$1</strong>' );
};

/* eslint-disable-next-line valid-jsdoc*/

const Awp0SearchHighlightingService = {
    getHighlightKeywords,
    initHighlight,
    resetHighlight,
    toggleHighlightSelection,
    escapeRegexSpecialChars,
    highlightSearchResults,
    toggleColorFiltering
};

export default Awp0SearchHighlightingService;
