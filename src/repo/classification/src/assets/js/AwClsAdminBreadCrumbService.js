// Copyright (c) 2022 Siemens

/**
 * This is tree component to display classification admin object
 *
 * @module js/AwClsAdminBreadCrumbService
 */
import localeService from 'js/localeService';

var exports = {};

/**
 * buildTitle
 * @function buildTitle
 *
 * @param {Object}selectedNode - selected node
 * @param {Object}searchObject - search state object
 * @return {Promise} Promise containing the localized text
 */
export let buildTitle = function( searchState ) {
    if( searchState ) {
        if( searchState.totalFound > 0 ) {
            //return resultsFound text
            return localeService.getLocalizedTextFromKey( 'ClassificationAdminMessages.resultsCountLabel' ).then( ( localizedText ) => {
                return localizedText.format( searchState.totalFound, searchState.searchString );
            } );
        }
        // return default text
        return localeService.getLocalizedTextFromKey( 'ClassificationAdminMessages.noSearchResultsFound' ).then( ( localizedText ) => {
            return localizedText.format( searchState.searchString );
        } );
    }
    return '';
};

export default exports = {
    buildTitle
};
