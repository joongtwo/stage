// Copyright (c) 2022 Siemens

/**
 * This is tree component to display classification classes
 *
 * @module js/AwClsBreadCrumbService
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
export let buildTitle = function( selectedNode, searchObject ) {
    //Need to make sure VNC created nodes work as well, hence check for visibility. Can only make deselection from tree with visibility.
    if ( selectedNode && !searchObject.returnToTop && ( selectedNode.parentDisplayName || selectedNode.selected ) && ( selectedNode.selected || !selectedNode.visible ) ) {
        if( searchObject.totalFound > 0 ) {
            //return resultsFound text
            return localeService.getLocalizedTextFromKey( 'ClassificationPanelMessages.resultsCountLabel' ).then( ( localizedText ) => {
                return localizedText.format( searchObject.totalFound,  selectedNode.displayName );
            } );
        }
        // return default text
        return localeService.getLocalizedTextFromKey( 'ClassificationPanelMessages.noSearchResultsFound' ).then( ( localizedText ) => {
            return localizedText.format( selectedNode.displayName );
        } );
    }
    return '';
};

/**
 * Get Prop Details

 * @return {Object} the prop Details
 */
export let getNodeData = function( nodeData ) {
    return nodeData.selectedNode;
};

export default exports = {
    buildTitle,
    getNodeData
};
