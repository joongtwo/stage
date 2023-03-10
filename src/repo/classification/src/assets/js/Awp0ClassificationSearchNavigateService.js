// Copyright (c) 2022 Siemens

/**
* @module js/Awp0ClassificationSearchNavigateService
*/
import filterPanelUtils from 'js/filterPanelUtils';
import localStrg from 'js/localStorage';
import searchSimilarService from 'js/searchSimilarService';
import classifyDefinesService from './classifyDefinesService';

var exports = {};

/**
  * Navigates up the class hierarchy to a parent. Replaces the selected node with the parent ID and indicates an update is happening.
  * @param {State} navigateState the current navigation state for the classification location navigator tab.
  */
export let activateUpHierarchy = function( navigateState, searchState ) {
    const tmpNavContext = { ...navigateState.value };
    tmpNavContext.selectedNode = {
        uid: navigateState.parent,
        selected: true
    };
    if( navigateState.parentDisplayName ) {
        tmpNavContext.selectedNode.displayName = navigateState.parentDisplayName;
    }
    //if at top level, we need to reset the results
    if ( navigateState.parent === 'top' ) {
        const tmpContext = { ...searchState.value };
        tmpContext.reset = !tmpContext.reset;
        searchState.update( tmpContext );
    }
    tmpNavContext.vncUpdate = navigateState.parent;
    navigateState.update( tmpNavContext );
};


/*
  * Handles show/hide annotation command
  */
export let toggleNavigateTree = function( commandContext, showNavigateImage ) {
    //Launch VNCs
    const tmpContext = { ...commandContext.navigateState.value };
    tmpContext.showNavigateImage = showNavigateImage;
    if( commandContext.selectionData && !tmpContext.originVNCs ) {
        tmpContext.originVNCs = commandContext.selectionData.selectedClassNode.treeLoadResult;
    }
    commandContext.navigateState.update( tmpContext );
};

/*
  * Deactivates Search similar mode
  */
export let deactivateSearchSimilarMode = function( searchState ) {
    const tmpContext = { ...searchState.value };
    tmpContext.activateSearchSimilarMode = false;
    searchState.update( tmpContext );
};

/**
  * Get the active filter values from active filter map value.
  * @param {Array} activeFilterMapValue active filter map value.
  *  @returns {Array} active filter values
  */
export let getOnlyFilterValuesFromActiveFilterMap = ( activeFilterMapValue ) => {
    let values = [];
    if( activeFilterMapValue && activeFilterMapValue.length > 0 ) {
        for( let index = 0; index < activeFilterMapValue.length; index++ ) {
            switch ( activeFilterMapValue[ index ].searchFilterType ) {
                case 'DateFilter': {
                    if( activeFilterMapValue[ index ].startDateValue.includes( filterPanelUtils.BEGINNING_OF_TIME ) ) {
                        values.push( filterPanelUtils.INTERNAL_DATE_FILTER + '*' + '_TO_' + activeFilterMapValue[ index ].endDateValue );
                    } else if( activeFilterMapValue[ index ].endDateValue.includes( filterPanelUtils.ENDING_OF_TIME ) ) {
                        values.push( filterPanelUtils.INTERNAL_DATE_FILTER + activeFilterMapValue[ index ].startDateValue + '_TO_' + '*' );
                    } else {
                        values.push( filterPanelUtils.INTERNAL_DATE_FILTER + activeFilterMapValue[ index ].startDateValue + '_TO_' + activeFilterMapValue[ index ].endDateValue );
                    }
                    break;
                }
                case 'NumericFilter': {
                    if( activeFilterMapValue[ index ].stringValue && activeFilterMapValue[ index ].stringValue.length > 0 &&
                        activeFilterMapValue[ index ].startEndRange !== 'NumericRange' &&
                        activeFilterMapValue[ index ].startEndRange !== 'NumericRangeBlankStart' &&
                        activeFilterMapValue[ index ].startEndRange !== 'NumericRangeBlankEnd' ) {
                        values.push( filterPanelUtils.INTERNAL_NUMERIC_FILTER + activeFilterMapValue[ index ].stringValue );
                    } else {
                        if( activeFilterMapValue[ index ].startNumericValue > 0 && activeFilterMapValue[ index ].endNumericValue > 0 ) {
                            values.push( filterPanelUtils.INTERNAL_NUMERIC_RANGE + activeFilterMapValue[ index ].startNumericValue + '_TO_' + activeFilterMapValue[ index ].endNumericValue );
                        } else if( activeFilterMapValue[ index ].startNumericValue > 0 ) {
                            values.push( filterPanelUtils.INTERNAL_NUMERIC_RANGE + activeFilterMapValue[ index ].startNumericValue + '_TO_' );
                        } else {
                            values.push( filterPanelUtils.INTERNAL_NUMERIC_RANGE + '_TO_' + activeFilterMapValue[ index ].endNumericValue );
                        }
                    }
                    break;
                }
                case 'RadioFilter':
                case 'StringFilter':
                    values.push( activeFilterMapValue[ index ].stringValue );
                    break;
                default:
                    break;
            }
        }
    }
    return values;
};

