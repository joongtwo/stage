// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0LoadSavedVariants View
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pca0LoadSavedVariantsService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import cmdPanelSvc from 'js/commandPanel.service';
import commonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/Pca0ExpressionGridService';
import messagingService from 'js/messagingService';
import Pca0Constants from 'js/Pca0Constants';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

// Register the policy before SOA call
var registerPolicy = function() {
    return policySvc.register( {
        types: [ {
            name: 'Cfg0ProductModel',
            properties: [ {
                name: 'object_name',
                count: 0
            },
            {
                name: 'object_desc',
                count: 0
            }
            ]
        } ]

    } );
};

/**
 * @param {Object} fscState - The fsc State object
 * Method to get the changed search criteria object
 * @param {Object} data - data object
 * @param {String} searchKey - the search criteria
 * @returns {Object} - searchCriteriaLink object
 */
var getSearchCriteriaLink = function( data, searchKey ) {
    var propertyDisplayName = configuratorUtils.getFscLocaleTextBundle()[ searchKey.toLowerCase() ];
    var searchCriteriaLink = data.searchCriteriaLink;
    uwPropertyService.updateModelData( searchCriteriaLink, searchKey, [ propertyDisplayName ], false, true, true, {} );

    searchCriteriaLink.propertyDisplayName = propertyDisplayName;

    return searchCriteriaLink;
};

var exports = {};

/**
 * This API processes the server response and constructs the client data model
 *
 * @param {Object} dp - The data provider object
 * @returns {Number} - Returns the start index for data provider
 */
export let evaluateStartIndexForVariantRuleDataProvider = function( dp ) {
    if( dp.startIndex === 0 ) {
        return 0;
    }
    return dp.viewModelCollection.loadedVMObjects.length;
};

/**
 * This API updates the fscContext
 * It updates lists of currently applied VRs
 * It triggers fetching of Active Settings (filter criteria and profile settings) in case of single loaded SVR in List mode
 * It triggers fetching of variant rule selections in the variant configuration tab
 * Event is called when a SVR is loaded from side panel "Load Saved Variants" or
 * when a change (single selection) in applied SVR happens in Variant header/side-panel configurator
 * @param {Object} selectedVariants - The selected saved variants
 * @param {Object} fscState - The fscState object
 * @param {Object} variantRuleData - The variantRuleData object
 * @param {Boolean} appendSVRElement - optional, used for tree view append
 */
export let loadSavedVariants = function( selectedVariants, fscState, variantRuleData, appendSVRElement ) {
    // the change in fscContext.initialVariantRule is observed by the scopes which then triggers the soa call to update the loaded svr
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( selectedVariants.length === 1 ) {
        fscContext.initialVariantRule = selectedVariants[ 0 ];
    } else {
        delete fscContext.initialVariantRule;
    }

    //since it may come either from fsc directly or via command, take care of both cases
    let newFscState = fscState.value ? { ...fscState.value } : { ...fscState.getAtomicData() };
    newFscState.variantRuleDirty = false;
    newFscState.isManualConfiguration = configuratorUtils.isPlatformVersionAtleast124();
    fscState.update ? fscState.update( newFscState ) : fscState.setAtomicData( newFscState );

    let newVariantRuleData = variantRuleData.value ? { ...variantRuleData.value } : { ...variantRuleData.getAtomicData() };

    delete fscContext.payloadStrings;
    delete fscContext.selectedExpressions;

    // GuidedMode and ManualConfiguration will be updated when preparing the input for Load SVR
    // for platform >12.4 default load mode is manual
    fscContext.guidedMode = !configuratorUtils.isPlatformVersionAtleast124();

    if( newFscState.treeDisplayMode ) {
        if( appendSVRElement ) {
            //adjust the variantRulesToLoad for re-appended ones
            var trimmedVariantRulesToLoad = _.uniqBy( [ ...newVariantRuleData.variantRulesToLoad, ...selectedVariants ], 'uid' );
            newVariantRuleData.variantRulesToLoad = trimmedVariantRulesToLoad;
        } else {
            newVariantRuleData.variantRulesToLoad = selectedVariants;
        }

        // If loading Single VR, fetch active settings
        // Otherwise, fire event to append or reload the SVRs
        if( newVariantRuleData.variantRulesToLoad.length === 1 ) {
            newVariantRuleData.useDefaultConfigPerspective = false;
        } else {
            newVariantRuleData.useDefaultConfigPerspective = true;
        }
    } else {
        //setting the treeMode on fsc has been removed, doen now via flag on data
        if( [ ...selectedVariants ].length > 1 ) {
            newVariantRuleData.useDefaultConfigPerspective = true;
        } else {
            // As only single variant rule is to be loaded, land back to 1st scope
            // Set the scope to first group, so that SOA call is made with scope as 1st group
            eventBus.publish( 'Pca0Scopes.setScopeToFirstGroup' );
            newVariantRuleData.useDefaultConfigPerspective = false;
        }
        newVariantRuleData.variantRulesToLoad = [ ...selectedVariants ];
    }

    // Delete currentScope: this will force to load SVR Configuration Data and 1st scope information
    delete fscContext.currentScope;

    // Delete lastAppliedRevisionRuleUid when new SVR(s) is being loaded
    delete fscContext.lastAppliedRevisionRuleUid;

    delete fscContext.appliedSettings;

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    variantRuleData.update ? variantRuleData.update( newVariantRuleData ) : variantRuleData.setAtomicData( newVariantRuleData );
};

