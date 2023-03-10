// Copyright (c) 2022 Siemens

/**
 * @module js/navigateSearchService
 */

import appCtxSvc from 'js/appCtxService';
import evaluateExpressionInGivenContext from 'js/evaluateExpressionInGivenContext';
import toggleIndexConfigurationService from 'js/toggleIndexConfigurationService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import occmgmtUtils from 'js/occmgmtUtils';
import selectionModelFactory from 'js/selectionModelFactory';
import searchCommonUtils from 'js/searchCommonUtils';


var exports = {};

var _productContextChanged = null;
var _syncingFindSelectionsWithPWA;
var _syncingPWASelectionsWithFind;

/**
  * Function to subscribe to product context change event on reset command execution
  * @param { Object } data view model data
  * @param { Object } subPanelContext subPanelContext
  */
export let subscribeToProductContextChangeEvent = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext )  ||
    !( data.searchStateForAdvanced.savedQuery || data.searchStateForKeyword.criteria && data.searchStateForKeyword.criteria.searchString )  ) {
        return;
    }
    if( !_productContextChanged ) {
        _productContextChanged = eventBus.subscribe( 'productContextChangedEvent', function( eventData ) {
            if( eventData && eventData.dataProviderActionType !== 'focusAction' && eventData.dataProviderActionType !== 'activateWindow' && eventData.dataProviderActionType !== 'productChangedOnSelectionChange' && _productContextChanged ) {
                eventBus.unsubscribe( _productContextChanged );
                _productContextChanged = null;
                eventBus.publish( 'navigate.resetStructure' );
            }
        } );
    }
};

export let redirectCommandEvent = function( eventName, eventData ) {
    eventBus.publish( eventName, eventData );
};

export let getLiveSearchResult2 = function( data ) {
    appCtxSvc.ctx[ data.navigateContext.dbValue ].showLiveSearchResultCommand = false;
    eventBus.publish( 'navigate.getLiveSearchResult' );
};

export let getLiveSearchResult = function(  commandContext ) {
    let searchState = commandContext.searchState;
    if( searchState ) {
        let newSearchState = { ...searchState.getValue() };
        newSearchState.showLiveSearchResultCommand = false;
        newSearchState.hideFilters = true;
        newSearchState.additionalCriteria.useAlternateConfig = 'false';
        commandContext.searchState.update && commandContext.searchState.update( newSearchState );
        searchCommonUtils.updateSearchState( searchState.criteria.searchString, commandContext );
    }
};

export let parseExpression = function( data, ctx, conditions, expression, type ) {
    return evaluateExpressionInGivenContext.parseExpression( data, ctx, conditions, expression, type );
};

export let getIndexOffProductListInLocalStorage = function() {
    return toggleIndexConfigurationService.getIndexOffProductListInLocalStorage().join( '|' );
};

export let getProductContextUids = function( data ) {
    if( data && data.subPanelContext ) {
        var occContextValue = data.subPanelContext.occContext.getValue();
        var elementToPCIMap = occContextValue.elementToPCIMap;
        var pCtx = occContextValue.productContextInfo;
        return elementToPCIMap ? Object.values( elementToPCIMap ).join( '|' ) : pCtx.uid;
    }
};


export let updateSearchScopeLabel = function(  data, subPanelContext ) {
    var resource = 'OccurrenceManagementConstants';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var message = localTextBundle.searchScopeText;

    let selectedString;
    if(  subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0
        && subPanelContext.selectionData.selected[ 0 ].props && subPanelContext.selectionData.selected[ 0 ].props.object_string ) {
        selectedString  = subPanelContext.selectionData.selected[ 0 ].props.object_string.dbValues[0];
    }else if ( subPanelContext.occContext && subPanelContext.occContext.selectedModelObjects && subPanelContext.occContext.selectedModelObjects.length > 0
        && subPanelContext.occContext.selectedModelObjects[ 0 ].props && subPanelContext.occContext.selectedModelObjects[ 0 ].props.object_string ) {
        selectedString  = subPanelContext.occContext.selectedModelObjects[ 0 ].props.object_string.dbValues[0];
    }
    if( selectedString ) {
        data.dispatch && data.dispatch( { path: 'data.searchScope.propertyDisplayName', value:  message.replace( '{0}', selectedString ) } );
    }
    if( subPanelContext.occContext.unifiedInContextSearchConfig && subPanelContext.occContext.unifiedInContextSearchConfig.selectSearchScopeCheckbox ) {
        data.searchScope.dbValue = subPanelContext.occContext.unifiedInContextSearchConfig.selectSearchScopeCheckbox;
    }
};

