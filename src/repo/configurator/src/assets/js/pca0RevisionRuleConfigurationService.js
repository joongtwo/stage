// Copyright (c) 2022 Siemens

/**
 * @module js/pca0RevisionRuleConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import pca0ContextManagementService from 'js/pca0ContextManagementService';
import pca0FscRevisionRuleConfigurationService from 'js/pca0FscRevisionRuleConfigurationService';
import pca0RevisionRuleProviderForSearchPanelService from 'js/pca0RevisionRuleProviderForSearchPanelService';
import popupService from 'js/popupService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';
import { filter } from 'd3';

/**
 * Internal Props
 * This is because VM data is disposed when popup widget is closed
 */

// * Map of Revision Rules is cached to internal list rather than VM data
var _pcaRevisionRulesMap = {};

var exports = {};

/**
 * Close popup
 * @param {Object} viewModel - vm model of the RevisionRule popup widget
 */
let _closePopup = ( viewModel ) => {
    popupService.hide( viewModel._internal.popupId );
};

/**
 * Filters the recipe objects based on the property value match
 *
 * @param {Array} viewModelObjs - list of view model objects
 * @param {String} filter - filter text
 * @return {Array} filtered list of view model objects
 */
var _getFilteredList = function( viewModelObjs, filter ) {
    var filteredRevRules = [];
    var filterText;

    if( !_.isEmpty( filter ) ) {
        filterText = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );
    }
    _.forEach( viewModelObjs, function( viewModelObj ) {
        if( filterText ) {
            var displayValue = viewModelObj.props.object_string.dbValues[ 0 ];
            var tmpDispValue = displayValue.toLocaleLowerCase().replace( /\\|\s/g, '' );
            if( tmpDispValue.indexOf( filterText ) > -1 ) {
                // Filter matches a property, add revRule to output elementList and go to next node
                filteredRevRules.push( viewModelObj );
            }
        } else {
            // No filter, just add the revRule to output elementList
            filteredRevRules.push( viewModelObj );
        }
    } );
    return {
        revisionRules: filteredRevRules,
        totalFound: filteredRevRules.length
    };
};

/**
 * Initialize View Configuration Data
 * @param {Object} subPanelContextInfo - The view model object information from calling View
 * @return {object} contextKey, isRevRuleFeatureReadOnly, isRevRuleActionDefaultBehavior
 */
export let initViewDataSettings = function( subPanelContextInfo ) {
    let contextKey = subPanelContextInfo.contextKey;
    let isRevRuleFeatureReadOnly = subPanelContextInfo.isConfigurationReadOnly;
    let isRevRuleActionDefaultBehavior = subPanelContextInfo.isRevRuleActionDefaultBehavior;
    let currentRevisionRule = subPanelContextInfo.currentRevisionRule;

    // Custom behavior for Full Screen Configuration if currentRevisionRule is not initialized
    if( !subPanelContextInfo.isRevRuleActionDefaultBehavior.dbValue /* Custom Behavior */ &&
        contextKey === Pca0Constants.FSC_CONTEXT /* Full Screen Configuration */ &&
        ( _.isUndefined( currentRevisionRule ) || currentRevisionRule === '' ) /* Widget not initialized */ ) {
        currentRevisionRule = configuratorUtils.initCurrentRevisionRuleFromSettingsForFSC();
    }
    return { contextKey, isRevRuleFeatureReadOnly, isRevRuleActionDefaultBehavior, currentRevisionRule };
};

/**
 * Handle post-selection change: set Current VM Revision Rule Property
 * Initialize internal data
 * @param {String} eventData - The applied Revision Rule ID
 * @return {Object} currentRevisionRule
 */
export let handlePostUpdateRevisionRule = function( eventData ) {
    let selectedRevisionRule = eventData;
    if( !_.isUndefined( eventData.appliedRevisionRule ) ) {
        selectedRevisionRule = eventData.appliedRevisionRule;
    }
    let currentRevisionRule = uwPropertyService.createViewModelProperty( selectedRevisionRule.dbValues[ 0 ],
        selectedRevisionRule.uiValues[ 0 ], 'STRING', selectedRevisionRule.dbValues[ 0 ], selectedRevisionRule.uiValues );
    currentRevisionRule.isEditable = true;
    return { currentRevisionRule };
};

/**
 * Initialize popup view model properties based on context
 * Save ID for last revRule selected to keep track and avoid unnecessary SOA calls.
 * @param {Object} subPanelContext - subPanelContext
 * @return {object} contextKey, isRevRuleFeatureReadOnly, isRevRuleActionDefaultBehavior
 *
 */