/**
 * This API processes loaded (applied) SVRs and performs synchronization into FSC
 * In case of no single selection (no SVRs are loaded OR multiple SVRs are loaded), no variant rule should be applied into FSC
 * @param {Object} fscState atomic data
 * */
export let handleSVRChange = function( fscState, variantRuleData ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    var selectedVariants;

    if( fscContext.currentAppliedVRs && !_.isUndefined( fscContext.currentAppliedVRs[ 0 ] ) && fscContext.currentAppliedVRs.length === 1 ) {
        if( !fscContext.initialVariantRule || fscContext.currentAppliedVRs[ 0 ] !== fscContext.initialVariantRule.uid ) {
            selectedVariants = viewModelObjectService.createViewModelObject( fscContext.currentAppliedVRs[ 0 ] );
            exports.loadSavedVariants( [ selectedVariants ], fscState, variantRuleData );
        }
    } else {
        // Force unloading of any variant rule from FSC
        eventBus.publish( 'Pca0LoadSavedVariants.unloadSVR' ); //this is the main path of unloading svr, do not call it directly
    }
};

/**
 * Unload SVR - triggered from ListView
 * This API removes requested variant rule from fscContext
 * It updates lists of currently applied VRs
 * It triggers fetching of Active Settings (filter criteria and profile settings) in List mode
 * It fires event to reload the variant configuration tab
 * @param {Object} scopeSelection atomic data
 * @param {Object} fscState atomic data
 * @param {Object} variantRuleData atomic data
 */
export let handleSVRUnload = function( scopeSelection, fscState, variantRuleData ) {
    var fscContext = { ...appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT ) };
    var isOldPlat = !configuratorUtils.isPlatformVersionAtleast124();
    if( isOldPlat ) {
        fscContext.guidedMode = true;
    }
    if( fscState && fscState.getAtomicData() ) {
        var newFscState = { ...fscState.getAtomicData() };
        newFscState.isManualConfiguration = isOldPlat ? false : newFscState.isManualConfiguration;
        newFscState.variantRuleDirty = false;
        fscState.setAtomicData( newFscState );
    }

    if( variantRuleData && variantRuleData.getAtomicData() ) {
        var newVariantRuleData = { ...variantRuleData.getAtomicData() };
        newVariantRuleData.variantRulesToLoad = [];
        newVariantRuleData.useDefaultConfigPerspective = true;
        if( newVariantRuleData.defaultConfigPerspective.uid === undefined ) {
            // Delete current Active Settings (filter criteria and profile settings) information
            delete fscContext.appliedSettings;
        } else {
            //if we switch to using the default perspective if there are no applied settings, make sure to re-apply them
            fscContext.appliedSettings = fscContext.defaultAppliedSettings;
        }
        variantRuleData.setAtomicData( newVariantRuleData );
    }
    [ 'initialVariantRule',
        'payloadStrings',
        'selectedExpressions',
        'allSelectionsExt',
        'configPerspective'
    ].forEach( function( prop ) {
        delete fscContext[ prop ];
    } );

    if( scopeSelection !== undefined && scopeSelection.getAtomicData() !== undefined ) {
        var newScopeSelection = { ...scopeSelection.getAtomicData() };
        newScopeSelection.currentScopeSelectionUid = '';
        scopeSelection.setAtomicData( newScopeSelection );
    }


    // Delete currentScope: this will force to load new Configuration Data and 1st scope information
    delete fscContext.currentScope;

    eventBus.publish( 'Pca0Scopes.setScopeToFirstGroup' );
    // Delete lastAppliedRevisionRuleUid when new SVR(s) is being loaded
    delete fscContext.lastAppliedRevisionRuleUid;
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
};