/**
  * Move one down from current selected search result
  *
  * @param {Object} commandContext - panel command context
  * @param {Object} moveTo - Direction to move to
  */
export let moveUpDown = function( commandContext, moveTo ) {
    let selection = commandContext.selectionData.selected[0];
    if( selection ) {
        const dp = commandContext.selectionModel.getDpListener();
        let vmoList = dp.vmCollectionObj.vmCollection.loadedVMObjects;
        var selectedIndex = _.findIndex( vmoList, function( vmo ) {
            return vmo.uid === selection.uid;
        } );
        if( selectedIndex !== -1 ) {
            if( moveTo === 'Down' ) {
                dp.changeObjectsSelection( selectedIndex + 1, selectedIndex + 1, true );
            }
            if( moveTo === 'Up' ) {
                dp.changeObjectsSelection( selectedIndex - 1, selectedIndex - 1, true );
            }
        }
    }
};

/**
  * SelectAll/ClearAll currently loaded objects
  *
  * @param {Object} commandContext -  panel command context
  *
  */
export let toggleSelectAllResults = function( commandContext ) {
    const dp = commandContext.selectionModel.getDpListener();
    var areAllResultsSelected = commandContext.selectionModel.getCurrentSelectedCount() === dp.vmCollectionObj.vmCollection.totalObjectsLoaded;
    areAllResultsSelected || commandContext.selectionModel.selectionState === 'all' ? dp.selectNone() : dp.selectAll();
};

let isUpdatedContextSameAsPanelContext = function( data, subPanelContext ) {
    if( data && subPanelContext ) {
        return data.navigateContext.dbValue === subPanelContext.occContext.viewKey;
    }
    return false;
};

let shouldShowFindWithin = function( data, subPanelContext ) {
    let showFindIn = false;
    if( subPanelContext.occContext.selectedModelObjects && subPanelContext.occContext.selectedModelObjects.length === 1 ) {
        let isSingleSelectionPresent = subPanelContext.occContext.selectedModelObjects[0].props.object_string;
        let isPartitionSelected = subPanelContext.occContext.selectedModelObjects[0].modelType.typeHierarchyArray.indexOf( 'Fgf0PartitionElement' ) > -1;
        let isValidSelection = subPanelContext.occContext.currentState.c_uid !== subPanelContext.occContext.currentState.t_uid;
        let isLeafNode =  subPanelContext.occContext.selectedModelObjects[0].props.awb0NumberOfChildren && subPanelContext.occContext.selectedModelObjects[0].props.awb0NumberOfChildren.dbValues[0] === '0';

        showFindIn = isSingleSelectionPresent && isValidSelection && !isLeafNode && !isPartitionSelected;
    }

    data.dispatch && data.dispatch( { path: 'data.showFindIn', value: showFindIn } );
};