/**
   * Get the active filter values from active filter map.
   * @param {Object} filterMap active filter map.
   * @returns {Object} active filter value map
   */
export let getActiveFilters = function( filterMap ) {
    let activeFilters = {};
    for ( let key of Object.keys( filterMap ) ) {
        activeFilters[key] = getOnlyFilterValuesFromActiveFilterMap( filterMap[key] );
    }
    return activeFilters;
};

/**
  * Clean the root in the case of user returning to top.
  * @param {Object} prnt active filter map.
  * @param {Object} selectionData selectionData to check for valid cleanup case.
  * @returns {State} updated component level navigate state.
  */
export let cleanForRoot = function( prnt, selectionData ) {
    if( prnt === classifyDefinesService.ROOT_LEVEL_ID && selectionData.selectedClassNode && selectionData.selectedClassNode.treeLoadResult && selectionData.selectedClassNode.treeLoadResult.parentNode  ) {
        prnt = '';
    }
    return prnt;
};

/**
  * Determine top
  * @param {Object} current the current setting of top or child nodes.
  * @param {Object} navigateState the navigation state to check.
  * @returns {Boolean} what the current setting should be.
  */
export let determineBreadcrumb = function( current, navigateState ) {
    if( navigateState && navigateState.selectedNode && navigateState.selectedNode.uid !== classifyDefinesService.ROOT_LEVEL_ID  ) {
        return false;
    }
    if( navigateState && navigateState.selectedNode && navigateState.selectedNode.uid === classifyDefinesService.ROOT_LEVEL_ID  ) {
        return true;
    }
    return current;
};

/**
  * Updates the search state with search similar information.
  * @param {State} tmpContext the search state to update.
  */
export let applySearchSimilar = function( tmpContext ) {
    let classSearchSimilar = JSON.parse( localStrg.get( 'SearchSimilarClass' ) );
    tmpContext.criteria.searchString = '"Classification Class Id":' + '"' + classSearchSimilar.id + '"';
    tmpContext.activeFilterMap = searchSimilarService.getFilterMapForSearchSimilar();
    tmpContext.activeFilters = getActiveFilters( tmpContext.activeFilterMap );
    tmpContext.selectedClassNode = classSearchSimilar;
    tmpContext.activateSearchSimilarMode = true;
    tmpContext.doneWithSearchSimilar = true;
};

/**
  * Updates the search state with the current selection's information.
  * @param {SelectionModel} selectionData selected class to use as reference point to fetch classification objects.
  * @param {State} searchState the selection model used to derive the selected class.
  * @param {State} navigateState the navigation state used to support the back functionality.
  * @return {State} navigateState the updated navigation state that lives on Search Navigate panel.
  */
export let updateSearchLocation = function( selectionData, searchState, navigateState ) {
    var pickedClass;
    let tmpContext = { ...searchState.value };
    let isSearchSimilarMode = new URLSearchParams( window.location.href ).get( 'mode' ) === 'SearchSimilar';
    var vncUpdateSyncSel = false;
    let needUpdate = false;
    if ( selectionData.value.selectedClassNode && selectionData.value.selectedClassNode.uid ) {
        vncUpdateSyncSel = selectionData.value.selectedClassNode.uid;
    }
    if ( isSearchSimilarMode && !tmpContext.doneWithSearchSimilar ) {
        applySearchSimilar( tmpContext );
        needUpdate = true;
    } else if( selectionData && selectionData.dbValue && selectionData.dbValue.selectedClassNode ) {
        //Update from tree.
        const currentSelection = selectionData.selected;

        var syncSel = false;
        if( selectionData.dbValue ) {
            syncSel = selectionData.dbValue.selectedClassNode;
        }
        if( currentSelection && syncSel && currentSelection[0] && currentSelection[0].uid === syncSel.uid  ) {
            pickedClass = selectionData.selected[0].uid;
            tmpContext.criteria.searchString = '"Classification Class Id":' + '"' + pickedClass + '"';
            navigateState.parent = selectionData.selected[0].parent_Id;
            needUpdate = true;
        }
    } else if( vncUpdateSyncSel && ( !navigateState.selectedNode || navigateState.selectedNode.uid !== vncUpdateSyncSel || navigateState.selectedNode.uid === navigateState.parent ) ) {
        //Update from VNC
        tmpContext.criteria.searchString = '"Classification Class Id":' + '"' + vncUpdateSyncSel + '"';
        needUpdate = true;
    } else if ( selectionData && selectionData.selected && !selectionData.selected.length && !selectionData.selectedClassNode ) {
        // Class was deselected. Reset the Search area.
        tmpContext.reset = !tmpContext.reset;
        needUpdate = true;
    }

    if ( needUpdate ) {
        searchState.update( tmpContext );
    }
    //Cleanup navigateState, if necessary.
    needUpdate = false;
    let parent = cleanForRoot( navigateState.parent, selectionData );
    let tmpNavState = { ...navigateState.value };
    if ( tmpNavState.parent !== parent ) {
        tmpNavState.parent = parent;
        needUpdate = true;
    }
    if( tmpNavState.vncUpdate ) {
        delete tmpNavState.vncUpdate;
        needUpdate = true;
    }
    if ( needUpdate ) {
        navigateState.update( tmpNavState );
    }
};