/**
 * Unload SVR - triggered from GridView
 * This API removes requested variant rule from fscContext
 * It updates lists of currently applied VRs
 * @param {Object} data - The ViewModel object
 * @param {Object} fscState - The fsc State object
 * @param {Object} variantRuleData - The variantRuleData object
 * */
export let handleUnloadSVRInGridView = function( variantRuleUID, fscState, variantRuleData ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Remove SVR from list
    //_.remove( fscContext.variantRulesToLoad, { uid: variantRuleUID } );
    if( variantRuleData && variantRuleData.getAtomicData() ) {
        var newVariantRuleData = { ...variantRuleData.getAtomicData() };
        _.remove( newVariantRuleData.variantRulesToLoad, { uid: variantRuleUID } );

        // Set initialVariantRule if SVR(s) are still loaded within configuration
        // Force List View mode otherwise
        if( newVariantRuleData.variantRulesToLoad.length > 1 ) {
            fscContext.initialVariantRule = newVariantRuleData.variantRulesToLoad[ 0 ];
            newVariantRuleData.useDefaultConfigPerspective = true;
        } else if( newVariantRuleData.variantRulesToLoad.length === 1 ) {
            fscContext.initialVariantRule = newVariantRuleData.variantRulesToLoad[ 0 ];
            newVariantRuleData.useDefaultConfigPerspective = false;
        } else {
            delete fscContext.initialVariantRule;
            newVariantRuleData.variantRulesToLoad = [];
            if( fscState && fscState.getAtomicData() ) {
                var newFscState = { ...fscState.getAtomicData() };
                newFscState.treeDisplayMode = false;
                newFscState.unloadedVariant = true;
                fscState.setAtomicData( newFscState );
                newVariantRuleData.useDefaultConfigPerspective = true;
                if( newVariantRuleData.defaultConfigPerspective.uid === undefined ) {
                    // Delete current Active Settings (filter criteria and profile settings) information
                    delete fscContext.appliedSettings;
                } else {
                    //if we switch to using the default perspective if there are no applied settings, make sure to re-apply them
                    fscContext.appliedSettings = fscContext.defaultAppliedSettings;
                }
            }
        }
        variantRuleData.setAtomicData( newVariantRuleData );
    }

    [ 'payloadStrings',
        'selectedExpressions',
        'allSelectionsExt'
    ].forEach( function( prop ) {
        delete fscContext[ prop ];
    } );

    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
};

/**
 * @param {Object} fscState atomic data
 * @param {Object} variantRuleData atomic data
 * Clear the data provider vmo
 * @param {Object} data - The VM object
 * @returns {Object} updated DataProvider and VariantRules
 */
export let clearSearchDataProvider = function( data ) {
    // If no results found, clear the data provider vmo
    let ret = { ...data };
    ret.dataProviders.getAllVariantRulesBasedOnSearchCriteria.viewModelCollection.clear();
    ret.variantRules = [];
    return {
        pdGetAllVariantRulesBasedOnSearchCriteria: ret.dataProviders.getAllVariantRulesBasedOnSearchCriteria,
        variantRules: ret.variantRules
    };
};

/**
 * Build the Result of the search
 * @param {Object} data - The VM object
 * @returns {Object} the results object
 */
export let buildSearchResults = function( data ) {
    var length = 0;
    if( data.variantRules ) {
        length = data.variantRules.length;
    }
    let resultStr = configuratorUtils.getFscLocaleTextBundle().resultsString.replace( /\{0}/g, length );
    resultStr = resultStr.replace( /\{1}/g, length );

    let activeSearchResultPropLabel = { ...data.activeSearchResultPropLabel };

    //let eventData = commonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0LoadSVRSearchInputTab.searchResultPanelActivated' );
    activeSearchResultPropLabel.propertyDisplayName = data.subPanelContext.value.searchCriteriaLink.dbValue;
    activeSearchResultPropLabel.uiValue = data.subPanelContext.value.searchCriteria.dbValue;
    return {
        resultsStringValue: resultStr,
        activeSearchResultPropLabel: activeSearchResultPropLabel,
        pdGetAllVariantRulesBasedOnSearchCriteria: data.dataProviders.getAllVariantRulesBasedOnSearchCriteria,
        variantRules: data.variantRules
    };
};