export let initializePopupData = function( subPanelContext ) {
    let contextKey = subPanelContext.contextKey;
    let isRevRuleActionDefaultBehavior = subPanelContext.isRevRuleActionDefaultBehavior;

    var context = appCtxSvc.getCtx( contextKey );
    context.mselected = appCtxSvc.ctx.mselected;
    let isRevRuleDataCached = {
        dbValue: pca0CommonUtils.getRevRuleCacheStatusForContext( contextKey )
    };
    return { isRevRuleActionDefaultBehavior, isRevRuleDataCached };
};

/**
 * Set mselected on global appCtx based on selection information on context
 * @param {Object} subPanelContext subPanel context
 */
export let resetContentSelectionInfo = function( subPanelContext ) {
    if( !_.isUndefined( subPanelContext ) ) {
        let context = appCtxSvc.getCtx( subPanelContext.contextKey );
        appCtxSvc.updatePartialCtx( 'ctx.mselected', context.mselected );
        delete context.mselected;
    }
};

/**
 * Call Platform SOA to get applicable Revision Rules for FSC context
 * Process Revision Rules and save data to internal map.
 * @param {String} contextKey - The Context Key
 * @param {UwDataProvider} dataProvider - The DataProvider of the Revision Rule popup widget
 * @return {Object} Promise - list of Revision Rules from platform
 */
export let loadRevisionRules = function( contextKey, dataProvider ) {
    return soaSvc.postUnchecked(
        'Internal-Configurator-2015-10-ConfiguratorManagement',
        'getRevRulesForConfiguratorContext', {} ).then( soaResponse => {
            // Clear DataProvider cache
            dataProvider.viewModelCollection.clear();
            dataProvider.selectedObjects = [];

            let revRuleMap = pca0CommonUtils.postProcessGetRevisionRulesFromPlatform( soaResponse );
            _pcaRevisionRulesMap = { ...revRuleMap };

            // Update context
            var context = appCtxSvc.getCtx( contextKey );
            switch ( contextKey ) {
                case Pca0Constants.FSC_CONTEXT:
                    if( context.isSearchContext ) {
                        context.isSearchPanelRevRuleDataCached = true;
                    } else {
                        context.isSettingsPanelRevRuleDataCached = true;
                    }
                    break;
                default:
                    context.isRevRuleDataCached = true;
            }
            appCtxSvc.updateCtx( contextKey, context );

            return AwPromiseService.instance.resolve( {
                revisionRules: Object.values( _pcaRevisionRulesMap ),
                totalFound: _.size( _pcaRevisionRulesMap ),
                isRevRuleDataCached: true
            } );
        },
        error => { throw soaSvc.createError( error ); } );
};

/**
 * Get list of Revision Rules from Cached Map if data is cached and no filter is active
 * @return {Object} Revision Rules List with VM Entries to feed data provider
 * @return {Array} list of Revision Rules from cache
 */
export let getCachedRevisionRules = function() {
    var allRevisionRules = [];
    for( var revRuleUID in _pcaRevisionRulesMap ) {
        allRevisionRules.push( _pcaRevisionRulesMap[ revRuleUID ] );
    }
    return {
        revisionRules: allRevisionRules,
        totalFound: allRevisionRules.length
    };
};

/**
 * Filter list of Revision Rules based on input search string if data is cached
 * @param {Object} filterString - the filter string
 * @return {Array} list of filtered Revision Rules from cache
 */
export let getFilteredRevisionRules = function( filterString ) {
    var allRevisionRules = [];

    if( _.isEmpty( _pcaRevisionRulesMap ) ) {
        return {
            revisionRules: [],
            totalFound: 0
        };
    }
    for( var revRuleUID in _pcaRevisionRulesMap ) {
        allRevisionRules.push( _pcaRevisionRulesMap[ revRuleUID ] );
    }
    return _getFilteredList( allRevisionRules, filterString );
};

/**
 * Updates the selection on the drop down list based on current value in context
 * Dropdown is opened and list of MOs is updated
 * @param {String} contextKey - The SubPanel Context Key
 * @param {UwDataProvider} dataProvider - RevisionRule data provider
 * @return {Boolean} true/false if an item in the dropdown was selected while loading
 */
export let performSelectRevisionRuleInDropDown = function( contextKey, dataProvider ) {
    let itemSelectedOnLoad = false;
    // Execute Select operation
    var context = appCtxSvc.getCtx( contextKey );
    switch ( contextKey ) {
        case Pca0Constants.FSC_CONTEXT:
            if( context.isSearchContext ) {
                itemSelectedOnLoad = pca0RevisionRuleProviderForSearchPanelService.selectRevisionRule( dataProvider );
            } else {
                itemSelectedOnLoad = pca0FscRevisionRuleConfigurationService.selectRevisionRule( dataProvider );
            }
            break;
        default:
            // Default behavior
            itemSelectedOnLoad = exports.selectRevisionRule( contextKey, dataProvider );
            break;
    }
    return itemSelectedOnLoad;
};

