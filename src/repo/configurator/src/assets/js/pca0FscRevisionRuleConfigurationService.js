// Copyright (c) 2022 Siemens

/**
 * This Service contains code specific for Revision Rule handling in Full Screen Configuration
 * All generic code applicable to any context is located in pca0RevisionRuleConfigurationService
 *
 * @module js/pca0FscRevisionRuleConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import popupService from 'js/popupService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};

/**
 * Updates the selection on the drop down list
 * NOTES:
 * - SOA getRevRulesForConfiguratorContext returns persistent UIDs
 * - VCV2 fetching filterCriteria instead returns transient UIDs
 * - We cannot have match between what's active and what's selected
 * - Solution approach: we save last selected revRule
 * - This works though only once a selection change is made by the user.
 * - Hence, the first time the drop down is loaded, no item is highlighted, unless:
 * ----- the dropdown is re-opened after an "apply settings" (because we cache the UID of last applied RevRule)
 * @param {UwDataProvider} dataProvider - RevisionRule data provider
 * @return {Boolean} true/false if an item in the dropdown was selected while loading
 */
export let selectRevisionRule = function( dataProvider ) {
    let itemSelectedOnLoad = false;
    if( !_.isEmpty( dataProvider.viewModelCollection.loadedVMObjects ) ) {
        var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
        var currentRevRule;
        if( !_.isUndefined( fscContext.lastAppliedRevisionRuleUid ) ) {
            currentRevRule = fscContext.lastAppliedRevisionRuleUid;
        }
        if( !_.isUndefined( fscContext.settingsCache.selectedRevisionRule ) ) {
            currentRevRule = fscContext.settingsCache.selectedRevisionRule.uid;
        }
        if( !_.isUndefined( currentRevRule ) ) {
            itemSelectedOnLoad = pca0CommonUtils.selectRevisionRuleInDropdown( dataProvider, currentRevRule );
        }
    }
    return itemSelectedOnLoad;
};

/**
 * Updates the selection on the context cache when user makes a selection in the widget
 * Fire event to update parent VM information on current revision Rule
 * @param {Object} eventData - Event Data Info Container
 */
export let updateRevisionRule = function( eventData ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    // In VCV, alert RevisionRule view container to update. No change is done on perspective
    // [in VCV, Settings Panel will trigger action through "Apply" command]
    var settingsCache = fscContext.settingsCache;

    // if <fscContext.selectedRevisionRule> is not defined, we take selected revRule and update
    // if defined, before updating we check if same revision rule is selected
    if( _.isUndefined( settingsCache.selectedRevisionRule ) ||
        settingsCache.selectedRevisionRule.uid !== eventData.selectedObjects[ 0 ].uid ) {
        settingsCache.selectedRevisionRule = eventData.selectedObjects[ 0 ];
        appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );

        // Update Revision Rule data on parent view
        // Fire special event for Revision Rule: this will (re)initialize internal VM data
        const revisionRuleData = {
            appliedRevisionRule: {
                dbValues: [ settingsCache.selectedRevisionRule.props.object_name.dbValues[ 0 ] ],
                uiValues: [ settingsCache.selectedRevisionRule.props.object_string.dbValues[ 0 ] ]
            },
            contextKey: Pca0Constants.FSC_CONTEXT
        };
        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContentOnFsc', revisionRuleData );
    }
};

/**
 * Set Current VM Revision Rule Property
 * Initialize internal data
 * @param {Object} revisionRule - The VM data
 * @param {String} contextKey - The source
 * @param {String} eventData - The applied Revision Rule ID
 * @return {object} currentRevisionRule
 */
export let handlePostUpdateRevisionRule = function( revisionRule, contextKey, eventData ) {
    let currentRevisionRule = { ...revisionRule };
    // check event generated by source should be same as contextKey
    if( contextKey !== eventData.contextKey ) {
        return { currentRevisionRule };
    }
    // Initialize View Model Object for Current Revision Rule
    // Properties are initialized from Context
    currentRevisionRule = uwPropertyService.createViewModelProperty( eventData.appliedRevisionRule.dbValues[ 0 ],
        eventData.appliedRevisionRule.uiValues[ 0 ], 'STRING', eventData.appliedRevisionRule.dbValues[ 0 ], eventData.appliedRevisionRule.uiValues );
    currentRevisionRule.isEditable = true;
    return { currentRevisionRule };
};

/**
 * Revision Rule for Full Screen Configuration service utility
 * @return {Object} exports
 */
export default exports = {
    selectRevisionRule,
    updateRevisionRule,
    handlePostUpdateRevisionRule
};