export let updateAdditionalSearchCriteria = function( data, subPanelContext, searchScope ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext ) ) {
        return;
    }
    let searchStateForAdvanced = data.searchStateForAdvanced;
    let searchStateForKeyword = data.searchStateForKeyword;
    let advancedAdditionalCriteria =  searchStateForAdvanced.additionalCriteria;
    let keywordAdditionalCriteria =  searchStateForKeyword.additionalCriteria;

    var hideFilters = true;
    if( subPanelContext.occContext.supportedFeatures.Awb0EnableFilterInFullTextSearchFeature ||
         subPanelContext.occContext.supportedFeaturesInWC && subPanelContext.occContext.supportedFeaturesInWC.Awb0EnableFilterInFullTextSearchFeature ||
        subPanelContext.occContext.supportedFeatures.Awb0UnifiedFindInStructure ) {
        hideFilters = false;
    }


    var searchContext;
    if( subPanelContext.occContext.productContextInfo && !subPanelContext.occContext.isOpenedUnderAContext ) {
        searchContext =  subPanelContext.occContext.productContextInfo.uid;
    }else if( subPanelContext.occContext.workingContextObj ) {
        searchContext =  subPanelContext.occContext.workingContextObj.uid;
    }

    var includeConnections;
    if( subPanelContext.occContext.persistentRequestPref &&
        subPanelContext.occContext.persistentRequestPref.includeConnections ) {
        includeConnections = 'True';
    }else{
        includeConnections = '';
    }

    let productContextsToBeExcludedFromSearch = exports.getIndexOffProductListInLocalStorage();
    let productContextUids = exports.getProductContextUids( data );
    let selectedObjectUid;
    if(  subPanelContext.selectionData && subPanelContext.selectionData.selected &&  subPanelContext.selectionData.selected.length > 0 ) {
        selectedObjectUid = subPanelContext.selectionData.selected[0].uid;
    }else if(  subPanelContext.occContext && subPanelContext.occContext.selectedModelObjects &&  subPanelContext.occContext.selectedModelObjects.length > 0 ) {
        selectedObjectUid = subPanelContext.occContext.selectedModelObjects[0].uid;
    }

    let searchScopeUid = '';
    if( searchScope.dbValue && selectedObjectUid ) {
        searchScopeUid = selectedObjectUid;
    }

    // Update Advanced  search criteria
    advancedAdditionalCriteria.searchContext = searchContext;
    advancedAdditionalCriteria.includeConnections = includeConnections;
    advancedAdditionalCriteria.useAlternateConfig = 'true';
    advancedAdditionalCriteria.productContextsToBeExcludedFromSearch = productContextsToBeExcludedFromSearch;
    advancedAdditionalCriteria.searchScope =  searchScopeUid;
    advancedAdditionalCriteria.productContextUids = productContextUids;
    advancedAdditionalCriteria.selectedLine = selectedObjectUid;

    // Update Keyword  search criteria
    keywordAdditionalCriteria.searchContext = searchContext;
    keywordAdditionalCriteria.savedQueryUID = '';
    keywordAdditionalCriteria.includeConnections = includeConnections;
    keywordAdditionalCriteria.useAlternateConfig = 'true';
    keywordAdditionalCriteria.productContextsToBeExcludedFromSearch = productContextsToBeExcludedFromSearch;
    keywordAdditionalCriteria.searchScope =  searchScopeUid;
    keywordAdditionalCriteria.productContextUids = productContextUids;
    keywordAdditionalCriteria.selectedLine = selectedObjectUid;

    //Update property policy
    let aceSearchPolicyOverride;
    if ( subPanelContext.pageContext && subPanelContext.pageContext.secondaryActiveTabId &&
        subPanelContext.pageContext.secondaryActiveTabId !== 'Awv0StructureViewerPageContainer' ) {
        aceSearchPolicyOverride =  { types: appCtxSvc.ctx.aceSearchPolicyOverride.types, override: true };
    }


    // Update search state
    let searchStateForAdvancedUpdater = data.updateAtomicData.searchStateForAdvanced;
    let searchStateForKeywordUpdater = data.updateAtomicData.searchStateForKeyword;
    searchStateForAdvancedUpdater( { ...searchStateForAdvanced, hideFilters: hideFilters, policy: aceSearchPolicyOverride, additionalCriteria: advancedAdditionalCriteria } );
    searchStateForKeywordUpdater( { ...searchStateForKeyword, hideFilters: hideFilters, policy: aceSearchPolicyOverride, additionalCriteria: keywordAdditionalCriteria
    } );

    shouldShowFindWithin( data, subPanelContext );
    updateSearchScopeLabel( data,  subPanelContext );
};