/**
 * Updates the selection on the drop down list based on current value in context
 * Dropdown is opened and list of MOs is updated
 * @param {String} contextKey - The SubPanel Context Key
 * @param {UwDataProvider} dataProvider - RevisionRule data provider
 * @return {Boolean} true/false if an item in the dropdown was selected while loading
 */
export let selectRevisionRule = function( contextKey, dataProvider ) {
    let itemSelectedOnLoad = false;
    if( !_.isEmpty( dataProvider.viewModelCollection.loadedVMObjects ) ) {
        var context = appCtxSvc.getCtx( contextKey );
        var currentRevRule;

        // SOA getRevRulesForConfiguratorContext returns persistent UIDs
        // SOAs setProperties/getVariantExpressionData instead return transient UIDs
        // We cannot match between what's active and what's selected
        // so we save last selected revRule uid persistent as a workaround
        // (avoiding unnecessary SOA calls, which works though only once setProperties has been called for the first time)
        if( context.lastSelectedRevisionRuleUid ) {
            currentRevRule = context.lastSelectedRevisionRuleUid;
        } else {
            var revRuleOnContext = context.appliedSettings.configSettings.props.pca0RevisionRule;
            currentRevRule = revRuleOnContext.dbValues[ 0 ];
        }
        itemSelectedOnLoad = pca0CommonUtils.selectRevisionRuleInDropdown( dataProvider, currentRevRule );
    }
    return itemSelectedOnLoad;
};

/**
 * Perform Update revision rule on selection change in dropdown - based on active context
 * This method is called also when loading dropdown and current revision rule is programmatically selected
 * @param {String} contextKey - The SubPanel Context Key
 * @param {Object} viewModel - vm model of the RevisionRule popup widget
 * @returns {Boolean} flag reset
 */
export let performUpdateRevisionRule = function( contextKey, viewModel ) {
    var context = appCtxSvc.getCtx( contextKey );
    let eventData = pca0CommonUtils.getEventDataFromEventMap( viewModel.eventMap, 'revisionRulesDataProvider.selectionChangeEvent' );
    if( eventData.selectedObjects.length > 0 && !viewModel.data.itemSelectedOnLoad ) {
        // Execute Update operation
        switch ( contextKey ) {
            case Pca0Constants.FSC_CONTEXT:
                if( context.isSearchContext ) {
                    pca0RevisionRuleProviderForSearchPanelService.updateRevisionRule( eventData );
                } else {
                    pca0FscRevisionRuleConfigurationService.updateRevisionRule( eventData );
                }
                break;
            default:
                // Default behavior
                exports.updateRevisionRule( contextKey, eventData );
                break;
        }
        _closePopup( viewModel );
    }

    // Reset flag for RevisionRule selected on widget
    return false;
};

/**
 * Perform Upate action for RevisionRule change in default behavior
 * @param {String} contextKey the Context Key
 * @param {Object} eventData - Event Data Info Container
 * @returns {Promise} promise
 */
export let updateRevisionRule = ( contextKey, eventData ) => {
    var context = appCtxSvc.getCtx( contextKey );
    // Variability Explorer scenario - "Variants" tab
    if( context.disableRevRuleOnConfigPerspective ) {
        // Notify Tabs of update pending on Revision Rule
        pca0ContextManagementService.notifyTabsToUpdateRevisionRule( eventData.selectedObjects );
        return;
    }

    // if <context.lastSelectedRevisionRuleUid> is not defined, we take selected revRule and update
    // if defined, before updating we check if same revision rule is selected
    if( _.isUndefined( context.lastSelectedRevisionRuleUid ) ||
        context.lastSelectedRevisionRuleUid !== eventData.selectedObjects[ 0 ].uid ) {
        return pca0CommonUtils.updateRevisionRuleOnPerspective( contextKey, eventData.selectedObjects[ 0 ].uid )
            .catch( err => {
                messagingService.showError( String( err ) );
            } );
    }
};

/**
 * Toggle Revision Rule Link State
 * @param {Boolean} isDisableRevisionRuleLink     true/false if Revision Rule link state to be disabled
 * @returns {Object} {true/false} for readOnly props of RevisionRule feature
 */
export let toggleRevisionRuleLinkState = function( isDisableRevisionRuleLink ) {
    let isRevRuleFeatureReadOnly = {};
    isRevRuleFeatureReadOnly.dbValue = isDisableRevisionRuleLink;
    return { isRevRuleFeatureReadOnly };
};

/**
 * Revision Rule Configuration service utility
 * @return {Object} exports
 */
export default exports = {
    initViewDataSettings,
    handlePostUpdateRevisionRule,
    initializePopupData,
    resetContentSelectionInfo,
    loadRevisionRules,
    getCachedRevisionRules,
    getFilteredRevisionRules,
    performSelectRevisionRuleInDropDown,
    selectRevisionRule,
    performUpdateRevisionRule,
    updateRevisionRule,
    toggleRevisionRuleLinkState
};