/**
  * Updates the search state with the current selection's information.
  * @param {SelectionModel} selectionData selected class to use as reference point to fetch classification objects.
  * @param {State} searchState the selection model used to derive the selected class.
  * @param {State} navigateState the navigation state used to support the back functionality.
  * @return {State} navigateState the updated navigation state that lives on Search Navigate panel.
  */
export let updateSearchLocationImages = function( selectionData, searchState, navigateState ) {
    var pickedClass;
    let tmpContext = { ...searchState.value };
    let isSearchSimilarMode = new URLSearchParams( window.location.href ).get( 'mode' ) === 'SearchSimilar';
    var vncUpdateSyncSel = false;
    if ( selectionData && selectionData.selectedClassNode && selectionData.selectedClassNode.uid ) {
        vncUpdateSyncSel = selectionData.selectedClassNode.uid;
    }
    if ( isSearchSimilarMode  && !searchState.doneWithSearchSimilar ) {
        applySearchSimilar( tmpContext );
    } else if( selectionData && selectionData.dbValue && selectionData.dbValue.selectedClassNode ) {
        //Update from tree.
        const currentSelection = selectionData.selected;

        var syncSel = false;
        if( selectionData.dbValue ) {
            syncSel = selectionData.dbValue.selectedClassNode;
        }
        if( currentSelection && syncSel && currentSelection[0] && currentSelection[0].uid === syncSel.uid  ) {
            pickedClass = selectionData.selected[0].uid;
            tmpContext.criteria.searchString = '"Classification Class Id":' + '"' + pickedClass + '"';
            navigateState.parent = selectionData.selected[0].parent_Id;
        }
    } else if( vncUpdateSyncSel && ( !navigateState.selectedNode || navigateState.selectedNode.uid !== vncUpdateSyncSel || navigateState.selectedNode.uid === navigateState.parent ) ) {
        //Update from VNC
        tmpContext.criteria.searchString = '"Classification Class Id":' + '"' + vncUpdateSyncSel + '"';
    } else if ( selectionData && selectionData.selected && !selectionData.selected.length && !selectionData.selectedClassNode ) {
        // Class was deselected. Reset the Search area.
        tmpContext.reset = !tmpContext.reset;
    }
    tmpContext.returnToTop = determineBreadcrumb( searchState.returnToTop, navigateState );
    searchState.update( tmpContext );

    //Cleanup navigateState, if necessary.
    navigateState.parent = cleanForRoot( navigateState.parent, selectionData );
    if( navigateState.vncUpdate ) {
        delete navigateState.vncUpdate;
    }
    return navigateState;
};


/**
*  Determines if the search state needs to be updated. Improves performance.
* @param {State} tmpContext the temporary context that has been edited.
* @param {State} searchState the original, unedited search state.
* @return {Boolean} Whether an update function call is required or not.
*/
let searchStateUpdateRequired = function( tmpContext, searchState ) {
    return Boolean( tmpContext.returnToTop !== searchState.value.returnToTop
        || tmpContext.reset !== searchState.value.reset
        || tmpContext.criteria.searchString !== searchState.value.criteria.searchString
        || tmpContext.doneWithSearchSimilar !== searchState.value.doneWithSearchSimilar );
};

/**
*  Decouples the search info added by searchClass from the uid of the node.
* @param {String} searchStr the search string used in search state containing the uid.
* @return {String} decoupled string.
*/
export let decoupleSearchEncoding = function( searchStr ) {
    return searchStr.slice( 0, -1 ).replace( '"Classification Class Id":"', '' );
};

/**
* Updates the search state with search similar information.
* @param {State} tmpContext the search state to update.
 */
export let establishNavState = function( navigateState, searchState ) {
    if( searchState.criteria && searchState.criteria.searchString ) {
        navigateState.selectedNode = {
            uid: decoupleSearchEncoding( searchState.criteria.searchString )
        };
    }
    //Clears previously selected filter values
    if( searchState.activeFilterMap && searchState.activeFilterMap !== {} && !searchState.activateSearchSimilarMode ) {
        const tmpSearchState = { ...searchState.value };
        tmpSearchState.activeFilterMap = {};
        tmpSearchState.activeFilters = {};
        tmpSearchState.appliedFilterMap = {};
        tmpSearchState.appliedFilters = [];
        tmpSearchState.searchFilterMap = {};
        searchState.update( tmpSearchState );
    }

    return navigateState;
};

export default exports = {
    activateUpHierarchy,
    applySearchSimilar,
    cleanForRoot,
    deactivateSearchSimilarMode,
    decoupleSearchEncoding,
    establishNavState,
    getActiveFilters,
    getOnlyFilterValuesFromActiveFilterMap,
    toggleNavigateTree,
    updateSearchLocation,
    updateSearchLocationImages
};
