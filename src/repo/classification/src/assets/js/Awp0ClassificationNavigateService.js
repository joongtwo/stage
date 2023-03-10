// Copyright (c) 2022 Siemens

/**
 * This is tree component to display classification classes
 *
 * @module js/Awp0ClassificationNavigateService
 */
import AwTimeoutService from 'js/awTimeoutService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};
var _timeout = null;


/**
  * Following method resets the application context variables, this would get called only while launching the filter panel
  * @param {*} data Declarative view model
  * @param {*} ctx Application context
  */
export let resetScope = function( data ) {
    eventBus.publish( 'primaryWorkArea.reset' );
};

/**
  *  Clears out the current selection to regenerate the VNCs and table.
  * @param {String} selectionData the new search criteria to update the state with.
  */
export let updateSelection = function( selectionData ) {
    if( selectionData.value.selectedClassNode ) {
        const tmpSelectionData = { ...selectionData.value };

        tmpSelectionData.selectedClassNode = null;
        tmpSelectionData.previouslySelectedClassNode = null;
        selectionData.update( tmpSelectionData );
    }
};

/**
  *  Clears out the current search string to maintain fidelity of navigator panel in images view.
  * @param {Object} searchBox the current search box to return to empty.
  * @param {Object} externalSearchBox the search box abstraction that updates between the two panel modes.
  */
export let clearSearch = function( searchBox, externalSearchBox ) {
    searchBox.dbValue = '';
    externalSearchBox.dbValue = '';
};

/**
  *  Updates navigation with new search criteria. Part of the code is duplicate of filterHiearchy function.
  * @param {Object} searchModel the new search criteria to update the state with.
  * @param {State} navigateState the state being used to drive navigation.
  * @param {String} providerName the name of the search provider being used. (Typically Awp0ClassificationSearchNavigate)
  * @param {State} searchState the current search state to update.
  * @param {Object} conditions array of conditions
  * @param {State} classifyState classify State
  * @returns {State} the new state to replace navigateState with.
  */
export let setSearchCriteria = function( searchModel, navigateState, providerName, searchState, conditions, classifyState ) {
    const searchCriteria = searchModel.dbValue.trim();
    if( !_.isNull( _timeout ) ) {
        AwTimeoutService.instance.cancel( _timeout );
    }
    _timeout = AwTimeoutService.instance( setStates( searchCriteria, conditions, providerName, navigateState, searchState, classifyState ), 1500 );
    var newModel = {};
    newModel.dbValue = searchCriteria;
    return newModel;
};

/**
  *  Determines whether the search made is a valid search input, updates all currently known search criteria states.
  * @param {Object} searchCriteria the criteria used to define for what is being searched.
  * @param {Object} conditions array of conditions
  * @param {String} providerName the name of the search provider being used. (Typically Awp0ClassificationSearchNavigate)
  * @param {State} navigateState the state being used to drive navigation.
  * @param {State} searchState the current search state to update.
  * @param {State} classifyState classify State
  * @returns {State} the new state to replace navigateState with.
  */
export function setStates( searchCriteria, conditions, providerName, navigateState, searchState, classifyState ) {
    return function() {
        if ( searchCriteria.length >= 1 &&
            !conditions.isValidSearchInput ) {
            eventBus.publish( providerName + '.invalidSearchString', {} );
        } else {
            if ( navigateState ) {
                const tmpNavContext = { ...navigateState.value };
                //prevent duplicate state updates.
                if ( tmpNavContext.searchCriteria || searchCriteria ) {
                    tmpNavContext.searchCriteria = searchCriteria;
                    navigateState.update( tmpNavContext );
                }
            }
            let isPanel = classifyState && classifyState.value.isClassifyPanel;
            if ( searchState && searchCriteria && !isPanel ) {
                const tmpSearchContext = { ...searchState.value };
                if ( !tmpSearchContext.criteria ) {
                    tmpSearchContext.criteria = {};
                }
                tmpSearchContext.criteria.searchString = '';
                searchState.update( tmpSearchContext );
            }
        }
    };
}

export default exports = {
    clearSearch,
    resetScope,
    setSearchCriteria,
    setStates,
    updateSelection
};