/**
 * Returns loaded variant rule from SOA response
 * @param {Object} response the response from the variant configuration view SOA
 * @returns {Object} loaded variant rules.
 */
export let getVariantRules = function( response ) {
    var vrList = [];
    var variantRules = _.get( response, 'responseInfo.variantRules', null );
    if( variantRules !== null ) {
        variantRules.forEach( function( vrUid ) {
            vrList.push( response.ServiceData.modelObjects[ vrUid ] );
        } );
    }
    return vrList;
};

/**
 * Publish the event with Active search criteria
 * @param {Object} data - The VM object
 * @returns {Object} updated active search criteria
 */
export let processSVRSearchCriteriaSelection = function( data ) {
    var searchCriteriaLink = getSearchCriteriaLink( data, data.eventData.property.staticElementObject );

    let loadVariantSearchCriteria = data.eventData.property.dbValue;
    appCtxSvc.updatePartialCtx( 'fscContext.loadVariantSearchCriteria', loadVariantSearchCriteria );
    // If the active tab is Results, force it back to Input
    if( data.selectedTab.tabKey === 'Results' ) {
        eventBus.publish( 'Pca0LoadSVRSearchTab.tabChange', {
            tabKey: 'Input'
        } );
    }

    return {
        searchCriteriaLink: searchCriteriaLink,
        activeSearchCriteria: data.eventData.property.dbValue,
        dispValueSearchCriteria: data.eventData.property.uiValue
    };
};

/**
 * Update the Active search criteria for tabs
 * And Total selected features from groups
 * @param {Object} data - The VM object
 * @returns {Object} updated Search criteria
 */
export let handleSelectionInSearchInputTab = function( data ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let totalSelection = {};
    let length = 0;

    let configMap = exprGridSvc.getConfigExpressionMap( fscContext.selectedExpressions );
    if( !_.isEmpty( configMap ) && configMap !== undefined ) {
        totalSelection = configMap;
        for( const key in totalSelection ) {
            if( totalSelection.hasOwnProperty( key ) ) {
                length += totalSelection[ key ].length;
            }
        }
    }

    let eventData = commonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0LoadSVRSearchCriteriaPanel.updateActiveSearchCriteria' );
    let modifiedData = { ...data };
    modifiedData.activeSearchCriteria = eventData.activeSearchCriteria;
    modifiedData.featurePropLabel.propertyDisplayName = configuratorUtils.getFscLocaleTextBundle().featurePropLabel.replace( '{0}', length );
    if( data.activeSearchResultPropLabel ) {
        modifiedData.activeSearchResultPropLabel.propertyDisplayName = eventData.dispValue;
    }

    var searchCriteriaLink = getSearchCriteriaLink( data, modifiedData.activeSearchCriteria.staticElementObject );
    return {
        activeSearchCriteria: modifiedData.activeSearchCriteria,
        featurePropLabel: modifiedData.featurePropLabel,
        activeSearchResultPropLabel: modifiedData.activeSearchResultPropLabel,
        searchCriteriaLink: searchCriteriaLink
    };
};

/**
 * Get all variant rules from response
 * If no variant results found then this will clear the results data provider vmo
 *@param {Object} response the response from the perform search SOA
 * @returns {Object} VariantRules
 */
export let getVariantRulesBasedOnCriteria = function( response ) {
    let vrList = [];
    if( response.searchResults !== null && response.searchResults !== undefined ) {
        response.searchResults.forEach( ( obj ) => {
            let vmoObj = viewModelObjectService.createViewModelObject( obj.uid );
            vrList.push( vmoObj );
        } );
    }
    //if no results found retund null and the dp will get cleared after
    if( !response.searchResults || !vrList ) {
        return null;
    }
    return vrList;
};

/**
 * Clearing the results panel
 * @param {Object} data - The VM object
 * @returns {Object} updated DataProvider and results
 */
export let clearResultsPanelView = function( data ) {
    let ret = { ...data };
    //clear the existed view model objects
    ret.dataProviders.getAllVariantRulesBasedOnSearchCriteria.viewModelCollection.clear();
    ret.resultsString.dbValue = null;
    ret.activeSearchResultPropLabel.propertyDisplayName = null;
    ret.activeSearchResultPropLabel.uiValue = null;
    return {
        dpGetAllVariantRulesBasedOnSearchCriteria: ret.dataProviders.getAllVariantRulesBasedOnSearchCriteria,
        resultsString: ret.resultsString,
        activeSearchResultPropLabel: ret.activeSearchResultPropLabel
    };
};