export let updateSearchScopeOnSearchState = function( searchStateForAdvanced, searchStateForKeyword, searchStateUpdater, subPanelContext, searchScope ) {
    let selectedObjectUid;
    if(  subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 ) {
        selectedObjectUid  = subPanelContext.selectionData.selected[ 0 ].uid;
    }else if ( subPanelContext.occContext && subPanelContext.occContext.selectedModelObjects && subPanelContext.occContext.selectedModelObjects.length > 0 ) {
        selectedObjectUid  = subPanelContext.occContext.selectedModelObjects[ 0 ].uid;
    }

    let advancedAdditionalCriteria =  searchStateForAdvanced.additionalCriteria;
    let keywordAdditionalCriteria =  searchStateForKeyword.additionalCriteria;
    if( searchScope.dbValue ) {
        advancedAdditionalCriteria.searchScope = selectedObjectUid;
        keywordAdditionalCriteria.searchScope = selectedObjectUid;
    }else{
        advancedAdditionalCriteria.searchScope = '';
        keywordAdditionalCriteria.searchScope = '';
    }
    let searchStateForAdvancedUpdater = searchStateUpdater.searchStateForAdvanced;
    let searchStateForKeywordUpdater = searchStateUpdater.searchStateForKeyword;
    searchStateForAdvancedUpdater( { ...searchStateForAdvanced, additionalCriteria: advancedAdditionalCriteria } );
    searchStateForKeywordUpdater( { ...searchStateForKeyword, additionalCriteria: keywordAdditionalCriteria } );
};

var isSearchResultSelectionSameAsPWA = function( searchResultSelection, pwaSelection ) {
    var isSelectionSame = true;
    if( searchResultSelection && pwaSelection ) {
        if ( searchResultSelection.length !== pwaSelection.length ) {
            isSelectionSame = false;
        }else {
            _.forEach( searchResultSelection, function( searchObj ) {
                var pwaSelectedObject = _.find( pwaSelection, function( pwaObj ) {
                    if( pwaObj.uid === searchObj.uid ) {
                        return pwaObj;
                    }
                } );
                if( !pwaSelectedObject ) {
                    isSelectionSame = false;
                }
            } );
        }
    }else if( searchResultSelection && !pwaSelection ||  !searchResultSelection && pwaSelection ) {
        isSelectionSame = false;
    }

    return isSelectionSame;
};

export let synchronizeFindSelectionWithPWA = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext )  ||
     !( data.searchStateForAdvanced.savedQuery || data.searchStateForKeyword.criteria && data.searchStateForKeyword.criteria.searchString ) ) {
        _syncingPWASelectionsWithFind = false;
        return;
    }

    let searchResultSelection = data.selectionData.selected ? data.selectionData.selected : null;
    let occContextValue = subPanelContext.occContext.getValue();
    let pwaSelection = occContextValue.selectedModelObjects;
    const dp = data.selectionModels.findSelectionModel.getDpListener();
    let totalLoadedObj = dp.vmCollectionObj.vmCollection.totalObjectsLoaded;

    if( searchResultSelection && searchResultSelection.length > 0 && !isSearchResultSelectionSameAsPWA( searchResultSelection, pwaSelection ) && !_syncingPWASelectionsWithFind ) {
        _syncingFindSelectionsWithPWA = true;
        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', { elementsToSelect: searchResultSelection, overwriteSelections: true }, subPanelContext.occContext );
    }else if ( searchResultSelection === null || searchResultSelection.length === 0 && totalLoadedObj > 0 && !_syncingPWASelectionsWithFind  ) {
        // Remove circular update of selections
        // Find panel selection was removed as the PWA selected object is not present in search results
        // Skip setting PWA selection to null.
        // Flag _syncingPWASelectionsWithFind indicates the find panel selection updated happened
        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', { elementsToSelect: [], overwriteSelections: true }, subPanelContext.occContext );
    }
    if( _syncingPWASelectionsWithFind ) {
        _syncingPWASelectionsWithFind = false;
    }
};

export let synchronizePWASelectionWithSearchResults = function( data, subPanelContext ) {
    if( _syncingFindSelectionsWithPWA ) {
        // Remove circular update of selections
        // Selection was triggered from find panel to update PWA selection, skip reacting to PWA selection change
        _syncingFindSelectionsWithPWA = false;
        return;
    }
    let isCompareMode =  subPanelContext.compareContext && subPanelContext.compareContext.isInCompareMode;
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext ) && !isCompareMode ) {
        _syncingPWASelectionsWithFind = false;
        return;
    }
    if( _syncingPWASelectionsWithFind ) {
        _syncingPWASelectionsWithFind = false;
    }

    let occContextValue = subPanelContext.occContext.getValue();
    let pwaSelection = occContextValue.selectedModelObjects ? occContextValue.selectedModelObjects : [];
    const dp = data.selectionModels.findSelectionModel.getDpListener();
    let totalLoadedObj = 0;
    if( dp && dp.vmCollectionObj && dp.vmCollectionObj.vmCollection ) {
        totalLoadedObj = dp.vmCollectionObj.vmCollection.totalObjectsLoaded;
    }
    // Skip setting selections if no results in find panel
    if( pwaSelection && pwaSelection.length > 0 && totalLoadedObj > 0 ) {
        // Skip setting selections if find panel selection matches PWA selection
        let searchResultSelection = data.selectionData.selected ? data.selectionData.selected : null;
        if( !isSearchResultSelectionSameAsPWA( searchResultSelection, pwaSelection ) ) {
            _syncingPWASelectionsWithFind = true;
            selectionModelFactory.setSelection( data.selectionModels.findSelectionModel, pwaSelection );
        }
    }
};

export let updateCommandVisibilityOnSearchExecution = function( data ) {
    // Reset search scope value
    data.dispatch( { path: 'data.searchScope.dbValue', value: false } );

    let searchStateForKeyword = data.searchStateForKeyword;
    let searchStateForAdvanced = data.searchStateForAdvanced;
    let hideFilters = true;
    if( data.subPanelContext.occContext.supportedFeatures.Awb0EnableFilterInFullTextSearchFeature ||
        data.subPanelContext.occContext.supportedFeaturesInWC && data.subPanelContext.occContext.supportedFeaturesInWC.Awb0EnableFilterInFullTextSearchFeature ||
       data.subPanelContext.occContext.supportedFeatures.Awb0UnifiedFindInStructure ) {
        hideFilters = false;
    }
    if( searchStateForKeyword ) {
        let keywordAdditionalCriteria = searchStateForKeyword.additionalCriteria;
        keywordAdditionalCriteria.searchScope = '';
        let searchStateForKeywordUpdater = data.updateAtomicData.searchStateForKeyword;
        if( searchStateForKeyword.criteria && searchStateForKeyword.criteria.searchString ) {
            // Update Show Results Only and Show Latest command visibility
            if( keywordAdditionalCriteria.useAlternateConfig && keywordAdditionalCriteria.useAlternateConfig === 'true' ) {
                // Case: Viewing indexed search results
                searchStateForKeywordUpdater( { ...searchStateForKeyword,
                    hideFilters: hideFilters, showLiveSearchResultCommand: true, searchScope: '', additionalCriteria: keywordAdditionalCriteria } );
            } else if( keywordAdditionalCriteria.useAlternateConfig && keywordAdditionalCriteria.useAlternateConfig === 'false' ) {
                // Case: Viewing non-indexed search results
                keywordAdditionalCriteria.useAlternateConfig = 'true';
                searchStateForKeywordUpdater( { ...searchStateForKeyword, hideFilters: true,
                    showLiveSearchResultCommand: false, additionalCriteria: keywordAdditionalCriteria } );
            }
        }else{
            searchStateForKeywordUpdater( { ...searchStateForKeyword, hideFilters: hideFilters, showLiveSearchResultCommand: false, additionalCriteria: keywordAdditionalCriteria } );
        }
    }
    if( searchStateForAdvanced && searchStateForAdvanced.additionalCriteria && searchStateForAdvanced.additionalCriteria.searchScope ) {
        let advancedAdditionalCriteria = searchStateForAdvanced.additionalCriteria;
        advancedAdditionalCriteria.searchScope = '';
        let searchStateForAdvancedUpdater = data.updateAtomicData.searchStateForAdvanced;
        searchStateForAdvancedUpdater( { ...searchStateForAdvanced, additionalCriteria: advancedAdditionalCriteria } );
    }
};