/**
 * Create and return the search criteria saved on the parent
 * @param {Object} data - The VM object
 * @returns {Object} updated revision rule and search criteria
 */
export let initFromSavedCriteria = function( data ) {
    let link = { ...data.searchCriteriaLink };

    if( _.get( data, 'subPanelContext.value.searchCriteriaLink.value' ) ) {
        var propertyDisplayName = configuratorUtils.getFscLocaleTextBundle()[ data.subPanelContext.searchCriteriaLink.value.toLowerCase() ];
        uwPropertyService.updateModelData( link, data.subPanelContext.searchCriteriaLink.value, [ propertyDisplayName ], false, true, true, {} );
        link.propertyDisplayName = propertyDisplayName;
    }
    let considerRevRuleForSearch = { ...data.considerRevRuleForSearch };
    if( _.get( data, 'subPanelContext.value.considerRevRuleForSearch' ) ) {
        considerRevRuleForSearch = data.subPanelContext.value.considerRevRuleForSearch;
    }

    let revisionRule = { ...data.currentRevisionRule };
    if( _.get( data, 'subPanelContext.value.revisionRule' ) ) {
        revisionRule = data.subPanelContext.value.revisionRule;
    }

    let featurePropLabel = { ...data.featurePropLabel };
    if( _.get( data, 'subPanelContext.value.featurePropLabel' ) ) {
        featurePropLabel.propertyDisplayName = data.subPanelContext.value.featurePropLabel;
    }

    let searchCriteria = { ...data.searchCriteria };
    if( _.get( data, 'subPanelContext.value.searchCriteria' ) ) {
        searchCriteria = data.subPanelContext.value.searchCriteria; //preserve the search criteria input between tab swaps
    }
    return {
        revisionRule: revisionRule,
        searchCriteriaLink: link,
        considerRevRuleForSearch: considerRevRuleForSearch,
        featurePropLabel: featurePropLabel,
        searchCriteria: searchCriteria
    };
};

/**
 * Create and return the search criteria input for perform search SOA
 * @param {Object} vmData - The VM object
 */
export let setSearchCriteria = function( vmData ) {
    let newSubPanelContext = { ...vmData.subPanelContext.value };
    newSubPanelContext.searchCriteria = vmData.searchCriteria;
    newSubPanelContext.searchCriteriaLink = vmData.searchCriteriaLink;
    newSubPanelContext.considerRevRuleForSearch = vmData.considerRevRuleForSearch;
    newSubPanelContext.revisionRule = vmData.currentRevisionRule.dbValue ? vmData.currentRevisionRule : '';
    newSubPanelContext.featurePropLabel = vmData.featurePropLabel.propertyDisplayName;
    if( vmData.subPanelContext.update ) {
        vmData.subPanelContext.update( newSubPanelContext );
    }
};

/**
 * Create and return the search criteria input for perform search SOA
 * @param {Object} data - The VM object
 * @returns {Object} updated revision rule and search criteria
 */
export let getSearchCriteria = function( data ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let searchCriteria = {}; //the * or search content
    let activeSearchCriteria; //the name or id or feature, comes from the link, feature is not the key to transmit though, see below
    //let eventData = commonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0LoadSVRSearchInputTab.searchResultPanelActivated' );
    if( data.subPanelContext && data.subPanelContext.value.searchCriteriaLink ) {
        activeSearchCriteria = data.subPanelContext.value.searchCriteriaLink.dbValue;
    }
    searchCriteria = data.subPanelContext.value.searchCriteria.dbValue;

    if( activeSearchCriteria === Pca0Constants.SEARCH_CRITERIA.FEATURE && fscContext.selectedExpressions ) {
        let featureSelections = {};
        featureSelections.selectedExpressions = fscContext.selectedExpressions;
        searchCriteria = JSON.stringify( featureSelections );
        activeSearchCriteria = Pca0Constants.SEARCH_CRITERIA.SELECTEDEXPRESSIONS; //for the feature the key is "selectedExpressions"
    }

    let selectedContext = configuratorUtils.getSelectionForVariantContext( Pca0Constants.FSC_CONTEXT ).uid;
    let allRevisions = !data.subPanelContext.value.considerRevRuleForSearch.dbValue;
    return {
        [ activeSearchCriteria ]: searchCriteria,
        selectedContext: selectedContext,
        allRevisions: allRevisions.toString(),
        revisionRule: fscContext.revRule
    };
};