export let resetPanel = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext ) ) {
        return;
    }
    if( data && ( data.searchStateForAdvanced.savedQuery || data.searchStateForKeyword.criteria && data.searchStateForKeyword.criteria.searchString )  ) {
        let keywordSearchStateValue = { ...data.searchStateForKeyword };
        if( keywordSearchStateValue.criteria && keywordSearchStateValue.criteria.searchString ) {
            let newResetSearchState = keywordSearchStateValue.resetSearchState ? keywordSearchStateValue.resetSearchState : 0;
            newResetSearchState += 1;
            let searchStateForKeywordUpdater = data.updateAtomicData.searchStateForKeyword;
            searchStateForKeywordUpdater( { ...keywordSearchStateValue, resetSearchState: newResetSearchState } );
        }

        let advancedSearchStateValue = { ...data.searchStateForAdvanced };
        if( advancedSearchStateValue.savedQuery ) {
            let newAdvancedResetSearchState = advancedSearchStateValue.resetSearchState ? advancedSearchStateValue.resetSearchState : 0;
            newAdvancedResetSearchState += 1;
            let searchStateForAdvancedUpdater = data.updateAtomicData.searchStateForAdvanced;
            searchStateForAdvancedUpdater( { ...advancedSearchStateValue, resetSearchState: newAdvancedResetSearchState } );
        }
    }
    updateAdditionalSearchCriteria( data, subPanelContext, data.searchScope );
};

export let updatePropertyPolicyOnSearchState = function( data, subPanelContext ) {
    if( !isUpdatedContextSameAsPanelContext( data, subPanelContext ) ) {
        return;
    }
    let searchStateForAdvanced = data.searchStateForAdvanced;
    let searchStateForKeyword = data.searchStateForKeyword;

    let aceSearchPolicyOverride;
    if ( subPanelContext.pageContext && subPanelContext.pageContext.secondaryActiveTabId && subPanelContext.pageContext.secondaryActiveTabId !== 'Awv0StructureViewerPageContainer' ) {
        aceSearchPolicyOverride =  { types: appCtxSvc.ctx.aceSearchPolicyOverride.types, override: true };
    }

    // Update search state
    let searchStateForAdvancedUpdater = data.updateAtomicData.searchStateForAdvanced;
    let searchStateForKeywordUpdater = data.updateAtomicData.searchStateForKeyword;
    searchStateForAdvancedUpdater( { ...searchStateForAdvanced, policy: aceSearchPolicyOverride } );
    searchStateForKeywordUpdater( { ...searchStateForKeyword, policy: aceSearchPolicyOverride } );
};

/**
  * navigateSearchService service utility
  */

export default exports = {
    subscribeToProductContextChangeEvent,
    redirectCommandEvent,
    getLiveSearchResult,
    parseExpression,
    getIndexOffProductListInLocalStorage,
    getProductContextUids,
    updateSearchScopeLabel,
    moveUpDown,
    toggleSelectAllResults,
    updateAdditionalSearchCriteria,
    updateSearchScopeOnSearchState,
    synchronizeFindSelectionWithPWA,
    synchronizePWASelectionWithSearchResults,
    updateCommandVisibilityOnSearchExecution,
    resetPanel,
    updatePropertyPolicyOnSearchState
};