/**
 * Get selection data from Results
 * @param {Object} eventData - The event data
 * @returns {Object} selected object
 */
export let handleResultsSelectionChange = function( eventData ) {
    let ret;
    if( eventData && eventData.selectedObjects ) {
        ret = eventData.selectedObjects;
    }
    return ret;
};

/**
 * Initialize Tabs and update context
 * @param {Array} visibleTabs the panel tabs
 * @param {Object} viewModel - The VM object
 * @returns {Object} List of visible tabs and callbackfior when user switches tab
 *  together with fields that need initialization
 */
export let handleInitializeActions = function( visibleTabs, viewModel ) {
    // Update context
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    fscContext.isSearchContext = true;
    appCtxSvc.updateCtx( 'fscContext', fscContext );

    // Load Panel tabs
    const tabChangeCallback = ( pageId, tabTitle ) => {
        //let { dispatch } = viewModel;
        let selectedTab = visibleTabs.filter( function( tab ) {
            return tab.pageId === pageId || tab.name === tabTitle;
        } )[ 0 ];

        viewModel.dispatch( { path: 'data.activeTab', value: selectedTab } );
    };

    let defaultTab = visibleTabs.filter( function( tab ) {
        return tab.selectedTab;
    } )[ 0 ];

    if( defaultTab ) {
        return {
            activeTab: defaultTab,
            visibleTabs: visibleTabs,
            api: tabChangeCallback
        };
    }

    return {
        visibleTabs: visibleTabs,
        api: tabChangeCallback
    };
};

/**
 * Programmatically switch to tab
 *
 * @param {Array} visibleTabs All visible tabs
 * @param {String} pageId Selected tab page ID to show
 * @param {String} tabKey Tab Key to show
 * @returns {Object} Active tab object
 */
export let handleTabChange = function( visibleTabs, pageId, tabKey ) {
    let selectedTab = visibleTabs.filter( function( tab ) {
        return tab.pageId === pageId || tab.tabKey === tabKey;
    } )[ 0 ];

    eventBus.publish( 'awTab.setSelected', selectedTab );

    return {
        selectedTab: selectedTab
    };
};

/**
 * Set active tab
 * @param {Object} data - The VM object
 * @returns {String} Active panel id string.
 */
export let setActiveView = function( data ) {
    return data.selectedTab.panelId;
};

/**
 * The method will pop up the show Confirmation Message For Load to let the user decide to continue or abort in case of a dirty model
 * Note: this was moved here form json and it is a workaround for the currently thrown RangeError: Maximum call stack size exceeded
 * that hinders the pop up from displaying
 */
export let showConfirmationMessageForLoad = function() {
    var msg = configuratorUtils.getFscLocaleTextBundle().loadConfirmation;
    var cancelString = configuratorUtils.getFscLocaleTextBundle().cancel;
    var proceedString = configuratorUtils.getFscLocaleTextBundle().load;
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0LoadSVRSearchTab.closeLoadSVRSearchCriteriaPanel' );
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0LoadSVRSearchTab.loadSavedVariants' );
        }
    }
    ];
    messagingService.showWarning( msg, buttons );
};
/**
 * Clean up action data for view UnMount
 * @returns {Object} searchCriteria
 */
export let cleanUp = function() {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    fscContext.revRule = '';
    delete fscContext.loadVariantSearchCriteria;
    delete fscContext.isSearchContext;
    appCtxSvc.updateCtx( 'fscContext', fscContext );

    var eventData = {
        source: 'toolAndInfoPanel'
    };
    eventBus.publish( 'complete', eventData );

    // Reset searchCriteriaLink to Name, so next time when Load Variant Tab is opened, it opens with 'Name' Search Criteria
    return { searchCriteriaLink: 'Name' };
};

export default exports = {
    evaluateStartIndexForVariantRuleDataProvider,
    loadSavedVariants,
    handleSVRChange,
    handleSVRUnload,
    handleUnloadSVRInGridView,
    clearSearchDataProvider,
    buildSearchResults,
    getVariantRules,
    processSVRSearchCriteriaSelection,
    handleSelectionInSearchInputTab,
    getVariantRulesBasedOnCriteria,
    clearResultsPanelView,
    initFromSavedCriteria,
    setSearchCriteria,
    getSearchCriteria,
    handleResultsSelectionChange,
    handleInitializeActions,
    handleTabChange,
    setActiveView,
    showConfirmationMessageForLoad,
    cleanUp
};
